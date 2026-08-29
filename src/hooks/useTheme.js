import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'dark';

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Gestisce il tema chiaro/scuro dell'app. Default 'dark' (nessuna preferenza
 * di sistema rilevata) se l'utente non ha mai scelto. Applica l'attributo
 * data-theme sull'elemento <html> e salva la scelta in localStorage, così il
 * cambio è immediato e persiste al reload.
 */
export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage non disponibile (es. navigazione privata): la scelta
      // resta valida solo per la sessione corrente.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
