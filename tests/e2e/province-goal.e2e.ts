import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const provinceOf = (page: Page, tile: number) => page.evaluate(t => Math.floor((window as any).globeRegions.tileTable()[t] / 7), tile);
/** Map every tile of a province through the test hook. */
const reveal = (page: Page, province: number) => page.evaluate(pr => {
  const w = window as any;
  const table = w.globeRegions.tileTable();
  const ids: number[] = [];
  for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / 7) === pr && !w.globeMap.isMapped(id)) ids.push(id);
  w.globeDebug.reveal(ids);
}, province);

/** The next level by its goal, its card closed and its advisors left to the player's own hand. */
async function rise(page: Page, card: RegExp) {
  await page.evaluate(() => (window as any).globeDebug.rise());
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: card }) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.getByRole('dialog', { name: /^Kuka hoitaa/ }).getByRole('button', { name: /^Ohjaan itse/ }).click();
}

async function days(page: Page, n: number) {
  const day = (await state(page)).day;
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(([d, k]) => (window as any).globeGame.state.day >= d + k, [day, n], { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
}

test('the province advisors aim at the province level\'s goal: the nearest province of the home state not held (STORY-111)', async ({ page }) => {
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
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  await rise(page, /kaupunkialue avautui/);
  await rise(page, /lääni avautui/);
  expect((await state(page)).openLevel).toBe(2);
  // The player's own hand aims at nothing
  await days(page, 2);
  expect((await state(page)).targetProvince).toBe(-1);

  // Tutkimusmatkailija: the home province mapped, the expedition goes to the target province
  const home = Math.floor((await state(page)).startCity / 7);
  await reveal(page, home);
  await page.evaluate(() => (window as any).globeDebug.setAdvisors({ province: 'explore' }));
  await days(page, 2);
  const s = await state(page);
  const goal = s.targetProvince;
  const p = await page.evaluate(() => (window as any).globeDebug.province());
  expect(goal).toBeGreaterThanOrEqual(0);
  expect(Math.floor(goal / 7)).toBe(p.homeState);
  expect(p.held).not.toContain(goal);
  expect(s.commands.some((c: { kind: string; by: string }) => c.kind === 'target' && c.by === 'province')).toBe(true);
  expect(s.flag).not.toBeNull();
  expect(await provinceOf(page, s.flag)).toBe(goal);

  // Vartija: the scouts may go into the provinces held and the target
  await page.evaluate(() => (window as any).globeDebug.setAdvisors({ province: 'defend' }));
  await days(page, 1);
  const kept = await page.evaluate(() => (window as any).globeDebug.province());
  expect(kept.keepAlso).toContain(goal);
  for (const h of kept.held) expect(kept.keepAlso).toContain(h);

  // Asuttaja: once the target is mapped, a site there is offered and taken
  await reveal(page, goal);
  await page.evaluate(() => { const d = (window as any).globeDebug; d.setAdvisors({ province: 'settle' }); d.setSiteOffers(true); });
  const before = (await state(page)).offered.length;
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(n => (window as any).globeGame.state.offered.length > n, before, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const offered: number[] = (await state(page)).offered.slice(before);
  const provinces = await Promise.all(offered.map(t => provinceOf(page, t)));
  expect(provinces).toContain(goal);
  expect(errors).toEqual([]);
});
