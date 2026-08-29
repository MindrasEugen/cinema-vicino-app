/**
 * Confronto tollerante tra i nomi dei cinema su MYmovies e quelli ottenuti da
 * Overpass (useNearbyCinemas), per mostrare solo i cinema che proiettano un
 * film e sono anche effettivamente vicini all'utente.
 *
 * I nomi non coincidono mai esattamente tra le due fonti (es. MYmovies
 * "CINEMA Colosseo" vs OSM "Cinema Colosseo", o "Uci Cinemas Bicocca" vs
 * "UCI Cinemas Bicocca Village"), quindi il confronto normalizza e poi prova
 * corrispondenza esatta, poi per inclusione in entrambe le direzioni.
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
 * Cerca, tra i cinema vicini (Overpass), quello che meglio corrisponde al nome
 * di un cinema MYmovies. Ritorna il cinema Overpass corrispondente o null se
 * nessuno sembra abbastanza simile.
 */
export function findMatchingNearbyCinema(myMoviesCinemaName, nearbyCinemas) {
  const target = normalizeName(myMoviesCinemaName);
  if (!target || !nearbyCinemas?.length) return null;

  for (const cinema of nearbyCinemas) {
    if (normalizeName(cinema.name) === target) return cinema;
  }

  // Corrispondenza per inclusione: richiede una lunghezza minima per evitare
  // falsi positivi su nomi troppo corti/generici (es. "cinema" da solo,
  // già rimosso, o iniziali di poche lettere).
  const MIN_LENGTH_FOR_SUBSTRING = 4;
  if (target.length >= MIN_LENGTH_FOR_SUBSTRING) {
    for (const cinema of nearbyCinemas) {
      const candidate = normalizeName(cinema.name);
      if (candidate.length < MIN_LENGTH_FOR_SUBSTRING) continue;
      if (candidate.includes(target) || target.includes(candidate)) {
        return cinema;
      }
    }
  }

  return null;
}
