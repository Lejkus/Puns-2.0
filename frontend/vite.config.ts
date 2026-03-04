import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // <--- dodaj to

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // <--- i to
    },
  },
})