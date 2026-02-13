import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts', 'api/**/*.ts', 'client/**/*.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  platform: 'node',
});
