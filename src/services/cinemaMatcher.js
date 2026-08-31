/**
 * Confronto tollerante tra nomi di cinema provenienti da fonti diverse — usato
 * per il matching tra i cinema vicini via Overpass (useNearbyCinemas) e
 * l'elenco cinema di ComingSoon.it (useComingSoonData), che non coincidono
 * mai esattamente tra loro (es. "CINEMA Colosseo" vs "Cinema Colosseo", o
 * "Uci Cinemas Bicocca" vs "UCI Cinemas Bicocca Village") — il confronto
 * normalizza e poi prova corrispondenza esatta, poi per inclusione in
 * entrambe le direzioni. Simmetrico: funziona indipendentemente da quale
 * dei due elenchi sia passato come lista candidati.
 */

const NOISE_WORDS = ['cinema', 'cinemas', 'multisala', 'multiplex', 'cityplex', 'arena'];

function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeName(name) {
  if (!name) return '';
  let normalized = stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const word of NOISE_WORDS) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '').trim();
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Cerca, in un elenco di cinema, quello che meglio corrisponde per nome a
 * `targetCinemaName`. Ritorna il cinema corrispondente (l'oggetto originale
 * della lista `candidates`) o null se nessuno sembra abbastanza simile.
 */
export function findMatchingNearbyCinema(targetCinemaName, candidates) {
  const target = normalizeName(targetCinemaName);
  if (!target || !candidates?.length) return null;

  for (const cinema of candidates) {
    if (normalizeName(cinema.name) === target) return cinema;
  }

  // Corrispondenza per inclusione: richiede una lunghezza minima per evitare
  // falsi positivi su nomi troppo corti/generici (es. "cinema" da solo,
  // già rimosso, o iniziali di poche lettere).
  const MIN_LENGTH_FOR_SUBSTRING = 4;
  if (target.length >= MIN_LENGTH_FOR_SUBSTRING) {
    for (const cinema of candidates) {
      const candidate = normalizeName(cinema.name);
      if (candidate.length < MIN_LENGTH_FOR_SUBSTRING) continue;
      if (candidate.includes(target) || target.includes(candidate)) {
        return cinema;
      }
    }
  }

  return null;
}
