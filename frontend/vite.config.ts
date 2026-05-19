import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    // Enter your specific IP address here, or use '0.0.0.0' to expose it to the network
    host: '0.0.0.0', 
    port: 5173, // Optional: specify a custom port
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
