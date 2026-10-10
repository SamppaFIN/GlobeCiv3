import { expect, test, type Page } from '@playwright/test';

/** Console errors and uncaught exceptions. Warnings are not failures. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()} (${msg.location().url})`);
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  // The browser's own 404 message has no URL, so record failing responses separately
  page.on('response', res => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return errors;
}

test('main game renders the hex globe without console errors', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  const ready = page.waitForEvent('console', {
    predicate: msg => msg.text().includes('3D globe ready'),
    timeout: 20_000,
  });
  await page.goto('./');
  await ready;
  await expect(page.locator('#globe-container canvas')).toBeVisible();
  // The game starts on the start screen (STORY-021)
  await expect(page.getByRole('button', { name: 'Uusi peli' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('globe.png') });
  expect(errors).toEqual([]);
});

test('zoom prototype settles at a mid level without console errors', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('spike.html?dist=0.04');
  const handle = await page.waitForFunction(() => (window as unknown as { __ready?: unknown }).__ready, null, {
    timeout: 30_000,
  });
  const ready = (await handle.jsonValue()) as { level: number; drawn: number };
  expect(ready.level).toBeGreaterThanOrEqual(6);
  expect(ready.drawn).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('spike.png') });
  expect(errors).toEqual([]);
});
