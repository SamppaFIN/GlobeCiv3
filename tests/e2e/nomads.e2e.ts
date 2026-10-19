import { expect, test, type Page } from '@playwright/test';

interface TribeState { state: number; name: string; camp: number; mapped: boolean; band: { size: number; unit: string; attack: number }; moves: number }
const tribes = (page: Page) => page.evaluate(() => (window as any).globeDebug.tribes() as TribeState[]);

test('nomad tribes: one in each state next to home, a band that raids a city, and the Kenraali scatters one for its ransom', async ({ page }, testInfo) => {
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
  // The home state conquered, and the tribes found with the city-states of its neighbours
  await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 49);
    for (let k = 0; k < 7; k++) w.globeDebug.foundIn(home * 7 + k);
    w.globeDebug.fastForward(4);
  });
  await page.waitForFunction(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 49);
    const states = new Set(w.globeDebug.tribes().map((t: TribeState) => t.state));
    return w.globeRegions.neighbors[home].every((s: number) => states.has(s));
  }, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const all = await tribes(page);
  for (const t of all) {
    expect(t.name).toMatch(/heimo$/);
    expect([2, 3, 4]).toContain(t.band.size);
    expect(t.band).toMatchObject({ unit: 'cavalry', attack: 2 });
  }

  // The tribe whose camp stays longest: in sight, a label of its own, and its hex card
  const t = all.sort((a, b) => b.moves - a.moves)[0];
  await page.evaluate(camp => {
    const w = window as any;
    w.globeDebug.reveal([camp, ...w.globeHexTiles.neighbors(camp)]);
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(camp), w.globeCamera.dist, 0);
  }, t.camp);
  const label = page.locator('.city-label-native', { hasText: t.name });
  await expect(label).toBeVisible();
  await expect(label.locator('.city-label-size')).toHaveText(String(t.band.size));
  await page.screenshot({ path: testInfo.outputPath('camp.png') });
  await label.click();
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await expect(card.locator('.tile-rows')).toContainText(new RegExp(`Paimentolaiset\\s*${t.name} · ${t.band.size} ratsumiestä · leiri siirtyy \\d+ pv päästä`));
  await card.getByRole('button', { name: 'Sulje' }).click();

  // Its band sets off at the nearest city: the card names the tribe
  await page.evaluate(() => (window as any).globeDebug.setRaids(true));
  expect(await page.evaluate(s => (window as any).globeDebug.tribeRaidNow(s), t.state)).toBe(true);
  const raid = page.getByRole('dialog', { name: `${t.name} hyökkää` });
  await expect(raid).toBeVisible();
  await expect(raid).toContainText(`${t.band.size} paimentolaista on matkalla kohti kaupunkia`);
  await raid.getByRole('button', { name: /Luota puolustukseen/ }).click();
  await page.evaluate(() => (window as any).globeDebug.setRaids(false));

  // The Kenraali against the camp: an army next to it scatters the tribe for the ransom (two
  // tribes may share a name, so the labels in sight are counted)
  const labels = await page.locator('.city-label-native:visible', { hasText: t.name }).count();
  await page.evaluate(camp => {
    const w = window as any;
    const next = w.globeHexTiles.neighbors(camp).find((n: number) => Number.isFinite(w.globeDebug.yieldOf(n).food) && w.globeTileTypes.tileInfo(n).terrain !== 'ocean');
    for (let k = 0; k < 12; k++) w.globeDebug.spawnUnitAt('swordsman', next);
    w.globeDebug.setAdvisors({ state: 'war' });
    w.globeDebug.fastForward(1);
  }, t.camp);
  await page.waitForFunction(s => (window as any).globeDebug.war().routed.includes(s), t.state, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect((await tribes(page)).some(x => x.state === t.state)).toBe(false);
  await expect(page.locator('.city-label-native:visible', { hasText: t.name })).toHaveCount(labels - 1);
  expect(await page.evaluate(() => (window as any).globeGame.state.stateAdvisor)).toBe('war');
  testInfo.annotations.push({ type: 'tribe', description: `${t.name} (${t.band.size}) hajosi päivänä ${await page.evaluate(() => (window as any).globeGame.state.day)}` });
  expect(errors).toEqual([]);
});
