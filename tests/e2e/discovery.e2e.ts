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
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Send the scouts toward the nearest discovery and run at 4× until it waits in the HUD. */
async function findDiscovery(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const [site] = w.globeDebug.discoverySites(1);
    w.globeDebug.sendTo(site.tile);
  });
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await expect(page.getByRole('button', { name: /^(Löytö odottaa|\d+ löytöä odottaa)$/ })).toBeVisible({ timeout: 90_000 });
}

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

test('a discovery waits in the HUD while the game goes on; opened, it stops the game until a find is chosen', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await startGame(page);
  await findDiscovery(page);
  // This test is about the first discovery: the next ones would add to the count
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  const found = await state(page);
  expect(found.discovery).not.toBeNull();
  const pill = page.getByRole('button', { name: 'Löytö odottaa' });

  // STORY-037: the game goes on with the find waiting, and no card opens by itself
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await daysOver(page, 2000)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('waiting.png') });

  // Opened from the HUD: design 4a with the pause chip, the ring, the kicker, the area, the
  // sentence, two finds and Myöhemmin; the game stands still
  await pill.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const s = await state(page);
  await expect(page.locator('.discovery-day')).toHaveText(`Peli pysähtyi · Päivä ${s.day}`);
  await expect(page.locator('.discovery-kicker')).toHaveText(/^Löytö · Tiedustelija \d+$/);
  await expect(page.locator('.discovery-title')).not.toBeEmpty();
  await expect(page.locator('.discovery-body')).toHaveText(/^Tiedustelija löysi .+ ja .+\. Valitse niistä toinen\.$/);
  await expect(page.locator('.discovery-note')).toHaveText('Valitsematta jäänyt löytö katoaa.');
  const options = page.locator('.discovery-option');
  await expect(options).toHaveCount(3);
  await expect(options.last()).toContainText('Myöhemmin');
  for (const b of await options.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(63.5);
  await expect(page.locator('.discovery-ring')).toBeVisible();
  await expect(page.locator('.hud-top')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('discovery.png') });
  expect(await daysOver(page, 2000)).toBe(0);

  // Myöhemmin: the card closes and the find still waits
  await options.last().click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(pill).toBeVisible();
  expect((await state(page)).found).toBe(0);

  // Opened again: keep the ruins if offered (a new scout), else the first find
  await pill.click();
  const finds: string[] = s.discovery.finds;
  const pick = finds.includes('ruins') ? finds.indexOf('ruins') : 0;
  const before = await state(page);
  await options.nth(pick).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const after = await state(page);
  expect(after.found).toBe(1);
  await expect(pill).toBeHidden();
  const notice = page.getByRole('status');
  if (finds[pick] === 'ruins') {
    expect(after.units.length).toBe(before.units.length + 1);
    await expect(notice).toHaveText(/^Vanhat rauniot: Tiedustelija \d+ liittyi joukkoon$/);
  } else if (finds[pick] === 'lookout') {
    expect(after.mapped).toBeGreaterThan(before.mapped);
    await expect(notice).toHaveText(/^Näköalapaikka: /);
  } else {
    expect(after.bonuses.length).toBe(before.bonuses.length + 1);
    await expect(notice).toHaveText(/löytöruudulle$/);
  }
  await expect(page.locator('.hud-top')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('after.png') });

  // The game goes on
  expect(await daysOver(page, 2000)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the discovery card fits the screen with 64 px choices', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = await startGame(page);
    await findDiscovery(page);
    await page.getByRole('button', { name: /odottaa$/ }).click();
    // The card shows on the next frame, which on a slow runner comes later
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
    await page.screenshot({ path: testInfo.outputPath('discovery-phone.png') });
    expect(errors).toEqual([]);
  });
});
