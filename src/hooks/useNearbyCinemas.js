import { useState, useEffect } from 'react';
import { haversine } from '../utils/haversine';

/**
 * Hook per ottenere i cinema vicini tramite Overpass API (OpenStreetMap)
 * Implementa fallback automatico: se overpass-api.de fallisce, ritenta su overpass.openstreetmap.fr
 * (vedi NOTE.md per la gestione della intermittenza di Overpass).
 * @param {number} lat - Latitudine dell'utente
 * @param {number} lng - Longitudine dell'utente
 * @returns {Object} { cinemas, error, loading }
 */
export function useNearbyCinemas(lat, lng) {
  const [cinemas, setCinemas] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;

    setLoading(true);
    const controller = new AbortController();

    // Raggio di ricerca in metri (10 km)
    const radius = 10000;
    
    // Query Overpass QL per trovare cinema (nodi e way) in un raggio di 10km.
    // Oltre al tag standard amenity=cinema, include anche leisure=cinema:
    // variante meno comune ma usata in OSM per alcune sale, specie piccole/di
    // paese, che altrimenti risulterebbero invisibili pur essendo mappate
    // (vedi NOTE.md). amenity=theatre è stato scartato: in OSM indica teatri
    // generici, non necessariamente sale cinematografiche, e includerlo
    // rischierebbe più falsi positivi che cinema realmente recuperati.
    const query = `[out:json];
(
  node["amenity"="cinema"](around:${radius},${lat},${lng});
  way["amenity"="cinema"](around:${radius},${lat},${lng});
  node["leisure"="cinema"](around:${radius},${lat},${lng});
  way["leisure"="cinema"](around:${radius},${lat},${lng});
);
out center;
`;

    /**
     * Funzione helper per fare il fetch da un endpoint Overpass specifico.
     * Ritorna una Promise che resolve in `data.elements` se succede,
     * oppure reject se:
     * - la fetch stessa fallisce (network error, AbortError, ecc.)
     * - response.ok è false
     * - il body non è JSON valido
     * 
     * @param {string} endpoint - URL dell'API Overpass da contattare
     * @returns {Promise<Array>} Array di elementi Overpass
     */
    async function fetchFromOverpass(endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.elements || [];
    }

    /**
     * Processo main: prova il primo endpoint, poi il fallback se il primo fallisce.
     */
    (async () => {
      try {
        let cinemasData;
        
        // Tentativo 1: endpoint primario
        try {
          cinemasData = await fetchFromOverpass('https://overpass-api.de/api/interpreter');
        } catch (primaryError) {
          // Se il primario fallisce, prova il mirror di fallback
          console.warn('[Overpass] Primario (overpass-api.de) fallito, ritento su fallback (overpass.openstreetmap.fr):', primaryError.message);
          cinemasData = await fetchFromOverpass('https://overpass.openstreetmap.fr/api/interpreter');
        }

        // Elabora i risultati: gestisci sia nodi che way
        const processedCinemas = cinemasData.map(element => {
          // Per i way, otteniamo il centro del poligono
          let cinemaLat, cinemaLng;
          if (element.type === 'node') {
            cinemaLat = element.lat;
            cinemaLng = element.lon;
          } else if (element.type === 'way' && element.center) {
            cinemaLat = element.center.lat;
            cinemaLng = element.center.lon;
          } else {
            // Se non abbiamo coordinate, salta questo elemento
            return null;
          }
          
          // Calcola la distanza dalla posizione dell'utente
          const distance = haversine(lat, lng, cinemaLat, cinemaLng);
          
          // Estrai le informazioni dai tag
          const tags = element.tags || {};
          
          return {
            id: element.id,
            type: element.type,
            name: tags.name || 'Cinema senza nome',
            address: buildAddress(tags),
            website: getWebsite(tags),
            distance: distance,
            lat: cinemaLat,
            lng: cinemaLng
          };
        }).filter(c => c !== null); // Filtra gli elementi nulli

        // Ordina per distanza (dal più vicino al più lontano)
        processedCinemas.sort((a, b) => a.distance - b.distance);
        
        setCinemas(processedCinemas);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Errore nel caricamento dei cinema (entrambi gli endpoint falliti):', err);
          setError('Impossibile caricare i cinema vicini. I dati potrebbero essere incompleti per la tua zona.');
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [lat, lng]);

  return { cinemas, error, loading };
}

/**
 * Costruisce l'indirizzo dai tag OSM
 * @param {Object} tags - Tag dell'elemento OSM
 * @returns {string|null} Indirizzo formattato o null
 */
function buildAddress(tags) {
  const parts = [];
  
  if (tags['addr:housenumber']) {
    parts.push(tags['addr:housenumber']);
  }
  if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) {
    parts.push(tags['addr:city']);
  }
  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }
  
  // Se abbiamo solo il nome della città, usalo
  if (parts.length === 0 && tags['addr:city']) {
    return tags['addr:city'];
  }
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Estrae l'URL del sito web dai tag OSM
 * @param {Object} tags - Tag dell'elemento OSM
 * @returns {string|null} URL del sito web o null
 */
function getWebsite(tags) {
  // Prova prima 'website', poi 'contact:website'
  const website = tags.website || tags['contact:website'];
  
  if (!website) return null;
  
  // Assicurati che l'URL inizi con http:// o https://
  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website;
  }
  
  // Se manca lo schema, aggiungi https://
  return `https://${website}`;
}
