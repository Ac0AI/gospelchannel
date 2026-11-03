import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // This suite uses node:test and is run separately in CI.
    exclude: [...configDefaults.exclude, 'scripts/__tests__/deploy-cloudflare.test.mjs'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
