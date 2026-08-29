import { useState, useEffect } from 'react';
import { getFilmsForCity, MyMoviesFetchError, MyMoviesStructureError } from '../services/mymoviesService';

/**
 * Hook per ottenere film+cinema da MYmovies per la città rilevata.
 * Non fa mai fallback da solo verso TMDB: si limita a esporre `fallbackReason`
 * (null finché va tutto bene) così App.jsx può decidere di usare
 * useNowPlayingMovies+useNearbyCinemas al suo posto. Il log in console della
 * Parte 2 della specifica avviene qui, nel punto in cui il fallimento viene
 * effettivamente rilevato.
 *
 * @param {string|null} citySlug
 * @param {string|null} cityName - solo per un messaggio di log più leggibile
 * @returns {{ films: Array, loading: boolean, fallbackReason: string|null, ready: boolean }}
 */
export function useMyMoviesData(citySlug, cityName) {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fallbackReason, setFallbackReason] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!citySlug) {
      setReady(false);
      return;
    }

    setLoading(true);
    setReady(false);
    const controller = new AbortController();

    getFilmsForCity(citySlug, { signal: controller.signal })
      .then((result) => {
        setFilms(result);
        setFallbackReason(null);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;

        let reason;
        if (err instanceof MyMoviesStructureError) {
          reason = `struttura della pagina MYmovies cambiata (${err.reasons.join('; ')})`;
        } else if (err instanceof MyMoviesFetchError) {
          reason = `richiesta a MYmovies fallita (${err.message})`;
        } else {
          reason = `errore imprevisto (${err.message})`;
        }

        console.warn(
          `[MyMovies] Fallback automatico a TMDB per "${cityName || citySlug}": ${reason}. ` +
            'Vedi NOTE.md per come verificare se MYmovies ha smesso di funzionare in modo stabile.'
        );

        setFilms([]);
        setFallbackReason(reason);
      })
      .finally(() => {
        setLoading(false);
        setReady(true);
      });

    return () => controller.abort();
  }, [citySlug, cityName]);

  return { films, loading, fallbackReason, ready };
}
