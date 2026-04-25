import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/__tests__/setup.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/index.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'postcss.config.js',
        'tailwind.config.js',
        'eslint.config.js',
        'scripts/**',
        'scratch/**',
        'sentinel-agent/**',
        'supabase/**',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
  },
});
