import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 30000,
    include: ['src/test/**/*.test.ts'],
  },
})
