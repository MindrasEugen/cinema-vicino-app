/**
 * Servizio ComingSoon.it — fonte primaria per film e cinema che li proiettano
 * (sostituisce MYmovies.it, la cui funzione di abbinamento film-cinema-orari
 * è stata rimossa dal sito — vedi NOTE.md).
 *
 * A differenza di MYmovies, ComingSoon.it non espone una singola pagina
 * "città" con già tutto incrociato: elenca i cinema per provincia
 * (`getCinemaDirectory`) e gli orari sono sulla pagina di ciascun cinema
 * (`getShowingsForCinema`). Il chiamante (useComingSoonData) fa prima il
 * matching tra i cinema vicini (Overpass) e l'elenco della provincia, poi
 * scarica gli orari solo dei cinema effettivamente vicini all'utente —
 * non di tutti quelli della provincia.
 *
 * ComingSoon.it espone `Access-Control-Allow-Origin: *` (verificato
 * 2026-08-31): a differenza di MYmovies, il fetch funziona direttamente dal
 * browser, senza bisogno di alcun proxy CORS (né in sviluppo né in
 * produzione) — vedi NOTE.md per il confronto.
 *
 * In caso di fallimento di rete/HTTP lancia ComingSoonFetchError; se la
 * pagina risponde ma la struttura non è più quella attesa lancia
 * ComingSoonStructureError. In entrambi i casi il chiamante decide se
 * passare al fallback TMDB.
 *
 * Oltre alla cache in memoria (per-tab, azzerata al refresh), i risultati
 * passano anche da una cache condivisa su Supabase (tabelle
 * `comingsoon_cinema_directory`/`comingsoon_cinema_showings`): il primo
 * utente che visita una provincia/cinema paga il fetch live, gli altri nella
 * stessa finestra di validità leggono da lì invece di rifare lo scraping.
 * Pattern read-through/write-through lato client (nessun backend dedicato):
 * ogni browser legge la cache condivisa prima del fetch live, e scrive il
 * proprio risultato dopo un fetch riuscito. Se Supabase non è configurato
 * (`supabaseClient.js` → `supabase === null`) o una chiamata fallisce, si
 * ricade silenziosamente sul fetch live: la cache condivisa è
 * un'ottimizzazione, mai un requisito per il funzionamento dell'app. Vedi
 * NOTE.md per RLS, scelta dei TTL e perché la scrittura è pubblica.
 */
import {
  parseCinemaDirectory,
  checkCinemaDirectoryStructureSanity,
  isValidCinemaPage,
  parseCinemaShowingsPage,
} from './comingsoonParser';
import { supabase } from './supabaseClient';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // qualche ora, per non ricaricare ad ogni interazione
const FETCH_TIMEOUT_MS = 12000;

// TTL della cache condivisa (Supabase), diversi da quelli della cache in
// memoria sopra: l'elenco cinema di una provincia cambia raramente (nuove
// sale aprono/chiudono di rado), la programmazione invece è specifica del
// giorno, quindi la finestra di validità condivisa resta più corta.
const SUPABASE_DIRECTORY_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 giorni
const SUPABASE_SHOWINGS_TTL_MS = 2 * 60 * 60 * 1000; // 2 ore

const directoryCache = new Map(); // provinceSlug -> { cinemas, fetchedAt }
const showingsCache = new Map(); // cinemaId -> { films, fetchedAt }

export class ComingSoonFetchError extends Error {
  /** @param {{ networkLevel?: boolean, httpStatus?: number|null }} [opts] - networkLevel: vedi stesso campo in mymoviesService (storico) */
  constructor(message, cause, { networkLevel = false, httpStatus = null } = {}) {
    super(message);
    this.name = 'ComingSoonFetchError';
    this.cause = cause;
    this.networkLevel = networkLevel;
    this.httpStatus = httpStatus;
  }
}

export class ComingSoonStructureError extends Error {
  constructor(message, reasons = []) {
    super(message);
    this.name = 'ComingSoonStructureError';
    this.reasons = reasons;
  }
}

function isCacheFresh(entry) {
  return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function isSupabaseRowFresh(fetchedAtIso, ttlMs) {
  return !!fetchedAtIso && Date.now() - new Date(fetchedAtIso).getTime() < ttlMs;
}

// La scrittura sulla cache condivisa è pubblica per design (vedi RLS in
// NOTE.md): una riga può arrivare da un bug di un altro client o da una
// scrittura diretta contro l'API Supabase, bypassando questa app. In lettura
// va quindi trattata come dato non fidato — questi validatori impediscono a
// una entry malformata di propagarsi fino al rendering (es. `.split` su un
// campo che non è una stringa) prima di fidarsene.
function isValidCinemaDirectoryData(cinemas) {
  return Array.isArray(cinemas) && cinemas.every((c) =>
    c && typeof c === 'object' &&
    typeof c.name === 'string' &&
    typeof c.id === 'string' &&
    typeof c.provinceSlug === 'string' &&
    typeof c.cinemaSlug === 'string' &&
    typeof c.url === 'string' && c.url.startsWith('https://www.comingsoon.it/cinema/')
  );
}

function isValidCinemaShowingsData(films) {
  return Array.isArray(films) && films.every((f) =>
    f && typeof f === 'object' &&
    typeof f.filmId === 'string' &&
    typeof f.title === 'string' &&
    Array.isArray(f.showings)
  );
}

/**
 * Legge una riga dalla cache condivisa Supabase, se configurata, fresca e
 * strutturalmente valida (vedi validatori sopra). Non lancia mai eccezioni:
 * qualunque problema (Supabase non configurato, rete, RLS, dato non valido)
 * fa semplicemente ricadere il chiamante sul fetch live.
 */
async function readSharedCache(table, matchColumn, matchValue, dataColumn, ttlMs, isValid) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(table)
      .select(`${dataColumn}, fetched_at`)
      .eq(matchColumn, matchValue)
      .maybeSingle();
    if (error || !data || !isSupabaseRowFresh(data.fetched_at, ttlMs)) return null;
    if (!isValid(data[dataColumn])) {
      console.warn(`[ComingSoon] Dati in cache condivisa (${table}) non validi, ignorati.`);
      return null;
    }
    return data[dataColumn];
  } catch {
    return null;
  }
}

/**
 * Scrive/aggiorna una riga nella cache condivisa Supabase dopo un fetch live
 * riuscito. Fire-and-forget rispetto al chiamante (non ne blocca la
 * risposta, il beneficio è solo per i prossimi utenti): eventuali errori
 * finiscono solo in un console.warn, mai propagati.
 */
function writeSharedCache(table, matchColumn, matchValue, dataColumn, dataValue) {
  if (!supabase) return;
  supabase
    .from(table)
    .upsert({ [matchColumn]: matchValue, [dataColumn]: dataValue, fetched_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) {
        console.warn(`[ComingSoon] Scrittura cache condivisa (${table}) fallita:`, error.message);
      }
    });
}

async function fetchHtml(url, { signal, notFoundMessage } = {}) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, { signal: timeoutController.signal });

    if (!response.ok) {
      // Risposta HTTP arrivata ma non ok: non è un blocco di rete (quello
      // finisce nel catch sotto, err.name/TypeError, mai qui). Logga subito
      // status + un estratto del body così, se il fallimento non è
      // riproducibile a tavolino (es. segnalato solo da un dispositivo
      // specifico), la console di quel dispositivo ha già l'informazione utile
      // senza dover indovinare la causa in una sessione successiva.
      let bodyExcerpt = null;
      try {
        bodyExcerpt = (await response.text()).slice(0, 300);
      } catch {
        // il body potrebbe non essere leggibile (già consumato, connessione
        // interrotta a metà): non è critico, l'excerpt resta null.
      }
      console.error(
        `[ComingSoon] Risposta non ok per "${url}": HTTP ${response.status}.`,
        bodyExcerpt ? { bodyExcerpt } : ''
      );
      throw new ComingSoonFetchError(
        notFoundMessage || `ComingSoon.it ha risposto con HTTP ${response.status} per "${url}".`,
        null,
        { httpStatus: response.status }
      );
    }
    return await response.text();
  } catch (err) {
    if (err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
    if (err instanceof ComingSoonFetchError) throw err;
    // Qui invece nessuna risposta HTTP è mai arrivata (fetch fallito/timeout,
    // es. TypeError "Failed to fetch"): nessuno status da loggare, solo il
    // motivo del fallimento della fetch stessa.
    console.error(`[ComingSoon] Fetch fallito per "${url}" (nessuna risposta HTTP): ${err.message}`);
    throw new ComingSoonFetchError(
      `Richiesta a ComingSoon.it fallita per "${url}": ${err.message}`,
      err,
      { networkLevel: true }
    );
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Ritorna l'elenco dei cinema della provincia (capoluogo `provinceSlug`),
 * con nome/slug/id utili sia per il matching con Overpass sia per costruire
 * l'URL della scheda di ciascun cinema.
 */
export async function getCinemaDirectory(provinceSlug, { signal } = {}) {
  const cached = directoryCache.get(provinceSlug);
  if (isCacheFresh(cached)) return cached.cinemas;

  const shared = await readSharedCache(
    'comingsoon_cinema_directory',
    'province_slug',
    provinceSlug,
    'cinemas',
    SUPABASE_DIRECTORY_TTL_MS,
    isValidCinemaDirectoryData
  );
  if (shared) {
    directoryCache.set(provinceSlug, { cinemas: shared, fetchedAt: Date.now() });
    return shared;
  }

  const url = `https://www.comingsoon.it/cinema/${provinceSlug}/`;
  const html = await fetchHtml(url, { signal });

  const sanity = checkCinemaDirectoryStructureSanity(html);
  if (!sanity.ok) {
    console.error(
      `[ComingSoon] Struttura pagina elenco-cinema inattesa per "${provinceSlug}" (HTTP 200, ma: ${sanity.reasons.join('; ')}).`,
      { bodyExcerpt: html.slice(0, 300) }
    );
    throw new ComingSoonStructureError(
      `La struttura della pagina elenco-cinema di ComingSoon.it per "${provinceSlug}" non corrisponde più a quella attesa.`,
      sanity.reasons
    );
  }

  const cinemas = parseCinemaDirectory(html);
  directoryCache.set(provinceSlug, { cinemas, fetchedAt: Date.now() });
  writeSharedCache('comingsoon_cinema_directory', 'province_slug', provinceSlug, 'cinemas', cinemas);
  return cinemas;
}

/**
 * Ritorna l'elenco dei film in programmazione oggi in un cinema specifico
 * (con relative sale/orari/prezzi). Un cinema senza film oggi è legittimo:
 * ritorna semplicemente un array vuoto, non un errore.
 * @param {{ id: string, url: string, provinceSlug: string, cinemaSlug: string }} cinema
 */
export async function getShowingsForCinema(cinema, { signal } = {}) {
  const cached = showingsCache.get(cinema.id);
  if (isCacheFresh(cached)) return cached.films;

  const shared = await readSharedCache(
    'comingsoon_cinema_showings',
    'cinema_id',
    cinema.id,
    'films',
    SUPABASE_SHOWINGS_TTL_MS,
    isValidCinemaShowingsData
  );
  if (shared) {
    showingsCache.set(cinema.id, { films: shared, fetchedAt: Date.now() });
    return shared;
  }

  const html = await fetchHtml(cinema.url, { signal });

  if (!isValidCinemaPage(html, cinema.id)) {
    console.error(
      `[ComingSoon] Pagina cinema inattesa per "${cinema.name}" (id ${cinema.id}, HTTP 200, ma isValidCinemaPage=false — probabile redirect silenzioso alla pagina provincia).`,
      { bodyExcerpt: html.slice(0, 300) }
    );
    throw new ComingSoonStructureError(
      `La pagina di "${cinema.name}" (id ${cinema.id}) non sembra più essere una scheda cinema valida ` +
        '(probabile redirect silenzioso di ComingSoon.it alla pagina provincia per slug/id non più validi).',
      ['isValidCinemaPage ha restituito false']
    );
  }

  const films = parseCinemaShowingsPage(html);
  showingsCache.set(cinema.id, { films, fetchedAt: Date.now() });
  writeSharedCache('comingsoon_cinema_showings', 'cinema_id', cinema.id, 'films', films);
  return films;
}

/** Utile nei test/nella simulazione di fallimento: svuota la cache in memoria. */
export function clearComingSoonCache() {
  directoryCache.clear();
  showingsCache.clear();
}
