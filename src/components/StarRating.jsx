import { getFilledStars } from '../utils/rating';

/**
 * Voto a 5 stelle. Se rating è null (voto non ancora disponibile) mostra
 * comunque 5 stelle vuote invece di non renderizzare nulla.
 */
export function StarRating({ rating, ratingScale }) {
  const filled = getFilledStars(rating, ratingScale);

  return (
    <span className="star-rating" role="img" aria-label={rating != null ? `Voto: ${filled} su 5 stelle` : 'Voto non disponibile'}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? 'star star-filled' : 'star star-empty'}>
          ★
        </span>
      ))}
    </span>
  );
}
