import { useState, useEffect } from 'react';

/**
 * Hook per ottenere il codice paese dalle coordinate tramite Nominatim (OpenStreetMap)
 * @param {number} lat - Latitudine
 * @param {number} lng - Longitudine
 * @returns {Object} { countryCode, countryName, error, loading }
 */
export function useReverseGeocoding(lat, lng) {
  const [countryCode, setCountryCode] = useState(null);
  const [countryName, setCountryName] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;

    setLoading(true);
    const controller = new AbortController();

    // Costruisci l'URL per Nominatim
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    fetch(url, {
      headers: {
        'User-Agent': 'AlCinemaApp/1.0'
      },
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Estrai il codice paese (ISO 3166-1 alpha-2) e lo portiamo in maiuscolo
        const code = data.address?.country_code?.toUpperCase() || null;
        const name = data.address?.country || null;
        
        setCountryCode(code);
        setCountryName(name);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Errore nel reverse geocoding:', err);
          setError('Impossibile determinare il paese dalla tua posizione.');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [lat, lng]);

  return { countryCode, countryName, error, loading };
}
