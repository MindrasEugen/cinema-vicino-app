import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useGeolocation } from './hooks/useGeolocation';
import { useReverseGeocoding } from './hooks/useReverseGeocoding';
import { useNowPlayingMovies } from './hooks/useNowPlayingMovies';
import { useNearbyCinemas } from './hooks/useNearbyCinemas';
import { useComingSoonData } from './hooks/useComingSoonData';
import { useTheme } from './hooks/useTheme';
import { getGeolocationPermissionInstructions } from './utils/geolocationPermissionInstructions';
import { mapTmdbMovieToFilm } from './services/tmdbService';
import { HomePage } from './pages/HomePage';
import { FilmDetailPage } from './pages/FilmDetailPage';
import { CinemaListPage } from './pages/CinemaListPage';
import './App.css';

function App() {
  // Ottieni la posizione dell'utente
  const { position, error: geoError, loading: geoLoading, retry: retryGeolocation, permissionState } = useGeolocation();

  // Ottieni paese e città dalla posizione (stessa chiamata Nominatim)
  const {
    countryCode,
    countryName,
    cityName,
    provinceSlug,
    error: geoCodeError,
    loading: geoCodeLoading,
  } = useReverseGeocoding(position?.lat, position?.lng);

  // Tema chiaro/scuro (persistito, default scuro) — applicato via data-theme
  // su <html>, quindi resta invariato navigando tra le rotte.
  const { theme, toggleTheme } = useTheme();

  // Cinema vicini (Overpass): servono sia per la sezione indipendente sempre
  // visibile nella vista principale, sia come input per il matching con
  // ComingSoon.it qui sotto — vanno quindi risolti PRIMA di useComingSoonData.
  const { cinemas: nearbyCinemas, error: cinemasError, loading: cinemasLoading } = useNearbyCinemas(
    position?.lat,
    position?.lng
  );

  // Fonte primaria: ComingSoon.it (film + cinema che li proiettano oggi, già
  // incrociati con i cinema vicini qui dentro — vedi useComingSoonData).
  const {
    films: comingSoonFilms,
    loading: comingSoonLoading,
    fallbackReason,
    possibleNetworkBlock,
    ready: comingSoonReady,
  } = useComingSoonData(provinceSlug, nearbyCinemas, cinemasLoading, cityName);

  // Nessuna provincia rilevabile dalla posizione (Nominatim non l'ha
  // restituita): ComingSoon.it non è nemmeno tentabile, si va dritti al fallback.
  const noCityDetected = !geoCodeLoading && !geoCodeError && !provinceSlug;

  // Sappiamo se serve il fallback solo dopo aver risolto la provincia E (se
  // risolta) tentato ComingSoon.it: finché non lo sappiamo, TMDB resta
  // inattivo (countryCode passato come null blocca l'effetto in
  // useNowPlayingMovies) — TMDB non viene mai interrogato in parallelo "per
  // uso normale", solo quando serve davvero.
  const fallbackDecided = noCityDetected || comingSoonReady;
  const usingFallback = noCityDetected || (comingSoonReady && !!fallbackReason);

  const { movies: tmdbMovies, error: tmdbError, loading: tmdbLoading } = useNowPlayingMovies(
    usingFallback ? countryCode : null
  );

  const films = usingFallback ? tmdbMovies.map(mapTmdbMovieToFilm) : comingSoonFilms;
  const filmsLoading = !fallbackDecided || (usingFallback ? tmdbLoading : comingSoonLoading);
  const filmsError = usingFallback ? tmdbError : null;

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
            {/* Solo per errori di geolocalizzazione (non di reverse geocoding):
                riprova la richiesta di permesso senza dover ricaricare la pagina. */}
            {geoError && (
              <>
                <button className="retry-btn" onClick={retryGeolocation}>
                  Riprova
                </button>

                {/* Istruzioni per riabilitare il permesso dalle impostazioni del
                    browser: mostrate solo quando sappiamo che è negato in modo
                    permanente (retry da solo non basta) o quando non possiamo
                    saperlo perché la Permissions API non è supportata. */}
                {(permissionState === 'denied' || permissionState === 'unsupported') && (
                  <div className="permission-instructions">
                    <h3>Come riabilitare il permesso:</h3>
                    <ol className="permission-steps">
                      {getGeolocationPermissionInstructions().map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
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

            <Routes>
              <Route
                path="/"
                element={
                  <HomePage
                    films={films}
                    filmsLoading={filmsLoading}
                    filmsError={filmsError}
                    cityName={cityName}
                    countryName={countryName}
                    usingFallback={usingFallback}
                    fallbackReason={fallbackReason}
                    possibleNetworkBlock={possibleNetworkBlock}
                  />
                }
              />
              <Route
                path="/film/:id"
                element={
                  <FilmDetailPage
                    films={films}
                    filmsLoading={filmsLoading}
                    filmsError={filmsError}
                  />
                }
              />
              <Route
                path="/cinema"
                element={
                  <CinemaListPage
                    cinemas={nearbyCinemas}
                    loading={cinemasLoading}
                    error={cinemasError}
                  />
                }
              />
            </Routes>
          </>
        )}

        {/* Messaggio se abbiamo la posizione ma non il codice paese */}
        {position && !countryCode && !geoCodeError && !geoCodeLoading && (
          <div className="info-message">
            <p>Non e stato possibile determinare il tuo paese. Mostrero solo i cinema vicini.</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Dati forniti da: ComingSoon.it, TMDB (fallback), OpenStreetMap (Nominatim &amp; Overpass API)</p>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Cambia tema chiaro/scuro"
          title={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
        >
          {theme === 'dark' ? '☀️ Tema chiaro' : '🌙 Tema scuro'}
        </button>
      </footer>
    </div>
  );
}

export default App;
