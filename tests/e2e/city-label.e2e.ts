import { expect, test, type Page } from '@playwright/test';

/** Whether the label itself is what a tap at its centre hits, not the top panel over it. */
const labelOnTop = (page: Page, name: string) => page.evaluate(n => {
  const label = [...document.querySelectorAll<HTMLElement>('.city-label')].find(l => !l.hidden && l.textContent?.includes(n));
  if (!label) return false;
  const r = label.getBoundingClientRect();
  return label.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
}, name);

test('at the city level the city label stays clear of the top panel when the city card opens and closes', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Neuvonantaja' }).getByRole('button', { name: 'Sulje' }).click();
  const name = await page.evaluate(() => (window as any).globeGame.state.cities[0].name as string);
  const card = page.getByRole('dialog', { name });

  for (let round = 0; round < 2; round++) {
    await page.locator('.city-label', { hasText: name }).click();
    await expect(card).toBeVisible();
    await page.waitForFunction(() => !(window as any).globeCamera.flying, null, { timeout: 10_000 });
    expect(await labelOnTop(page, name)).toBe(true);
    await card.getByRole('button', { name: 'Sulje' }).click();
    await expect(card).toBeHidden();
    // Closed, the label can be tapped again
    expect(await labelOnTop(page, name)).toBe(true);
  }
  expect(errors).toEqual([]);
});
