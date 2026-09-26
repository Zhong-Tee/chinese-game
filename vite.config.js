import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, cpSync, existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = fileURLToPath(new URL('.', import.meta.url))

const GAME_MIME = {
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'game-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = req.url ?? ''
          // Vite asset imports use ?import — must not serve raw files for those URLs
          if (rawUrl.includes('?')) return next()

          const url = rawUrl.split('?')[0]
          if (!url.startsWith('/game/')) return next()

          const filePath = resolve(projectDir, url.slice(1))
          if (!existsSync(filePath)) return next()

          const mime = GAME_MIME[extname(filePath)]
          if (mime) res.setHeader('Content-Type', mime)
          createReadStream(filePath).pipe(res)
        })
      },
      closeBundle() {
        cpSync(resolve(projectDir, 'game'), resolve(projectDir, 'dist/game'), { recursive: true })
      },
    },
  ],
})
