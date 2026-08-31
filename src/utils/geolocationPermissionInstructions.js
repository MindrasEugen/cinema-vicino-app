/**
 * Rileva il browser dell'utente e ritorna istruzioni per abilitare il permesso di geolocalizzazione
 * @returns {Array<string>} Array di passaggi in italiano
 */
export function getGeolocationPermissionInstructions() {
  const userAgent = navigator.userAgent;

  // Ordine dei check è importante: Edge contiene "Chrome", Safari contiene "AppleWebKit"
  
  // Safari: cerca "Safari" e "AppleWebKit" ma NON "Chrome", "Edge", "Firefox"
  if (/Safari/.test(userAgent) && /AppleWebKit/.test(userAgent) && !/Chrome|Edge|Firefox/.test(userAgent)) {
    return [
      'Apri Safari > Preferenze',
      'Vai alla scheda "Siti web"',
      'Seleziona questo sito dall\'elenco a sinistra (o aggiungilo)',
      'Nella colonna "Posizione" a destra, imposta su "Consenti"'
    ];
  }

  // Edge (Chromium-based): check "Edge" prima di "Chrome"
  if (/Edge|Edg/.test(userAgent)) {
    return [
      'Clicca l\'icona di informazioni (lucchetto o "i") accanto all\'URL',
      'Clicca "Impostazioni sito" o "Permessi"',
      'Trova "Posizione" e impostala su "Consenti"'
    ];
  }

  // Chrome (e altri browser Chromium): check "Chrome"
  if (/Chrome/.test(userAgent)) {
    return [
      'Clicca l\'icona di informazioni (lucchetto o "i") accanto all\'URL',
      'Clicca "Impostazioni sito" o "Permessi"',
      'Trova "Posizione" e impostala su "Consenti"'
    ];
  }

  // Firefox
  if (/Firefox/.test(userAgent)) {
    return [
      'Clicca l\'icona di informazioni (lucchetto) accanto all\'URL',
      'Clicca l\'icona "posizione" o "Permessi aggiuntivi"',
      'Imposta "Posizione" su "Consenti"'
    ];
  }

  // Fallback per browser sconosciuti
  return [
    'Cerca l\'icona di informazioni (lucchetto o "i") accanto alla barra degli indirizzi',
    'Apri le impostazioni di permessi per questo sito',
    'Cerca "Posizione" o "Location" e impostala su "Consenti"'
  ];
}
