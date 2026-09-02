import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Al Cinema Vicino a Te',
        short_name: 'Cinema Vicino',
        description: "Film in programmazione e cinema vicini a te, geolocalizzati automaticamente.",
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        theme_color: '#141414',
        background_color: '#141414',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache solo l'app shell (JS/CSS/HTML/icone): niente cache delle
        // risposte API (ComingSoon.it, TMDB, Overpass) per evitare di mostrare
        // programmazioni o cinema non piu aggiornati.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
