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
