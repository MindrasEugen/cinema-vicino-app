import { useState, useEffect } from 'react';
import { normalizeProvinceCapitalSlug } from '../services/comingsoonParser';

/**
 * Hook per ottenere il codice paese e la città dalle coordinate tramite Nominatim (OpenStreetMap)
 * @param {number} lat - Latitudine
 * @param {number} lng - Longitudine
 * @returns {Object} { countryCode, countryName, cityName, provinceSlug, error, loading }
 */
export function useReverseGeocoding(lat, lng) {
  const [countryCode, setCountryCode] = useState(null);
  const [countryName, setCountryName] = useState(null);
  const [cityName, setCityName] = useState(null);
  const [provinceSlug, setProvinceSlug] = useState(null);
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
        // Nominatim non ha un campo "città" unico: a seconda del tipo di area
        // il nome utile può comparire sotto chiavi diverse.
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.municipality ||
          null;
        // Provincia: ComingSoon.it elenca SEMPRE i cinema a livello di
        // capoluogo di provincia (mai del singolo comune), quindi è questo,
        // non il comune, lo slug usato per interrogarlo. Il campo Nominatim
        // "county" non è uniforme (es. "Provincia di Trento" ma "Milano"
        // senza prefisso) — normalizeProvinceCapitalSlug ripulisce entrambe
        // le forme (vedi comingsoonParser.js).
        const province = data.address?.county || data.address?.state_district || null;

        setCountryCode(code);
        setCountryName(name);
        setCityName(city);
        setProvinceSlug(normalizeProvinceCapitalSlug(province));
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

  return { countryCode, countryName, cityName, provinceSlug, error, loading };
}
