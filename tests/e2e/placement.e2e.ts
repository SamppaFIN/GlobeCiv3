import { expect, test, type Page } from '@playwright/test';

type Spot = { tile: number; best: boolean };
type Placement = { placed: Record<string, number>; best: string[]; spots: Spot[]; moving: { city: number; building: string } | null };
const placement = (page: Page, building?: string) => page.evaluate(b => (window as any).globeDebug.placement(0, b) as Placement, building);
/** A tile's centre on the screen, on the risen ground; the canvas must be what is there. */
const tapTile = async (page: Page, tile: number) => {
  const at = await page.evaluate(t => {
    const p = (window as any).globeDebug.tileScreen(t) as [number, number] | null;
    return p && { x: p[0], y: p[1], canvas: document.elementFromPoint(p[0], p[1]) === document.querySelector('canvas') };
  }, tile);
  expect(at?.canvas).toBe(true);
  await page.mouse.click(at!.x, at!.y);
};

test('the governor puts each building on its best ground; the player moves one, and its bonus follows', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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

  // The governor's placement: every building on a tile where it may stand, on its best ground when there is one
  const props = (await page.evaluate(() => (window as any).globeDebug.cityLevel().props)) as number;
  await page.evaluate(() => (window as any).globeDebug.giveBuildings(0, ['temple', 'market', 'granary', 'library']));
  const first = await placement(page);
  for (const b of ['temple', 'market', 'granary', 'library']) {
    const spots = (await placement(page, b)).spots;
    const here = spots.find(s => s.tile === first.placed[b]);
    expect(here, b).toBeDefined();
    expect(first.best.includes(b), b).toBe(here!.best);
  }
  // The temple went first, so its best ground was free if the city has any
  const templeSpots = (await placement(page, 'temple')).spots;
  if (templeSpots.some(s => s.best)) expect(first.best).toContain('temple');
  await page.waitForFunction(n => (window as any).globeDebug.cityLevel().props > n, props, { timeout: 10_000 });
  await page.screenshot({ path: testInfo.outputPath('placed.png') });

  // The temple's hex: its height and buildings, and a button to move it
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await tapTile(page, first.placed.temple);
  await expect(card).toBeVisible();
  await expect(card.locator('.tile-rows')).toContainText(/Korkeus\s*(ylhäällä|alhaalla)/);
  await expect(card.locator('.tile-rows')).toContainText('Temppeli');
  await card.getByRole('button', { name: 'Siirrä temppeli' }).click();

  // Moving: the card tells where it does best, and the tiles it may go to are marked
  await expect(card.locator('.tile-title')).toHaveText('Siirrä: Temppeli');
  await expect(card.locator('.tile-rows')).toContainText('ylhäällä, keskustaa korkeammalla: +1 tyytyväinen');
  const moving = await placement(page, 'temple');
  expect(moving.moving).toMatchObject({ building: 'temple' });
  await page.waitForFunction(n => (window as any).globeDebug.cityLevel().props > n + 4, props, { timeout: 10_000 });
  await page.screenshot({ path: testInfo.outputPath('moving.png') });
  // To a tile where the bonus changes if there is one, else any other
  const onBest = first.best.includes('temple');
  const others = moving.spots.filter(s => s.tile !== first.placed.temple);
  const target = others.find(s => s.best !== onBest) ?? others[0];
  await tapTile(page, target.tile);
  await expect.poll(async () => (await placement(page)).placed.temple).toBe(target.tile);
  const after = await placement(page);
  expect(after.moving).toBeNull();
  expect(after.best.includes('temple')).toBe(target.best);
  // The hex it went to opens, with the temple on it
  await expect(card.locator('.tile-rows')).toContainText('Temppeli');
  await page.screenshot({ path: testInfo.outputPath('moved.png') });

  // A tap on a tile it may not stand on (the centre) leaves it where it is, and Peru ends the move
  await card.getByRole('button', { name: 'Siirrä temppeli' }).click();
  const centre = await page.evaluate(() => (window as any).globeGame.state.cities[0].tile as number);
  await tapTile(page, centre);
  expect((await placement(page)).placed.temple).toBe(target.tile);
  await card.getByRole('button', { name: 'Peru' }).click();
  expect((await placement(page)).moving).toBeNull();

  // Where the buildings stand is saved
  await page.evaluate(() => (window as any).globeDebug.saveNow());
  const ready2 = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.reload();
  await ready2;
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  const loaded = await placement(page);
  expect(loaded.placed).toEqual(after.placed);
  expect(loaded.best.sort()).toEqual(after.best.sort());
  expect(errors).toEqual([]);
});
