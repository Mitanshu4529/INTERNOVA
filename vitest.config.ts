import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Keep the test cache out of node_modules/.vite.
  cacheDir: '.vitest-cache',
  test: {
    environment: 'happy-dom',
    globals: true,
    // Mocks the Supabase client and installs in-memory web storage, so the
    // suite never touches the real backend.
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
