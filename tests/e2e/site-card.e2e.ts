import { expect, test, type Page } from '@playwright/test';

type Site = { block: string | null; action: string | null; going: number | null; pending: number | null; yields: { food: number; shield: number; trade: number; surplus: number }[]; builds: string[] };
const site = (page: Page, tile: number) => page.evaluate(t => (window as any).globeDebug.site(t) as Site, tile);
/**
 * A tile's centre on the screen, once the canvas is what is there: a notice may pass over it
 * for a while (CI 2026-10-20: the notice of the settler sent covered the next hex).
 */
const tapTile = async (page: Page, tile: number) => {
  const clear = () => page.evaluate(t => {
    const p = (window as any).globeDebug.tileScreen(t) as [number, number] | null;
    return !!p && document.elementFromPoint(p[0], p[1]) === document.querySelector('canvas');
  }, tile);
  await expect.poll(clear, { timeout: 15_000 }).toBe(true);
  const at = (await page.evaluate(t => (window as any).globeDebug.tileScreen(t), tile)) as [number, number];
  await page.mouse.click(at[0], at[1]);
};
/**
 * Mapped land hexes on the screen, clear of the panels, nearest the city first, with no unit
 * on or next to them but the ones in the city.
 */
const freeTiles = (page: Page) => page.evaluate(() => {
  const w = window as any;
  const s = w.globeGame.state;
  const centre = s.cities[0].tile as number;
  const near = (id: number) => [id, ...w.globeHexTiles.neighbors(id)];
  const busy = new Set(s.units.filter((u: { tile: number }) => u.tile !== centre).flatMap((u: { tile: number }) => near(u.tile)));
  let ring = new Set<number>([centre]);
  const out: number[] = [];
  for (let r = 0; r < 9; r++) {
    ring = new Set([...ring].flatMap(near));
    for (const id of ring) {
      if (id === centre || out.includes(id) || busy.has(id) || !w.globeMap.isMapped(id) || w.globeTileTypes.tileInfo(id).terrain === 'ocean') continue;
      const p = w.globeDebug.tileScreen(id) as [number, number] | null;
      // Below the band of the notices, above the bottom panel
      if (p && p[1] > 240 && p[1] < innerHeight - 140 && document.elementFromPoint(p[0], p[1]) === document.querySelector('canvas')) out.push(id);
    }
  }
  return { centre, ring1: w.globeHexTiles.neighbors(centre) as number[], tiles: out };
});

test('a tapped hex tells the whole yield of its city, or of a city founded there, and sends a settler', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
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
  // A city where a scout stands; the settler stays free
  await page.evaluate(() => {
    const w = window as any;
    const scout = w.globeGame.state.units.find((u: { kind: string }) => u.kind === 'scout');
    w.globeDebug.foundHere(scout.tile);
  });
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  // The city's research pill comes a frame later: hexes under it are not free
  await expect(page.locator('.hud-research')).toBeVisible();
  const { ring1, tiles } = await freeTiles(page);

  // A hex of the city: the city's whole yield today
  const mine = tiles.find(t => ring1.includes(t))!;
  await tapTile(page, mine);
  const y = (await site(page, mine)).yields[0];
  await expect(card.locator('.tile-rows')).toContainText(new RegExp(`Kaupungin tuotto\\s*\\S+: ruokaa ${y.food} · tuotantoa ${y.shield} · kauppaa ${y.trade} päivässä · ruoan ylijäämä ${y.surplus}`));
  await page.screenshot({ path: testInfo.outputPath('city-yield.png') });
  await card.getByRole('button', { name: 'Sulje' }).click();

  // Next to the city: what a city there would yield, but too close for one
  const blocks = await Promise.all(tiles.map(async t => (await site(page, t)).block));
  const close = tiles.find((t, i) => !ring1.includes(t) && blocks[i] === 'liian lähellä omaa kaupunkia')!;
  await tapTile(page, close);
  await expect(card.locator('.tile-rows')).toContainText(/Kaupunki tässä\s*alussa ruokaa \d+ · tuotantoa \d+ · kauppaa \d+ päivässä/);
  await expect(card.locator('.tile-rows')).toContainText('Uudisasukasei kaupunkia: liian lähellä omaa kaupunkia');
  await expect(card.getByRole('button', { name: /uudisasuka/ })).toHaveCount(0);
  await card.getByRole('button', { name: 'Sulje' }).click();

  // A free site: what a city there would yield, and the free settler goes
  const sites = tiles.filter((_, i) => blocks[i] === null);
  expect(sites.length).toBeGreaterThanOrEqual(2);
  const [a, b] = sites;
  await tapTile(page, a);
  await expect(card.locator('.tile-rows')).toContainText(/Kaupunki tässä\s*alussa ruokaa \d+ · tuotantoa \d+ · kauppaa \d+ päivässä/);
  await expect(card.locator('.tile-rows')).toContainText(/Koko alue\s*kaksi rengasta: ruokaa \d+ · tuotantoa \d+ · kauppaa \d+ päivässä/);
  await expect(card.locator('.tile-rows')).toContainText('Uudisasukasvapaa uudisasukas voi lähteä');
  await page.screenshot({ path: testInfo.outputPath('site.png') });
  await card.getByRole('button', { name: 'Lähetä uudisasukas' }).click();
  await expect.poll(async () => (await site(page, a)).going).toBe(a);
  await expect(card.locator('.tile-rows')).toContainText('Uudisasukasmatkalla perustamaan kaupunkia');
  await expect(card.getByRole('button', { name: 'Lähetä uudisasukas' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Sulje' }).click();

  // Another site, with no free settler: the capital builds one for it
  await tapTile(page, b);
  await card.getByRole('button', { name: 'Rakenna uudisasukas tänne' }).click();
  await expect.poll(async () => (await site(page, b)).pending).toBe(b);
  expect((await site(page, b)).builds[0]).toBe('settler');
  await expect(card.locator('.tile-rows')).toContainText(/Uudisasukas\S+ rakentaa uudisasukasta tänne/);
  await page.screenshot({ path: testInfo.outputPath('pending.png') });
  expect(errors).toEqual([]);
});
