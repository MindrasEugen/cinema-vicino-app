import { formatDistance } from '../utils/haversine';

/**
 * Componente che mostra la lista dei cinema vicini
 * @param {Object} props
 * @param {Array} props.cinemas - Array di cinema
 * @param {boolean} props.loading - Stato di caricamento
 * @param {string} props.error - Messaggio di errore
 */
export function CinemasList({ cinemas, loading, error }) {
  // Messaggio di caricamento
  if (loading) {
    return (
      <section className="section">
        <h2>Cinema vicino a te</h2>
        <p className="loading">Ricerca cinema in corso...</p>
      </section>
    );
  }

  // Messaggio di errore
  if (error) {
    return (
      <section className="section">
        <h2>Cinema vicino a te</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  // Nessun cinema trovato
  if (cinemas.length === 0) {
    return (
      <section className="section">
        <h2>Cinema vicino a te</h2>
        <p>Nessun cinema trovato nel raggio di 10 km dalla tua posizione.</p>
        <p className="hint">
          I dati dei cinema su OpenStreetMap potrebbero essere incompleti per la tua zona.
        </p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>Cinema vicino a te</h2>
      <div className="cinemas-list">
        {cinemas.map(cinema => (
          <article key={cinema.id} className="cinema-card">
            <div className="cinema-header">
              <h3>{cinema.name}</h3>
              <span className="cinema-distance">
                {formatDistance(cinema.distance)}
              </span>
            </div>
            
            {cinema.address && (
              <p className="cinema-address">
                <span role="img" aria-label="Indirizzo">📍</span> {cinema.address}
              </p>
            )}
            
            {cinema.website && (
              <p className="cinema-website">
                <a href={cinema.website} target="_blank" rel="noopener noreferrer">
                  <span role="img" aria-label="Sito web">🌐</span> Sito web
                </a>
              </p>
            )}
            
            <div className="cinema-meta">
              <span className="cinema-id">ID: {cinema.id}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
