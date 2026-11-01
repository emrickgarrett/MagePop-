import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works when Electron loads it from file://
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
