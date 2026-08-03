import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// HTTPS dev certs (generate with mkcert — see DEPLOYMENT.md / chat notes):
//   mkdir -p certs
//   mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem \
//          localhost 127.0.0.1 <IP-PC-kamu>
// When the files exist the dev server serves HTTPS; otherwise plain HTTP.
const certDir = path.resolve(__dirname, 'certs')
const keyPath = path.join(certDir, 'dev-key.pem')
const certPath = path.join(certDir, 'dev-cert.pem')
const httpsConfig =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on all interfaces so phones on the LAN can connect
    port: 5173,
    https: httpsConfig,
    // Same-origin proxy to the backend: the phone only ever talks to the
    // HTTPS Vite origin; /api and /uploads are forwarded to Express over
    // localhost. One cert covers everything, no CORS/mixed-content issues.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
