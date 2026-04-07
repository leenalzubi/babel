import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Relative base so JS/CSS resolve on GitHub Pages (e.g. …/babel/) and on root hosts.
// For client-side tab URLs under a subpath, set at build time:
//   VITE_DEPLOY_PATH=babel  → history uses /babel/, /babel/about, etc.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  appType: 'spa',
  server: {
    // Client-side routes (/findings, /about): SPA-style fallback to index.html in dev.
    historyApiFallback: true,
  },
})
