# Al Cinema Vicino a Te

Un'app web (solo Italia) che geolocalizza l'utente e mostra i film in programmazione nella sua città, già abbinati ai cinema che li proiettano oggi. Perfetto per trovare rapidamente cosa guardare e dove guardarlo.

## Funzionalità principali

- **Geolocalizzazione automatica** — Rileva la posizione dell'utente tramite browser (con permesso esplicito)
- **Film + cinema abbinati (ComingSoon.it)** — Fonte primaria: film in programmazione nei cinema vicini all'utente, con sinossi, cast, sale, orari e prezzi
- **Fallback automatico su TMDB** — Se ComingSoon.it non risponde o cambia struttura, l'app passa da sola a TMDB (film) + Overpass (cinema vicini) come due liste separate, con una nota visibile che l'abbinamento film-cinema non è momentaneamente disponibile
- **Cinema vicini** — Trova cinema fisici nel raggio di 10 km dalla posizione dell'utente (OpenStreetMap / Overpass), incrociati con ComingSoon.it quando disponibile
- **Cache condivisa (opzionale)** — Se configurato Supabase, i dati ComingSoon.it già scaricati da altri utenti nella stessa zona vengono riusati invece di ri-scaricarli, per un caricamento più veloce
- **Tema chiaro/scuro** — Selettore in header, preferenza salvata e ripristinata al ricaricamento (default: scuro)
- **Distanze calcolate** — Mostra la distanza di ogni cinema usando la formula di Haversine

Dettagli tecnici su parsing ComingSoon.it, gestione CORS, cache condivisa e manutenzione dello scraper in [NOTE.md](./NOTE.md#comingsoonit-come-fonte-primaria-tmdb-come-fallback-automatico).

## Stack tecnico

- **React 19** — UI library moderno con hook
- **Vite** — Bundler veloce e configurazione minima
- **Fetch API nativa** — Nessuna libreria HTTP esterna per i dati di film/cinema
- **Supabase** (opzionale) — Cache condivisa Postgres per i dati ComingSoon.it, vedi sotto

## Setup rapido

1. **Installare le dipendenze**
   ```bash
   npm install
   ```

2. **Configurare la API Key TMDB**
   - Creare un file `.env` nella radice del progetto
   - Aggiungere la linea: `VITE_TMDB_API_KEY=tua_chiave_api`
   - Per ottenere la chiave, consulta [NOTE.md](./NOTE.md#come-ottenere-una-api-key-tmdb)

2b. **Configurare la cache Supabase** *(opzionale — l'app funziona anche senza)*
   - Vedi [NOTE.md](./NOTE.md#come-configurare-la-cache-condivisa-supabase-opzionale)

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

- **ComingSoon.it** — Fonte primaria: film in programmazione, sinossi, cast, sale, orari e prezzi, per i cinema vicini all'utente
- **TMDB (The Movie Database)** — Fallback automatico quando ComingSoon.it non è disponibile
- **Nominatim (OpenStreetMap)** — Reverse geocoding per determinare paese e città
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
