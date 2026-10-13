import { expect, test, type Page } from '@playwright/test';

const onScreen = (page: Page, tile: number) => page.evaluate(t => {
  const w = window as any;
  const p = w.globeHexTiles.tileCenter(t).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
  return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight] as [number, number];
}, tile);

test('a tapped hex opens a card of what it holds; mapped land and the fog alike', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
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

  // A mapped land hex two steps from the selected scout, with no unit next to it, on screen
  const pick = (mapped: boolean) => page.evaluate(m => {
    const w = window as any;
    const s = w.globeGame.state;
    const near = (id: number) => [id, ...w.globeHexTiles.neighbors(id)];
    const busy = new Set(s.units.flatMap((u: any) => near(u.tile)));
    const from = s.units[s.selected].tile;
    let ring = new Set<number>([from]);
    for (let r = 0; r < 8; r++) {
      ring = new Set([...ring].flatMap(near));
      const hit = [...ring].find(id => !busy.has(id) && w.globeMap.isMapped(id) === m && (!m || w.globeTileTypes.tileInfo(id).terrain !== 'ocean'));
      if (hit !== undefined && r >= 1) return hit;
    }
    return null;
  }, mapped);
  const land = (await pick(true))!;
  const [x, y] = await onScreen(page, land);
  await page.mouse.click(x, y);
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await expect(card).toBeVisible();
  expect((await page.evaluate(() => (window as any).globeGame.state.tileOpen))).toBe(land);
  const info = await page.evaluate(id => (window as any).globeTileTypes.tileInfo(id), land);
  await expect(card.locator('.tile-title')).toContainText(/\S/);
  await expect(card.locator('.tile-rows')).toContainText(/Tuottaa\s*ruokaa \d+ · tuotantoa \d+ · kauppaa \d+ päivässä/);
  await expect(card.locator('.tile-rows')).toContainText(/Kulku\s*\d+ pv/);
  await expect(card.locator('.tile-rows')).toContainText('Kaupunkiei kaupungin alueella');
  testInfo.annotations.push({ type: 'tile', description: `${land}: ${info.terrain} ${info.resource ?? ''} → ${await card.locator('.tile-title').textContent()}` });
  // The unit panel steps aside, and the hex's yield marks it on the map
  await expect(page.locator('.hud-bottom')).toBeHidden();
  await expect(page.locator('.tile-yield').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tile.png') });

  // Closed, then a hex in the fog: nothing known yet
  await card.getByRole('button', { name: 'Sulje' }).click();
  await expect(card).toBeHidden();
  await expect(page.locator('.hud-bottom')).toBeVisible();
  const fog = await pick(false);
  if (fog !== null) {
    const [fx, fy] = await onScreen(page, fog);
    await page.mouse.click(fx, fy);
    await expect(card.locator('.tile-title')).toHaveText('Kartoittamaton');
  }
  // Another card closes it
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt ja talous' }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Luettelo' })).toBeVisible();
  await expect(page.locator('.hud-bottom')).toBeHidden();
  expect(errors).toEqual([]);
});
