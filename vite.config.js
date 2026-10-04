import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // SANGAT PENTING: Ubah ke './' agar aset (JS/CSS) terbaca di WebView Android
  base: './', 
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Port untuk running di lokal (npm run dev)
    port: 5173,
    host: true, // Opsional: Agar bisa dibuka via IP laptop di HP dalam satu WiFi
  },

  build: {
    // Memastikan output build bersih dan optimal
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild'  }
})