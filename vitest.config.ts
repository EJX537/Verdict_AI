import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // Stub Next.js `server-only` guard — tests run in plain Node, not the
      // Next.js bundler, so the real package would throw unconditionally.
      'server-only': resolve(__dirname, 'lib/__mocks__/server-only.ts'),
    },
  },
})
