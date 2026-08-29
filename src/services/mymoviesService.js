/**
 * Servizio MYmovies.it — fonte primaria per film e cinema che li proiettano
 * (vedi NOTE.md per la strategia di fallback e la gestione CORS).
 *
 * Espone getFilmsForCity(citySlug): scarica (con cache) la pagina
 * https://www.mymovies.it/cinema/{citySlug}/, verifica che la struttura attesa
 * sia ancora presente e ritorna l'elenco dei film già pronti per l'app
 * (sinossi, cast, trailer, sale che li proiettano oggi in città).
 *
 * In caso di fallimento di rete/HTTP lancia MyMoviesFetchError; se la pagina
 * risponde ma la struttura non è più quella attesa (o non produce film) lancia
 * MyMoviesStructureError. In entrambi i casi il chiamante (useMyMoviesData)
 * scatta automaticamente sul fallback TMDB.
 */
import { parseCityPage, checkStructureSanity } from './mymoviesParser';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // qualche ora, per non ricaricare la pagina ad ogni interazione
const FETCH_TIMEOUT_MS = 12000;

// Proxy CORS pubblico usato solo in build di produzione, dove non esiste un
// server Node che possa fare da proxy (vedi vite.config.js per lo sviluppo).
// È di per sé un punto di fragilità aggiuntivo (dipendenza da un servizio
// terzo): se anche questo comincia a fallire, il fallback TMDB scatta lo
// stesso, quindi l'app resta comunque utilizzabile.
const PUBLIC_CORS_PROXY = 'https://corsproxy.io/?url=';

const cache = new Map(); // citySlug -> { html, fetchedAt }

export class MyMoviesFetchError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MyMoviesFetchError';
    this.cause = cause;
  }
}

export class MyMoviesStructureError extends Error {
  constructor(message, reasons = []) {
    super(message);
    this.name = 'MyMoviesStructureError';
    this.reasons = reasons;
  }
}

function buildRequestUrl(citySlug) {
  const targetUrl = `https://www.mymovies.it/cinema/${citySlug}/`;
  if (import.meta.env.DEV) {
    return `/mymovies-proxy/cinema/${citySlug}/`;
  }
  return `${PUBLIC_CORS_PROXY}${encodeURIComponent(targetUrl)}`;
}

function isCacheFresh(entry) {
  return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/** Scarica la pagina città (con cache in memoria di qualche ora). */
async function fetchCityHtml(citySlug, { signal } = {}) {
  const cached = cache.get(citySlug);
  if (isCacheFresh(cached)) {
    return cached.html;
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(buildRequestUrl(citySlug), {
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new MyMoviesFetchError(
        `MYmovies ha risposto con HTTP ${response.status} per la città "${citySlug}".`
      );
    }

    const html = await response.text();
    cache.set(citySlug, { html, fetchedAt: Date.now() });
    return html;
  } catch (err) {
    if (err.name === 'AbortError' && signal?.aborted) {
      // Abort esterno (es. smontaggio componente/cambio città): propaga così com'è,
      // il chiamante lo ignora senza trattarlo come fallimento da loggare.
      throw err;
    }
    if (err instanceof MyMoviesFetchError) throw err;
    throw new MyMoviesFetchError(
      `Richiesta alla pagina MYmovies fallita per la città "${citySlug}": ${err.message}`,
      err
    );
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Ritorna l'elenco dei film in programmazione oggi nella città, con
 * sinossi/cast/trailer e le sale (MYmovies) che li proiettano oggi.
 * Lancia MyMoviesFetchError o MyMoviesStructureError in caso di fallimento:
 * sta al chiamante decidere di passare al fallback TMDB.
 */
export async function getFilmsForCity(citySlug, { signal } = {}) {
  const html = await fetchCityHtml(citySlug, { signal });

  const sanity = checkStructureSanity(html);
  if (!sanity.ok) {
    throw new MyMoviesStructureError(
      `La struttura della pagina MYmovies per "${citySlug}" non corrisponde più a quella attesa.`,
      sanity.reasons
    );
  }

  const films = parseCityPage(html);
  if (films.length === 0) {
    throw new MyMoviesStructureError(
      `Nessun film estratto dalla pagina MYmovies per "${citySlug}" pur con struttura apparentemente valida.`,
      ['parseCityPage ha restituito un array vuoto']
    );
  }

  return films;
}

/** Utile nei test/nella simulazione di fallimento: svuota la cache in memoria. */
export function clearMyMoviesCache(citySlug) {
  if (citySlug) cache.delete(citySlug);
  else cache.clear();
}
