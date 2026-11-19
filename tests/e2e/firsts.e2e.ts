import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
/** Frames pass; the day the game shows after them. */
const dayAfterFrames = (page: Page, frames: number) => page.evaluate(n => new Promise<number>(resolve => {
  let left = n;
  const step = () => (--left > 0 ? requestAnimationFrame(step) : resolve((window as any).globeGame.state.day));
  requestAnimationFrame(step);
}), frames);

/** A new game on seed 42 in the player's own hand, its city area open. */
async function cityAreaGame(page: Page, errors: string[]) {
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.evaluate(() => (window as any).globeDebug.rise());
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  expect((await state(page)).openLevel).toBe(3);
}

test('bandits stop the game the first time only; later ones are notices, and the game goes on (STORY-017)', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await cityAreaGame(page, errors);

  // The first bandits: the card, and the game stands
  expect(await page.evaluate(() => (window as any).globeDebug.raidNow(0))).toBe(true);
  const card = page.getByRole('dialog', { name: 'Rosvoja liikkeellä' });
  // A frame or two after the band sets off; frames are slow here right after the city area is mapped
  await expect(card).toBeVisible({ timeout: 20_000 });
  expect((await state(page)).raidAlert).toBe(true);
  const day = (await state(page)).day;
  expect(await dayAfterFrames(page, 30)).toBe(day);
  await card.getByRole('button', { name: /Luota puolustukseen/ }).click();

  // The band reaches the city and is done
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(() => (window as any).globeGame.state.raid === null, null, { timeout: 90_000 });

  // The next ones: a notice, no card, and the days go on
  expect(await page.evaluate(() => (window as any).globeDebug.raidNow(0))).toBe(true);
  const s = await state(page);
  expect(s.raid).not.toBeNull();
  expect(s.raidAlert).toBe(false);
  await expect(page.locator('.hud-notice')).toContainText('liikkeellä kohti kaupunkia');
  await expect(card).toBeHidden();
  expect(await dayAfterFrames(page, 60)).toBeGreaterThan(s.day);
  await page.screenshot({ path: testInfo.outputPath('second-raid.png') });
  expect(errors).toEqual([]);
});

test('a city site stops the game the first time only; later sites are notices (STORY-017)', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await cityAreaGame(page, errors);
  await page.evaluate(() => (window as any).globeDebug.setSiteOffers(true));
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  const card = page.getByRole('dialog').filter({ hasText: 'Tiedustelija löysi hyvän paikan kaupungille' });
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole('button', { name: /Myöhemmin/ }).click();
  // The next site: offered with a notice, no card and no stop
  await page.waitForFunction(() => (window as any).globeGame.state.offered.length >= 2, null, { timeout: 90_000 });
  const s = await state(page);
  expect(s.offer).toBeNull();
  await expect(page.locator('.hud-notice')).toContainText('Kaupunkipaikka:');
  await expect(card).toBeHidden();
  expect(await dayAfterFrames(page, 60)).toBeGreaterThan(s.day);
  expect(errors).toEqual([]);
});

test('diplomacy waits for the state level: no diplomacy tab before it (STORY-017)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await cityAreaGame(page, errors);
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  const list = page.getByRole('dialog').filter({ has: page.locator('input[name="list-tab"]') });
  await expect(list.getByText('Talous')).toBeVisible();
  await expect(list.getByText('Diplomatia', { exact: true })).toBeHidden();
  await list.getByRole('button', { name: 'Sulje' }).click();
  // The province, then the state, each with its advisors' cards: the tab shows
  for (let k = 0; k < 2; k++) {
    await page.evaluate(() => (window as any).globeDebug.rise());
    await page.getByRole('button', { name: 'Myöhemmin' }).click();
    await page.getByRole('button', { name: /^Ohjaan itse/ }).click();
  }
  expect((await state(page)).openLevel).toBe(1);
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  await expect(list.getByText('Diplomatia', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
