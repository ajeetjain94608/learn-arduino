/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 5173 is used by the 3D spike in spikes/uno-3d; the app always runs on its own port.
  server: { port: 5180, strictPort: true, host: true },
  preview: { port: 5181, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
