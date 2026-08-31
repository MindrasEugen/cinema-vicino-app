/**
 * Rileva la piattaforma dell'utente e ritorna istruzioni per abilitare il permesso di geolocalizzazione
 * @returns {Array<string>} Array di passaggi in italiano
 */
export function getGeolocationPermissionInstructions() {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;

  // Rilevamento per piattaforma (iOS / Android / fallback)
  
  // iOS: iPhone, iPad, iPod oppure iPadOS 13+ in modalità desktop
  // (iPadOS riporta userAgent da Mac quando in modalità desktop, distinguiamo
  // dal vero Mac verificando se ha touch screen — maxTouchPoints > 1)
  const isIOS = /iPhone|iPad|iPod/.test(userAgent) || 
                (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    return [
      'Esci dal browser e vai su Impostazioni del telefono',
      'Seleziona Privacy e sicurezza → Servizi di localizzazione',
      'Verifica che i Servizi di localizzazione siano attivi',
      'Cerca il tuo browser nell\'elenco e imposta "Consenti" o "Chiedi"'
    ];
  }

  // Android
  if (/Android/.test(userAgent)) {
    return [
      'Tocca l\'icona del lucchetto (o la ⓘ) accanto all\'indirizzo del sito',
      'Trova "Posizione" tra le autorizzazioni',
      'Imposta la posizione su "Consenti"'
    ];
  }

  // Fallback: desktop Windows/Mac/Linux o piattaforma non riconosciuta
  return [
    'Cerca le impostazioni/autorizzazioni del sito nel tuo browser',
    '(Di solito sono vicino alla barra dell\'indirizzo)',
    'Imposta la posizione su "Consenti"'
  ];
}
