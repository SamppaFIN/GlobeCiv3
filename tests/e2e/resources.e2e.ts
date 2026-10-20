import { expect, test, type Page } from '@playwright/test';

type Kinds = { known: string[]; found: string[]; target: string | null };
const kinds = (page: Page) => page.evaluate(() => (window as any).globeDebug.kinds() as Kinds);
/** A tile's centre on the screen, on the risen ground; the canvas must be what is there. */
const tapTile = async (page: Page, tile: number) => {
  const at = await page.evaluate(t => {
    const p = (window as any).globeDebug.tileScreen(t) as [number, number] | null;
    return p && { x: p[0], y: p[1], canvas: document.elementFromPoint(p[0], p[1]) === document.querySelector('canvas') };
  }, tile);
  expect(at?.canvas).toBe(true);
  await page.mouse.click(at!.x, at!.y);
};

test('the people study the start resource; until then it is unknown and yields nothing, and resources open advances', async ({ page }, testInfo) => {
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

  // A new game knows no kind; the start site's one resource is found
  const start = await page.evaluate(() => {
    const w = window as any;
    const centre = w.globeGame.state.cities[0].tile as number;
    let ring = new Set<number>([centre]);
    for (let r = 0; r < 2; r++) ring = new Set([...ring].flatMap((id: number) => [id, ...w.globeHexTiles.neighbors(id)]));
    const tile = [...ring].find(id => w.globeTileTypes.tileInfo(id).resource)!;
    return { tile, kind: w.globeTileTypes.tileInfo(tile).resource as string };
  });
  const before = await kinds(page);
  expect(before.known).toEqual([]);
  expect(before.found).toContain(start.kind);

  // Its hex: an unknown resource
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await tapTile(page, start.tile);
  await expect(card.locator('.tile-title')).toHaveText(/· tuntematon resurssi$/);
  await expect(card.locator('.tile-rows')).toContainText(/Erikoisresurssi\s*tuntematon: tutkimus .+ resurssi paljastaa sen ja sen tuoton/);
  await page.screenshot({ path: testInfo.outputPath('unknown.png') });
  await card.getByRole('button', { name: 'Sulje' }).click();

  // The people study it of themselves, a bulb a day from the city at least
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector('.hud-notice')!;
    w.notices = [];
    // Every text set, also when two come in the same frame
    new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) w.notices.push(n.textContent); }).observe(el, { childList: true });
  });
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  await page.waitForFunction(k => (window as any).globeDebug.kinds().target === k, start.kind, { timeout: 30_000 });
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(k => (window as any).globeDebug.kinds().known.includes(k), start.kind, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const notices = (await page.evaluate(() => (window as any).notices)) as string[];
  expect(notices.some(n => n.startsWith('Kansa tutkii: '))).toBe(true);
  expect(notices.some(n => n.startsWith('Tutkittu: ') && n.includes('näkyy kartalla ja tuottaa'))).toBe(true);
  await tapTile(page, start.tile);
  await expect(card.locator('.tile-title')).not.toHaveText(/tuntematon/);
  await expect(card.locator('.tile-rows')).toContainText(/Erikoisresurssi\s*\S+.*\(\+/);
  await page.screenshot({ path: testInfo.outputPath('known.png') });

  // Advances from a resource stay shut until a kind of it is known: Horseback Riding needs horses
  const research = await page.evaluate(() => {
    const w = window as any;
    const known = w.globeDebug.kinds().known as string[];
    return { known, options: w.globeDebug.researchOptions() as string[] };
  });
  expect(research.options.includes('horseback')).toBe(research.known.includes('horses'));
  expect(research.options.includes('wheel')).toBe(research.known.includes('horses'));
  expect(errors).toEqual([]);
});

test('at the city-area level a kind not known shows as a grey marker with a question mark', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  // The old start knows every kind
  expect((await kinds(page)).known).toHaveLength(11);
  await page.screenshot({ path: testInfo.outputPath('known-markers.png') });
  await page.evaluate(() => (window as any).globeDebug.setKinds([]));
  // Two frames: the shader has the new kinds
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: testInfo.outputPath('unknown-markers.png') });
  expect(errors).toEqual([]);
});
