import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/GlobeCiv3/',
  plugins: [svelte()],
  worker: { format: 'es' },
  build: { target: 'esnext', outDir: 'dist', assetsDir: 'assets' },
  server: { port: 3000, open: true },
});
