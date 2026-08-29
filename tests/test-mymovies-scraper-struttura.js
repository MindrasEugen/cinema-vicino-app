/**
 * Script di controllo struttura per lo scraping di MYmovies.it.
 *
 * Scarica una pagina reale di prova (Milano) e verifica che gli elementi
 * chiave attesi siano ancora presenti: blocchi film, sezione "OGGI A", link
 * ai cinema, ed estrazione effettiva di almeno un film con i suoi campi
 * principali. Se la struttura del sito è cambiata, fallisce con un messaggio
 * chiaro (exit code 1) invece di fallire silenziosamente a runtime.
 *
 * Vedi NOTE.md per la cadenza consigliata (indicativamente settimanale) e per
 * cosa succede all'app nel frattempo (fallback automatico a TMDB, non si rompe).
 *
 * Uso: node tests/test-mymovies-scraper-struttura.js
 */
import { parseCityPage, checkStructureSanity } from '../src/services/mymoviesParser.js';

const TEST_CITY_SLUG = 'milano';
const TEST_URL = `https://www.mymovies.it/cinema/${TEST_CITY_SLUG}/`;

function fail(message) {
  console.error(`\n❌ FALLITO: ${message}`);
  console.error(
    '\nLa struttura di MYmovies.it sembra essere cambiata. Lo scraper in ' +
      'src/services/mymoviesParser.js va aggiornato. Nel frattempo l\'app ' +
      'continua a funzionare grazie al fallback automatico su TMDB (vedi NOTE.md).'
  );
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function main() {
  console.log(`Scarico ${TEST_URL} per verificare la struttura attesa...`);

  let html;
  try {
    const response = await fetch(TEST_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlCinemaAppStructureCheck/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      fail(`La pagina di test ha risposto con HTTP ${response.status}.`);
    }
    html = await response.text();
  } catch (err) {
    fail(`Impossibile scaricare la pagina di test: ${err.message}`);
  }

  const sanity = checkStructureSanity(html);
  console.log('\nControllo struttura di base:');
  console.log(`  - blocchi film trovati: ${sanity.filmBlockCount}`);
  console.log(`  - titoli film trovati: ${sanity.titleCount}`);
  console.log(`  - link a schede cinema trovati: ${sanity.cinemaLinkCount}`);

  assert(sanity.ok, `struttura di base non valida:\n  - ${sanity.reasons.join('\n  - ')}`);

  const films = parseCityPage(html);
  console.log(`\nFilm effettivamente estratti: ${films.length}`);
  assert(films.length > 0, 'checkStructureSanity ha dato esito positivo ma parseCityPage non ha estratto alcun film.');

  const sample = films[0];
  console.log(`\nEsempio di film estratto: "${sample.title}"`);
  assert(!!sample.title, 'il primo film estratto non ha un titolo.');
  assert(!!sample.filmUrl, 'il primo film estratto non ha un URL scheda film.');

  const filmsWithShowings = films.filter((f) => f.showingsToday.length > 0);
  console.log(
    `Film con almeno una sala "oggi a ${TEST_CITY_SLUG}": ${filmsWithShowings.length} / ${films.length}`
  );
  assert(
    filmsWithShowings.length > 0,
    'nessun film ha sale associate nella sezione "OGGI A" — l\'abbinamento film-cinema potrebbe essere rotto anche se i blocchi film sono presenti.'
  );

  const filmsWithTrailer = films.filter((f) => f.trailerUrl);
  console.log(`Film con URL trailer estratto: ${filmsWithTrailer.length} / ${films.length}`);
  if (filmsWithTrailer.length === 0) {
    console.warn(
      '⚠️  Nessun trailer estratto da MYmovies: non blocca il test (il trailer ha comunque un fallback TMDB per-film), ma vale la pena controllare se il markup di GetVideo(...) è cambiato.'
    );
  }

  console.log('\n✅ SUPERATO: la struttura di MYmovies.it corrisponde a quella attesa dallo scraper.');
}

main().catch((err) => {
  fail(`errore inatteso durante il controllo: ${err.message}`);
});
