import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => ({ ...(window as any).globeGame.state, level: (window as any).globeLevels.state.level }));

/** Found a city in a province of the home state through the test hook: k 0 is the home province. */
const foundIn = (page: Page, k = 0) => page.evaluate(n => {
  const w = window as any;
  const home = Math.floor(w.globeGame.state.startCity / 7);
  const state = Math.floor(home / 7);
  // The home province first, then the others of the state in order
  const provinces = [home, ...Array.from({ length: 7 }, (_, i) => state * 7 + i).filter(p => p !== home)];
  return w.globeDebug.foundIn(provinces[n]);
}, k);

/** Frames pass with the game running; the day it shows after them. */
const dayAfterFrames = (page: Page, frames: number) => page.evaluate(n => new Promise<number>(resolve => {
  let left = n;
  const step = () => (--left > 0 ? requestAnimationFrame(step) : resolve((window as any).globeGame.state.day));
  requestAnimationFrame(step);
}), frames);

const arrive = (page: Page, level: number) => page.waitForFunction(l => {
  const s = (window as any).globeLevels.state;
  return s.level === l && !s.flying;
}, level, { timeout: 20_000 });

/**
 * Wait for the first frame at a level and return, from that frame, the chips' boxes and the
 * free band between the top panel and the visible bottom panel (a later frame could hide
 * a frame where they disagree; on CI one frame can take a second).
 */
const arriveWithChips = (page: Page, level: number) => page.evaluate(l => new Promise<{ chips: { top: number; bottom: number }[]; top: number; bottom: number }>(resolve => {
  const step = () => {
    const s = (window as any).globeLevels.state;
    if (s.level !== l || s.flying) return requestAnimationFrame(step);
    const chips = [...document.querySelectorAll('.chip:not([hidden])')].map(c => c.getBoundingClientRect());
    resolve({
      chips: chips.map(r => ({ top: r.top, bottom: r.bottom })),
      top: document.querySelector('.hud-top')!.getBoundingClientRect().bottom,
      bottom: document.querySelector('.level-bottom:not([hidden])')!.getBoundingClientRect().top,
    });
  };
  requestAnimationFrame(step);
}), level);

test('three ready settlements open the province level (STORY-092; the old start\'s cities count as they stand): the goal on the meter, its gold, and a card that stops the game (STORY-087)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  // A scout's city site would stop the game with its card before the third city, and the level
  // would not rise under it: whether one comes first depends on the frames (CI 2026-11-26)
  await page.evaluate(() => (window as any).globeDebug.setSiteOffers(false));
  // The city area's goal on the meter; mapping all of the home province opens nothing (the old start: its cities count as they stand)
  await expect(page.locator('.hud-goal')).toHaveText('TavoiteKolme valmista settlementtiä+60 kultaa');
  await expect(page.locator('.hud-meter-value')).toHaveText('0 / 3 valmiina');
  await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 7);
    const table = w.globeRegions.tileTable();
    const ids: number[] = [];
    for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / 7) === home && !w.globeMap.isMapped(id)) ids.push(id);
    w.globeDebug.reveal(ids);
  });
  expect(await foundIn(page)).not.toBeNull();
  expect(await foundIn(page)).not.toBeNull();
  await expect(page.locator('.hud-meter-value')).toHaveText('2 / 3 valmiina');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await state(page)).openLevel).toBe(3);

  const gold = (await state(page)).gold;
  expect(await foundIn(page)).not.toBeNull();
  const card = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Kolme valmista settlementtiä: lääni avautui, zoomaa ulos' }) });
  // The level rises at the end of a day under way (STORY-117), some seconds of frames without a
  // GPU (CI 2026-11-26), so the card is waited for, not expected at once
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText('Uusi tavoite: Pidä neljä kotivaltion lääniä (1 / 4).');
  const s = await state(page);
  expect([s.openLevel, s.gold, s.goal]).toEqual([2, gold + 60, 'Pidä neljä kotivaltion lääniä']);
  await expect(page.getByRole('status')).toHaveText('Tavoite saavutettu: Kolme valmista settlementtiä · +60 kultaa');
  // The card stops the game: even running, no day passes while it is open
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  expect(await dayAfterFrames(page, 30)).toBe(s.day);
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.screenshot({ path: testInfo.outputPath('unlock-card.png') });
  const arrived = arriveWithChips(page, 2);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  // From the first frame on, every chip stays between the top panel and the area panel,
  // where it can be tapped
  const first = await arrived;
  expect(first.chips).toHaveLength(7);
  for (const r of first.chips) {
    expect(r.top).toBeGreaterThanOrEqual(first.top);
    expect(r.bottom).toBeLessThanOrEqual(first.bottom);
  }

  // Seven named chips, home among them, and the area panel
  const chips = page.locator('.chip:not([hidden])');
  await expect(chips).toHaveCount(7);
  await expect(page.locator('.chip-name', { hasText: 'Kotialue' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('province.png') });
  // Select a fogged or other area and plan it: skip, then send an expedition there
  const other = chips.filter({ hasNotText: 'Kotialue' }).first();
  const name = (await other.locator('.chip-name').textContent())!;
  await other.click();
  await expect(other).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.area-name')).toHaveText(name);
  await page.locator('.area-panel label', { hasText: 'Ohita' }).click();
  expect((await state(page)).areaPlans.map((p: [number, string]) => p[1])).toContain('skip');
  await page.locator('.area-expedition').click();
  expect((await state(page)).flag).not.toBeNull();

  // Zooming out stops at the province level: the state is not open yet
  await page.mouse.move(640, 300);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 3000);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect((await state(page)).level).toBe(2);
  // With the card closed the game goes on
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  await page.waitForFunction(d => (window as any).globeGame.state.day > d, s.day, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('four provinces held open the state level, with the state line and a target province', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  for (let i = 0; i < 3; i++) await foundIn(page);
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  // The minus key zooms out a level once it is open
  await page.keyboard.press('-');
  await arrive(page, 2);
  // The province's goal counts the home state's provinces held: three more cities in three more
  for (let k = 1; k <= 3; k++) expect(await foundIn(page, k)).not.toBeNull();
  await expect(page.getByRole('heading', { name: 'Valtio avautui, zoomaa ulos' })).toBeVisible();
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 1);
  await expect(page.locator('.chip:not([hidden])')).toHaveCount(7);
  await expect(page.locator('.chip-name', { hasText: 'Kotilääni' })).toBeVisible();
  // The state's goal: all seven provinces held open the planet (STORY-016)
  await expect(page.locator('.hud-goal')).toHaveText('TavoiteValtaa kotivaltio+150 kultaa');
  await expect(page.locator('.hud-meter-value')).toHaveText(/^[4-6] \/ 7 hallussa$/);
  await expect(page.locator('.hud-meter-tick')).toBeVisible();
  await page.locator('.state-panel label', { hasText: 'Puolustus' }).click();
  expect((await state(page)).stateLine).toBe('defend');
  const province = page.locator('.chip:not([hidden])').filter({ hasNotText: 'Kotilääni' }).first();
  await province.click();
  await page.getByRole('button', { name: 'Tavoitteeksi' }).click();
  await expect(province.locator('.chip-sub')).toContainText('Tavoite');
  await page.screenshot({ path: testInfo.outputPath('state.png') });
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the province and state chips do not overlap: the region spans the width', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await startGame(page);
    const overlaps = async () => {
      const boxes = await page.locator('.chip:not([hidden])').evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
      expect(boxes).toHaveLength(7);
      const pairs: string[] = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) pairs.push(`${i}-${j}`);
      }
      return pairs;
    };
    await page.evaluate(() => (window as any).globeDebug.rise());
    await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
    await arrive(page, 2);
    expect(await overlaps()).toEqual([]);
    await page.evaluate(() => (window as any).globeDebug.rise());
    await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
    await arrive(page, 1);
    expect(await overlaps()).toEqual([]);
    expect(errors).toEqual([]);
  });
});
