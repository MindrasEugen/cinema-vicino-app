import { Link } from 'react-router-dom';
import { CinemasList } from '../components/CinemasList';

/**
 * Pagina dedicata all'elenco di tutti i cinema vicini (rotta /cinema).
 * Riusa gli stessi dati già ottenuti da useNearbyCinemas in App.jsx — nessuna
 * nuova chiamata, solo la UI già esistente spostata dalla home a una pagina propria.
 */
export function CinemaListPage({ cinemas, loading, error }) {
  return (
    <>
      <Link className="back-link" to="/">← Torna alla lista film</Link>
      <CinemasList cinemas={cinemas} loading={loading} error={error} />
    </>
  );
}
