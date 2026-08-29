/**
 * Converte un voto in una scala arbitraria (es. 0-5 MYmovies, 0-10 TMDB) in un
 * numero intero di stelle piene su un totale di 5. Un voto assente
 * (null/undefined) ritorna 0 stelle piene (tutte vuote), non viene omesso.
 */
export function getFilledStars(rating, ratingScale) {
  if (rating == null || !ratingScale) return 0;
  const normalized = (rating / ratingScale) * 5;
  return Math.max(0, Math.min(5, Math.round(normalized)));
}
