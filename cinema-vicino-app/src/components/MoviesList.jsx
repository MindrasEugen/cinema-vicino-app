import { formatDate, formatVote, getPosterUrl } from '../utils/haversine';

/**
 * Componente che mostra la lista dei film attualmente al cinema
 * @param {Object} props
 * @param {Array} props.movies - Array di film
 * @param {boolean} props.loading - Stato di caricamento
 * @param {string} props.error - Messaggio di errore
 * @param {string} props.countryName - Nome del paese
 */
export function MoviesList({ movies, loading, error, countryName }) {
  // Messaggio di caricamento
  if (loading) {
    return (
      <section className="section">
        <h2>Film al cinema {countryName ? `in ${countryName}` : ''}</h2>
        <p className="loading">Caricamento film in corso...</p>
      </section>
    );
  }

  // Messaggio di errore
  if (error) {
    return (
      <section className="section">
        <h2>Film al cinema {countryName ? `in ${countryName}` : ''}</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  // Nessun film trovato
  if (movies.length === 0) {
    return (
      <section className="section">
        <h2>Film al cinema {countryName ? `in ${countryName}` : ''}</h2>
        <p>Nessun film attualmente al cinema trovato per questo paese.</p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>Film al cinema {countryName ? `in ${countryName}` : ''}</h2>
      <div className="movies-grid">
        {movies.map(movie => (
          <article key={movie.id} className="movie-card">
            <div className="movie-poster">
              {movie.poster_path ? (
                <img 
                  src={getPosterUrl(movie.poster_path, 'w342')} 
                  alt={`Poster di ${movie.title}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDM0MiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzNDIiIGhlaWdodD0iNTEyIiBmaWxsPSIjZjVmNWY1Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZTVlN2U3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Qb3N0ZXI8L3RleHQ+Cjwvc3ZnPg==';
                  }}
                />
              ) : (
                <div className="poster-placeholder">Nessun poster</div>
              )}
            </div>
            <div className="movie-info">
              <h3>{movie.title}</h3>
              <p className="movie-release">
                <span role="img" aria-label="Calendario">📅</span> 
                {formatDate(movie.release_date)}
              </p>
              <p className="movie-vote">
                <span role="img" aria-label="Stella">⭐</span> 
                {formatVote(movie.vote_average)} / 10
              </p>
              {movie.overview && (
                <p className="movie-overview">{movie.overview.length > 150 ? movie.overview.substring(0, 150) + '...' : movie.overview}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
