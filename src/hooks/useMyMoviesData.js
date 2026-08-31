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
 * @param {string|null} provinceSlug - usato per ritentare con
 *   `/cinema/{provincia}/{comune}/` se la forma semplice non è coperta
 *   (comuni non capoluogo, vedi NOTE.md)
 * @returns {{ films: Array, loading: boolean, fallbackReason: string|null,
 *   possibleNetworkBlock: boolean, ready: boolean }}
 */
export function useMyMoviesData(citySlug, cityName, provinceSlug) {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fallbackReason, setFallbackReason] = useState(null);
  // true quando il fallimento è un MyMoviesFetchError "networkLevel" (nessuna
  // risposta HTTP mai arrivata): possibile sintomo di un blocco di
  // rete/dispositivo (VPN, DNS, filtro dell'operatore) a monte del proxy,
  // non necessariamente un problema di MYmovies o del proxy stesso — non è
  // possibile distinguerli con certezza lato client (vedi NOTE.md).
  const [possibleNetworkBlock, setPossibleNetworkBlock] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!citySlug) {
      setReady(false);
      return;
    }

    setLoading(true);
    setReady(false);
    const controller = new AbortController();

    getFilmsForCity(citySlug, { signal: controller.signal, provinceSlug })
      .then((result) => {
        setFilms(result);
        setFallbackReason(null);
        setPossibleNetworkBlock(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;

        let reason;
        let networkBlock = false;
        if (err instanceof MyMoviesStructureError) {
          reason = `struttura della pagina MYmovies cambiata (${err.reasons.join('; ')})`;
        } else if (err instanceof MyMoviesFetchError) {
          reason = `richiesta a MYmovies fallita (${err.message})`;
          networkBlock = !!err.networkLevel;
        } else {
          reason = `errore imprevisto (${err.message})`;
        }

        console.warn(
          `[MyMovies] Fallback automatico a TMDB per "${cityName || citySlug}": ${reason}. ` +
            'Vedi NOTE.md per come verificare se MYmovies ha smesso di funzionare in modo stabile.'
        );

        setFilms([]);
        setFallbackReason(reason);
        setPossibleNetworkBlock(networkBlock);
      })
      .finally(() => {
        setLoading(false);
        setReady(true);
      });

    return () => controller.abort();
  }, [citySlug, cityName, provinceSlug]);

  return { films, loading, fallbackReason, possibleNetworkBlock, ready };
}
