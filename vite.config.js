import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-game-assets',
      closeBundle() {
        cpSync(resolve(__dirname, 'game'), resolve(__dirname, 'dist/game'), { recursive: true })
      },
    },
  ],
})
