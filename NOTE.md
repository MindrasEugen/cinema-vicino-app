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

## Tema chiaro/scuro

Il tema scuro esistente è invariato (stesse variabili in `:root` in `App.css`).
Il tema chiaro è un blocco separato `[data-theme="light"]` con una palette
propria (non un'inversione meccanica dei colori). La scelta è gestita da
`src/hooks/useTheme.js`, salvata in `localStorage` (chiave `theme`) e applicata
via attributo `data-theme` su `<html>`; default `dark` se non è mai stata
scelta una preferenza. Un piccolo script inline in `index.html` applica il tema
salvato prima del render React, per evitare un flash del tema scuro di default.
