/**
 * Client Supabase per la cache condivisa dei dati ComingSoon.it (vedi
 * comingsoonService.js e NOTE.md). Chiave "publishable", sicura da esporre
 * nel bundle client: la sicurezza è garantita dalle policy RLS sul database
 * (lettura pubblica, scrittura pubblica ma limitata da un tetto di
 * dimensione — dati pubblici e non sensibili, non credenziali), non dalla
 * segretezza della chiave stessa.
 *
 * Se le variabili d'ambiente non sono configurate (es. sviluppo locale senza
 * `.env` Supabase), `supabase` è `null`: la cache viene semplicemente
 * saltata, l'app continua a funzionare come prima (fetch diretto ogni
 * volta), nessun errore bloccante.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
