import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const BASE = ['lumberjack', 'sawmill', 'quarry'];

/** A new game on seed 42 with the Rakentaja at the city level, its city area open in the own hand. */
async function cityAreaGame(page: Page, errors: string[]) {
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
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).locator('.onboard-option').filter({ hasText: 'Rakentaja' }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.evaluate(() => (window as any).globeDebug.rise());
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkialuetta?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  expect((await state(page)).openLevel).toBe(3);
}

test('a city founded in the city area starts as a settlement: its base and a chain of food stand where the governor put them, and its city level is there to dive into (STORY-091)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  await cityAreaGame(page, errors);
  await page.getByRole('button', { name: 'Tauko' }).click();

  // A site four to six steps from the capital where a city may stand, founded the way a settler founds
  const tile: number = await page.evaluate(() => {
    const w = window as any;
    const capital: number = w.globeGame.state.cities[0].tile;
    let ring = [capital];
    const seen = new Set(ring);
    for (let d = 1; d <= 6; d++) {
      ring = ring.flatMap((t: number) => w.globeHexTiles.neighbors(t) as number[]).filter((t: number) => !seen.has(t) && (seen.add(t), true));
      if (d < 4) continue;
      const ok = ring.find((t: number) => w.globeDebug.site(t).block === null);
      if (ok !== undefined) return ok;
    }
    return -1;
  });
  expect(tile).toBeGreaterThanOrEqual(0);
  await page.evaluate(t => (window as any).globeDebug.foundHere(t), tile);

  // Size 1 as in Freeciv, its chains and its buildings: the base and a whole chain of food
  const city = (await state(page)).cities[1];
  testInfo.annotations.push({ type: 'settlement', description: JSON.stringify({ tile, buildings: city.buildings }) });
  expect(city.tile).toBe(tile);
  expect(city.size).toBe(1);
  expect(city.chain).toBeTruthy();
  expect(city.buildings).toEqual(expect.arrayContaining(BASE));
  const bread = ['field', 'mill', 'bakery'].every(b => city.buildings.includes(b));
  expect(bread || city.buildings.includes('fishery')).toBe(true);
  // The governor put each of them on a tile: none is placed by the player at this level
  const placed = (await page.evaluate(() => (window as any).globeDebug.placement(1))).placed as Record<string, number>;
  for (const b of city.buildings) expect(placed[b], b).toBeGreaterThanOrEqual(0);
  // The capital's own chains are as they were
  expect((await state(page)).cities[0].chain).toBeTruthy();

  // Its card at the city area: a settlement still growing, its stock and the city level's advisor
  const card = page.getByRole('dialog', { name: city.name });
  const openCard = async () => {
    await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
    const list = page.getByRole('dialog', { name: 'Luettelo' });
    await list.getByText('Kaupungit (2)').click();
    await list.locator('.list-row').filter({ hasText: city.name }).click();
    await expect(card).toBeVisible();
  };
  await openCard();
  await expect(card.locator('.city-chain')).toContainText('Varasto:');
  await expect(card.locator('.city-chain')).not.toContainText('Valmis settlementti');
  await card.getByRole('button', { name: 'Sulje' }).click();

  // The Rakentaja keeps its chains going: in a few days its buildings make goods
  const before = JSON.stringify((await state(page)).cities[1].chain.stock);
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(b => JSON.stringify((window as any).globeGame.state.cities[1].chain.stock) !== b, before, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // At three citizens it is a ready settlement
  await page.evaluate(() => (window as any).globeDebug.setCitySize(1, 3));
  await openCard();
  await expect(card.locator('.city-chain')).toContainText('Valmis settlementti');
  await card.getByRole('button', { name: 'Sulje' }).click();

  // Its city level is there to dive into: the relief rises with its buildings, and the city level's advisor runs it
  await page.evaluate(t => {
    const w = window as any;
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeDebug.cityLevelDist(), 0);
  }, tile);
  await page.waitForFunction(t => {
    const l = (window as any).globeDebug.cityLevel();
    return l.city === t && l.relief === 1;
  }, tile, { timeout: 30_000 });
  expect((await page.evaluate(() => (window as any).globeDebug.cityLevel())).props).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /^Neuvonantaja: Rakentaja/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settlement-city-level.png') });
  expect(errors).toEqual([]);
});
