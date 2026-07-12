import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // Fixtures are sample-repo data, not real test suites.
    exclude: [...configDefaults.exclude, 'test/fixtures/**'],
    environment: 'node',
  },
})
