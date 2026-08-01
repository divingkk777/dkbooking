import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Prefer localhost (not 127.0.0.1) — Google OAuth / Firebase authorized domains
// reject 127.0.0.1 unless explicitly added in the Firebase console.
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5174,
    strictPort: true,
  },
});
