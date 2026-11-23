import { expect, test, type Page } from '@playwright/test';

/**
 * A late game does not stutter at the day's turn (STORY-117): seed 42 under the war general,
 * stepped to day 300, then twenty days worked out in slices of 4 ms as the frames do, each
 * slice timed. The rendered frames are not measured here: on CI's SwiftShader a late frame
 * takes seconds. Headless Chromium, so an estimate; the real devices are measured in Sami's
 * acceptance (TICKET-TEST-082).
 */
type Combo = { town: string; city: string; province: string; state: string; planet: string };
const BUILD: Combo = { town: 'Rakentaja', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' };

async function start(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.stepMode(true));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 20_000 });
  await page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' }).getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: new RegExp(BUILD.town) }).first().click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.evaluate(c => {
    const d = (window as any).globeDebug;
    for (const level of ['city', 'province', 'state', 'planet'] as const) d.advise(level, c[level]);
  }, BUILD);
}

/** Step to a day, every card answered by its first choice (the advisors answer theirs). */
async function stepTo(page: Page, until: number) {
  await page.evaluate(until => {
    const w = window as any;
    const dialogs = () => [...document.querySelectorAll('[role="dialog"]:not([hidden])')].filter(x => [...x.querySelectorAll('button')].some(b => (b as HTMLElement).offsetParent));
    let stuck = 0;
    while (w.globeGame.state.day < until) {
      if (w.globeDebug.step()) { stuck = 0; continue; }
      const b = dialogs().flatMap(d => [...d.querySelectorAll<HTMLButtonElement>('button')]).find(x => x.offsetParent && !/Sulje|Ohjaan itse/.test(x.textContent ?? ''));
      if (!b || ++stuck > 20) throw new Error(`stuck on day ${w.globeGame.state.day}`);
      b.click();
    }
  }, until);
}

test('a late day is worked out in slices of about 4 ms (STORY-117)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  for (const day of [100, 200, 300]) await stepTo(page, day);
  // Twenty late days in slices; the frames' rendering is left out, as SwiftShader's frames are seconds long
  await page.evaluate(() => (window as any).globeDebug.sliceDays(4));
  await stepTo(page, 320);
  const ms: number[] = await page.evaluate(() => (window as any).globeDebug.sliceMs());
  const sorted = [...ms].sort((a, b) => a - b);
  const stat = { slices: ms.length, median: sorted[sorted.length >> 1], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1] };
  console.log('SLICE_MS', JSON.stringify(stat));
  expect(stat.slices).toBeGreaterThanOrEqual(20);
  expect(stat.p95).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});
