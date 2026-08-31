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
