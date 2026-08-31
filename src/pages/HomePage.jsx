import { Link } from 'react-router-dom';
import { MoviesList } from '../components/MoviesList';

/**
 * Vista principale: card film minimali (il dettaglio vive in /film/:id).
 * La lista completa dei cinema vicini vive nella propria pagina (/cinema,
 * vedi CinemaListPage) — qui c'è solo un link ben visibile per raggiungerla.
 */
export function HomePage({
  films,
  filmsLoading,
  filmsError,
  cityName,
  countryName,
  usingFallback,
  fallbackReason,
  possibleNetworkBlock,
}) {
  return (
    <>
      {usingFallback && (
        <div className="info-message">
          <p>
            L'abbinamento automatico tra film e cinema (con i relativi orari di proiezione)
            non è al momento disponibile
            {fallbackReason ? ' (MYmovies non ha risposto correttamente)' : ' per la tua città'}.
            Stiamo mostrando film e cinema come due liste separate, senza orari.
          </p>
          {possibleNetworkBlock && (
            <p className="hint">
              La richiesta a MYmovies non ha ricevuto risposta: se il problema persiste
              solo su questo dispositivo o questa rete, potrebbe trattarsi di una VPN, un
              DNS filtrante o un blocco tracker della rete/operatore che impedisce la
              richiesta. Provare a disattivarli o a cambiare rete può risolvere.
            </p>
          )}
        </div>
      )}

      <MoviesList
        films={films}
        loading={filmsLoading}
        error={filmsError}
        cityName={!usingFallback ? cityName : null}
        countryName={countryName}
        headerAction={
          <Link className="cinema-link-button" to="/cinema">Cinema vicino a te →</Link>
        }
      />
    </>
  );
}
