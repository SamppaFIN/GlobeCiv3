import { expect, test, type Page } from '@playwright/test';

const cityLevel = (page: Page) => page.evaluate(() => (window as any).globeDebug.cityLevel() as { city: number | null; relief: number; triangles: number; props: number });

/** Frames drawn over a span of wall time, counted inside the page. */
const framesOver = (page: Page, ms: number) => page.evaluate(span => new Promise<number>(resolve => {
  let n = 0;
  const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < span) requestAnimationFrame(tick); else resolve(n); };
  requestAnimationFrame(tick);
}), ms);

test('close to a city its area rises into relief with its buildings, and sinks back on the way out', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=7');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const tile = await page.evaluate(() => {
    const w = window as any;
    const settler = w.globeGame.state.units.find((u: { kind: string }) => u.kind === 'settler');
    w.globeDebug.foundHere(settler.tile);
    w.globeDebug.setCitySize(0, 6);
    w.globeDebug.giveBuildings(0, ['granary', 'temple', 'walls', 'library', 'market']);
    return w.globeGame.state.cities[0].tile as number;
  });
  // The city area: flat, nothing risen
  expect((await cityLevel(page)).relief).toBe(0);
  const flat = await framesOver(page, 2000);
  await page.screenshot({ path: testInfo.outputPath('city-area.png') });

  // Close to the city it rises in about 0.6 s
  await page.evaluate(t => {
    const w = window as any;
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeDebug.cityLevelDist(), 0);
  }, tile);
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 20_000 });
  const risen = await cityLevel(page);
  expect(risen.city).toBe(tile);
  // Three rings and one more sloping back: the triangles between their centres, cut 8 × 8
  expect(risen.triangles).toBeGreaterThan(5000);
  // The palace, five buildings, houses, walls, trees and rocks
  expect(risen.props).toBeGreaterThan(20);
  // A moment for the first frames, which compile the new materials
  await page.waitForTimeout(1000);
  const close = await framesOver(page, 2000);
  await page.screenshot({ path: testInfo.outputPath('city-level.png') });
  testInfo.annotations.push({ type: 'frames', description: `2 s: kaupunkialue ${flat} framea, kaupunkitaso ${close} framea (${risen.triangles} kolmiota, ${risen.props} kohdetta)` });

  // Out again: it sinks, and its group is hidden
  await page.evaluate(t => {
    const w = window as any;
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeDebug.cityLevelDist() * 4, 0);
  }, tile);
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 0, null, { timeout: 20_000 });
  expect(errors).toEqual([]);
});
