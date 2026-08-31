/**
 * Servizio TMDB isolato. Usato come fallback automatico (Parte 2 della specifica)
 * quando ComingSoon.it non risponde o la sua struttura risulta cambiata, e come
 * arricchimento puntuale (solo trailer) su richiesta dell'utente, dato che
 * ComingSoon.it non espone un URL diretto del trailer sulla pagina cinema.
 */

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export class TmdbConfigError extends Error {}

function ensureApiKey() {
  if (!API_KEY) {
    throw new TmdbConfigError(
      'API key di TMDB non configurata. Aggiungi VITE_TMDB_API_KEY al file .env'
    );
  }
}

/**
 * Recupera i film attualmente al cinema in Italia (region IT), fino a 3 pagine,
 * nello stesso modo già usato da useNowPlayingMovies.
 */
export async function fetchNowPlayingIT({ signal } = {}) {
  ensureApiKey();

  const firstPageRes = await fetch(
    `${BASE_URL}/movie/now_playing?region=IT&api_key=${API_KEY}&language=it-IT&page=1`,
    { signal }
  );
  if (!firstPageRes.ok) {
    if (firstPageRes.status === 401) {
      throw new Error('API key di TMDB non valida. Verifica che sia corretta.');
    }
    if (firstPageRes.status === 429) {
      throw new Error('Troppi request a TMDB. Attendi qualche minuto e riprova.');
    }
    throw new Error(`Errore HTTP: ${firstPageRes.status}`);
  }

  const firstPageData = await firstPageRes.json();
  let allMovies = [...firstPageData.results];
  const maxPagesToFetch = Math.min(3, firstPageData.total_pages || 1);

  if (maxPagesToFetch > 1) {
    const extraPages = await Promise.all(
      Array.from({ length: maxPagesToFetch - 1 }, (_, i) => i + 2).map((page) =>
        fetch(
          `${BASE_URL}/movie/now_playing?region=IT&api_key=${API_KEY}&language=it-IT&page=${page}`,
          { signal }
        )
          .then((r) => r.json())
          .catch((err) => {
            if (err.name === 'AbortError') throw err;
            console.error(`Errore nel caricamento della pagina ${page}:`, err);
            return { results: [] };
          })
      )
    );
    extraPages.forEach((pageData) => {
      if (Array.isArray(pageData.results)) {
        allMovies = [...allMovies, ...pageData.results];
      }
    });
  }

  return allMovies;
}

/**
 * Converte un film TMDB (shape di /movie/now_playing) nella forma comune "Film"
 * usata dall'app indipendentemente dalla fonte (vedi useComingSoonData.mapComingSoonFilmToFilm
 * per l'equivalente lato ComingSoon.it). In modalità fallback l'incrocio film-cinema
 * non è disponibile: showingsToday resta null (diverso da [] = "nessuna sala oggi").
 */
export function mapTmdbMovieToFilm(movie) {
  return {
    id: `tmdb-${movie.id}`,
    title: movie.title,
    filmUrl: null,
    // w500 (non w342): un solo posterUrl è riusato sia per le card sia per la
    // pagina dettaglio, quindi serve una risoluzione sufficiente per entrambi
    // i contesti (e per schermi ad alta densità) anche dopo la riduzione
    // della dimensione visualizzata.
    posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    genres: [],
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
    durationMinutes: null,
    overviewShort: movie.overview || null,
    overviewFull: movie.overview || null,
    director: null,
    cast: [],
    rating: typeof movie.vote_average === 'number' ? movie.vote_average : null,
    ratingScale: 10,
    trailerUrl: null,
    showingsToday: null,
  };
}

function extractYoutubeTrailerUrl(videosResponse) {
  const results = videosResponse?.results || [];
  const trailer =
    results.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    results.find((v) => v.site === 'YouTube');
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

/**
 * Cerca su TMDB il trailer di un film per titolo (ed eventuale anno), su
 * richiesta dell'utente (pulsante "Cerca trailer" in FilmDetailPage), dato
 * che ComingSoon.it non espone un URL diretto del trailer. Non lancia mai
 * eccezioni: ritorna null in ogni caso di fallimento, per non bloccare il
 * resto dei dati (che restano quelli di ComingSoon.it).
 */
export async function searchMovieTrailerUrl(title, year) {
  try {
    ensureApiKey();
    const params = new URLSearchParams({
      api_key: API_KEY,
      language: 'it-IT',
      query: title,
    });
    if (year) params.set('year', String(year));

    const searchRes = await fetch(`${BASE_URL}/search/movie?${params.toString()}`);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const bestMatch = searchData.results?.[0];
    if (!bestMatch) return null;

    const detailsRes = await fetch(
      `${BASE_URL}/movie/${bestMatch.id}?api_key=${API_KEY}&language=it-IT&append_to_response=videos`
    );
    if (!detailsRes.ok) return null;
    const details = await detailsRes.json();
    return extractYoutubeTrailerUrl(details.videos);
  } catch (err) {
    console.warn(`[TMDB] Impossibile recuperare il trailer di fallback per "${title}":`, err);
    return null;
  }
}
