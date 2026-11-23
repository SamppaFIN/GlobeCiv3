import { expect, test, type Page } from '@playwright/test';

/**
 * A late game does not stutter at the day's turn (STORY-117): seed 42 under the war general,
 * stepped to day 300, then days 300–400 worked out in slices of 3 ms as the frames do, each
 * slice timed. The rendered frames are not measured here: on CI's SwiftShader a late frame
 * takes seconds. Headless Chromium, so an estimate; the real devices are measured in Sami's
 * acceptance (TICKET-TEST-082). By the clock the clock's day is the day under way, and no save
 * works a day out in one frame (Utu's review).
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

/** Step to a day, every card answered by its first choice (the advisors answer theirs); an advance's card by Jatka, its advisor's study ready (STORY-118). */
async function stepTo(page: Page, until: number) {
  await page.evaluate(until => {
    const w = window as any;
    const dialogs = () => [...document.querySelectorAll('[role="dialog"]:not([hidden])')].filter(x => [...x.querySelectorAll('button')].some(b => (b as HTMLElement).offsetParent));
    let stuck = 0;
    while (w.globeGame.state.day < until) {
      if (w.globeDebug.step()) { stuck = 0; continue; }
      const buttons = dialogs().flatMap(d => [...d.querySelectorAll<HTMLButtonElement>('button')]).filter(x => x.offsetParent && !x.disabled);
      const b = buttons.find(x => x.closest('.advance-card') && x.textContent === 'Jatka') ?? buttons.find(x => !x.closest('.advance-card') && !/Sulje|Ohjaan itse/.test(x.textContent ?? ''));
      if (!b || ++stuck > 20) throw new Error(`stuck on day ${w.globeGame.state.day}`);
      b.click();
    }
  }, until);
}

test('a late day is worked out in slices of about 3 ms (STORY-117)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  for (const day of [100, 200, 300]) await stepTo(page, day);
  // Days 300–400 in slices as the frames work them out (DAY_BUDGET_MS); the frames' rendering is
  // left out, as SwiftShader's late frames are seconds long. The largest slice is told, and the
  // real devices hold it to 8 ms in Sami's acceptance (Utu's review: AC 1 tells p95 and the largest)
  await page.evaluate(() => (window as any).globeDebug.sliceDays(3));
  await stepTo(page, 400);
  const ms: number[] = await page.evaluate(() => (window as any).globeDebug.sliceMs());
  const sorted = [...ms].sort((a, b) => a - b);
  const stat = { slices: ms.length, median: sorted[sorted.length >> 1], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1] };
  console.log('SLICE_MS', JSON.stringify(stat));
  expect(stat.slices).toBeGreaterThanOrEqual(100);
  expect(stat.p95).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});

test("by the clock in a late game: the clock's day is the day under way, and no save works a day out at once (Utu's review)", async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  for (const day of [100, 200, 300]) await stepTo(page, day);
  // The clock at 4×, frames as they come; over 10 s, so that the autosave comes due
  const seen = await page.evaluate(() => new Promise<{ frames: number; behind: number; ahead: number; atOnce: number; from: number; to: number }>(done => {
    const w = window as any;
    const d = w.globeDebug;
    d.stepMode(false);
    d.fastForward(4);
    const t0 = performance.now();
    const from = w.globeGame.state.day;
    const atOnce = d.daysFinishedAtOnce();
    let frames = 0, behind = 0, ahead = 0;
    const tick = () => {
      frames++;
      const day = w.globeGame.state.day;
      if (day < d.dayBegun()) behind++;
      if (day > d.dayBegun()) ahead++;
      // Cards wait for no one here: a later card by its first choice
      const card = [...document.querySelectorAll<HTMLElement>('[role="dialog"]:not([hidden])')].find(x => x.offsetParent);
      const b = card && ([...card.querySelectorAll<HTMLButtonElement>('button')].find(x => x.textContent === 'Jatka' && !x.disabled) ?? [...card.querySelectorAll<HTMLButtonElement>('button')].find(x => !x.disabled && !/Sulje|Ohjaan itse/.test(x.textContent ?? '')));
      b?.click();
      if (performance.now() - t0 > 12_000 && day >= from + 3) done({ frames, behind, ahead, atOnce: d.daysFinishedAtOnce() - atOnce, from, to: day });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  console.log('BY_CLOCK', JSON.stringify(seen));
  expect(seen.to).toBeGreaterThan(seen.from);
  expect(seen.ahead).toBe(0);
  expect(seen.behind).toBe(0);
  expect(seen.atOnce).toBe(0);
  expect(errors).toEqual([]);
});
