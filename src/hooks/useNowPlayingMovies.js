import { useState, useEffect } from 'react';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Hook per ottenere i film attualmente al cinema per un paese specifico
 * @param {string} countryCode - Codice paese ISO 3166-1 alpha-2 (es. 'IT', 'US')
 * @returns {Object} { movies, error, loading }
 */
export function useNowPlayingMovies(countryCode) {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Non procedere senza codice paese o API key
    if (!countryCode) return;
    if (!API_KEY) {
      setError('API key di TMDB non configurata. Aggiungi VITE_TMDB_API_KEY al file .env');
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    // Prima richiesta: pagina 1 (critica)
    fetch(`${BASE_URL}/movie/now_playing?region=${countryCode}&api_key=${API_KEY}&language=it-IT&page=1`, {
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('API key di TMDB non valida. Verifica che sia corretta.');
          } else if (response.status === 429) {
            throw new Error('Troppi request a TMDB. Attendi qualche minuto e riprova.');
          }
          throw new Error(`Errore HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const { results: firstPageResults, total_pages: totalPages } = data;
        let allMovies = [...firstPageResults];

        // Se ci sono più pagine, recupera fino a pagina 3 (max 3 pagine totali)
        if (totalPages > 1) {
          const maxPagesToFetch = Math.min(3, totalPages);
          const additionalPageRequests = [];

          // Prepara le richieste per le pagine aggiuntive (2 e 3) in parallelo
          for (let page = 2; page <= maxPagesToFetch; page++) {
            additionalPageRequests.push(
              fetch(`${BASE_URL}/movie/now_playing?region=${countryCode}&api_key=${API_KEY}&language=it-IT&page=${page}`, {
                signal: controller.signal
              })
                .then(response => response.json())
                .catch(err => {
                  // Propaga l'abort (es. smontaggio o cambio countryCode) invece di
                  // inghiottirlo: deve arrivare al catch esterno che ignora l'AbortError
                  // senza chiamare setState.
                  if (err.name === 'AbortError') throw err;
                  // Fallimento silenzioso per pagine aggiuntive
                  console.error(`Errore nel caricamento della pagina ${page}:`, err);
                  return { results: [] };
                })
            );
          }

          // Esegui tutte le richieste aggiuntive in parallelo e concatena risultati
          return Promise.all(additionalPageRequests)
            .then(additionalPages => {
              // Concatena i risultati mantenendo ordine per pagina
              additionalPages.forEach(pageData => {
                if (pageData.results && Array.isArray(pageData.results)) {
                  allMovies = [...allMovies, ...pageData.results];
                }
              });
              return allMovies;
            });
        }

        return allMovies;
      })
      .then(allMovies => {
        setMovies(allMovies);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Errore nel caricamento dei film:', err);
          setError(`Impossibile caricare i film al cinema: ${err.message}`);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [countryCode]);

  return { movies, error, loading };
}
