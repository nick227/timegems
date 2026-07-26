import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./src/__tests__/helpers/setup.ts'],
    // All test files share one MySQL database and afterEach wipes every
    // table -- running files in parallel races that wipe against other
    // files' in-flight tests. Force sequential execution.
    fileParallelism: false,
  },
})
