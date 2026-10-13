import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const plans = async (page: Page) => ((await state(page)).areaPlans as [number, string][]).map(p => p[1]);

test('province advisors: three to choose from at the province level, each running the province', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // Map the whole home province through the test hook, and zoom out to it
  await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 7);
    const table = w.globeRegions.tileTable();
    const ids: number[] = [];
    for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / 7) === home && !w.globeMap.isMapped(id)) ids.push(id);
    w.globeDebug.reveal(ids);
  });
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await page.waitForFunction(() => { const s = (window as any).globeLevels.state; return s.level === 2 && !s.flying; }, null, { timeout: 20_000 });

  // The province's own advisor: none at first
  await page.getByRole('button', { name: 'Neuvonantaja: Oma ohjaus' }).click();
  const card = page.getByRole('dialog', { name: 'Neuvonantaja' });
  await expect(card.locator('.advisor-level')).toHaveText('Lääni');
  const options = card.getByRole('radio');
  await expect(options).toHaveCount(4);
  for (const n of ['Asuttaja', 'Tutkimusmatkailija', 'Vartija']) await expect(options.filter({ hasText: n })).toHaveCount(1);
  await expect(page.locator('.level-bottom:not([hidden])')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('province-advisors.png') });

  // Asuttaja: the two best areas without a city are marked Asuta
  await options.filter({ hasText: 'Asuttaja' }).click();
  expect((await state(page)).provinceAdvisor).toBe('settle');
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.areaPlans.filter((p: [number, string]) => p[1] === 'settle').length === 2, null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(card.locator('.advisor-log')).toContainText('asutettavaksi');

  // Tutkimusmatkailija: Ohita goes, and an expedition sets off into the home state
  await card.getByRole('button', { name: 'Sulje' }).click();
  const other = page.locator('.chip:not([hidden])').filter({ hasNotText: 'Kotialue' }).first();
  await other.click();
  await page.locator('.area-panel label', { hasText: 'Ohita' }).click();
  expect(await plans(page)).toContain('skip');
  await page.getByRole('button', { name: 'Neuvonantaja: Asuttaja' }).click();
  await options.filter({ hasText: 'Tutkimusmatkailija' }).click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await expect(card.locator('.advisor-log')).toContainText('retkikunta kohti:', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect(await plans(page)).not.toContain('skip');
  expect((await state(page)).flag).not.toBeNull();

  // Vartija: chosen and saved in the state
  await options.filter({ hasText: 'Vartija' }).click();
  expect((await state(page)).provinceAdvisor).toBe('defend');
  await expect(page.getByRole('button', { name: 'Neuvonantaja: Vartija' })).toBeVisible();
  expect(errors).toEqual([]);
});
