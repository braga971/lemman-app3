// vite.config.js
import { defineConfig } from 'vite'
// Se usi il plugin React di Vite, sblocca la riga sotto e assicurati di avere @vitejs/plugin-react installato
// import react from '@vitejs/plugin-react'

export default defineConfig({
  // Con dominio personalizzato dedicato (es. https://app.lemman.it) la base deve essere la root:
  base: '/',

  // plugins: [react()], // <-- sblocca se usi il plugin React

  server: {
    port: 5173,
    strictPort: false
  },

  preview: {
    port: 4173,
    strictPort: true
  },

  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false
  }
})
