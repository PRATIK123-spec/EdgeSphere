import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.EDGESPHERE_API_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // Frontend calls /api/*; the dev server forwards to FastAPI without the prefix.
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: true, // also proxies the WebSocket at /api/ws
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: true, // also proxies the WebSocket at /api/ws
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
