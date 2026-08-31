/**
 * Script di controllo struttura per lo scraping di ComingSoon.it (sostituisce
 * MYmovies.it dopo che quest'ultimo ha rimosso l'abbinamento film-cinema-orari
 * dalle sue pagine città — vedi NOTE.md).
 *
 * Scarica l'elenco cinema di una provincia di prova (Milano) e le pagine di
 * alcuni dei suoi cinema, verificando che gli elementi chiave attesi siano
 * ancora presenti: elenco cinema con id, blocchi film con sale/orari/prezzi
 * su almeno uno dei cinema campionati. Se la struttura del sito è cambiata,
 * fallisce con un messaggio chiaro (exit code 1) invece di fallire
 * silenziosamente a runtime.
 *
 * Vedi NOTE.md per la cadenza consigliata (indicativamente settimanale) e per
 * cosa succede all'app nel frattempo (fallback automatico a TMDB, non si rompe).
 *
 * Uso: node tests/test-comingsoon-scraper-struttura.js
 */
import {
  parseCinemaDirectory,
  checkCinemaDirectoryStructureSanity,
  isValidCinemaPage,
  parseCinemaShowingsPage,
} from '../src/services/comingsoonParser.js';

const TEST_PROVINCE_SLUG = 'milano';
const TEST_URL = `https://www.comingsoon.it/cinema/${TEST_PROVINCE_SLUG}/`;
const SAMPLE_CINEMA_COUNT = 5;

function fail(message) {
  console.error(`\n❌ FALLITO: ${message}`);
  console.error(
    '\nLa struttura di ComingSoon.it sembra essere cambiata. Lo scraper in ' +
      'src/services/comingsoonParser.js va aggiornato. Nel frattempo l\'app ' +
      'continua a funzionare grazie al fallback automatico su TMDB (vedi NOTE.md).'
  );
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlCinemaAppStructureCheck/1.0)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    fail(`${url} ha risposto con HTTP ${response.status}.`);
  }
  return response.text();
}

async function main() {
  console.log(`Scarico ${TEST_URL} per verificare l'elenco cinema...`);
  const directoryHtml = await fetchHtml(TEST_URL);

  const sanity = checkCinemaDirectoryStructureSanity(directoryHtml);
  console.log('\nControllo struttura elenco cinema:');
  console.log(`  - voci cinema trovate: ${sanity.entryCount}`);
  assert(sanity.ok, `struttura elenco cinema non valida:\n  - ${sanity.reasons.join('\n  - ')}`);

  const cinemas = parseCinemaDirectory(directoryHtml);
  console.log(`Cinema estratti per la provincia di ${TEST_PROVINCE_SLUG}: ${cinemas.length}`);
  assert(cinemas.length > 0, 'checkCinemaDirectoryStructureSanity ha dato esito positivo ma parseCinemaDirectory non ha estratto alcun cinema.');

  const sample = cinemas.slice(0, SAMPLE_CINEMA_COUNT);
  console.log(`\nScarico ${sample.length} cinema campione per verificare la programmazione...`);

  let foundFilmsSomewhere = false;
  for (const cinema of sample) {
    const html = await fetchHtml(cinema.url);
    assert(
      isValidCinemaPage(html, cinema.id),
      `la pagina di "${cinema.name}" (${cinema.url}) non sembra una scheda cinema valida (isValidCinemaPage ha dato false).`
    );

    const films = parseCinemaShowingsPage(html);
    console.log(`  - ${cinema.name}: ${films.length} film in programmazione oggi`);

    if (films.length > 0) {
      foundFilmsSomewhere = true;
      const sampleFilm = films[0];
      assert(!!sampleFilm.title, `il primo film di "${cinema.name}" non ha un titolo.`);
      assert(sampleFilm.showings.length > 0, `il film "${sampleFilm.title}" non ha alcuna proiezione estratta.`);
      const sampleShowing = sampleFilm.showings[0];
      assert(!!sampleShowing.hall, `la proiezione di "${sampleFilm.title}" non ha una sala.`);
      assert(/^\d{2}\.\d{2}$/.test(sampleShowing.time), `orario "${sampleShowing.time}" non nel formato atteso HH.MM.`);
    }
  }

  assert(
    foundFilmsSomewhere,
    `nessuno dei ${sample.length} cinema campionati ha film in programmazione oggi: ` +
      'possibile che l\'estrazione dei blocchi film sia rotta (a meno che sia davvero così per tutti, verificare manualmente).'
  );

  console.log('\n✅ SUPERATO: la struttura di ComingSoon.it corrisponde a quella attesa dallo scraper.');
}

main().catch((err) => {
  fail(`errore inatteso durante il controllo: ${err.message}`);
});
