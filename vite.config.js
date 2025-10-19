import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- Import Tailwind

// https://vite.dev/config/
export default defineConfig({
  // Register the Tailwind plugin
  plugins: [react(), tailwindcss()],
})
