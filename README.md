# Al Cinema Vicino a Te

Un'app web che geolocalizza l'utente e mostra i film attualmente al cinema nel suo paese, insieme ai cinema fisici più vicini entro un raggio di 10 km. Perfetto per trovare rapidamente cosa guardare e dove guardarlo.

## Funzionalità principali

- **Geolocalizzazione automatica** — Rileva la posizione dell'utente tramite browser (con permesso esplicito)
- **Film al cinema** — Recupera la lista di film attualmente in programmazione nel paese rilevato (dati TMDB)
- **Cinema vicini** — Trova cinema fisici nel raggio di 10 km dalla posizione dell'utente (dati OpenStreetMap)
- **Distanze calcolate** — Mostra la distanza di ogni cinema usando la formula di Haversine

## Stack tecnico

- **React 19** — UI library moderno con hook
- **Vite** — Bundler veloce e configurazione minima
- **Fetch API nativa** — Nessuna libreria HTTP esterna
- **Nessuna dipendenza esterna** (a parte React e Vite)

## Setup rapido

1. **Installare le dipendenze**
   ```bash
   npm install
   ```

2. **Configurare la API Key TMDB**
   - Creare un file `.env` nella radice del progetto
   - Aggiungere la linea: `VITE_TMDB_API_KEY=tua_chiave_api`
   - Per ottenere la chiave, consulta [NOTE.md](./NOTE.md#come-ottenere-una-api-key-tmdb)

3. **Avviare lo sviluppo**
   ```bash
   npm run dev
   ```

## Script disponibili

- `npm run dev` — Avvia il server di sviluppo con HMR
- `npm run build` — Compila il progetto per la produzione
- `npm run lint` — Esegue il linter (Oxlint)
- `npm run preview` — Anteprima locale della build di produzione

## Fonti dati

- **TMDB (The Movie Database)** — Film attualmente al cinema
- **Nominatim (OpenStreetMap)** — Reverse geocoding per determinare il paese
- **Overpass API (OpenStreetMap)** — Cinema fisici nelle vicinanze

Per dettagli su endpoint API, rate limit e limitazioni note, consulta [NOTE.md](./NOTE.md#endpoint-api-utilizzati).

## Per approfondire

Vedi [NOTE.md](./NOTE.md) per:
- Note tecniche di sviluppo
- Dettagli su endpoint API e rate limiting
- Limitazioni note e loro origine
- Guida alla risoluzione dei problemi comuni

---

**Sviluppato con React 19 + Vite**
