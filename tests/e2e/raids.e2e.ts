import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  // Discoveries, site offers and raids by chance stop the game; this test calls the raid itself
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const speed = (page: Page, s: string) => page.locator('.hud-speed label', { hasText: s }).click();

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

test('bandits march on the capital: the card stops the game, and the soldiers fight them', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await startGame(page);
  // The capital on the settler's first site
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await speed(page, '4×');
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // Notices go by in four seconds: keep them all
  await page.evaluate(() => {
    const w = window as any;
    w.notices = [];
    new MutationObserver(() => w.notices.push(document.querySelector('.hud-notice')!.textContent)).observe(document.querySelector('.hud-notice')!, { childList: true, characterData: true, subtree: true });
  });
  // An uprising against the capital while the game runs at 4×
  expect(await page.evaluate(() => (window as any).globeDebug.raidNow(0))).toBe(true);
  const card = page.getByRole('dialog', { name: 'Rosvoja liikkeellä' });
  await expect(card).toBeVisible();
  await expect(card.locator('.discovery-kicker')).toHaveText('Uhka · Aamuranta');
  await expect(card.locator('.discovery-body')).toHaveText(/^(Rosvo|2 rosvoa) on matkalla kohti kaupunkia ja perillä noin \d+ päivässä\. Kaupungissa (ei ole sotureita|on \d+ soturia?)\.$/);
  await expect(card.locator('.discovery-option-title')).toHaveText(['Rakenna soturi', 'Luota puolustukseen']);
  await expect(card.locator('.discovery-option-effect').last()).toHaveText(/^(Soturi voittaa rosvon \d+ %:n todennäköisyydellä|Ilman soturia rosvot ryöstävät kaupungin)$/);
  const s = await state(page);
  expect(s.raidAlert).toBe(true);
  // From known land 5 to 8 tiles away, every bandit on its way to the capital
  expect(s.raid.city).toBe(s.cities[0].tile);
  for (const b of s.raid.bandits) expect(b.path).toBeGreaterThanOrEqual(5);
  await page.screenshot({ path: testInfo.outputPath('raid-card.png') });
  // The game stands still while the card waits
  expect(await daysOver(page, 2000)).toBe(0);

  // Rakenna soturi: the capital builds one (on a slow runner it may be done already, and
  // the capital gone on to settlers)
  const soldiers = (await state(page)).units.filter((u: any) => u.kind === 'warrior').length;
  await card.getByRole('button', { name: /Rakenna soturi/ }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Aamuranta rakentaa soturin');
  const built = await state(page);
  expect(built.cities[0].build === 'warrior' || built.units.filter((u: any) => u.kind === 'warrior').length > soldiers).toBe(true);

  // The band comes near: the bandits and their way are on the map
  await page.waitForFunction(() => {
    const r = (window as any).globeGame.state.raid;
    return !r || r.bandits[0].path <= 3;
  }, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.screenshot({ path: testInfo.outputPath('raid-near.png') });
  await page.getByRole('button', { name: 'Jatka' }).click();

  // The fights decide it: the last bandit falls, or the band plunders the capital
  await page.waitForFunction(() => (window as any).globeGame.state.raid === null, null, { timeout: 90_000 });
  const notices: string[] = await page.evaluate(() => (window as any).notices.filter((n: string) => /rosvo/i.test(n)));
  testInfo.annotations.push({ type: 'raid', description: notices.join(' | ') });
  expect(notices.at(-1)).toMatch(/(Soturi torjui rosvon|Soturit torjuivat \d rosvoa|Rosvot ryöstivät kaupungin) · Aamuranta$/);
  expect(errors).toEqual([]);
});
