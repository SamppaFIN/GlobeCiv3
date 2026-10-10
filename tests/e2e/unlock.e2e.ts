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
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => ({ ...(window as any).globeGame.state, level: (window as any).globeLevels.state.level }));

/** Map a share of the home province (level 1) or state (level 0) through the test hook. */
const mapShare = (page: Page, region: 'province' | 'state', share: number) => page.evaluate(([r, s]) => {
  const w = window as any;
  const city = w.globeGame.state.startCity;
  const div = r === 'province' ? 7 : 49;
  const home = Math.floor(city / div);
  const table = w.globeRegions.tileTable();
  const ids: number[] = [];
  for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / div) === home) ids.push(id);
  // Count what is mapped already, then add the rest of the share in id order
  const target = Math.ceil(ids.length * (s as number));
  const missing = ids.filter(id => !w.globeMap.isMapped(id));
  w.globeDebug.reveal(missing.slice(0, Math.max(0, target - (ids.length - missing.length))));
}, [region, share] as const);

const arrive = (page: Page, level: number) => page.waitForFunction(l => {
  const s = (window as any).globeLevels.state;
  return s.level === l && !s.flying;
}, level, { timeout: 20_000 });

test('the province level opens at 60 % with the unlock card, its chips and area actions', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  await mapShare(page, 'province', 0.59);
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await state(page)).openLevel).toBe(3);

  await mapShare(page, 'province', 0.61);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lääni kartoitettu, zoomaa ulos' })).toBeVisible();
  expect((await state(page)).openLevel).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('unlock-card.png') });
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 2);

  // Seven named chips, home among them, and the area panel
  const chips = page.locator('.chip:not([hidden])');
  await expect(chips).toHaveCount(7);
  await expect(page.locator('.chip-name', { hasText: 'Kotialue' })).toBeVisible();
  // Every chip stays between the top panel and the area panel, where it can be tapped
  const top = (await page.locator('.hud-top').boundingBox())!;
  const panel = (await page.locator('.area-panel').boundingBox())!;
  for (const b of await chips.all()) {
    const r = (await b.boundingBox())!;
    expect(r.y).toBeGreaterThanOrEqual(top.y + top.height);
    expect(r.y + r.height).toBeLessThanOrEqual(panel.y);
  }
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
  expect(errors).toEqual([]);
});

test('the state level opens next, with the state line and a target province', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  await mapShare(page, 'province', 0.61);
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  // The minus key zooms out a level once it is open
  await page.keyboard.press('-');
  await arrive(page, 2);
  await mapShare(page, 'state', 0.61);
  await expect(page.getByRole('heading', { name: 'Valtio kartoitettu, zoomaa ulos' })).toBeVisible();
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 1);
  await expect(page.locator('.chip:not([hidden])')).toHaveCount(7);
  await expect(page.locator('.chip-name', { hasText: 'Kotilääni' })).toBeVisible();
  // Nothing more opens by mapping (the planet waits for a conquest): the meter shows the share only
  await expect(page.locator('.hud-meter-value')).toHaveText(/^\d+ %$/);
  await expect(page.locator('.hud-meter-tick')).toBeHidden();
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
    await mapShare(page, 'province', 0.61);
    await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
    await arrive(page, 2);
    expect(await overlaps()).toEqual([]);
    await mapShare(page, 'state', 0.61);
    await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
    await arrive(page, 1);
    expect(await overlaps()).toEqual([]);
    expect(errors).toEqual([]);
  });
});
