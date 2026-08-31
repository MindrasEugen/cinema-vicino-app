import { useState, useEffect, useCallback } from 'react';

/**
 * Hook per ottenere la posizione geografica dell'utente
 * @returns {Object} { position: {lat, lng}, error, loading, retry }
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Isolata in una funzione richiamabile (non solo nell'effect iniziale) per
  // permettere all'utente di ritentare dopo un diniego, senza dover
  // ricaricare la pagina — vedi bottone "Riprova" in App.jsx. Nota: se il
  // browser ha già memorizzato il diniego, ritentare non farà ricomparire il
  // prompt: serve prima cambiare il permesso nelle impostazioni del browser.
  const requestPosition = useCallback(() => {
    // Verifica se il browser supporta la geolocalizzazione
    if (!navigator.geolocation) {
      setError('La geolocalizzazione non è supportata dal tuo browser');
      return;
    }

    setError(null);
    setLoading(true);

    const handleSuccess = (pos) => {
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      setLoading(false);
    };

    const handleError = (err) => {
      let errorMessage = 'Impossibile ottenere la posizione';

      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Permesso di accesso alla posizione negato. Abilita la geolocalizzazione per questo sito nelle impostazioni del browser, poi riprova.';
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Le informazioni sulla posizione non sono disponibili.';
          break;
        case err.TIMEOUT:
          errorMessage = 'Timeout nel recupero della posizione. Riprova.';
          break;
        default:
          errorMessage = 'Si è verificato un errore sconosciuto nel recupero della posizione.';
      }

      setError(errorMessage);
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
  }, []);

  useEffect(() => {
    requestPosition();
  }, [requestPosition]);

  return { position, error, loading, retry: requestPosition };
}
