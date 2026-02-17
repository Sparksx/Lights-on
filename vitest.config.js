import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    globals: true,
    setupFiles: ['tests/unit/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js', 'server/db.js'],
      exclude: ['js/effects/**', 'js/intro.js', 'js/canvas.js', 'js/dom.js'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
