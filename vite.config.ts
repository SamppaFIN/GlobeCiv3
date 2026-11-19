import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/GlobeCiv3/',
  worker: { format: 'es' },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
  server: { port: 3000, open: true },
});
