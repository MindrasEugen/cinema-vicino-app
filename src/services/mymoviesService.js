/**
 * Servizio MYmovies.it — fonte primaria per film e cinema che li proiettano
 * (vedi NOTE.md per la strategia di fallback e la gestione CORS).
 *
 * Espone getFilmsForCity(citySlug, { provinceSlug }): scarica (con cache) la
 * pagina https://www.mymovies.it/cinema/{citySlug}/, verifica che la
 * struttura attesa sia ancora presente e ritorna l'elenco dei film già pronti
 * per l'app (sinossi, cast, trailer, sale che li proiettano oggi in città).
 *
 * Per i comuni non capoluogo, MYmovies non copre la forma semplice
 * `/cinema/{comune}/` (risponde con una pagina "provincia non trovata", pur
 * con HTTP 200) e richiede invece `/cinema/{provincia}/{comune}/`. Se viene
 * passato `provinceSlug`, dopo un primo tentativo con la forma semplice si
 * ritenta automaticamente con quella con provincia prima di arrendersi (vedi
 * NOTE.md, sezione "Comuni piccoli: URL con provincia").
 *
 * In caso di fallimento di rete/HTTP lancia MyMoviesFetchError; se la pagina
 * risponde ma la struttura non è più quella attesa (o non produce film) lancia
 * MyMoviesStructureError. In entrambi i casi il chiamante (useMyMoviesData)
 * scatta automaticamente sul fallback TMDB.
 */
import { parseCityPage, checkStructureSanity, isProvinceNotFoundPage } from './mymoviesParser';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // qualche ora, per non ricaricare la pagina ad ogni interazione
const FETCH_TIMEOUT_MS = 12000;

// Proxy CORS pubblico usato solo in build di produzione, dove non esiste un
// server Node che possa fare da proxy (vedi vite.config.js per lo sviluppo).
// È di per sé un punto di fragilità aggiuntivo (dipendenza da un servizio
// terzo): se anche questo comincia a fallire, il fallback TMDB scatta lo
// stesso, quindi l'app resta comunque utilizzabile.
//
// Nota di manutenzione (verificato 2026-08-30 sul deploy Render): corsproxy.io
// ha iniziato a richiedere una API key a pagamento (401 su ogni richiesta),
// quindi è stato sostituito con proxy.cors.sh. Un'alternativa come
// api.allorigins.win/raw?url= è stata scartata perché tronca silenziosamente
// pagine di queste dimensioni (si ferma a metà con "[BLOCKED: Cookie/query
// string data]"), restituendo solo una manciata di film senza segnalare
// errore — peggio del fallback TMDB pulito che scatta se proxy.cors.sh smette
// di funzionare. Se anche questo dovesse rompersi, verificare di nuovo con lo
// stesso metodo (fetch diretto dal browser sull'app deployata) prima di
// sceglierne un altro.
const PUBLIC_CORS_PROXY = 'https://proxy.cors.sh/';

const cache = new Map(); // citySlug -> { html, fetchedAt }

export class MyMoviesFetchError extends Error {
  /**
   * @param {string} message
   * @param {Error} [cause]
   * @param {{ networkLevel?: boolean }} [opts] - `networkLevel: true` quando la
   *   richiesta non ha mai ricevuto una risposta HTTP (fetch fallito/andato in
   *   timeout prima ancora di raggiungere il proxy) — sintomo tipico di un
   *   blocco a livello di rete/dispositivo (VPN, DNS, filtro dell'operatore),
   *   non di un errore del server MYmovies/proxy. `false`/assente quando
   *   invece una risposta HTTP è arrivata, solo con status non-ok.
   */
  constructor(message, cause, { networkLevel = false } = {}) {
    super(message);
    this.name = 'MyMoviesFetchError';
    this.cause = cause;
    this.networkLevel = networkLevel;
  }
}

export class MyMoviesStructureError extends Error {
  constructor(message, reasons = []) {
    super(message);
    this.name = 'MyMoviesStructureError';
    this.reasons = reasons;
  }
}

/** Unisce i segmenti del percorso (es. ["trento", "rivadelgarda"]) nella chiave di cache/URL. */
function pathKey(segments) {
  return segments.join('/');
}

function buildRequestUrl(segments) {
  const path = pathKey(segments);
  const targetUrl = `https://www.mymovies.it/cinema/${path}/`;
  if (import.meta.env.DEV) {
    return `/mymovies-proxy/cinema/${path}/`;
  }
  return `${PUBLIC_CORS_PROXY}${targetUrl}`;
}

function isCacheFresh(entry) {
  return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/** Scarica la pagina città (con cache in memoria di qualche ora). `segments` è
 * l'elenco dei segmenti del percorso `/cinema/...`: `[citySlug]` per la forma
 * semplice, `[provinceSlug, citySlug]` per quella con provincia. */
async function fetchCityHtml(segments, { signal } = {}) {
  const key = pathKey(segments);
  const cached = cache.get(key);
  if (isCacheFresh(cached)) {
    return cached.html;
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(buildRequestUrl(segments), {
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new MyMoviesFetchError(
        `MYmovies ha risposto con HTTP ${response.status} per "${key}".`
      );
    }

    const html = await response.text();
    cache.set(key, { html, fetchedAt: Date.now() });
    return html;
  } catch (err) {
    if (err.name === 'AbortError' && signal?.aborted) {
      // Abort esterno (es. smontaggio componente/cambio città): propaga così com'è,
      // il chiamante lo ignora senza trattarlo come fallimento da loggare.
      throw err;
    }
    if (err instanceof MyMoviesFetchError) throw err;
    // Il fetch non ha mai ricevuto una risposta HTTP (TypeError di rete es.
    // "Failed to fetch", o timeout interno scaduto): la richiesta non ha
    // raggiunto (o non ha ottenuto risposta da) il proxy, a differenza del
    // caso "!response.ok" sopra dove una risposta HTTP è arrivata comunque.
    throw new MyMoviesFetchError(
      `Richiesta alla pagina MYmovies fallita per "${key}": ${err.message}`,
      err,
      { networkLevel: true }
    );
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Scarica la pagina città provando prima la forma semplice
 * `/cinema/{citySlug}/`; se MYmovies risponde con la pagina "provincia non
 * trovata" (comuni non capoluogo, vedi commento in testa al file) e
 * `provinceSlug` è disponibile, ritenta con `/cinema/{provinceSlug}/{citySlug}/`.
 */
async function fetchCityHtmlWithProvinceFallback(citySlug, provinceSlug, { signal } = {}) {
  const direct = await fetchCityHtml([citySlug], { signal });
  if (!isProvinceNotFoundPage(direct)) {
    return { html: direct, pathTried: [citySlug] };
  }
  if (!provinceSlug) {
    return { html: direct, pathTried: [citySlug] };
  }

  const viaProvince = await fetchCityHtml([provinceSlug, citySlug], { signal });
  return { html: viaProvince, pathTried: [provinceSlug, citySlug] };
}

/**
 * Ritorna l'elenco dei film in programmazione oggi nella città, con
 * sinossi/cast/trailer e le sale (MYmovies) che li proiettano oggi.
 * Lancia MyMoviesFetchError o MyMoviesStructureError in caso di fallimento:
 * sta al chiamante decidere di passare al fallback TMDB.
 *
 * @param {string} citySlug
 * @param {{ signal?: AbortSignal, provinceSlug?: string|null }} [opts]
 */
export async function getFilmsForCity(citySlug, { signal, provinceSlug } = {}) {
  const { html, pathTried } = await fetchCityHtmlWithProvinceFallback(citySlug, provinceSlug, {
    signal,
  });

  if (isProvinceNotFoundPage(html)) {
    throw new MyMoviesStructureError(
      `MYmovies non riconosce "${pathTried.join('/')}" (pagina "provincia non trovata").`,
      [
        provinceSlug
          ? 'tentativo con provincia fallito a sua volta (stessa pagina di errore)'
          : 'nessuna provincia nota per ritentare (provinceSlug non disponibile)',
      ]
    );
  }

  const sanity = checkStructureSanity(html);
  if (!sanity.ok) {
    throw new MyMoviesStructureError(
      `La struttura della pagina MYmovies per "${pathTried.join('/')}" non corrisponde più a quella attesa.`,
      sanity.reasons
    );
  }

  const films = parseCityPage(html);
  if (films.length === 0) {
    throw new MyMoviesStructureError(
      `Nessun film estratto dalla pagina MYmovies per "${pathTried.join('/')}" pur con struttura apparentemente valida.`,
      ['parseCityPage ha restituito un array vuoto']
    );
  }

  return films;
}

/** Utile nei test/nella simulazione di fallimento: svuota la cache in memoria. */
export function clearMyMoviesCache(citySlug) {
  if (!citySlug) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key === citySlug || key.endsWith(`/${citySlug}`)) {
      cache.delete(key);
    }
  }
}
