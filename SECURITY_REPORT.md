# Report di sicurezza — Al Cinema Vicino a Te

Data: 2026-08-31
Ambito: intero codice sorgente `src/` (nessun diff pendente sul branch `main`, allineato a `origin`)

**Esito: nessuna vulnerabilità HIGH o MEDIUM con confidenza ≥8/10 identificata.**

## Sintesi della review

- **Nessun diff pendente**: branch `main` pulito, nessuna PR aperta da valutare. Review eseguita sull'intero `src/` come "istantanea corrente".
- **XSS**: nessun `dangerouslySetInnerHTML`/`innerHTML`/`eval` nel codice. React esegue escaping automatico di tutti i dati esterni (ComingSoon.it, TMDB, Overpass/OSM, Nominatim) renderizzati come testo in `FilmDetailPage.jsx`, `MoviesList.jsx`, `CinemasList.jsx`.
- **Link esterni**: tutti gli `<a target="_blank">` verso URL di terze parti (sito cinema, TMDB trailer, ComingSoon.it) hanno correttamente `rel="noopener noreferrer"`.
- **Parsing HTML (`comingsoonParser.js`)**: basato su regex, non `innerHTML`/DOMParser eval-like; i dati estratti passano solo in `textContent` React, non in HTML grezzo.
- **Chiavi API client-side (`tmdbService.js`, `supabaseClient.js`)**: sia la chiave TMDB sia quella Supabase sono esposte nel bundle client, intrinseco in un'app Vite senza backend. La chiave Supabase è "publishable" e protetta da RLS (per design, documentato in `supabaseClient.js`/`NOTE.md`); la chiave TMDB non ha uno scope ristretto lato server, ma il rischio è solo abuso di quota (rientra nelle esclusioni DoS/rate-limit).
- **Cache condivisa Supabase (scrittura pubblica)**: un client può scrivere righe arbitrarie in `comingsoon_cinema_directory`/`comingsoon_cinema_showings` (cache poisoning dei dati di programmazione mostrati ad altri utenti). Dati non sensibili, nessun path di code-execution o injection — rischio di integrità dati noto e accettato per design (RLS con tetto dimensionale, vedi `comingsoonService.js`), non una vulnerabilità con impatto sufficiente per la soglia richiesta.
- **Overpass QL query**: `lat`/`lng` provengono dalla Geolocation API del browser (numerici), non da input utente testuale libero — nessun path di injection sfruttabile.
- **Permessi/geolocalizzazione**: gestione permessi via Permissions API, nessuna logica di bypass o privilege escalation.

Nessun altro elemento (autenticazione, deserializzazione, comandi di sistema, segreti hardcoded nel codice) è presente in questo progetto — è una SPA client-only senza backend proprio.

## File esaminati

- `src/services/tmdbService.js`
- `src/services/supabaseClient.js`
- `src/services/comingsoonService.js`
- `src/services/comingsoonParser.js`
- `src/hooks/useGeolocation.js`
- `src/hooks/useReverseGeocoding.js`
- `src/hooks/useNearbyCinemas.js`
- `src/utils/geolocationPermissionInstructions.js`
- `src/pages/FilmDetailPage.jsx`
- Ricerca globale per `dangerouslySetInnerHTML` / `innerHTML` / `eval` / `new Function` in `src/`

---

## Miglioramenti di robustezza suggeriti

Nessuno di questi è una vulnerabilità di sicurezza reale (il modello di minaccia
corretto è spiegato per ciascuno) — sono migliorie di robustezza dei dati,
utili comunque perché la cache Supabase è scrivibile pubblicamente, quindi
`comingsoon_cinema_directory`/`comingsoon_cinema_showings` vanno trattate come
dati non fidati anche dal proprio client in lettura.

#### 1. Validare i dati letti dalla cache condivisa → `comingsoonService.js`
**Perché serve davvero**: la scrittura è pubblica per design (vedi NOTE.md), quindi
un'entry malformata o malevola in cache — per bug di un altro client o per
scrittura diretta contro l'API Supabase — arriva senza controlli fino al
rendering (es. `film.title.split` su un valore non stringa) e può rompere la UI
per tutti gli utenti che leggono quella riga di cache prima della scadenza del TTL.
Validare in lettura, prima di fidarsi del dato, protegge da questo scenario
indipendentemente dalla causa (bug o attore malevolo).

**Nota**: validare anche in *scrittura* (come proposto nella versione precedente
di questa sezione) non aggiunge protezione reale — un attore che vuole scrivere
dati malevoli chiama direttamente l'API Supabase con la chiave pubblica,
bypassando questo codice JS. La validazione ha senso solo lato lettura.

```javascript
function isValidCinemaDirectoryData(cinemas) {
  return Array.isArray(cinemas) && cinemas.every((c) =>
    c && typeof c === 'object' &&
    typeof c.name === 'string' &&
    typeof c.id === 'string' &&
    typeof c.provinceSlug === 'string' &&
    typeof c.cinemaSlug === 'string' &&
    typeof c.url === 'string' && c.url.startsWith('https://www.comingsoon.it/cinema/')
  );
}

function isValidCinemaShowingsData(films) {
  return Array.isArray(films) && films.every((f) =>
    f && typeof f === 'object' &&
    typeof f.filmId === 'string' &&
    typeof f.title === 'string' &&
    Array.isArray(f.showings)
  );
}

// In readSharedCache, dopo aver recuperato `data[dataColumn]` e prima di ritornarlo:
const validate = table === 'comingsoon_cinema_directory'
  ? isValidCinemaDirectoryData
  : isValidCinemaShowingsData;
if (!validate(data[dataColumn])) {
  console.warn(`[ComingSoon] Dati in cache non validi per ${table}, ignorati`);
  return null;
}
```

#### 2. Fix range di validazione coordinate → `useNearbyCinemas.js`
**Perché serve**: la versione precedente di questa proposta usava lo stesso
range `[-90, 90]` sia per `lat` che per `lng`, ma la longitudine valida va da
-180 a 180 (irrilevante per coordinate in Italia, ma sbagliato come funzione
generica — respingerebbe longitudini legittime se il progetto si estendesse
oltre l'Italia). Utile comunque come guardia contro risposte malformate della
Geolocation API (`NaN`/`Infinity`) prima di usarle nella query Overpass e nel
calcolo distanza.

```javascript
function isValidLatitude(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}
function isValidLongitude(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
}
```

---

## Proposte scartate (nessun beneficio reale)

- **Rate limiting lato client su TMDB**: la chiave è comunque leggibile nel
  bundle; un rate limiter in-memory nel client non impedisce a chi la estrae
  di chiamare l'API TMDB direttamente, e si azzera ad ogni reload. Non mitiga
  il rischio che dichiara di risolvere.
- **Aggiunte a `.gitignore`**: `.env`, `.env.local` e `*.local` sono già
  ignorati (verificato). La riga `VITE_*` proposta non ha inoltre l'effetto
  voluto: ignorerebbe file il cui *nome* inizia per "VITE_", non le variabili
  d'ambiente.
- **File `SECURITY.md` dedicato**: sovradimensionato per un progetto
  client-only di queste dimensioni; i rischi accettati (chiavi esposte nel
  bundle, scrittura pubblica della cache) sono già documentati dove servono
  (`supabaseClient.js`, `NOTE.md`).

---

## Cosa NON richiede patch

- ✅ **XSS**: Già protetto da React (nessun `dangerouslySetInnerHTML`)
- ✅ **Link esterni**: Già hanno `rel="noopener noreferrer"`
- ✅ **Parsing HTML**: Già basato su regex, non su DOMParser
- ✅ **Geolocalizzazione**: Già usa Permissions API correttamente
