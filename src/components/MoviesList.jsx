import { Link } from 'react-router-dom';
import { StarRating } from './StarRating';

const POSTER_PLACEHOLDER_SVG =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDM0MiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzNDIiIGhlaWdodD0iNTEyIiBmaWxsPSIjZjVmNWY1Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZTVlN2U3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Qb3N0ZXI8L3RleHQ+Cjwvc3ZnPg==';

/**
 * Card minimale: poster, titolo, voto in stelle. Nessun altro dato (sinossi,
 * cast, cinema, trailer): quelli vivono nella pagina dedicata /film/:id.
 */
function FilmCard({ film }) {
  return (
    <Link to={`/film/${encodeURIComponent(film.id)}`} className="movie-card">
      <div className="movie-poster">
        {film.posterUrl ? (
          <img
            src={film.posterUrl}
            alt={`Locandina di ${film.title}`}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = POSTER_PLACEHOLDER_SVG;
            }}
          />
        ) : (
          <div className="poster-placeholder">Nessun poster</div>
        )}
      </div>
      <div className="movie-info">
        <h3>{film.title}</h3>
        <StarRating rating={film.rating} ratingScale={film.ratingScale} />
      </div>
    </Link>
  );
}

/**
 * Griglia di card film minimali. Il click su una card naviga a /film/:id
 * (routing gestito dal chiamante tramite react-router-dom).
 * @param {Object} props
 * @param {Array} props.films - Array di film in forma comune
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {string} props.cityName - Nome città (fonte ComingSoon.it)
 * @param {string} props.countryName - Nome paese (fonte TMDB, fallback)
 * @param {import('react').ReactNode} props.headerAction - Contenuto opzionale
 *   affiancato al titolo (es. il link alla pagina cinema), sulla stessa riga
 *   su schermi larghi.
 */
export function MoviesList({ films, loading, error, cityName, countryName, headerAction }) {
  const locationLabel = cityName ? `a ${cityName}` : countryName ? `in ${countryName}` : '';

  const header = (
    <div className="section-header">
      <h2>Film al cinema {locationLabel}</h2>
      {headerAction}
    </div>
  );

  if (loading) {
    return (
      <section className="section">
        {header}
        <p className="loading">Caricamento film in corso...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        {header}
        <p className="error">{error}</p>
      </section>
    );
  }

  if (films.length === 0) {
    return (
      <section className="section">
        {header}
        <p>Nessun film attualmente al cinema trovato.</p>
      </section>
    );
  }

  return (
    <section className="section">
      {header}
      <div className="movies-grid">
        {films.map((film) => (
          <FilmCard key={film.id} film={film} />
        ))}
      </div>
    </section>
  );
}
