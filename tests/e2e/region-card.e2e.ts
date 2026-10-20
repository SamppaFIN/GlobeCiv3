import { expect, test, type Page } from '@playwright/test';

/** Map a share of the home province or state through the test hook. */
const mapShare = (page: Page, region: 'province' | 'state', share: number) => page.evaluate(([r, s]) => {
  const w = window as any;
  const div = r === 'province' ? 7 : 49;
  const home = Math.floor(w.globeGame.state.startCity / div);
  const table = w.globeRegions.tileTable();
  const ids: number[] = [];
  for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / div) === home) ids.push(id);
  const target = Math.ceil(ids.length * (s as number));
  const missing = ids.filter(id => !w.globeMap.isMapped(id));
  w.globeDebug.reveal(missing.slice(0, Math.max(0, target - (ids.length - missing.length))));
}, [region, share] as const);

const arrive = (page: Page, level: number) => page.waitForFunction(l => {
  const s = (window as any).globeLevels.state;
  return s.level === l && !s.flying;
}, level, { timeout: 20_000 });

/**
 * A point on the screen over the map (not a chip, label or panel) inside the home region of
 * a level: 2 the start city area, 1 its province, 0 its state.
 */
const spotIn = (page: Page, level: 0 | 1 | 2) => page.evaluate(l => {
  const w = window as any;
  const start = w.globeGame.state.startCity;
  const id = l === 2 ? start : l === 1 ? Math.floor(start / 7) : Math.floor(start / 49);
  const div = l === 2 ? 1 : l === 1 ? 7 : 49;
  const table = w.globeRegions.tileTable();
  const canvas = document.querySelector('canvas');
  for (let t = 0; t < table.length; t += 7) {
    if (Math.floor(table[t] / div) !== id) continue;
    const p = w.globeHexTiles.tileCenter(t).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
    const x = ((p.x + 1) / 2) * innerWidth, y = ((1 - p.y) / 2) * innerHeight;
    if (x < 20 || y < 20 || x > innerWidth - 20 || y > innerHeight - 20) continue;
    if (document.elementFromPoint(x, y) === canvas) return { id, x, y };
  }
  return null;
}, level);

test('a tap on the map opens a card of the city area, province or state; a second tap or its button goes in', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
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
  // The start area with its coloured resources, at the city-area level
  await page.screenshot({ path: testInfo.outputPath('resources.png') });
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });

  // The province level: a city area's card
  await mapShare(page, 'province', 0.61);
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.keyboard.press('-');
  await arrive(page, 2);
  const area = (await spotIn(page, 2))!;
  await page.mouse.click(area.x, area.y);
  await expect(card).toBeVisible();
  const areaView = await page.evaluate(id => (window as any).globeDebug.regionView(2, id), area.id);
  await expect(card.locator('.tile-title')).toHaveText(areaView.title);
  await expect(card.locator('.tile-kicker')).toHaveText(/^Kaupunkialue · /);
  for (const label of ['Painotus', 'Kartoitettu', 'Maasto', 'Erikoisresurssit', 'Kaupungit']) await expect(card.locator('.tile-rows')).toContainText(label);
  await expect(card.locator('.tile-rows')).toContainText(/Kartoitettu\s*\d+ %/);
  // The level's panel and chips step aside, and come back with the selection when it closes
  await expect(page.locator('.chips')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('area.png') });
  await card.getByRole('button', { name: 'Sulje' }).click();
  await expect(card).toBeHidden();
  await expect(page.locator('.chips')).toBeVisible();
  expect(await page.evaluate(() => (window as any).globeLevels.state.selection)).toEqual({ level: 2, id: area.id });
  // A chip only selects, as before
  await page.locator('.chip:not([hidden])').first().click();
  await expect(card).toBeHidden();
  // The second tap on the map goes in
  await page.mouse.click(area.x, area.y);
  await expect(card).toBeVisible();
  await page.mouse.click(area.x, area.y);
  await arrive(page, 3);
  await expect(card).toBeHidden();

  // The state level: a province's card; its button goes in
  await mapShare(page, 'state', 0.61);
  await page.keyboard.press('-');
  await arrive(page, 2);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 1);
  const province = (await spotIn(page, 1))!;
  await page.mouse.click(province.x, province.y);
  await expect(card).toBeVisible();
  await expect(card.locator('.tile-kicker')).toHaveText(/^Lääni · /);
  await expect(card.locator('.tile-rows')).toContainText(/Tila\s*(ei hallussa|hallussa: kaupunki läänissä)/);
  await page.screenshot({ path: testInfo.outputPath('province.png') });
  await card.getByRole('button', { name: 'Sukella sisään' }).click();
  await arrive(page, 2);

  // The planet: the home state conquered, a state's card
  await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 49);
    for (let k = 0; k < 7; k++) w.globeDebug.foundIn(home * 7 + k);
  });
  await page.keyboard.press('-');
  await arrive(page, 1);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 0);
  const state = (await spotIn(page, 0))!;
  await page.mouse.click(state.x, state.y);
  await expect(card).toBeVisible();
  await expect(card.locator('.tile-kicker')).toHaveText('Valtio');
  await expect(card.locator('.tile-title')).toHaveText('Kotivaltio');
  await expect(card.locator('.tile-rows')).toContainText(/Tila\s*kotivaltio/);
  await expect(card.locator('.tile-rows')).toContainText(/Läänit\s*7 \/ 7 hallussa/);
  await expect(card.locator('.tile-rows')).toContainText(/Kaupungit\s*\S/);
  await page.screenshot({ path: testInfo.outputPath('state.png') });
  expect(errors).toEqual([]);
});
