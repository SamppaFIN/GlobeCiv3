import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page, ruins = true): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  if (!ruins) await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Days that pass over at least `ms` of wall time and three frames, measured inside the page. */
const daysOver = (page: Page, ms: number) => page.evaluate(span => new Promise<number>(resolve => {
  const w = window as any;
  const d0 = w.globeGame.state.day;
  let t0 = 0, frames = 0;
  const step = (t: number) => {
    t0 ||= t;
    if (++frames >= 3 && t - t0 >= span) resolve(w.globeGame.state.day - d0);
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), ms);

test('ruins open by themselves: no card and no choice, a notice tells what they held, and the game goes on', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await startGame(page);
  // Every notice, collected inside the page (a slow runner may replace one before a check)
  await page.evaluate(() => {
    const w = window as any;
    w.notices = [];
    const el = document.querySelector('[role="status"]')!;
    new MutationObserver(() => w.notices.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
  });
  // The scouts go toward the nearest ruins
  const site = await page.evaluate(() => {
    const w = window as any;
    const [s] = w.globeDebug.discoverySites(1);
    w.globeDebug.sendTo(s.tile);
    return s as { tile: number; kind: string };
  });
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.found >= 1, null, { timeout: 90_000 });
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  const notice = (await page.evaluate(() => (window as any).notices as string[])).find(n => n.startsWith('Rauniot'));
  testInfo.annotations.push({ type: 'ruins', description: `${site.kind}: ${notice}` });
  // Without a city, a soldier is Freeciv's consolation of 25 gold
  const held = [/: (25|50|100) kultaa$/, /: keksintö \S+$/, /: Tiedustelija \d+ liittyi joukkoon$/];
  expect(notice).toMatch(/^Rauniot · Tiedustelija \d+: /);
  expect(held.some(r => r.test(notice!))).toBe(true);
  // No card, no waiting pill, and the game goes on
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: /odottaa$/ })).toHaveCount(0);
  expect(await daysOver(page, 2000)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('ruins.png') });
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the card that stops the game fits the screen with 64 px choices', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = await startGame(page, false);
    await page.getByRole('button', { name: 'Tauko' }).click();
    const name = page.locator('.hud-unit-name');
    for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
      const prev = (await name.textContent())!;
      await page.locator('.hud-unit').click();
      await expect(name).not.toHaveText(prev, { timeout: 15_000 });
    }
    await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
    await page.locator('.hud-speed label', { hasText: '4×' }).click();
    await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Tauko' }).click();
    await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();
    // Bandits: the card shows on the next frame, which on a slow runner comes later
    await page.evaluate(() => (window as any).globeDebug.raidNow(0));
    await expect(page.locator('.discovery-card')).toBeVisible();
    const card = (await page.locator('.discovery-card').boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(390);
    expect(card.y + card.height).toBeLessThanOrEqual(844);
    for (const b of await page.locator('.discovery-option').all()) {
      const r = (await b.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(63.5);
      expect(r.width).toBeGreaterThan(300);
    }
    // Nothing in the card is clipped
    expect(await page.locator('.discovery-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('card-phone.png') });
    expect(errors).toEqual([]);
  });
});
