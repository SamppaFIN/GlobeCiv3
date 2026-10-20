import { expect, test, type Page } from '@playwright/test';

type RivalState = { name: string; cities: { name: string; tile: number; size: number }[] };
const rivals = (page: Page) => page.evaluate(() => (window as any).globeDebug.rivals() as RivalState[]);
const cities = (page: Page) => page.evaluate(() => (window as any).globeGame.state.cities as { id: number; name: string; tile: number; size: number }[]);
const watchNotices = (page: Page) => page.evaluate(() => {
  const w = window as any;
  const el = document.querySelector('.hud-notice')!;
  w.notices = [];
  new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) w.notices.push(n.textContent); }).observe(el, { childList: true });
});
const notices = (page: Page) => page.evaluate(() => (window as any).notices as string[]);
const resume = async (page: Page) => page.getByRole('button', { name: 'Jatka', exact: true }).click();
const pause = async (page: Page) => {
  await page.getByRole('button', { name: 'Tauko' }).click();
  if (await page.getByRole('button', { name: 'Myöhemmin' }).isVisible()) await page.getByRole('button', { name: 'Myöhemmin' }).click();
};

/** The old start with the capital founded where the settler stands and a second city where a scout does; the first rival met. */
async function setUp(page: Page, two: boolean) {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.evaluate(found => {
    const w = window as any;
    const units = w.globeGame.state.units as { kind: string; tile: number }[];
    w.globeDebug.foundHere(units.find(u => u.kind === 'settler')!.tile);
    if (found) w.globeDebug.foundHere(units.find(u => u.kind === 'scout')!.tile);
  }, two);
  await watchNotices(page);
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(() => (window as any).globeDebug.rivals()[0]?.cities.length > 0, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const w = window as any;
    const t = w.globeDebug.rivals()[0].cities[0].tile;
    w.globeDebug.reveal([t, ...w.globeHexTiles.neighbors(t)]);
  });
  await page.waitForFunction(() => (window as any).globeDebug.ties()[0].met, null, { timeout: 30_000 });
  await pause(page);
  // War, declared on its diplomacy card
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  await list.getByText('Diplomatia', { exact: true }).click();
  const name = (await rivals(page))[0].name;
  await list.locator('.list-row', { hasText: name }).click();
  const card = page.getByRole('dialog', { name });
  await card.getByRole('button', { name: 'Julista sota' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).globeDebug.ties()[0].state))).toBe('war');
  await card.getByRole('button', { name: 'Sulje' }).click();
  return name;
}

test('a rival at war gathers an army against the player\'s city, takes it, and the last city lost ends the game', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const name = await setUp(page, true);

  // It aims at one of the player's cities and, knowing Horseback Riding, builds horsemen for it
  await page.evaluate(() => (window as any).globeDebug.rivalLearn(0, 'horseback'));
  await resume(page);
  await page.waitForFunction(() => (window as any).globeDebug.rivalWar(0).target !== null, null, { timeout: 30_000 });
  await pause(page);
  const target = (await page.evaluate(() => (window as any).globeDebug.rivalWar(0).target)) as number;
  const mine = await cities(page);
  const lost = mine.find(c => c.tile === target)!;
  expect(lost).toBeTruthy();

  // Horsemen next to it, and the city of size 3 with no defender: it is taken, a citizen fewer
  await page.evaluate(([t, id]) => {
    const w = window as any;
    w.globeDebug.setCitySize(id, 3);
    w.globeDebug.rivalUnits(0, 'horseman', w.globeHexTiles.neighbors(t)[0], 2);
  }, [target, lost.id]);
  await resume(page);
  await page.waitForFunction(t => !(window as any).globeGame.state.cities.some((c: { tile: number }) => c.tile === t), target, { timeout: 30_000 });
  await pause(page);
  const theirs = (await rivals(page))[0].cities.find(c => c.tile === target);
  // A citizen fewer when taken (rivals.test.ts); days pass before the pause, and it may starve or build a settler
  expect(theirs?.name).toBe(lost.name);
  expect(theirs!.size).toBeLessThanOrEqual(2);
  const left = await cities(page);
  expect(left.map(c => c.id)).toEqual(left.map((_, i) => i));
  expect(left.some(c => (c as any).capital)).toBe(true);
  // A soldier the city built meanwhile may have fallen first
  expect((await notices(page)).some(n => n.startsWith(`${name}: `) && n.endsWith(`kaupunki menetettiin · ${lost.name}`))).toBe(true);

  // The last city falls: the game is over, the save is gone, and a new game begins
  const last = left[0];
  await page.evaluate(([t]) => {
    const w = window as any;
    w.globeDebug.setCitySize(0, 2);
    w.globeDebug.rivalUnits(0, 'horseman', w.globeHexTiles.neighbors(t)[0], 2);
  }, [last.tile]);
  await resume(page);
  const end = page.getByRole('dialog').filter({ hasText: 'Peli päättyi' });
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(end).toContainText(`${name} valtasi viimeisen kaupunkisi`);
  await page.screenshot({ path: testInfo.outputPath('game-over.png') });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await end.getByRole('button', { name: /Uusi peli/ }).click();
  await ready;
  await expect(page.getByRole('button', { name: 'Uusi peli' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jatka' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('at war the Kenraali takes a rival\'s city, which comes over with a citizen fewer', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setUp(page, false);
  const city = (await rivals(page))[0].cities[0];
  await page.evaluate(t => {
    const w = window as any;
    w.globeDebug.setRivalCitySize(0, 0, 3);
    w.globeDebug.learn('horseback');
    w.globeDebug.setAdvisors({ state: 'war' });
    w.globeDebug.aimAt(Math.floor(w.globeRegions.tileTable()[t] / 49));
    for (let k = 0; k < 6; k++) w.globeDebug.spawnUnitAt('horseman', w.globeHexTiles.neighbors(t)[k % 6]);
  }, city.tile);
  await resume(page);
  await page.waitForFunction(t => (window as any).globeGame.state.cities.some((c: { tile: number }) => c.tile === t), city.tile, { timeout: 60_000 });
  await pause(page);
  const taken = (await cities(page)).find(c => c.tile === city.tile)!;
  expect(taken.name).toBe(city.name);
  expect(taken.size).toBeLessThanOrEqual(2);
  expect((await rivals(page))[0].cities.some(c => c.tile === city.tile)).toBe(false);
  expect(await page.evaluate(() => (window as any).globeDebug.ties()[0].lost)).toBe(1);
  expect(errors).toEqual([]);
});
