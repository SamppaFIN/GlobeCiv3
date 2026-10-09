import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
// Not 3000 (Sami's dev server) or 4173 (manual vite preview)
const PORT = 4175;

export default defineConfig({
  testDir: 'tests/e2e',
  // .e2e.ts keeps these files out of Vitest's *.test / *.spec pattern
  testMatch: /.*\.e2e\.ts$/,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/GlobeCiv3/`,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Locally: installed Chrome with the real GPU. CI runners have no GPU,
        // so WebGL runs on SwiftShader, which Chrome only allows when asked explicitly.
        channel: CI ? undefined : 'chrome',
        launchOptions: { args: CI ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] },
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --open false`,
    url: `http://localhost:${PORT}/GlobeCiv3/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
