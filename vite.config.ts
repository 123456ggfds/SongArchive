import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'

// Keep GitHub Pages absolute base while using relative assets inside Capacitor's WKWebView.
export default defineConfig({
  base: isCapacitorBuild ? './' : '/SongArchive/',
  plugins: [react()],
})
