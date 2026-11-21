import { expect, test, type Page } from '@playwright/test';

/** Where a hex is on the screen, and how far from the middle. */
const onScreen = (page: Page, tile: number) => page.evaluate(t => {
  const w = window as any;
  const p = w.globeHexTiles.tileCenter(t).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
  return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight] as [number, number];
}, tile);
const offCentre = async (page: Page, tile: number) => {
  const [x, y] = await onScreen(page, tile);
  const size = page.viewportSize()!;
  return Math.hypot(x - size.width / 2, y - size.height / 2);
};
const settled = (page: Page) => page.waitForFunction(() => !(window as any).globeLevels.state.flying, null, { timeout: 10_000 });

/** Drag the map aside, so a link has somewhere to take the view back to. */
async function dragAside(page: Page) {
  const size = page.viewportSize()!;
  const [x, y] = [size.width / 2, size.height * 0.4];
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x - i * 16, y - i * 10);
  await page.mouse.up();
  await settled(page);
}

test('coloured texts: a unit in the hex card and a city in the advisor log take the view there (STORY-103)', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // A mapped land hex two steps from the selected scout, with no unit next to it: its card opens,
  // and a soldier put there shows in it as a link (a tap on a unit's mark would select the unit)
  const land: number = await page.evaluate(() => {
    const w = window as any;
    const s = w.globeGame.state;
    const near = (id: number) => [id, ...w.globeHexTiles.neighbors(id)];
    const busy = new Set(s.units.flatMap((u: any) => near(u.tile)));
    let ring = new Set<number>([s.units[s.selected].tile]);
    for (let r = 0; r < 8; r++) {
      ring = new Set([...ring].flatMap(near));
      const hit = [...ring].find(id => !busy.has(id) && w.globeMap.isMapped(id) && w.globeTileTypes.tileInfo(id).terrain !== 'ocean');
      if (hit !== undefined && r >= 1) return hit;
    }
    return null;
  });
  const camp: number = (await page.evaluate(() => (window as any).globeGame.state.units.find((u: { kind: string }) => u.kind === 'settler').tile));
  const [x, y] = await onScreen(page, land);
  await page.mouse.click(x, y);
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await expect(card).toBeVisible();
  const name: string = await page.evaluate(t => (window as any).globeDebug.spawnUnitAt('warrior', t), land);
  const target = { tile: land, name, i: (await page.evaluate(() => (window as any).globeGame.state.units.length)) - 1 };
  await expect(card).toBeVisible();
  const link = card.getByRole('button', { name: `${target.name}, yksikkö` });
  await expect(link).toBeVisible();
  await expect(link).toHaveClass(/rich-unit/);
  await page.screenshot({ path: testInfo.outputPath('tile-links.png') });
  await dragAside(page);
  await expect(card).toBeVisible();
  expect(await offCentre(page, target.tile)).toBeGreaterThan(60);
  await link.click();
  await settled(page);
  // Selected, the card closed, and the view on the unit
  const after = await page.evaluate(() => (window as any).globeGame.state);
  expect(after.selected).toBe(target.i);
  expect(after.tileOpen).toBeNull();
  await expect(card).toBeHidden();
  expect(await offCentre(page, after.units[target.i].tile)).toBeLessThan(40);

  // A city with a Vartija: the advisor log names it, coloured and linked
  await page.evaluate(t => (window as any).globeDebug.foundHere(t), camp);
  await page.evaluate(() => (window as any).globeDebug.setAdvisors({ city: 'defend' }));
  const city: string = (await page.evaluate(() => (window as any).globeGame.state.cities[0].name));
  await page.evaluate(() => (window as any).globeDebug.raidNow(0));
  await page.getByRole('button', { name: 'Neuvonantaja: Vartija' }).click();
  const advisor = page.getByRole('dialog', { name: 'Neuvonantaja' });
  await page.getByRole('button', { name: 'Jatka' }).click();
  const cityLink = advisor.locator('.advisor-log').getByRole('button', { name: `${city}, kaupunki` }).first();
  await expect(cityLink).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(cityLink).toHaveClass(/rich-city/);
  await expect(advisor.locator('.advisor-log')).toContainText(`${city} rakentaa sotilaan rosvoja vastaan`);
  await page.screenshot({ path: testInfo.outputPath('advisor-links.png') });
  await advisor.getByRole('button', { name: 'Sulje' }).click();
  await dragAside(page);
  expect(await offCentre(page, camp)).toBeGreaterThan(60);
  await page.getByRole('button', { name: 'Neuvonantaja: Vartija' }).click();
  await cityLink.click();
  await settled(page);
  // The card closes, the view is on the city, and its quick panel is open
  await expect(advisor).toBeHidden();
  expect(await offCentre(page, camp)).toBeLessThan(40);
  await expect(page.getByLabel(`Kaupunki ${city}: pikatoiminnot`)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('city-link.png') });
  expect(errors).toEqual([]);
});
