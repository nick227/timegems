import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  // `pnpm --filter web start` serves the production build on Railway via
  // `vite preview`, which rejects unknown Host headers by default.
  preview: {
    allowedHosts: ['.up.railway.app'],
  },
})
