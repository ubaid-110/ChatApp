import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: true,

    // ←←← Yeh sabse important changes
    allowedHosts: true,        // Sab hosts allow karega (development ke liye safe hai)

    hmr: {
      clientPort: 443
    }
  }
})