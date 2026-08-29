import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy minimale per aggirare il blocco CORS di MYmovies.it in sviluppo:
      // il browser chiama un percorso same-origin, il dev server Node fa la
      // richiesta reale a mymovies.it (che non manda header CORS) e ne inoltra
      // la risposta, così il browser non vede mai una richiesta cross-origin.
      // In produzione (nessun server Node) src/services/mymoviesService.js usa
      // invece un proxy CORS pubblico di fallback: vedi NOTE.md.
      '/mymovies-proxy': {
        target: 'https://www.mymovies.it',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mymovies-proxy/, ''),
      },
    },
  },
})
