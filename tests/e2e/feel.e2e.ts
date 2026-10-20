import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto(query);
  await ready;
  return errors;
}

const well = (page: Page) => page.evaluate(() => (window as any).globeFeel.well);

/** Mean light (0–255) of the canvas in a 20 px square around a CSS point, read right after a frame is drawn. */
const lightAt = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => new Promise<number>(resolve => requestAnimationFrame(() => {
  const src = document.querySelector<HTMLCanvasElement>('#globe-container canvas')!;
  const dpr = src.width / src.clientWidth;
  const c = document.createElement('canvas');
  c.width = c.height = 20;
  const g = c.getContext('2d')!;
  g.drawImage(src, (x - 10) * dpr, (y - 10) * dpr, 20 * dpr, 20 * dpr, 0, 0, 20, 20);
  const d = g.getImageData(0, 0, 20, 20).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += ((d[i] + d[i + 1] + d[i + 2]) / 3) * (d[i + 3] / 255);
  resolve(sum / 400);
})), [x, y] as const);

test('a press on the start screen makes a gravity well: a glow gathers while held and fades after', async ({ page }, testInfo) => {
  const errors = await open(page, './?classic&seed=42');
  const [x, y] = [1000, 300];
  const dark = await lightAt(page, x, y);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForFunction(() => (window as any).globeFeel.well.g > 0.95);
  const lit = await lightAt(page, x, y);
  testInfo.annotations.push({ type: 'light', description: `${dark.toFixed(1)} → ${lit.toFixed(1)}` });
  expect(lit).toBeGreaterThan(dark + 100);
  await page.screenshot({ path: testInfo.outputPath('well.png') });
  // The well follows the pointer (view units: NDC with x scaled by the aspect ratio)
  const before = await well(page);
  await page.mouse.move(x - 120, y + 80, { steps: 8 });
  await page.waitForFunction(([tx]) => Math.abs((window as any).globeFeel.well.x - tx) < 0.01, [(((x - 120) / 1280) * 2 - 1) * (1280 / 800)] as const);
  expect((await well(page)).y).toBeLessThan(before.y);
  await page.mouse.up();
  await page.waitForFunction(() => (window as any).globeFeel.well.g === 0);
  expect(await lightAt(page, x - 120, y + 80)).toBeLessThan(dark + 10);
  // A drag that turns the planet makes the well too
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(700, 400, { steps: 5 });
  await page.waitForFunction(() => (window as any).globeFeel.well.g > 0.5);
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('in the game the well comes from a press in space, not from one on the globe', async ({ page }) => {
  const errors = await open(page, './?free');
  await page.waitForTimeout(500);
  // On the globe (the centre of the planet view): a drag of the map, no well
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(650, 405, { steps: 3 });
  await page.waitForTimeout(300);
  expect((await well(page)).target).toBe(0);
  await page.mouse.up();
  // In space (a corner beside the planet): the well
  await page.mouse.move(40, 760);
  await page.mouse.down();
  await page.waitForFunction(() => (window as any).globeFeel.well.g > 0.9);
  await page.mouse.up();
  await page.waitForFunction(() => (window as any).globeFeel.well.g === 0);
  expect(errors).toEqual([]);
});

test('moments glow: a new city and bandits on the way send a pulse that lasts 1.6 s', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await open(page, './?classic&seed=42');
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  // Watch every frame from now: when the city pulse is first seen, and the first frame without it
  const watch = page.evaluate(() => new Promise<{ start: number; gone: number; gap: number }>(resolve => {
    const w = window as any;
    let start = 0, last = 0, gap = 0;
    const step = (t: number) => {
      if (last) gap = Math.max(gap, t - last);
      last = t;
      const p = w.globeFeel.pulses.find((x: any) => x.kind === 'city');
      if (p && !start) start = performance.now() - p.age * 1000;
      if (!p && start) resolve({ start, gone: performance.now(), gap });
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeFeel.pulses.some((p: any) => p.kind === 'city'), null, { timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath('city-pulse.png') });
  const seen = await watch;
  const lasted = (seen.gone - seen.start) / 1000;
  testInfo.annotations.push({ type: 'pulse', description: `${lasted.toFixed(2)} s, longest frame ${seen.gap.toFixed(0)} ms` });
  expect(lasted).toBeGreaterThanOrEqual(1.6);
  expect(lasted).toBeLessThan(1.6 + seen.gap / 1000 + 0.1);

  // Bandits on the way: the raid card and a rust pulse where they are
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();
  await page.evaluate(() => (window as any).globeDebug.raidNow(0));
  await page.waitForFunction(() => (window as any).globeFeel.pulses.some((p: any) => p.kind === 'raid'));
  const s = await page.evaluate(() => (window as any).globeGame.state);
  expect((await page.evaluate(() => (window as any).globeFeel.pulses)).find((p: any) => p.kind === 'raid').tile).toBe(s.raid.bandits[0].tile);
  expect(errors).toEqual([]);
});
