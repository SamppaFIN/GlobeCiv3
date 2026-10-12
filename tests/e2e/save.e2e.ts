import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, errors: string[]) {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** What a continued game must keep: the day, the map, the cities, the units and the rest. */
const kept = (s: any) => ({
  seed: s.seed, startCity: s.startCity, day: s.day, speed: s.speed, paused: s.paused, mapped: s.mapped, openLevel: s.openLevel,
  cities: s.cities.map((c: any) => [c.name, c.tile, c.size, c.food, c.shields, c.build]),
  units: s.units.map((u: any) => [u.name, u.kind, u.tile, u.mode, u.path, u.task]),
  site: s.site, improvements: s.improvements, raid: s.raid, found: s.found,
});

test('the game saves itself; after a reload Jatka goes on where it was', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, errors);
  // No save yet: only "Uusi peli"
  await expect(page.getByRole('button', { name: /^Jatka/ })).toBeHidden();
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  // The capital, and some days of play
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  const founded = (await state(page)).day;
  await page.waitForFunction(d => (window as any).globeGame.state.day >= d + 5, founded, { timeout: 60_000 });
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  const before = await state(page);
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);

  // A reload: the start screen offers the saved game
  await open(page, errors);
  const go = page.getByRole('button', { name: /^Jatka/ });
  await expect(go).toBeVisible();
  await expect(go).toContainText(`Päivä ${before.day} · Aamuranta`);
  await expect(page.locator('.start-progress span')).toHaveText(/^Kartoitettu \d+ %$/);
  await expect(go).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('continue.png') });
  // "Uusi peli" asks before it replaces the save
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await expect(page.getByRole('button', { name: 'Aloita alusta, tallennus korvataan' })).toBeVisible();
  expect((await state(page)).screen).toBe('start');

  // Jatka: the game goes on, paused as it was saved
  await go.click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  const after = await state(page);
  expect(kept(after)).toEqual(kept(before));
  await expect(page.locator('.hud-day-n')).toHaveText(`Päivä ${before.day}`);
  await expect(page.getByRole('button', { name: /^Kaupunki Aamuranta, koko/ })).toBeVisible();
  // And it goes on from there
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(d => (window as any).globeGame.state.day > d, before.day, { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath('continued.png') });
  expect(errors).toEqual([]);
});

test('a broken save is not offered, and a new game starts as usual', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => errors.push(e.message));
  await open(page, errors);
  // A save with a unit of an unknown kind, written past the game
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('globeciv3', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('saves');
    req.onsuccess = () => {
      const tx = req.result.transaction('saves', 'readwrite');
      tx.objectStore('saves').put({ version: 1, seed: 42, units: { units: [{ kind: 'dragon' }] } }, 'auto');
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await open(page, errors);
  await page.waitForFunction(() => document.querySelector('.start-new') !== null);
  await expect.poll(() => warnings.some(w => w.includes('not valid'))).toBe(true);
  await expect(page.getByRole('button', { name: /^Jatka/ })).toBeHidden();
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 20_000 });
  expect(errors).toEqual([]);
});
