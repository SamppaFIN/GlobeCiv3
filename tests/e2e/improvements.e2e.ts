import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  // Discoveries and site offers stop the game; this test is about improvements
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const speed = (page: Page, s: string) => page.locator('.hud-speed label', { hasText: s }).click();

/** Cycle the unit button until the named unit is selected; the name changes on the next frame. */
async function select(page: Page, unit: string) {
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 8 && (await name.textContent()) !== unit; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await expect(name).toHaveText(unit);
}

test('a settler set to Kehitä improves the tiles its city works; the yield and the map show it', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await startGame(page);
  // The capital on the settler's first site
  await select(page, 'Uudisasukas');
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await speed(page, '4×');
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // A settler of the capital: it starts as Asuta with the site actions
  const settler: string = await page.evaluate(() => (window as any).globeDebug.spawnSettler(0));
  await select(page, settler);
  const tasks = page.getByRole('radiogroup', { name: 'Tehtävä' });
  await expect(tasks.getByRole('radio', { name: 'Asuta' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Perusta kaupunki tähän' })).toBeVisible();

  // Kehitä: the site actions go, and the settler takes a job
  await tasks.getByText('Kehitä').click();
  await expect(tasks.getByRole('radio', { name: 'Kehitä' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Perusta kaupunki tähän' })).toBeHidden();
  await speed(page, '4×');
  await expect(page.locator('.hud-unit-status')).toHaveText(/^Kehittää · /);
  // The job and its tile's yield before the work is done, in one look
  const before = await (await page.waitForFunction(name => {
    const w = (window as any);
    const job = w.globeGame.state.units.find((u: any) => u.name === name).job;
    return job && { tile: job.tile, kind: job.kind, terrain: w.globeTileTypes.tileInfo(job.tile).terrain, yield: w.globeDebug.yieldOf(job.tile) };
  }, settler, { timeout: 60_000 })).jsonValue();
  await page.waitForFunction(([t, k]) => (window as any).globeGame.state.improvements.some(([tile, kinds]: [number, string[]]) => tile === t && kinds.includes(k)), [before.tile, before.kind] as const, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // It adds the source table's yield there (Freeciv civ1 terrain.ruleset)
  const BONUS: Record<string, Record<string, [number, number, number]>> = {
    road: { desert: [0, 0, 1], grassland: [0, 0, 1], plains: [0, 0, 1] },
    irrigation: { desert: [1, 0, 0], grassland: [1, 0, 0], hills: [1, 0, 0], plains: [1, 0, 0] },
    mine: { desert: [0, 1, 0], hills: [0, 3, 0], mountains: [0, 1, 0] },
  };
  const after = await page.evaluate(t => (window as any).globeDebug.yieldOf(t), before.tile);
  expect([after.food - before.yield.food, after.shield - before.yield.shield, after.trade - before.yield.trade]).toEqual(BONUS[before.kind][before.terrain]);
  // The first job is on a tile the capital works when one of them can be improved
  const worked: number[] = await page.evaluate(() => (window as any).globeDebug.worked()[0]);
  testInfo.annotations.push({ type: 'job', description: `${before.kind} on ${before.terrain}, worked: ${worked.includes(before.tile)}` });

  // Asuta again: the settler drops the job and has the site actions back
  await tasks.getByText('Asuta').click();
  await expect(page.getByRole('button', { name: 'Perusta kaupunki tähän' })).toBeVisible();
  const unit = (await state(page)).units.find((u: any) => u.name === settler);
  expect([unit.task, unit.job]).toEqual(['found', null]);
  await page.screenshot({ path: testInfo.outputPath('improvements.png') });
  expect(errors).toEqual([]);
});
