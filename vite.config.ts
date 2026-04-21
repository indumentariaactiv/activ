import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-pwa.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'ALTIV',
        short_name: 'ALTIV',
        description: 'Plataforma de gestión de pedidos ALTIV',
        theme_color: '#0052cc',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo-pwa.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-pwa.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo-pwa.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
