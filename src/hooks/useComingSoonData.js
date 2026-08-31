import { useState, useEffect } from 'react';
import {
  getCinemaDirectory,
  getShowingsForCinema,
  ComingSoonFetchError,
  ComingSoonStructureError,
} from '../services/comingsoonService';
import { findMatchingNearbyCinema } from '../services/cinemaMatcher';

/**
 * Hook per ottenere film+cinema+orari da ComingSoon.it, incrociati con i
 * cinema vicini trovati via Overpass. A differenza del precedente
 * useMyMoviesData (MYmovies), il matching cinema-per-cinema avviene QUI,
 * una volta sola, invece che ad ogni render nella pagina di dettaglio: ogni
 * voce di `showingsToday` porta già con sé il cinema Overpass corrispondente
 * (`nearbyCinema`), pronto per essere mostrato senza ri-matchare.
 *
 * Non fa mai fallback da solo verso TMDB: si limita a esporre `fallbackReason`
 * (null finché va tutto bene) così App.jsx può decidere di usare
 * useNowPlayingMovies al suo posto.
 *
 * @param {string|null} provinceSlug - slug ComingSoon.it del capoluogo di
 *   provincia (es. "trento", "reggio-emilia") — vedi comingsoonParser.js
 * @param {Array|null} nearbyCinemas - cinema vicini da Overpass (useNearbyCinemas)
 * @param {boolean} nearbyCinemasLoading - si aspetta che Overpass finisca
 *   prima di tentare il matching, altrimenti si perderebbero i cinema non
 *   ancora arrivati
 * @param {string|null} cityName - solo per un messaggio di log più leggibile
 * @returns {{ films: Array, loading: boolean, fallbackReason: string|null,
 *   possibleNetworkBlock: boolean, ready: boolean }}
 */
export function useComingSoonData(provinceSlug, nearbyCinemas, nearbyCinemasLoading, cityName) {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fallbackReason, setFallbackReason] = useState(null);
  const [possibleNetworkBlock, setPossibleNetworkBlock] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!provinceSlug || nearbyCinemasLoading) {
      setReady(false);
      return;
    }

    setLoading(true);
    setReady(false);
    const controller = new AbortController();

    (async () => {
      try {
        const directory = await getCinemaDirectory(provinceSlug, { signal: controller.signal });

        const matchedPairs = (nearbyCinemas || [])
          .map((nearbyCinema) => ({
            nearbyCinema,
            csCinema: findMatchingNearbyCinema(nearbyCinema.name, directory),
          }))
          .filter((pair) => pair.csCinema);

        if (matchedPairs.length === 0) {
          setFilms([]);
          setFallbackReason(
            (nearbyCinemas || []).length === 0
              ? 'nessun cinema vicino trovato (Overpass)'
              : 'nessuno dei cinema vicini corrisponde all\'elenco ComingSoon.it della provincia'
          );
          setPossibleNetworkBlock(false);
          return;
        }

        // Dedup: più cinema Overpass potrebbero corrispondere allo stesso
        // cinema ComingSoon.it (es. voci OSM duplicate) — una sola richiesta
        // per id cinema comunque, la cache del service la eviterebbe, ma
        // evitiamo pure il doppio lavoro di aggregazione.
        const seenIds = new Set();
        const uniquePairs = matchedPairs.filter((pair) => {
          if (seenIds.has(pair.csCinema.id)) return false;
          seenIds.add(pair.csCinema.id);
          return true;
        });

        const results = await Promise.all(
          uniquePairs.map(async (pair) => {
            try {
              const csFilms = await getShowingsForCinema(pair.csCinema, { signal: controller.signal });
              return { pair, csFilms, error: null };
            } catch (err) {
              if (err.name === 'AbortError') throw err;
              return { pair, csFilms: [], error: err };
            }
          })
        );

        const filmsMap = new Map();
        let anyNetworkBlock = false;
        for (const { pair, csFilms, error } of results) {
          if (error) {
            anyNetworkBlock = anyNetworkBlock || !!error.networkLevel;
            console.warn(
              `[ComingSoon] Cinema "${pair.csCinema.name}" saltato (${error.message}).`
            );
            continue;
          }
          for (const csFilm of csFilms) {
            if (!filmsMap.has(csFilm.filmId)) {
              filmsMap.set(csFilm.filmId, mapComingSoonFilmToFilm(csFilm));
            }
            const film = filmsMap.get(csFilm.filmId);
            const times = [...new Set(csFilm.showings.map((s) => s.time))].sort();
            film.showingsToday.push({
              cinemaName: pair.csCinema.name,
              comingSoonCinemaUrl: pair.csCinema.url,
              times,
              nearbyCinema: pair.nearbyCinema,
            });
          }
        }

        const aggregated = [...filmsMap.values()];

        if (aggregated.length === 0) {
          const allFailed = results.every((r) => r.error);
          setFilms([]);
          setFallbackReason(
            allFailed
              ? `richiesta a ComingSoon.it fallita per tutti i ${uniquePairs.length} cinema vicini`
              : 'nessun film in programmazione oggi nei cinema vicini'
          );
          setPossibleNetworkBlock(allFailed && anyNetworkBlock);
          return;
        }

        setFilms(aggregated);
        setFallbackReason(null);
        setPossibleNetworkBlock(false);
      } catch (err) {
        if (err.name === 'AbortError') return;

        let reason;
        let networkBlock = false;
        if (err instanceof ComingSoonStructureError) {
          reason = `struttura della pagina ComingSoon.it cambiata (${err.reasons.join('; ')})`;
        } else if (err instanceof ComingSoonFetchError) {
          reason = `richiesta a ComingSoon.it fallita (${err.message})`;
          networkBlock = !!err.networkLevel;
        } else {
          reason = `errore imprevisto (${err.message})`;
        }

        console.warn(
          `[ComingSoon] Fallback automatico a TMDB per "${cityName || provinceSlug}": ${reason}.`
        );

        setFilms([]);
        setFallbackReason(reason);
        setPossibleNetworkBlock(networkBlock);
      } finally {
        setLoading(false);
        setReady(true);
      }
    })();

    return () => controller.abort();
  }, [provinceSlug, nearbyCinemas, nearbyCinemasLoading, cityName]);

  return { films, loading, fallbackReason, possibleNetworkBlock, ready };
}

/** Converte un film ComingSoon.it nella forma comune "Film" usata dall'app
 * (vedi tmdbService.mapTmdbMovieToFilm per l'equivalente lato TMDB). */
function mapComingSoonFilmToFilm(csFilm) {
  const yearMatch = csFilm.releaseDateRaw?.match(/(\d{4})$/);
  return {
    id: `comingsoon-${csFilm.filmId}`,
    title: csFilm.title,
    filmUrl: null,
    posterUrl: csFilm.posterUrl,
    genres: csFilm.genres,
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    durationMinutes: csFilm.durationMinutes,
    overviewShort: null,
    overviewFull: null,
    director: null,
    cast: csFilm.cast,
    rating: csFilm.rating,
    ratingScale: 5,
    trailerUrl: null,
    showingsToday: [],
  };
}
