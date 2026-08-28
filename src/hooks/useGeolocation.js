import { useState, useEffect } from 'react';

/**
 * Hook per ottenere la posizione geografica dell'utente
 * @returns {Object} { position: {lat, lng}, error, loading }
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Verifica se il browser supporta la geolocalizzazione
    if (!navigator.geolocation) {
      setError('La geolocalizzazione non è supportata dal tuo browser');
      return;
    }

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
          errorMessage = 'Permesso di accesso alla posizione negato. Per utilizzare l\'app, consentire la geolocalizzazione.';
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

  return { position, error, loading };
}
