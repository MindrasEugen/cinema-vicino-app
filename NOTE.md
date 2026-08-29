# Al Cinema Vicino a Te - Note Tecniche

## Come ottenere una API Key TMDB

1. Vai su [The Movie Database (TMDB) - API](https://www.themoviedb.org/settings/api)
2. Registrati (gratuitamente) se non hai già un account
3. Richiedi una API key dal pannello delle impostazioni
4. Copia la chiave generata (v4 auth)
5. Crea un file `.env` nella radice del progetto con:
   ```
   VITE_TMDB_API_KEY=tua_chiave_api
   ```

## Endpoint API Utilizzati

### 1. Nominatim (OpenStreetMap) - Reverse Geocoding
- **Endpoint:** `https://nominatim.openstreetmap.org/reverse`
- **Parametri:** `format=json&lat={lat}&lon={lon}`
- **Header obbligatorio:** `User-Agent: AlCinemaApp/1.0`
- **Scopo:** Ottenere il codice paese ISO 3166-1 alpha-2 dalle coordinate
- **Campo utile:** `address.country_code` (portato in maiuscolo)

### 2. TMDB (The Movie Database) - Film al Cinema
- **Endpoint:** `https://api.themoviedb.org/3/movie/now_playing`
- **Parametri:** `region={CODICE_PAESE}&api_key={API_KEY}&language=it-IT`
- **Scopo:** Ottenere la lista dei film attualmente al cinema per un paese specifico
- **Campi utili:** `results[].title`, `results[].poster_path`, `results[].release_date`, `results[].vote_average`, `results[].overview`

### 3. Overpass API (OpenStreetMap) - Cinema Vicini
- **Endpoint:** `https://overpass-api.de/api/interpreter`
- **Metodo:** POST
- **Query (Overpass QL):**
  ```
  [out:json];
  (
    node["amenity"="cinema"](around:10000,{lat},{lon});
    way["amenity"="cinema"](around:10000,{lat},{lon});
  );
  out center;
  ```
- **Scopo:** Trovare cinema (nodi e way) in un raggio di 10 km dalla posizione
- **Campi utili:** `elements[].tags.name`, `elements[].tags.addr:*`, `elements[].tags.website`, `elements[].tags.contact:website`, `elements[].lat`, `elements[].lon`, `elements[].center`

## Limitazioni Note

### Nominatim (OpenStreetMap)
- **Rate Limiting:** Max 1 richiesta al secondo per IP
- **User-Agent obbligatorio:** Senza header `User-Agent` personalizzato, le richieste vengono bloccate
- **Accuratezza:** Il reverse geocoding potrebbe non essere sempre preciso, specialmente in aree remote
- **Privacy:** Non memorizzare i dati di geolocalizzazione degli utenti

### TMDB
- **API Key richiesta:** Senza chiave valida, l'endpoint restituisce 401
- **Rate Limiting:** 
  - 10.000 richieste al giorno per account gratuito
  - 40 richieste ogni 10 secondi
- **Dati regionali:** Non tutti i paesi hanno dati completi sui film al cinema
- **Lingua:** I risultati possono variare a seconda della lingua richiesta

### Overpass API
- **Dati incompleti:** I cinema su OpenStreetMap potrebbero non essere tutti mappati
- **Qualità dei dati:** Alcuni cinema potrebbero non avere nome, indirizzo o sito web
- **Aree rurali:** In zone poco abitate, potrebbero non esserci cinema nel raggio di 10 km
- **Ritardi:** Le modifiche su OSM possono impiegare tempo per essere riflessi in Overpass

### Geolocalizzazione Browser
- **Permesso necessario:** L'utente deve consentire esplicitamente l'accesso alla posizione
- **Accuratezza variabile:** Dipende dal dispositivo e dal segnale GPS/WiFi
- **Browser non supportati:** Alcuni browser vecchi potrebbero non supportare la Geolocation API

## Soluzione ai Problemi Comuni

### "API key non valida"
- Verifica che il file `.env` esista e contenga `VITE_TMDB_API_KEY=tua_chiave`
- Verifica che la chiave sia corretta e attiva
- Riavvia il server di sviluppo dopo aver aggiunto il file `.env`

### "Nessun cinema trovato"
- Prova a aumentare il raggio di ricerca (modifica `radius` in `useNearbyCinemas.js`)
- Verifica che la tua posizione sia corretta
- I dati OSM potrebbero essere incompleti per la tua zona

### "Permesso negato"
- L'utente ha cliccato "Negare" sul popup del browser
- Chiedi all'utente di ricaricare la pagina e consentire la geolocalizzazione
- Su alcuni browser (Chrome), puoi controllare le impostazioni del sito

### "Impossibile determinare il paese"
- Prova a ricaricare la pagina
- Verifica che la tua connessione internet funzioni
- Il servizio Nominatim potrebbe essere temporaneamente non disponibile

## Note di Sviluppo

- L'app utilizza **React 18+** con componenti funzionali e hook
- **Vite** è usato come bundler per lo sviluppo rapido
- Tutte le chiamate HTTP sono fatte con l'API nativa `fetch`
- Le distanze sono calcolate usando la **formula di Haversine** senza librerie esterne
- Il codice è organizzato in hook riutilizzabili per una migliore manutenibilità

## Dipendenze

Nessuna dipendenza esterna oltre a React e Vite. Tutti i calcoli e le chiamate API sono implementati con codice nativo.

## MYmovies.it come fonte primaria, TMDB come fallback automatico

A partire da questa versione l'app è limitata all'Italia e usa **MYmovies.it** come
fonte primaria per film + cinema che li proiettano (già abbinati nella stessa
pagina, niente fuzzy matching tra fonti diverse). **TMDB** resta configurato e
scatta automaticamente come fallback solo quando MYmovies non risponde o la sua
struttura risulta cambiata.

### Moduli coinvolti

- `src/services/mymoviesParser.js` — parsing puro/isomorfo (nessuna API browser),
  usato sia a runtime sia dallo script di controllo struttura.
- `src/services/mymoviesService.js` — fetch con cache (qualche ora) + gestione CORS,
  lancia `MyMoviesFetchError` / `MyMoviesStructureError` in caso di fallimento.
- `src/services/tmdbService.js` — fallback completo (now_playing IT) e fallback
  puntuale solo-trailer per singolo film.
- `src/services/cinemaMatcher.js` — confronto tollerante dei nomi cinema
  MYmovies ↔ Overpass.
- `src/hooks/useMyMoviesData.js` — orchestrazione + log del fallback in console
  (prefisso `[MyMovies]`, utile in manutenzione per capire quando/se scatta).

### Orari di proiezione per cinema

Gli orari (uno o più per cinema, es. "15:30, 18:00, 21:15") sono estratti da
`mymoviesParser.js` insieme al resto: sono già presenti inline nella stessa
sezione "OGGI A {CITTÀ}" di ogni film (blocco `orari-dettaglio` subito dopo il
nome di ciascun cinema), quindi non serve alcuna richiesta HTTP aggiuntiva per
ottenerli (a differenza di quanto sarebbe servito se fossero stati disponibili
solo sulla pagina del singolo cinema). Se lo stesso cinema compare più volte
nella sezione (es. versione doppiata + versione originale come voci separate),
gli orari vengono uniti sotto un'unica voce e ordinati cronologicamente. In
modalità fallback TMDB gli orari non sono mai disponibili (TMDB è un database
di film generico, non di programmazione): la nota visibile in home lo indica
esplicitamente.

### Gestione CORS

MYmovies.it non espone header CORS (verificato: nessun `Access-Control-Allow-Origin`),
quindi un fetch diretto dal browser viene bloccato. Soluzione a due livelli:

- **Sviluppo** (`npm run dev`): `vite.config.js` proxya `/mymovies-proxy/*` verso
  `https://www.mymovies.it/*` tramite il dev server Node (il browser non fa mai
  una richiesta cross-origin diretta).
- **Produzione**: non essendoci un backend nel progetto, `mymoviesService.js` usa
  come soluzione minima un proxy CORS pubblico (`proxy.cors.sh`, verificato
  funzionante il 2026-08-30 sul deploy Render — `corsproxy.io`, usato in
  precedenza, ha iniziato a richiedere una API key a pagamento). È un punto di
  fragilità aggiuntivo rispetto al parsing stesso: se anche questo comincia a
  fallire, scatta comunque il fallback TMDB, quindi l'app resta utilizzabile.
  Se dovesse rompersi di nuovo, verificare con un fetch diretto dal browser
  sull'app deployata (non solo in locale, dove in dev si usa il proxy Vite) —
  è così che è stato scoperto questo problema. Se in futuro si aggiunge un
  backend proprio, va sostituito con un proxy self-hosted.

### Script di controllo struttura — rilanciare periodicamente

`tests/test-mymovies-scraper-struttura.js` scarica una pagina reale (Milano) e
verifica che gli elementi chiave attesi siano ancora presenti (blocchi film,
sezione "OGGI A", link ai cinema, almeno un film estratto con showings).

```
node tests/test-mymovies-scraper-struttura.js
```

**Va rilanciato periodicamente (indicativamente una volta a settimana)**: i siti
di terze parti cambiano struttura senza preavviso. Se il test fallisce, il
markup di `src/services/mymoviesParser.js` va aggiornato di conseguenza.

**Nel frattempo l'app non si rompe**: se la struttura di MYmovies cambia anche
in produzione (non solo nel test), `checkStructureSanity()` lo rileva a runtime
e fa scattare da sola il fallback automatico su TMDB — stessa logica usata dal
test, quindi i due punti di verifica sono sempre allineati. Si perde solo
l'abbinamento film-cinema (mostrato con una nota visibile in app), non la
disponibilità del servizio.

## Tema chiaro/scuro

Il tema scuro esistente è invariato (stesse variabili in `:root` in `App.css`).
Il tema chiaro è un blocco separato `[data-theme="light"]` con una palette
propria (non un'inversione meccanica dei colori). La scelta è gestita da
`src/hooks/useTheme.js`, salvata in `localStorage` (chiave `theme`) e applicata
via attributo `data-theme` su `<html>`; default `dark` se non è mai stata
scelta una preferenza. Un piccolo script inline in `index.html` applica il tema
salvato prima del render React, per evitare un flash del tema scuro di default.
