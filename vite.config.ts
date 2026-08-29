import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

/**
 * No COOP/COEP headers here on purpose. They would let onnxruntime use
 * `SharedArrayBuffer` and thread background removal, but cross-origin
 * isolation also blocks every embed that does not opt in, and Unlayer sends no
 * `Cross-Origin-Resource-Policy` on its editor iframe or its CDN. A faster
 * cutout is not worth losing the editor, so inference stays single-threaded.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
