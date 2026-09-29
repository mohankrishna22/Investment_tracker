import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// One id per build. CI supplies the commit; a local build falls back to the time.
const BUILD_ID = (process.env.GITHUB_SHA ?? '').slice(0, 7) || `local-${Date.now().toString(36)}`

/**
 * Publishes version.json beside the bundle. A running tab fetches it now and then
 * and compares it with the id it was built with, so a phone that has been sitting
 * on a week-old copy finds out it is stale instead of quietly syncing old code.
 */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      })
    },
  }
}

// `base` is set from BASE_PATH at build time so the same code works both
// locally (`/`) and under a GitHub Pages project URL (`/<repo>/`).
export default defineConfig({
  plugins: [react(), versionFile()],
  base: process.env.BASE_PATH || '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
})
