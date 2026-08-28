/**
 * Componente generico per gestire stati di caricamento e errore
 * @param {Object} props
 * @param {boolean} props.loading - Stato di caricamento
 * @param {string} props.error - Messaggio di errore
 * @param {Function} props.children - Contenuto da renderizzare
 */
export function LoadingError({ loading, error, children }) {
  if (loading) {
    return <p className="loading">Caricamento...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  return children;
}
