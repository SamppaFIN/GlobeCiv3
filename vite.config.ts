import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/GlobeCiv3/',
  plugins: [svelte()],
  worker: { format: 'es' },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    // spike.html is the STORY-004 prototype; it only exists on the spike branch
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        spike: fileURLToPath(new URL('./spike.html', import.meta.url)),
      },
    },
  },
  server: { port: 3000, open: true },
});
