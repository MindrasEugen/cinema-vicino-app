import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StarRating } from '../components/StarRating';
import { findMatchingNearbyCinema } from '../services/cinemaMatcher';
import { searchMovieTrailerUrl } from '../services/tmdbService';

const POSTER_PLACEHOLDER_SVG =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDM0MiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzNDIiIGhlaWdodD0iNTEyIiBmaWxsPSIjZjVmNWY1Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZTVlN2U3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Qb3N0ZXI8L3RleHQ+Cjwvc3ZnPg==';

/**
 * Pagina dedicata al dettaglio di un film (rotta /film/:id).
 * Riceve i dati già caricati da App.jsx (nessun fetch per-film separato):
 * funziona anche con refresh diretto sull'URL perché App.jsx avvia comunque
 * tutto il data-fetching indipendentemente dalla rotta attiva.
 */
export function FilmDetailPage({ films, filmsLoading, filmsError, crossMatchAvailable, nearbyCinemas }) {
  const { id } = useParams();
  const [trailerLookup, setTrailerLookup] = useState({ status: 'idle', url: null });

  const decodedId = id ? decodeURIComponent(id) : null;
  const film = films.find((f) => f.id === decodedId);

  if (filmsLoading) {
    return (
      <section className="section film-detail">
        <p className="loading">Caricamento in corso...</p>
      </section>
    );
  }

  if (filmsError) {
    return (
      <section className="section film-detail">
        <p className="error">{filmsError}</p>
        <Link className="back-link" to="/">← Torna alla lista</Link>
      </section>
    );
  }

  if (!film) {
    return (
      <section className="section film-detail">
        <h2>Film non trovato</h2>
        <p>Questo film non è (più) nella programmazione odierna.</p>
        <Link className="back-link" to="/">← Torna alla lista</Link>
      </section>
    );
  }

  const handleTrailerFallbackClick = () => {
    setTrailerLookup({ status: 'loading', url: null });
    searchMovieTrailerUrl(film.title, film.year).then((url) => {
      setTrailerLookup({ status: url ? 'found' : 'not-found', url });
    });
  };

  const matchedShowings = crossMatchAvailable
    ? (film.showingsToday || [])
        .map((showing) => ({
          ...showing,
          nearbyCinema: findMatchingNearbyCinema(showing.cinemaName, nearbyCinemas),
        }))
        .filter((showing) => showing.nearbyCinema)
    : [];

  return (
    <section className="section film-detail">
      <Link className="back-link" to="/">← Torna alla lista</Link>

      <div className="film-detail-layout">
        <div className="film-detail-poster">
          <img
            src={film.posterUrl || POSTER_PLACEHOLDER_SVG}
            alt={`Locandina di ${film.title}`}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = POSTER_PLACEHOLDER_SVG;
            }}
          />
        </div>

        <div className="film-detail-info">
          <h2>{film.title}</h2>

          {film.genres.length > 0 && (
            <div className="movie-genres">
              {film.genres.map((genre) => (
                <span key={genre} className="movie-genre-badge">{genre}</span>
              ))}
            </div>
          )}

          <p className="movie-release">
            <span role="img" aria-label="Calendario">📅</span>
            {film.year || 'Anno sconosciuto'}
            {film.durationMinutes ? ` · ${film.durationMinutes} min` : ''}
          </p>

          <p className="movie-vote">
            <StarRating rating={film.rating} ratingScale={film.ratingScale} />
            {film.rating != null && <span className="movie-vote-number"> {film.rating.toFixed(1)} / {film.ratingScale}</span>}
          </p>

          {(film.overviewFull || film.overviewShort) && (
            <p className="movie-overview">{film.overviewFull || film.overviewShort}</p>
          )}

          {(film.director || film.cast.length > 0) && (
            <p className="movie-cast">
              {film.director && <><strong>Regia:</strong> {film.director}. </>}
              {film.cast.length > 0 && <><strong>Con:</strong> {film.cast.join(', ')}</>}
            </p>
          )}

          {film.trailerUrl ? (
            <a className="movie-trailer-link" href={film.trailerUrl} target="_blank" rel="noopener noreferrer">
              ▶ Guarda il trailer
            </a>
          ) : trailerLookup.status === 'idle' ? (
            <button className="movie-trailer-btn" onClick={handleTrailerFallbackClick}>
              Cerca trailer
            </button>
          ) : trailerLookup.status === 'loading' ? (
            <p className="movie-showings-empty">Ricerca trailer in corso...</p>
          ) : trailerLookup.status === 'found' ? (
            <a className="movie-trailer-link" href={trailerLookup.url} target="_blank" rel="noopener noreferrer">
              ▶ Guarda il trailer
            </a>
          ) : (
            <p className="movie-showings-empty">Trailer non disponibile.</p>
          )}

          {crossMatchAvailable && (
            <div className="movie-showings">
              <h4>Oggi vicino a te</h4>
              {matchedShowings.length > 0 ? (
                matchedShowings.map((showing) => (
                  <div key={showing.myMoviesCinemaUrl} className="movie-showing-item">
                    <div className="movie-showing-main">
                      <span>{showing.nearbyCinema.name}</span>
                      <span className="movie-showing-times">
                        {showing.times && showing.times.length > 0
                          ? showing.times.join(', ')
                          : 'orario non disponibile'}
                      </span>
                    </div>
                    <span className="movie-showing-links">
                      {showing.nearbyCinema.website && (
                        <a href={showing.nearbyCinema.website} target="_blank" rel="noopener noreferrer">
                          Sito
                        </a>
                      )}
                      <a href={showing.myMoviesCinemaUrl} target="_blank" rel="noopener noreferrer">
                        Programmazione
                      </a>
                    </span>
                  </div>
                ))
              ) : (
                <p className="movie-showings-empty">Nessuna sala vicina a te per questo film oggi.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
