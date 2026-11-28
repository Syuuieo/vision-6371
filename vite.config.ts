import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Three.js is intentionally isolated in a lazy vendor chunk.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-three', test: /node_modules[\\/]three/ },
            { name: 'vendor-react', test: /node_modules[\\/]react(?:-dom)?/ },
          ],
        },
      },
    },
  },
})
