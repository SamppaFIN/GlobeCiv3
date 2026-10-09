import { expect, test, type Page } from '@playwright/test';

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./');
  await ready;
  return errors;
}

/** Put the camera at dist × R and wait until no tiles are queued or being built. */
async function settleAt(page: Page, distR: number) {
  await page.evaluate(d => {
    const w = window as any;
    w.__stable = 0; // count settled frames from this move on
    // Correctness, not the per-frame build budget: on a GPU-less CI runner a frame
    // can take seconds, so build every requested tile in the same frame
    w.globeTiles.budgetMs = 1e9;
    const rig = w.globeCamera;
    rig.dist = d * rig.R;
    rig.apply();
  }, distR);
  await page.waitForFunction(() => {
    const w = window as any;
    const s = w.globeTiles.lastStats;
    w.__stable = s.queue === 0 && s.created === 0 ? (w.__stable ?? 0) + 1 : 0;
    return w.__stable >= 10;
  }, null, { timeout: 30_000, polling: 'raf' });
  return page.evaluate(() => (window as any).globeTiles.lastStats as { drawn: number; maxLevel: number });
}

test('the globe has a tiled surface from orbit down to quadtree level 17', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await openGame(page);
  const levels: Record<string, { drawn: number; maxLevel: number }> = {};
  for (const [name, d] of [['orbit', 4], ['continent', 0.04], ['tile', 0.0025], ['deepest', 2e-5]] as const) {
    levels[name] = await settleAt(page, d);
    await page.screenshot({ path: testInfo.outputPath(`surface-${name}.png`) });
  }
  console.log('[surface-levels] ' + JSON.stringify(levels));
  expect(levels.orbit.drawn).toBeGreaterThan(0);
  expect(levels.continent.maxLevel).toBeGreaterThanOrEqual(6);
  expect(levels.deepest.maxLevel).toBe(17);
  for (const s of Object.values(levels)) expect(s.drawn).toBeLessThanOrEqual(600);
  expect(errors).toEqual([]);
});
