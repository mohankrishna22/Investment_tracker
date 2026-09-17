import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` is set from BASE_PATH at build time so the same code works both
// locally (`/`) and under a GitHub Pages project URL (`/<repo>/`).
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
