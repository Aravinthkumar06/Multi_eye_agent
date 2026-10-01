import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiUrl = process.env.VITE_API_URL || 'http://localhost:8000'
const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws'

const renderApiPlugin: Plugin = {
  name: 'render-api-url',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/src/services/api.ts')) {
      return null
    }

    return {
      code: code
        .replace(
          /const API_BASE = `http:\/\/\$\{window\.location\.hostname\}:8000`;/,
          `const API_BASE = ${JSON.stringify(apiUrl)};`,
        )
        .replace(
          /export const WS_URL = `ws:\/\/\$\{window\.location\.hostname\}:8000\/ws`;/,
          `export const WS_URL = ${JSON.stringify(wsUrl)};`,
        ),
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    renderApiPlugin,
  ],
})
