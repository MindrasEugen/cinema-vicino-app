/**
 * Calcola la distanza tra due punti sulla Terra usando la formula di Haversine
 * @param {number} lat1 - Latitudine del primo punto (in gradi)
 * @param {number} lon1 - Longitudine del primo punto (in gradi)
 * @param {number} lat2 - Latitudine del secondo punto (in gradi)
 * @param {number} lon2 - Longitudine del secondo punto (in gradi)
 * @returns {number} Distanza in chilometri
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raggio della Terra in chilometri
  
  // Converti i gradi in radianti
  const lat1Rad = lat1 * Math.PI / 180;
  const lon1Rad = lon1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lon2Rad = lon2 * Math.PI / 180;
  
  // Differenza di latitudine e longitudine
  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;
  
  // Formula di Haversine
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distanza in chilometri
  return R * c;
}

/**
 * Formatta una distanza in chilometri per la visualizzazione
 * @param {number} distance - Distanza in chilometri
 * @returns {string} Distanza formattata
 */
export function formatDistance(distance) {
  if (distance < 1) {
    // Mostra in metri per distanze inferiori a 1 km
    return `${Math.round(distance * 1000)} m`;
  } else if (distance < 10) {
    // Mostra con 2 decimali per distanze inferiori a 10 km
    return `${distance.toFixed(2)} km`;
  } else {
    // Mostra con 1 decimale per distanze superiori
    return `${distance.toFixed(1)} km`;
  }
}

/**
 * Formatta una data ISO (es. 2024-01-15) in formato italiano
 * @param {string} dateString - Data in formato ISO
 * @returns {string} Data formattata
 */
export function formatDate(dateString) {
  if (!dateString) return 'Data sconosciuta';
  
  const date = new Date(dateString);
  
  // Verifica se la data è valida
  if (isNaN(date.getTime())) {
    return 'Data sconosciuta';
  }
  
  return date.toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formatta il voto medio (da 0 a 10) per la visualizzazione
 * @param {number} vote - Voto medio
 * @returns {string} Voto formattato
 */
export function formatVote(vote) {
  if (vote === undefined || vote === null) return 'N/A';
  return vote.toFixed(1);
}

/**
 * Ottiene l'URL completo del poster di un film da TMDB
 * @param {string} posterPath - Percorso del poster (es. /xYZabc123.jpg)
 * @param {string} size - Dimensione dell'immagine (es. 'w500', 'w342', 'w185')
 * @returns {string} URL completo del poster
 */
export function getPosterUrl(posterPath, size = 'w500') {
  if (!posterPath) {
    return null;
  }
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
