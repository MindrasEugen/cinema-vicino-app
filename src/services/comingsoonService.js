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
 */
import {
  parseCinemaDirectory,
  checkCinemaDirectoryStructureSanity,
  isValidCinemaPage,
  parseCinemaShowingsPage,
} from './comingsoonParser';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // qualche ora, per non ricaricare ad ogni interazione
const FETCH_TIMEOUT_MS = 12000;

const directoryCache = new Map(); // provinceSlug -> { cinemas, fetchedAt }
const showingsCache = new Map(); // cinemaId -> { films, fetchedAt }

export class ComingSoonFetchError extends Error {
  /** @param {{ networkLevel?: boolean }} [opts] - vedi stesso campo in mymoviesService (storico) */
  constructor(message, cause, { networkLevel = false } = {}) {
    super(message);
    this.name = 'ComingSoonFetchError';
    this.cause = cause;
    this.networkLevel = networkLevel;
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

async function fetchHtml(url, { signal, notFoundMessage } = {}) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, { signal: timeoutController.signal });

    if (!response.ok) {
      throw new ComingSoonFetchError(
        notFoundMessage || `ComingSoon.it ha risposto con HTTP ${response.status} per "${url}".`
      );
    }
    return await response.text();
  } catch (err) {
    if (err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
    if (err instanceof ComingSoonFetchError) throw err;
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

  const url = `https://www.comingsoon.it/cinema/${provinceSlug}/`;
  const html = await fetchHtml(url, { signal });

  const sanity = checkCinemaDirectoryStructureSanity(html);
  if (!sanity.ok) {
    throw new ComingSoonStructureError(
      `La struttura della pagina elenco-cinema di ComingSoon.it per "${provinceSlug}" non corrisponde più a quella attesa.`,
      sanity.reasons
    );
  }

  const cinemas = parseCinemaDirectory(html);
  directoryCache.set(provinceSlug, { cinemas, fetchedAt: Date.now() });
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

  const html = await fetchHtml(cinema.url, { signal });

  if (!isValidCinemaPage(html, cinema.id)) {
    throw new ComingSoonStructureError(
      `La pagina di "${cinema.name}" (id ${cinema.id}) non sembra più essere una scheda cinema valida ` +
        '(probabile redirect silenzioso di ComingSoon.it alla pagina provincia per slug/id non più validi).',
      ['isValidCinemaPage ha restituito false']
    );
  }

  const films = parseCinemaShowingsPage(html);
  showingsCache.set(cinema.id, { films, fetchedAt: Date.now() });
  return films;
}

/** Utile nei test/nella simulazione di fallimento: svuota la cache in memoria. */
export function clearComingSoonCache() {
  directoryCache.clear();
  showingsCache.clear();
}
