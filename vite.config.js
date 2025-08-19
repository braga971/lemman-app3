import { defineConfig } from 'vite'

export default defineConfig({
  base: '/lemman-app3/',   // <-- metti /NOME-REPO/
  build: { target: 'es2020' },
  server: { port: 5173, strictPort: false }
})