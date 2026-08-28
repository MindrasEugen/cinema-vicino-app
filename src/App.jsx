import { useState, useEffect } from 'react';
import { useGeolocation } from './hooks/useGeolocation';
import { useReverseGeocoding } from './hooks/useReverseGeocoding';
import { useNowPlayingMovies } from './hooks/useNowPlayingMovies';
import { useNearbyCinemas } from './hooks/useNearbyCinemas';
import { MoviesList } from './components/MoviesList';
import { CinemasList } from './components/CinemasList';
import './App.css';

function App() {
  // Ottieni la posizione dell'utente
  const { position, error: geoError, loading: geoLoading } = useGeolocation();
  
  // Ottieni il codice paese dalla posizione
  const { countryCode, countryName, error: geoCodeError } = useReverseGeocoding(
    position?.lat, 
    position?.lng 
  );
  
  // Ottieni i film al cinema per il paese
  const { movies, error: moviesError, loading: moviesLoading } = useNowPlayingMovies(countryCode);
  
  // Ottieni i cinema vicini
  const { cinemas, error: cinemasError, loading: cinemasLoading } = useNearbyCinemas(
    position?.lat, 
    position?.lng 
  );

  // Stato per tracciare se l'utente ha visto il messaggio di benvenuto
  const [showWelcome, setShowWelcome] = useState(true);

  // Nascondi il messaggio di benvenuto quando abbiamo la posizione
  useEffect(() => {
    if (position) {
      const timer = setTimeout(() => setShowWelcome(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [position]);

  // Messaggio di errore principale (geolocalizzazione o reverse geocoding)
  const mainError = geoError || geoCodeError;

  return (
    <div className="app">
      <header className="header">
        <h1>Al Cinema Vicino a Te</h1>
        <p className="subtitle">Scopri i film al cinema e i cinema vicino a te</p>
      </header>

      <main className="main">
        {/* Messaggio di caricamento iniziale */}
        {geoLoading && (
          <div className="initial-loading">
            <p>Richiedendo permesso di geolocalizzazione...</p>
            <p className="hint">Consenti l'accesso alla posizione per continuare</p>
          </div>
        )}

        {/* Messaggio di errore principale (geolocalizzazione) */}
        {mainError && !geoLoading && (
          <div className="error-message">
            <h2>Errore</h2>
            <p>{mainError}</p>
            <p className="hint">
              L'app non puo funzionare senza accesso alla tua posizione.
            </p>
          </div>
        )}

        {/* Contenuto principale - solo se abbiamo la posizione */}
        {position && !mainError && (
          <>
            {/* Messaggio di benvenuto temporaneo */}
            {showWelcome && (
              <div className="welcome-message">
                <p>Posizione ottenuta con successo!</p>
                <p>Caricamento dati in corso...</p>
              </div>
            )}

            {/* Sezione Film al cinema */}
            <MoviesList 
              movies={movies} 
              loading={moviesLoading} 
              error={moviesError} 
              countryName={countryName}
            />

            {/* Sezione Cinema vicini */}
            <CinemasList 
              cinemas={cinemas} 
              loading={cinemasLoading} 
              error={cinemasError}
            />
          </>
        )}

        {/* Messaggio se abbiamo la posizione ma non il codice paese */}
        {position && !countryCode && !geoCodeError && !geoLoading && (
          <div className="info-message">
            <p>Non e stato possibile determinare il tuo paese. Mostrero solo i cinema vicini.</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Dati forniti da: TMDB, OpenStreetMap (Nominatim & Overpass API)</p>
      </footer>
    </div>
  );
}

export default App;
