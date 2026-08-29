/**
 * Parsing isolato e senza dipendenze della pagina "cinema/{città}" di MYmovies.it.
 * Isomorfo (nessuna API browser): usato sia dal servizio a runtime (mymoviesService.js)
 * sia dallo script di controllo struttura (tests/test-mymovies-scraper-struttura.js),
 * così i due punti verificano esattamente la stessa forma di dati.
 *
 * Approccio: split della pagina in blocchi (uno per film) sul marcatore
 * `id="divTrailer_N"`, poi estrazione per-blocco via regex mirate. La pagina non
 * è una SPA: è HTML server-side con markup inline non sempre annidato in modo
 * pulito, quindi regex mirate sui singoli campi sono più robuste di un parse DOM
 * completo (che richiederebbe comunque assunzioni sulla gerarchia dei nodi).
 */

/** Rimuove accenti da una stringa (per normalizzazioni tolleranti). */
function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalizza un nome città nello slug usato da MYmovies nell'URL
 * `https://www.mymovies.it/cinema/{slug}/` (es. "Reggio Emilia" -> "reggio-emilia").
 * Se lo slug indovinato non corrisponde a una città coperta, il fetch fallirà
 * (404 o pagina senza blocchi film) e scatterà il fallback TMDB automaticamente.
 */
export function normalizeCitySlug(cityName) {
  if (!cityName) return null;
  return stripAccents(cityName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Decodifica sicura di componenti URI, senza sollevare eccezioni su input malformato. */
function safeDecodeURIComponent(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return null;
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&Igrave;/g, 'Ì')
    .replace(/&egrave;|&#232;/g, 'è')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Divide l'intera pagina città in blocchi HTML, uno per film.
 * Ogni blocco va dal marcatore `id="divTrailer_N"` (incluso) fino a prima del
 * marcatore successivo (o fine pagina).
 */
export function splitFilmBlocks(html) {
  const markerRe = /<div id="divTrailer_\d+"/g;
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

/**
 * Estrae l'URL diretto del trailer da un blocco film, se presente in modo affidabile.
 * MYmovies espone il video nell'attributo onclick `GetVideo(idx, id2, '', 'coverEnc',
 * 0, 'Titolo+Con+Plus', 'false', 'embedUrlEnc')`: l'ultimo argomento tra apici è
 * l'URL (URL-encoded) dell'embed del trailer (es. Dailymotion/YouTube).
 * Ritorna null se non trovato o non decodificabile: nessuna eccezione, il chiamante
 * userà il fallback TMDB solo per il trailer di quel film.
 */
export function extractTrailerUrl(blockHtml) {
  const callMatch = blockHtml.match(/GetVideo\(([^)]*)\)/);
  if (!callMatch) return null;

  const args = callMatch[1];
  const quoted = [...args.matchAll(/'([^']*)'/g)].map((mm) => mm[1]);
  if (quoted.length === 0) return null;

  const last = quoted[quoted.length - 1];
  const decoded = safeDecodeURIComponent(last);
  if (!decoded || !/^https?:\/\//i.test(decoded)) return null;
  return decoded;
}

/** Estrae titolo e URL scheda film dal blocco. */
function extractTitleAndUrl(blockHtml) {
  const m = blockHtml.match(
    /<div class="schedine-titolo">\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/
  );
  if (!m) return { title: null, filmUrl: null };
  return { title: stripTags(m[2]), filmUrl: m[1] };
}

/**
 * Estrae l'URL della locandina (poster). La pagina città espone solo una
 * miniatura minuscola (~150px larga, `imm.jpg`) come src dell'immagine
 * poster-N: ingrandita via CSS risulterebbe visibilmente sgranata. Nella
 * stessa cartella di asset esiste però quasi sempre anche `locandina.jpg`
 * (~420px larga), derivabile per sostituzione di nome file senza bisogno di
 * una richiesta aggiuntiva. Se per qualche film non esiste (404), il
 * componente che la mostra ricade comunque sul placeholder via onError.
 */
function extractPosterUrl(blockHtml) {
  const m = blockHtml.match(/<img id="poster-\d+"[^>]*\ssrc="([^"]+)"/);
  if (!m) return null;
  const smallUrl = m[1];
  return smallUrl.replace(/imm\.jpg$/, 'locandina.jpg');
}

/** Estrae generi, anno e durata dalla riga "schedine-lancio". */
function extractGenreYearDuration(blockHtml) {
  const lineMatch = blockHtml.match(
    /<div class="mm-line-height-130 schedine-lancio">([\s\S]*?)<\/div>/
  );
  const result = { genres: [], year: null, durationMinutes: null };
  if (!lineMatch) return result;

  const line = lineMatch[1];

  const genreRe = /<a[^>]*title="Film [^"]+"[^>]*>([^<]+)<\/a>/g;
  let gm;
  while ((gm = genreRe.exec(line)) !== null) {
    result.genres.push(stripTags(gm[1]));
  }

  const yearMatch = line.match(/\/film\/(\d{4})\/?"[^>]*>\s*\d{4}\s*<\/a>/);
  if (yearMatch) result.year = parseInt(yearMatch[1], 10);

  const durationMatch = line.match(/Durata\s*(\d+)\s*Minuti/i);
  if (durationMatch) result.durationMinutes = parseInt(durationMatch[1], 10);

  return result;
}

/** Estrae la sinossi breve (fuori dal blocco "Espandi") e quella completa. */
function extractSynopsis(blockHtml) {
  let overviewFull = null;
  const fullMatch = blockHtml.match(/<div id="trama\d+"[^>]*>([\s\S]*?)<\/div>\s*<script>/);
  if (fullMatch) {
    overviewFull = stripTags(fullMatch[1]).replace(/Recensione\s*❯?\s*$/i, '').trim();
  }

  let overviewShort = null;
  const shortMatch = blockHtml.match(
    /<\/div>\s*<div class="clear5"><\/div>\s*<div>\s*([\s\S]*?)<span id="espandi\d+"/
  );
  if (shortMatch) {
    overviewShort = stripTags(shortMatch[1]);
  }

  return { overviewShort: overviewShort || null, overviewFull: overviewFull || null };
}

/** Estrae regista e cast principale dalla frase "Un film di ... Con ...". */
function extractDirectorAndCast(blockHtml) {
  const m = blockHtml.match(
    /Un film di\s*<a[^>]*>([^<]+)<\/a>\.[\s\S]{0,20}?<span>Con\s*([\s\S]*?)<\/span>/
  );
  if (!m) return { director: null, cast: [] };

  const director = stripTags(m[1]);
  const cast = [...m[2].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((cm) => stripTags(cm[1]));
  return { director, cast };
}

/** Estrae il voto redazionale MYmovies.it (MYMONETRO), se presente. */
function extractRating(blockHtml) {
  const m = blockHtml.match(/MYMOVIES\.IT\s*<strong>([\d.]+|N\.D\.)<\/strong>/);
  if (!m || m[1] === 'N.D.') return null;
  const value = parseFloat(m[1]);
  return Number.isNaN(value) ? null : value;
}

/**
 * Estrae l'elenco dei cinema che proiettano il film "oggi" nella città, con i
 * relativi orari, dalla sezione "OGGI  A {CITTÀ}" (MYmovies usa doppio spazio
 * prima di "A"). Gli orari sono già presenti inline in questa stessa sezione
 * (blocco `orari-dettaglio` subito dopo il nome del cinema, uno
 * `<span class="mm-medium mm-weight-700">HH:MM</span>` per proiezione):
 * nessuna richiesta aggiuntiva è necessaria per ottenerli.
 * Se la sezione non è presente il film non è in programmazione oggi in città:
 * ritorna un array vuoto (non è un errore, non fa scattare alcun fallback).
 * Se un cinema compare più di una volta (es. versione originale mostrata come
 * voce separata), i relativi orari vengono uniti sotto un'unica voce invece
 * di scartare la seconda occorrenza.
 */
function extractTodayShowings(blockHtml) {
  const sectionStart = blockHtml.search(/OGGI\s+A\s+[A-ZÀ-Ù]/);
  if (sectionStart === -1) return [];

  const section = blockHtml.slice(sectionStart);
  const cinemaRe =
    /<a class="link-19"[^>]*href="(https:\/\/www\.mymovies\.it\/cinema\/[^"]+)"[^>]*title="[^"]*">\s*<div>\s*<div[^>]*>([^<]+)<\/div>/g;
  const timeRe = /<span class="mm-medium mm-weight-700">(\d{2}:\d{2})<\/span>/g;

  const matches = [...section.matchAll(cinemaRe)];
  const order = [];
  const byUrl = new Map();

  matches.forEach((m, i) => {
    const cinemaUrl = m[1];
    const cinemaName = stripTags(m[2]);

    // Gli orari del cinema stanno nel blocco "orari-dettaglio" tra la fine di
    // questo link e l'inizio del prossimo cinema (o la fine della sezione).
    const windowStart = m.index + m[0].length;
    const windowEnd = i + 1 < matches.length ? matches[i + 1].index : section.length;
    const timesWindow = section.slice(windowStart, windowEnd);
    const times = [...timesWindow.matchAll(timeRe)].map((tm) => tm[1]);

    if (!byUrl.has(cinemaUrl)) {
      byUrl.set(cinemaUrl, { cinemaName, times: [] });
      order.push(cinemaUrl);
    }
    byUrl.get(cinemaUrl).times.push(...times);
  });

  return order.map((cinemaUrl) => {
    const entry = byUrl.get(cinemaUrl);
    // Ordinamento cronologico: se un cinema proietta più "versioni" (es.
    // doppiata + versione originale) gli orari arrivano intrecciati.
    return { cinemaName: entry.cinemaName, myMoviesCinemaUrl: cinemaUrl, times: entry.times.sort() };
  });
}

/**
 * Effettua il parse completo di un blocco film in un oggetto dati pronto per l'app.
 * Ritorna null se il blocco non contiene almeno titolo e URL film (blocco non valido/pubblicitario).
 */
export function parseFilmBlock(blockHtml) {
  const { title, filmUrl } = extractTitleAndUrl(blockHtml);
  if (!title || !filmUrl) return null;

  const { genres, year, durationMinutes } = extractGenreYearDuration(blockHtml);
  const { overviewShort, overviewFull } = extractSynopsis(blockHtml);
  const { director, cast } = extractDirectorAndCast(blockHtml);

  return {
    id: filmUrl,
    title,
    filmUrl,
    posterUrl: extractPosterUrl(blockHtml),
    genres,
    year,
    durationMinutes,
    overviewShort,
    overviewFull,
    director,
    cast,
    rating: extractRating(blockHtml),
    ratingScale: 5,
    trailerUrl: extractTrailerUrl(blockHtml),
    showingsToday: extractTodayShowings(blockHtml),
  };
}

/** Effettua il parse dell'intera pagina città in un array di film. */
export function parseCityPage(html) {
  return splitFilmBlocks(html)
    .map((block) => parseFilmBlock(block))
    .filter((film) => film !== null);
}

/**
 * Verifica "leggera" che la struttura attesa della pagina sia ancora presente,
 * senza fare un parse completo. Usata sia per decidere se scattare il fallback
 * TMDB automatico a runtime, sia dallo script di controllo struttura settimanale.
 */
export function checkStructureSanity(html) {
  const reasons = [];

  const filmBlockCount = (html.match(/<div id="divTrailer_\d+"/g) || []).length;
  if (filmBlockCount === 0) {
    reasons.push('Nessun blocco film (id="divTrailer_N") trovato nella pagina.');
  }

  const titleCount = (html.match(/<div class="schedine-titolo">/g) || []).length;
  if (titleCount === 0) {
    reasons.push('Nessun elemento "schedine-titolo" (titolo film) trovato.');
  }

  const hasTodaySection = /OGGI\s+A\s+[A-ZÀ-Ù]/.test(html);
  if (!hasTodaySection) {
    reasons.push('Nessuna sezione "OGGI A {CITTÀ}" trovata nella pagina.');
  }

  const cinemaLinkCount = (html.match(/href="https:\/\/www\.mymovies\.it\/cinema\/[^"]+"/g) || [])
    .length;
  if (cinemaLinkCount === 0) {
    reasons.push('Nessun link a schede cinema trovato nella pagina.');
  }

  return {
    ok: reasons.length === 0,
    reasons,
    filmBlockCount,
    titleCount,
    cinemaLinkCount,
  };
}
