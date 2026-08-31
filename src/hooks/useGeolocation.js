import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook per ottenere la posizione geografica dell'utente
 * @returns {Object} { position: {lat, lng}, error, loading, retry, permissionState, isPermissionDeniedError }
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('unsupported');
  const [isPermissionDeniedError, setIsPermissionDeniedError] = useState(false);
  const permissionStatusRef = useRef(null);
  const handlerRef = useRef(null);

  // Isolata in una funzione richiamabile (non solo nell'effect iniziale) per
  // permettere all'utente di ritentare dopo un diniego, senza dover
  // ricaricare la pagina — vedi bottone "Riprova" in App.jsx. Nota: se il
  // browser ha già memorizzato il diniego, ritentare non farà ricomparire il
  // prompt: serve prima cambiare il permesso nelle impostazioni del browser.
  const requestPosition = useCallback(() => {
    // Verifica se il browser supporta la geolocalizzazione
    if (!navigator.geolocation) {
      setError('La geolocalizzazione non è supportata dal tuo browser');
      setIsPermissionDeniedError(false);
      return;
    }

    setError(null);
    setIsPermissionDeniedError(false);
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
      let isDenied = false;

      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Permesso di accesso alla posizione negato. Abilita la geolocalizzazione per questo sito nelle impostazioni del browser, poi riprova.';
          isDenied = true;
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Le informazioni sulla posizione non sono disponibili.';
          isDenied = false;
          break;
        case err.TIMEOUT:
          errorMessage = 'Timeout nel recupero della posizione. Riprova.';
          isDenied = false;
          break;
        default:
          errorMessage = 'Si è verificato un errore sconosciuto nel recupero della posizione.';
          isDenied = false;
      }

      setError(errorMessage);
      setIsPermissionDeniedError(isDenied);
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
  }, []);

  useEffect(() => {
    requestPosition();
  }, [requestPosition]);

  // Ascolta i cambiamenti del permesso di geolocalizzazione tramite Permissions API
  useEffect(() => {
    if (!navigator.permissions) {
      setPermissionState('unsupported');
      return;
    }

    let isMounted = true;

    navigator.permissions.query({ name: 'geolocation' })
      .then((status) => {
        if (!isMounted) return;

        permissionStatusRef.current = status;
        setPermissionState(status.state);

        // Handler per i cambiamenti del permesso
        handlerRef.current = () => {
          if (isMounted) {
            setPermissionState(status.state);
            // Se il permesso è stato appena concesso, richiedi la posizione
            if (status.state === 'granted') {
              requestPosition();
            }
          }
        };

        // Ascolta i cambiamenti
        if (status.addEventListener) {
          status.addEventListener('change', handlerRef.current);
        } else if (typeof status.onchange !== 'undefined') {
          status.onchange = handlerRef.current;
        }
      })
      .catch(() => {
        if (isMounted) {
          setPermissionState('unsupported');
        }
      });

    return () => {
      isMounted = false;
      // Cleanup: rimuovi il listener
      const status = permissionStatusRef.current;
      const handler = handlerRef.current;
      
      if (status && handler) {
        if (status.removeEventListener) {
          status.removeEventListener('change', handler);
        } else if (typeof status.onchange !== 'undefined') {
          status.onchange = null;
        }
      }
    };
  }, [requestPosition]);

  // Fallback: ri-verifica il permesso quando la tab torna visibile/focused.
  // Questo gestisce il caso in cui l'utente cambia il permesso dalle
  // impostazioni del browser (non dal pannello rapido della tab corrente),
  // che non scatena l'evento `change` della Permissions API su Edge/Chromium.
  useEffect(() => {
    if (position) {
      // Se abbiamo già una posizione valida, non serve ri-verificare
      return;
    }

    let isMounted = true;

    // Handler per visibilitychange e focus
    const handleVisibilityOrFocus = () => {
      // Ri-verifica solo se la tab è visibile e noi siamo focused, e non stiamo già caricando
      if (!isMounted || loading) {
        return;
      }

      if (document.visibilityState === 'visible') {
        // Se Permissions API è disponibile, ri-verifica lo stato del permesso
        if (navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' })
            .then((status) => {
              if (isMounted && status.state === 'granted') {
                // Il permesso è stato appena concesso
                requestPosition();
              }
            })
            .catch(() => {
              // Permissions API non disponibile o errore: prova comunque
              if (isMounted) {
                requestPosition();
              }
            });
        } else {
          // Fallback: Permissions API non disponibile, prova comunque
          // (se il permesso è ancora negato, requestPosition lo rileverà via geolocation API)
          if (isMounted) {
            requestPosition();
          }
        }
      }
    };

    // Ascolta visibilitychange (quando la tab torna visibile)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    // Ascolta focus (quando la finestra riceve il focus)
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [position, loading, requestPosition]);

  return { position, error, loading, retry: requestPosition, permissionState, isPermissionDeniedError };
}
