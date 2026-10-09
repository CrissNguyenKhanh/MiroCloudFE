import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Unit/UI tests must never inherit a developer's real-mode .env and call
  // running services. Real HTTP contracts are covered with mocked fetches.
  define: mode === 'test'
    ? { 'import.meta.env.VITE_USE_MOCK_API': JSON.stringify('true') }
    : undefined,
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  },
}))
