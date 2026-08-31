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

## Come configurare la cache condivisa Supabase (opzionale)

Facoltativo: senza queste variabili l'app funziona lo stesso (fetch diretto
ogni volta, come prima di questa funzione) — vedi "Cache condivisa su
Supabase" più sotto per i dettagli.

1. Crea un progetto su [supabase.com](https://supabase.com) (piano gratuito)
2. Applica lo schema delle due tabelli di cache — vedi la migrazione
   `create_comingsoon_cache_tables` per lo SQL completo (tabelle
   `comingsoon_cinema_directory`/`comingsoon_cinema_showings` con RLS)
3. Copia URL progetto e chiave "publishable" (Project Settings → API) nel
   file `.env`:
   ```
   VITE_SUPABASE_URL=https://tuoprogetto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
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
- **Intermittenza del server primario:** `overpass-api.de` risponde a volte con HTTP 503 (sovraccarico) senza header CORS, causando un generico "Failed to fetch" nel browser. Per questa ragione, `src/hooks/useNearbyCinemas.js` implementa un fallback automatico: se `overpass-api.de` fallisce, ritenta automaticamente su `overpass.openstreetmap.fr` (mirror ufficiale OSM France, verificato con CORS funzionante) prima di propagare l'errore all'utente. Nota: un mirror alternativo (`overpass.kumi.systems`) è stato scartato perché, verificato il 2026-08-30, risultava in transizione verso un altro dominio (`overpass.private.coffee`) e restituiva errori 500/502 su entrambi. Se anche `overpass.openstreetmap.fr` dovesse smettere di funzionare in futuro, verificare di nuovo manualmente con curl (status HTTP + header `Access-Control-Allow-Origin`) prima di sceglierne un altro, come fatto qui.
- **Timeout esplicito sul primario (risolto 2026-08-31, causa della lentezza percepita):** `overpass-api.de` non fallisce sempre con un errore pulito — a volte la connessione resta semplicemente appesa senza rispondere (verificato con `curl`: ~21s di timeout di rete, `http_code=000`, non un 503), mentre il mirror `overpass.openstreetmap.fr` nel frattempo risponde normalmente in meno di un secondo. Il fetch verso il primario non aveva alcun timeout esplicito (solo l'`AbortController` di smontaggio componente), quindi nel browser l'attesa prima di provare il fallback poteva essere anche più lunga dei 21s osservati con curl. Aggiunto un timeout di 8s per-tentativo (stesso pattern già usato in `comingsoonService.js`): se il primario non risponde entro 8s si passa subito al mirror. Un timeout interno viene distinto da un abort esterno (smontaggio/cambio posizione) — altrimenti il catch più esterno lo scarterebbe in silenzio invece di propagarlo al fallback/mostrarlo come errore.

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

### "Not Found" ricaricando una pagina interna (`/film/...`, `/cinema`) — risolto 2026-08-31

Segnalato soprattutto da mobile (dove aprire un link condiviso o fare
refresh/redirect è più comune che restare sempre dentro l'app cliccando),
ma non è un problema specifico del dispositivo: riprodotto identico anche
da riga di comando (`curl`).

**Causa**: l'app usa `react-router-dom` con `BrowserRouter` (URL reali tipo
`/film/123`), ma il deploy statico su Render (servizio "Al Cinema",
`srv-da9l58pf2nfc73fspemg`, https://cinema-vicino-app.onrender.com) non
aveva una regola di rewrite configurata. Cliccando dentro l'app funziona
sempre (routing lato client, nessuna vera richiesta al server), ma un
refresh o un link diretto genera una vera richiesta HTTP a quel path — un
host statico puro cerca un file reale a quel percorso, non lo trova, e
risponde 404.

**Fix**: Render non supporta un file `_redirects` (a differenza di
Netlify) — verificato con la documentazione ufficiale. Serve una regola nel
pannello **Redirects/Rewrites** del servizio:
Source Path `/*` → Destination Path `/index.html` → Action `Rewrite`.
Non esiste un modo per configurarla via API (l'MCP Render collegato non
espone le regole di redirect/rewrite, solo servizi/deploy/log), va fatto
dal pannello: https://dashboard.render.com/static/srv-da9l58pf2nfc73fspemg.

**Nota di manutenzione**: la prima volta che la regola è stata creata, gli
status code sono tornati corretti (200 invece di 404) ma il body era vuoto
(0 byte, nessun `Content-Type`) — verificato non essere un problema di
cache CDN (`cf-cache-status: MISS` anche su path mai richiesti prima, quindi
risposta fresca dall'origin Render stesso, non un residuo cache). La causa
esatta di questo stato intermedio non è nota (nessun log a livello di
richiesta disponibile per i siti statici via API Render per indagare
oltre) — **cancellare e ricreare la regola identica** ha risolto. Se
capitasse di nuovo dopo aver salvato una nuova regola, verificare prima con
`curl -v` su un path mai richiesto (per escludere la cache) e, se il body
risulta comunque vuoto, provare a cancellare/ricreare prima di altro.

## Note di Sviluppo

- L'app utilizza **React 18+** con componenti funzionali e hook
- **Vite** è usato come bundler per lo sviluppo rapido
- Tutte le chiamate HTTP sono fatte con l'API nativa `fetch`
- Le distanze sono calcolate usando la **formula di Haversine** senza librerie esterne
- Il codice è organizzato in hook riutilizzabili per una migliore manutenibilità

## Dipendenze

Nessuna dipendenza esterna oltre a React e Vite. Tutti i calcoli e le chiamate API sono implementati con codice nativo.

## ComingSoon.it come fonte primaria, TMDB come fallback automatico

A partire da questa versione l'app è limitata all'Italia e usa **ComingSoon.it**
come fonte primaria per film + cinema che li proiettano. **TMDB** resta
configurato e scatta automaticamente come fallback solo quando ComingSoon.it
non risponde o la sua struttura risulta cambiata.

**Nota storica**: la fonte primaria era originariamente **MYmovies.it**, sostituita
il 2026-08-31 dopo che MYmovies ha rimosso dal proprio sito la funzione di
incrocio film-cinema-orari a livello di città (non un bug del nostro scraper:
verificato che la struttura attesa — blocchi `id="divTrailer_N"`, sezione
"OGGI A {CITTÀ}" — non esiste più su nessuna pagina `/cinema/{comune}/` di
MYmovies, nemmeno su Milano). Vedi in fondo a questa sezione ("Storia: da
MYmovies.it a ComingSoon.it") per il dettaglio completo, utile se in futuro
capitasse una situazione simile con ComingSoon.it.

### Moduli coinvolti

- `src/services/comingsoonParser.js` — parsing puro/isomorfo (nessuna API
  browser), usato sia a runtime sia dallo script di controllo struttura.
- `src/services/comingsoonService.js` — fetch con cache (qualche ora), lancia
  `ComingSoonFetchError` / `ComingSoonStructureError` in caso di fallimento.
  Nessun proxy CORS necessario (vedi "Gestione CORS" sotto).
- `src/services/tmdbService.js` — fallback completo (now_playing IT) e
  arricchimento trailer su richiesta dell'utente (ComingSoon.it non espone un
  URL diretto del trailer sulla pagina cinema).
- `src/services/cinemaMatcher.js` — confronto tollerante dei nomi cinema,
  usato per abbinare i cinema vicini (Overpass) alle voci dell'elenco cinema
  di ComingSoon.it.
- `src/hooks/useComingSoonData.js` — orchestrazione: matching + fetch orari +
  aggregazione per film, log del fallback in console (prefisso
  `[ComingSoon]`, utile in manutenzione per capire quando/se scatta).
- `src/services/supabaseClient.js` — client Supabase per la cache condivisa
  (vedi sotto), `null` se non configurato.

### Cache condivisa su Supabase (aggiunto 2026-08-31)

Il pezzo più lento e più ripetuto del fetch (l'elenco cinema di una
provincia, ~300KB, uguale per tutti gli utenti nella stessa zona, e le
pagine dei singoli cinema, uguali per tutti gli utenti vicini a quel cinema)
viene ora anche letto/scritto su una cache condivisa Postgres via Supabase
(progetto dedicato `cinema-vicino-app`, id `wjswqerpvwockfbgjggy`, region
`eu-central-1`), non solo dalla cache in memoria per-tab già esistente.

**Pattern**: read-through/write-through **lato client**, nessun backend
dedicato — coerente con il resto del progetto (deploy come sito statico
puro). Ogni browser, prima di un fetch live:
1. controlla la cache in memoria del proprio tab (esistente, invariata);
2. se assente, interroga Supabase (`comingsoon_cinema_directory` per
   provincia, `comingsoon_cinema_showings` per cinema) — se c'è una riga
   abbastanza fresca (entro il TTL), la usa e si ferma qui, **zero
   richieste a ComingSoon.it**;
3. solo se anche questa manca/è scaduta, fa il fetch live come prima, e dopo
   un fetch riuscito scrive il risultato su Supabase (fire-and-forget, non
   blocca la risposta al chiamante) per i prossimi utenti.

Verificato dal vivo (Torino): primo caricamento, 1 richiesta all'elenco
provincia + 18 alle pagine dei cinema abbinati; ricaricando la pagina,
**zero** richieste a `www.comingsoon.it` — tutti i 19 valori letti da
Supabase invece che ri-scrapare.

**TTL** (`comingsoonService.js`): 3 giorni per l'elenco cinema (cambia
raramente), 2 ore per la programmazione (specifica del giorno). Diversi
dalla cache in memoria (3 ore, per-tab, esistente prima di questa modifica
e lasciata invariata).

**Sicurezza (RLS)**: entrambe le tabelle hanno Row Level Security attiva.
Lettura pubblica (`select` per chiunque, serve a questo). Scrittura pubblica
in `insert`/`update` (ogni browser scrive dopo un fetch live riuscito) ma
**nessuna policy `delete`** — un client anonimo non può cancellare righe
(verificato: un `DELETE` via REST API risponde 200 ma non cancella nulla).
La scrittura pubblica è un rischio accettato consapevolmente: i dati sono
pubblici e non sensibili (programmazione cinematografica reperibile
comunque su ComingSoon.it), un valore scritto male si autocorregge alla
prossima scrittura legittima entro la finestra di TTL. Unica guardia:
`pg_column_size(...) < 2000000` sulle policy di scrittura, contro payload
abusivi/eccessivi.

**Se Supabase non è configurato** (`.env` senza `VITE_SUPABASE_URL`/
`VITE_SUPABASE_PUBLISHABLE_KEY`, es. clonando il repo senza le proprie
variabili): `supabaseClient.js` esporta `supabase = null`, la cache
condivisa viene semplicemente saltata (si legge/scrive solo la cache in
memoria come prima di questa modifica) — nessun errore bloccante,
funzionalità sempre opzionale.

**Chiavi**: `VITE_SUPABASE_PUBLISHABLE_KEY` è la chiave "publishable"
(`sb_publishable_...`), sicura da esporre nel bundle client — la sicurezza
sta nelle policy RLS sul database, non nella segretezza della chiave.
Configurata sia in `.env` locale sia come env var sul servizio Render
("Al Cinema", `srv-da9l58pf2nfc73fspemg`) tramite l'MCP Render collegato.

### Come funziona il fetch (diverso da come funzionava con MYmovies)

MYmovies esponeva **una singola pagina per città** con già tutto incrociato
(film + cinema + orari). ComingSoon.it non ha l'equivalente: elenca i cinema
**per provincia** (mai per singolo comune) e gli orari sono sulla pagina di
**ciascun cinema**, non su una pagina città aggregata. Il flusso è quindi:

1. `useReverseGeocoding.js` ricava `provinceSlug` (slug del capoluogo di
   provincia, es. `trento`, `reggio-emilia`) da `address.county`/`state_district`
   di Nominatim tramite `normalizeProvinceCapitalSlug` (vedi sotto per
   l'uniformità di questo campo, stesso problema già noto da MYmovies).
2. `useNearbyCinemas.js` (Overpass, invariato) trova i cinema entro 10 km
   dall'utente.
3. `useComingSoonData.js` scarica **una sola volta** l'elenco cinema
   dell'intera provincia (`getCinemaDirectory`), poi abbina per nome
   ciascun cinema vicino (Overpass) a una voce di quell'elenco
   (`findMatchingNearbyCinema`, la stessa funzione di tolleranza sui nomi già
   usata con MYmovies).
4. Per ogni cinema vicino **abbinato** (tipicamente pochi, non tutti quelli
   della provincia) scarica la sua pagina (`getShowingsForCinema`) e ne
   estrae film + sale + orari + prezzi.
5. Aggrega i risultati per film (`filmId` di ComingSoon.it, non il titolo:
   più affidabile per deduplicare tra cinema diversi): ogni film ottiene un
   `showingsToday` con una voce per cinema abbinato, orari uniti e ordinati.

Questo significa **N+1 richieste** (1 elenco provincia + 1 per cinema vicino
abbinato) invece dell'unica richiesta che bastava con MYmovies — accettabile
perché N è di norma piccolo (i cinema _vicini all'utente_, non tutti quelli
della provincia). Il matching cinema↔cinema avviene **una sola volta** dentro
`useComingSoonData`, non ad ogni render nella pagina di dettaglio: ogni voce
di `showingsToday` porta già con sé il cinema Overpass corrispondente
(`nearbyCinema`), quindi `FilmDetailPage.jsx` non deve ri-matchare.

### Orari di proiezione per cinema

A differenza di MYmovies (dove gli orari di un film in un cinema erano già un
elenco unico), su ComingSoon.it ogni sala/orario è un blocco "sala" separato
per lo stesso film — e se in quella sala il film ha più spettacoli nello
stesso giorno, gli orari compaiono concatenati nello stesso testo separati da
" - " (es. `11.20 / 13,90€ - 15.20 / 13,90€ - 18.10 / 13,90€`), non in blocchi
ripetuti. `comingsoonParser.js` scompone esplicitamente questi orari multipli
(non assume mai un blocco = un orario). Due campi opzionali osservati e
gestiti in modo tollerante (assenti in alcuni casi, non un errore):
- il numero di posti ("| Posti N") può mancare (sale/venue non numerati);
- il prezzo ("/ N,NN€") può mancare (es. cinema all'aperto con biglietteria
  esterna, dove ComingSoon.it mostra solo l'orario).

Se lo stesso cinema compare abbinato più volte (improbabile ma non impedito),
gli orari vengono comunque uniti sotto un'unica voce per film+cinema. In
modalità fallback TMDB gli orari non sono mai disponibili (TMDB è un database
di film generico, non di programmazione): la nota visibile in home lo indica
esplicitamente.

### Gestione CORS

A differenza di MYmovies.it, **ComingSoon.it espone `Access-Control-Allow-Origin: *`**
(verificato 2026-08-31 con `curl -I`), quindi il fetch funziona
**direttamente dal browser**, sia in sviluppo sia in produzione — nessun
proxy CORS necessario, né lato Vite né un servizio pubblico di terze parti.
Questo elimina completamente il punto di fragilità che affliggeva
l'integrazione MYmovies (proxy pubblici che smettevano di funzionare o
introducevano un dominio bloccabile separatamente dall'app — vedi la sezione
storica sotto). Se in futuro ComingSoon.it dovesse rimuovere questo header,
verificare di nuovo con `curl -I` prima di reintrodurre un proxy.

### Zero film in programmazione in un cinema (comportamento corretto)

Un cinema abbinato che oggi non proietta alcun film è uno scenario legittimo,
non un errore: la pagina del cinema semplicemente non ha blocchi film (nessun
messaggio esplicito di "nessun film" da riconoscere — verificato, il markup
relativo è presente nell'HTML ma commentato, quindi mai visibile). Se **tutti**
i cinema abbinati non hanno film oggi, `useComingSoonData` tratta il
risultato come fallback (`fallbackReason: 'nessun film in programmazione oggi
nei cinema vicini'`), stesso comportamento a schermo del caso "provincia non
trovata" di MYmovies: nessun crash, solo due liste separate senza orari.

### Copertura Overpass per cinema piccoli/di paese

La query Overpass includeva solo `amenity=cinema`. Aggiunta anche la variante
`leisure=cinema` (nodi e way), usata su OSM per alcune sale meno comuni.
`amenity=theatre` è stato scartato: su OSM indica teatri generici, non
necessariamente sale cinematografiche, e includerlo avrebbe rischiato più
falsi positivi che cinema realmente recuperati. Se in una zona `Nessun cinema
trovato nel raggio di 10 km` continua a comparire pur sapendo che esistono
cinema nelle vicinanze, è probabile che semplicemente non siano mappati su
OSM (limite dei dati, non un bug applicativo).

### Possibile blocco di rete/dispositivo (VPN, DNS, filtro operatore)

Osservato in precedenza (con MYmovies) su un dispositivo a Riva del Garda: il
fallback TMDB scattava con lo stesso identico comportamento sia su Brave sia
su Chrome sullo stesso dispositivo/rete (quindi non imputabile al browser).
`ComingSoonFetchError` distingue (`networkLevel: true`) il caso in cui il
fetch non riceve mai una risposta HTTP (fetch fallito/timeout, sintomo tipico
di un blocco a monte) dal caso in cui una risposta HTTP arriva comunque (solo
con status non-ok). Quando accade il primo caso, l'app mostra un avviso
aggiuntivo in home che suggerisce di controllare VPN/DNS/filtri di rete. Il
fix strutturale originariamente consigliato per questo problema (proxy
self-hosted, per evitare un dominio proxy pubblico riconoscibile e
bloccabile) è ora superfluo: ComingSoon.it non richiede alcun proxy (vedi
"Gestione CORS" sopra), quindi il rischio che motivava quel consiglio non si
applica più a questa integrazione.

### Script di controllo struttura — rilanciare periodicamente

`tests/test-comingsoon-scraper-struttura.js` scarica l'elenco cinema di una
provincia di prova (Milano) e le pagine di alcuni dei suoi cinema, verificando
che gli elementi chiave attesi siano ancora presenti (elenco cinema con id,
blocchi film con sale/orari, almeno un cinema campionato con film in
programmazione oggi).

```
node tests/test-comingsoon-scraper-struttura.js
```

**Va rilanciato periodicamente (indicativamente una volta a settimana)**: i siti
di terze parti cambiano struttura senza preavviso — è esattamente quello che
è successo con MYmovies. Se il test fallisce, il markup di
`src/services/comingsoonParser.js` va aggiornato di conseguenza.

**Nel frattempo l'app non si rompe**: se la struttura di ComingSoon.it cambia
anche in produzione (non solo nel test), `checkCinemaDirectoryStructureSanity()`
e `isValidCinemaPage()` lo rilevano a runtime e fanno scattare da sole il
fallback automatico su TMDB — stessa logica usata dal test, quindi i due punti
di verifica sono sempre allineati. Si perde solo l'abbinamento film-cinema
(mostrato con una nota visibile in app), non la disponibilità del servizio.

### Controllo struttura automatico (Supabase Edge Function + cron-job.org)

Lo script sopra andava rilanciato **a mano**. Dopo l'esperienza con MYmovies
(la cui rimozione della struttura è stata scoperta solo perché segnalata
dall'utente, non da un controllo automatico), lo stesso controllo è stato
esposto anche come endpoint HTTP e automatizzato:

- **Edge Function Supabase** `check-comingsoon-structure` (progetto
  `wjswqerpvwockfbgjggy`, stesso progetto della cache): stessa logica dello
  script Node (elenco cinema di una provincia di prova + campione di cinema),
  ma richiamabile via HTTP. Risponde `200` con `{ ok: true, ... }` se la
  struttura è quella attesa, `500` con `{ ok: false, reasons: [...] }`
  altrimenti — i `reasons` spiegano esattamente cosa non corrisponde più.
  URL: `https://wjswqerpvwockfbgjggy.supabase.co/functions/v1/check-comingsoon-structure`.
  **Richiede autenticazione** (`verify_jwt: true`, deciso deliberatamente:
  è un endpoint che genera traffico verso ComingSoon.it ad ogni chiamata,
  meglio non lasciarlo invocabile da chiunque lo trovi) — va chiamato con
  header `Authorization: Bearer <chiave publishable>` (la stessa
  `VITE_SUPABASE_PUBLISHABLE_KEY` usata dall'app).
- **cron-job.org** (servizio esterno gratuito, account dell'utente): chiama
  quell'URL su base settimanale con l'header di autorizzazione configurato,
  e manda un'email automatica se la risposta non è 2xx — cron-job.org tratta
  di default qualunque status non-2xx come fallimento, nessuna configurazione
  aggiuntiva necessaria per la notifica.

Divisione dei compiti: la Edge Function fa il controllo vero e proprio ma non
si attiva da sola; cron-job.org sa solo chiamare un URL a orario e notificare
un fallimento, non sa fare il controllo. Nessuno dei due basta da solo.

Per aggiornare la Edge Function dopo una modifica: ridistribuire con lo
stesso nome (`check-comingsoon-structure`) crea una nuova versione, non serve
toccare la configurazione su cron-job.org (l'URL resta lo stesso).

### Storia: da MYmovies.it a ComingSoon.it (2026-08-31)

Riassunto per chi in futuro si chiedesse perché non c'è più codice MYmovies
nel repository, o dovesse affrontare una situazione simile:

1. **Bug iniziale segnalato**: l'abbinamento film-cinema non funzionava per i
   comuni piccoli (caso reale: Riva del Garda, TN). Diagnosticate e corrette
   due cause reali lato nostro: (a) `normalizeCitySlug` inseriva un trattino
   tra le parole multi-comune (es. `riva-del-garda`), ma MYmovies concatenava
   le parole senza separatore (`rivadelgarda`) — bug che colpiva qualsiasi
   comune multi-parola, non solo quelli piccoli; (b) i comuni non capoluogo
   richiedevano la forma `/cinema/{provincia}/{comune}/`, rilevabile solo dal
   testo della pagina ("Non trovo nessuna provincia..."), non dallo status
   HTTP (200 anche per provincia non trovata).
2. **Dopo il fix, l'utente ha segnalato che l'abbinamento non funzionava
   ancora**: verificando dal vivo su Milano (non un comune piccolo, per
   escludere il bug appena corretto) è emerso che MYmovies aveva **rimosso
   dal sito** la sezione "OGGI A {CITTÀ}" con gli orari per cinema — la
   pagina città esiste ancora ma non contiene più quella struttura, per
   nessuna città verificata. Cercata un'alternativa sullo stesso sito
   (variante "versione originale", link "cerca in tutta la provincia",
   dropdown di ricerca) senza trovarne una funzionante: la funzione risultava
   effettivamente rimossa, non solo spostata.
3. **Trovata un'alternativa funzionante**: ComingSoon.it (stesso gruppo GEDI
   di MYmovies) espone ancora film + cinema + orari + prezzi, ma con una
   struttura diversa (elenco cinema per provincia, orari sulla pagina di
   ciascun cinema — non una singola pagina città con tutto incrociato). Il
   servizio è stato riscritto da zero su questa fonte (vedi sezioni sopra);
   il vecchio codice MYmovies (`mymoviesParser.js`, `mymoviesService.js`,
   `useMyMoviesData.js`, il proxy dev in `vite.config.js`,
   `tests/test-mymovies-scraper-struttura.js`) è stato rimosso perché non
   più funzionante e non recuperabile lato nostro (il problema era sul sito,
   non nel parsing).
4. **Lezione per il futuro**: se un giorno anche ComingSoon.it dovesse
   smettere di funzionare, verificare **prima di tutto con un browser reale**
   (non solo `curl`/`fetch` diretto) se la struttura attesa esiste ancora
   sulla pagina — è così che si è scoperto che il problema MYmovies non era
   un bug di scraping ma un cambiamento del sito stesso. Se confermato,
   cercare un'alternativa (comingsoon.it stesso è nato da questa ricerca)
   prima di assumere che la funzione di abbinamento film-cinema non sia più
   ottenibile in alcun modo.

### "Provincia non trovata" su province con nome composto (es. Massa-Carrara) — risolto 2026-08-31

Segnalato da un dispositivo a Massa (MS, CAP 54100): l'app mostrava lo stesso
messaggio di "nessuna provincia rilevata" (`noCityDetected` in `App.jsx`)
riservato al caso in cui Nominatim non restituisce alcuna provincia.

**Causa reale (non quella inizialmente ipotizzata)**: non era un bug di
normalizzazione dello slug. Verificato dal vivo con reverse geocoding
Nominatim reale sulle coordinate di Massa: per le province con nome composto
da trattino (Massa-Carrara, Barletta-Andria-Trani — verificato su entrambe),
Nominatim valorizza il campo `address.province`, **non** `address.county` né
`address.state_district` come per il resto delle province italiane (Torino,
Milano, Trento, Reggio Emilia, ecc., tutte con `county` valorizzato).
`useReverseGeocoding.js` leggeva solo `county`/`state_district`, quindi per
queste province `province` restava `null` ancora prima di arrivare a
`normalizeProvinceCapitalSlug` — la funzione di normalizzazione non veniva
nemmeno chiamata con un valore utile.

**Fix**: aggiunto `data.address?.province` come terzo fallback in
`useReverseGeocoding.js`. Una volta che il valore raggiunge
`normalizeProvinceCapitalSlug`, i nomi composti da trattino producono già lo
slug corretto senza bisogno di modifiche (verificato: "Massa-Carrara" →
`massa-carrara`, "Barletta-Andria-Trani" → `barletta-andria-trani`, entrambi
`/cinema/{slug}/` con HTTP 200 e `id="lista-tag"` presente su comingsoon.it).

**Bug distinto trovato durante la verifica generale**: "Pesaro e Urbino" (nome
composto con la congiunzione "e", non un trattino) produceva invece uno slug
sbagliato (`pesaro-e-urbino`, HTTP 200 ma senza `id="lista-tag"` — pagina non
valida) perché `normalizeProvinceCapitalSlug` non rimuoveva la congiunzione.
Corretto in `comingsoonParser.js`: la parola isolata "e" viene ora rimossa
prima della sostituzione degli spazi con trattini, producendo `pesaro-urbino`
(verificato HTTP 200 con `id="lista-tag"` presente, elenco cinema di Pesaro e
Urbino confermato). "Reggio nell'Emilia" resta un limite noto non risolto
(vedi commento nella funzione) — caso diverso: particella con apostrofo, non
congiunzione "e" isolata.

**Verifica end-to-end**: dati reali di Nominatim per Massa (44.0333, 10.1333)
→ campo `province` = "Massa-Carrara" → slug `massa-carrara` → richiesta a
`https://www.comingsoon.it/cinema/massa-carrara/` risponde 200 con l'elenco
cinema atteso.

### "ComingSoon.it non ha risposto correttamente" — segnalato su un dispositivo mobile a Milano, causa non ancora nota

Un dispositivo specifico a Milano ha mostrato questo messaggio (risposta HTTP
arrivata ma non quella attesa — `possibleNetworkBlock: false`, quindi non il
caso "nessuna risposta" già documentato sopra), mentre altri dispositivi nella
stessa città funzionavano correttamente con gli stessi dati. **Non
riprodotto**: mancano evidenze dirette (status HTTP ricevuto, contenuto della
risposta) per diagnosticare la causa — niente fix speculativi applicati.

Nota: sia questo caso sia quello di Massa sopra provengono da dispositivi
mobile, non desktop — se in futuro il problema si ripresentasse, vale la pena
considerare anche cause legate alla rete mobile (CGNAT/IP condivisi tra
operatori, comportamenti specifici di browser mobile), non ancora indagate
per mancanza di evidenza diretta.

**Logging migliorato per la prossima occorrenza** (`comingsoonService.js`,
prefisso console `[ComingSoon]` già in uso):
- risposta HTTP non-ok: ora logga subito status code + estratto (300
  caratteri) del body, non solo il messaggio d'errore generico che arrivava
  già a `useComingSoonData.js`;
- fetch senza alcuna risposta HTTP (blocco di rete puro): loggato
  distintamente, senza status (non disponibile in quel caso);
- struttura pagina inattesa (elenco provincia o scheda cinema, HTTP 200 ma
  contenuto diverso da quello atteso): logga anch'esso un estratto del body.

Se il problema si ripresenta, controllare la console del dispositivo
interessato: dovrebbe ora essere presente uno di questi log con il dettaglio
utile a capire la causa esatta.

## Tema chiaro/scuro

Il tema scuro esistente è invariato (stesse variabili in `:root` in `App.css`).
Il tema chiaro è un blocco separato `[data-theme="light"]` con una palette
propria (non un'inversione meccanica dei colori). La scelta è gestita da
`src/hooks/useTheme.js`, salvata in `localStorage` (chiave `theme`) e applicata
via attributo `data-theme` su `<html>`; default `dark` se non è mai stata
scelta una preferenza. Un piccolo script inline in `index.html` applica il tema
salvato prima del render React, per evitare un flash del tema scuro di default.
