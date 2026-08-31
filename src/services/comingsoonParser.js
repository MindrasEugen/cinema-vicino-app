/**
 * Parsing isolato e senza dipendenze delle pagine cinema di ComingSoon.it
 * (sostituisce MYmovies.it come fonte primaria — vedi NOTE.md per il perché).
 *
 * Due tipi di pagina:
 * - Elenco cinema di una provincia (`/cinema/{provincia-capoluogo}/`): lista
 *   piatta di tutti i cinema della provincia (raggruppati per comune sul
 *   sito, ma qui estratti come lista piatta perché il matching con Overpass
 *   avviene per nome, non per comune).
 * - Programmazione di un singolo cinema (`/cinema/{provincia}/{cinema-slug}/{id}/`):
 *   elenco dei film in sala oggi in quel cinema, con sale/orari/prezzi.
 */

function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Decodifica le entità HTML numeriche/nominate più comuni nei testi di ComingSoon.it. */
function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Stessi prefissi amministrativi già osservati su Nominatim per MYmovies:
// non uniformi tra le province italiane (es. "Provincia di Trento" ma
// "Milano" senza prefisso). Confrontati dopo stripAccents, quindi senza accenti.
const PROVINCE_NAME_PREFIXES = [
  'libero consorzio comunale di ',
  'citta metropolitana di ',
  'provincia di ',
  'provincia autonoma di ',
];

/**
 * Normalizza il nome di una provincia (`address.county`/`state_district` da
 * Nominatim) nello slug del capoluogo usato da ComingSoon.it, che elenca
 * SEMPRE i cinema a livello di provincia (mai del singolo comune), con le
 * parole separate da trattino — verificato (2026-08-31) su più province:
 * "Reggio Emilia" -> "reggio-emilia", "La Spezia" -> "la-spezia" (a
 * differenza di MYmovies, che le concatenava senza trattino).
 *
 * Limite noto: come su MYmovies, alcuni nomi provincia completi con
 * particelle (es. "Reggio nell'Emilia") non corrispondono allo slug atteso
 * dal sito ("reggio-emilia", non "reggio-nell-emilia"). Non esiste una
 * regola generale affidabile per questi casi — quando lo slug indovinato
 * non corrisponde, il fetch fallisce con 404 e l'app degrada al fallback
 * TMDB, senza crash.
 */
export function normalizeProvinceCapitalSlug(rawProvinceName) {
  if (!rawProvinceName) return null;
  let name = stripAccents(rawProvinceName).toLowerCase().trim();

  for (const prefix of PROVINCE_NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }

  // Nomi bilingue (Alto Adige/Sudtirolo, es. "Bolzano - Bozen"): tiene solo
  // la prima forma, quella usata negli URL italiani del sito.
  name = name.split(' - ')[0].trim();

  return name
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Un cinema nella lista provinciale è un <li> con un link che include un id
// numerico finale — a differenza dei link "Cinema a {Comune}" (senza id),
// quindi questo pattern da solo isola in modo affidabile le voci-cinema
// ovunque si trovino nella pagina, senza dover delimitare con precisione il
// blocco "lista-tag" (che si ripete raggruppato per comune).
const CINEMA_DIRECTORY_ENTRY_RE =
  /href=\/cinema\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d+)\/ title="([^"]*)"/g;

/**
 * Estrae l'elenco piatto dei cinema di una provincia dalla pagina
 * `/cinema/{provincia}/`. Ogni voce: { name, provinceSlug, cinemaSlug, id, url }.
 */
export function parseCinemaDirectory(html) {
  const seen = new Set();
  const cinemas = [];
  let m;
  CINEMA_DIRECTORY_ENTRY_RE.lastIndex = 0;
  while ((m = CINEMA_DIRECTORY_ENTRY_RE.exec(html)) !== null) {
    const [, provinceSlug, cinemaSlug, id, rawName] = m;
    const key = `${provinceSlug}/${cinemaSlug}/${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cinemas.push({
      name: decodeHtmlEntities(rawName),
      provinceSlug,
      cinemaSlug,
      id,
      url: `https://www.comingsoon.it/cinema/${provinceSlug}/${cinemaSlug}/${id}/`,
    });
  }
  return cinemas;
}

/** Verifica "leggera" che la pagina elenco-cinema di una provincia abbia ancora la struttura attesa. */
export function checkCinemaDirectoryStructureSanity(html) {
  const reasons = [];
  if (!/id="lista-tag"/.test(html)) {
    reasons.push('Nessun blocco id="lista-tag" (elenco cinema) trovato nella pagina.');
  }
  const entryCount = (html.match(CINEMA_DIRECTORY_ENTRY_RE) || []).length;
  if (entryCount === 0) {
    reasons.push('Nessuna voce cinema (link con id numerico) trovata nella pagina.');
  }
  return { ok: reasons.length === 0, reasons, entryCount };
}

/**
 * Verifica che la pagina scaricata sia davvero la scheda del cinema
 * richiesto (id `cinemaId`) e non, ad esempio, la pagina città a cui
 * ComingSoon.it fa redirect silenzioso quando slug/id non sono più validi
 * (redirect verificato: HTTP 302 -> `/cinema/{provincia}/`, che fetch()
 * segue automaticamente restituendo comunque status 200 con un contenuto
 * diverso da quello richiesto).
 */
export function isValidCinemaPage(html, cinemaId) {
  return html.includes(`data-idc="${cinemaId}"`);
}

/** Divide la pagina cinema in blocchi, uno per film in programmazione oggi. */
function splitFilmBlocks(html) {
  const markerRe = /<div class="header-scheda streaming/g;
  const starts = [];
  let m;
  while ((m = markerRe.exec(html)) !== null) {
    starts.push(m.index);
  }
  const blocks = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : html.length;
    blocks.push(html.slice(start, end));
  }
  return blocks;
}

// Un blocco "sala" corrisponde a UNA sala (non a un singolo orario): se il
// film ha più spettacoli nella stessa sala lo stesso giorno, gli orari
// compaiono concatenati nello stesso span, separati da " - " (es.
// "11.20 / 13,90€ - 15.20 / 13,90€ - 18.10 / 13,90€"), non in blocchi "sala"
// ripetuti — vanno quindi separati esplicitamente, non assunti 1:1 col blocco.
//
// Il numero posti ("| Posti N") non è sempre presente (alcune sale/venue non
// numerati ne sono privi, es. "Sala Abanella" senza "| Posti"): il nome sala
// va quindi estratto in modo tollerante, non con un formato fisso a slot.
const SALA_BLOCK_RE =
  /<i class="fx"><\/i>\s*([\s\S]*?)<\/span>\s*<span><i class="fx clock"><\/i> ([^<]+)<\/span>/g;
// Il prezzo non è sempre presente (es. cinema all'aperto con biglietteria
// esterna, dove ComingSoon.it mostra solo l'orario senza "/ N,NN€").
const TIME_PRICE_RE = /(\d{2}\.\d{2})(?:\s*\/\s*([\d,]+)€)?/g;

function parseHallInfo(raw) {
  const seatsMatch = raw.match(/Posti (\d+)/);
  return {
    hall: decodeHtmlEntities(raw.split('|')[0].trim()),
    seats: seatsMatch ? parseInt(seatsMatch[1], 10) : null,
    isOriginalLanguage: /V\.O\./.test(raw),
  };
}

function parseFilmBlock(blockHtml) {
  const idfMatch = blockHtml.match(/\?idf=(\d+)"/);
  const titleMatch = blockHtml.match(/class="tit_olo h1">([^<]*)<\/a>/);
  if (!idfMatch || !titleMatch) return null;

  const originalTitleMatch = blockHtml.match(/class='sottotitolo h3'>\(\s*([^)]*?)\s*\)<\/div>/);
  const genreMatch = blockHtml.match(/<b>Genere:<\/b> <span>([^<]*)<\/span>/);
  const durationMatch = blockHtml.match(/<b>Durata:<\/b> <span>(\d+) Minuti<\/span>/);
  const releaseDateMatch = blockHtml.match(/<b>Uscita al cinema:<\/b> <span>([^<]*)<\/span>/);
  const castMatch = blockHtml.match(/<b>Cast:<\/b> <span>([^<]*)<\/span>/);
  const posterMatch = blockHtml.match(/<img src="([^"]*)" alt="/);
  // Voto della community CineRating di ComingSoon.it, scala 0-5 (stesso
  // formato già usato da StarRating): virgola decimale, es. data-rating="3,7".
  const ratingMatch = blockHtml.match(/class="p stelle pbs" data-rating="([\d,]+)"/);

  const showings = [];
  let sm;
  SALA_BLOCK_RE.lastIndex = 0;
  while ((sm = SALA_BLOCK_RE.exec(blockHtml)) !== null) {
    const [, hallInfoRaw, timesText] = sm;
    const { hall, seats, isOriginalLanguage } = parseHallInfo(hallInfoRaw);
    let tm;
    TIME_PRICE_RE.lastIndex = 0;
    while ((tm = TIME_PRICE_RE.exec(timesText)) !== null) {
      showings.push({
        hall,
        seats,
        isOriginalLanguage,
        time: tm[1],
        price: tm[2] ? tm[2].replace(',', '.') : null,
      });
    }
  }

  return {
    filmId: idfMatch[1],
    title: decodeHtmlEntities(titleMatch[1]),
    originalTitle: originalTitleMatch ? decodeHtmlEntities(originalTitleMatch[1]) : null,
    genres: genreMatch ? decodeHtmlEntities(genreMatch[1]).split(',').map((g) => g.trim()).filter(Boolean) : [],
    durationMinutes: durationMatch ? parseInt(durationMatch[1], 10) : null,
    releaseDateRaw: releaseDateMatch ? releaseDateMatch[1].trim() : null,
    cast: castMatch ? decodeHtmlEntities(castMatch[1]).split(',').map((c) => c.trim()).filter(Boolean) : [],
    posterUrl: posterMatch ? posterMatch[1] : null,
    rating: ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null,
    showings,
  };
}

/**
 * Effettua il parse completo della pagina di un cinema: elenco dei film in
 * programmazione oggi con relative proiezioni (sala/posti/orario/prezzo).
 * Un cinema senza film oggi (scenario legittimo, non un errore) produce
 * semplicemente un array vuoto — nella pagina reale non c'è un messaggio di
 * "nessun film" da riconoscere, solo l'assenza dei blocchi film.
 */
export function parseCinemaShowingsPage(html) {
  return splitFilmBlocks(html)
    .map((block) => parseFilmBlock(block))
    .filter((film) => film !== null);
}
