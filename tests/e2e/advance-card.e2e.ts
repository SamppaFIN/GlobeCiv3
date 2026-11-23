import { expect, test, type Page } from '@playwright/test';

/**
 * An advance's card (STORY-118): an advance gained stops the game on a card that tells its
 * effects with their numbers and asks for the next study. In the player's own hand nothing is
 * chosen and the game waits; a building the advance opened can be put first. Under the state's
 * advisor its study is chosen ready, and a card waiting is saved.
 */

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Frames drawn: the game's clock has had its chance to pass days (rule 5: no fixed waits). */
const frames = (page: Page, n: number) => page.evaluate(n => new Promise<void>(done => {
  let left = n;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

test('own hand: the card tells the effects, the game waits for a study, and a building goes first', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  // The old start is the player's own hand; the other stops are off, the card on
  await page.evaluate(() => { const d = (window as any).globeDebug; d.setDiscoveries(false); d.setAdvanceCards(true); });
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
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // Keramiikka researched to its end: the next day learns it
  await page.evaluate(() => { const d = (window as any).globeDebug; d.study('pottery'); d.addBulbs(100); });
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  const card = page.locator('.advance-card');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole('heading', { name: 'Keramiikka' })).toBeVisible();
  await expect(card.locator('.city-kicker')).toContainText('peli pysähtyi');
  // The effects with their numbers, as the Tietokirja tells them (codex.ts advanceEffects)
  const facts = card.locator('.advance-facts');
  await expect(facts).toContainText('Viljavarasto: Säilyttää puolet ruoasta');
  await expect(facts).toContainText(/Viljavarasto: [^\n]* · \d+ tuotantoa · ylläpito 1 kulta päivässä/);
  await expect(facts).toContainText('Riippuvat puutarhat');
  await expect(facts).toContainText('kerran pelissä');
  // Nothing chosen in the player's own hand: the game waits
  const go = card.getByRole('button', { name: 'Jatka', exact: true });
  await expect(go).toBeDisabled();
  const studies = card.getByRole('radiogroup', { name: 'Tutki seuraavaksi' }).getByRole('radio');
  expect(await studies.count()).toBeGreaterThan(3);
  await expect(card.getByRole('radio', { checked: true })).toHaveCount(1); // only "Neuvonantaja päättää"
  const day = (await state(page)).day;
  await frames(page, 90);
  expect((await state(page)).day).toBe(day);
  await page.screenshot({ path: testInfo.outputPath('advance-card.png') });

  // A building goes first: with one city only in the capital (every city wants two, and a wonder
  // goes to the capital only; Utu's review)
  const firsts = card.getByRole('radiogroup', { name: 'Uusi rakennus' }).getByRole('radio');
  await expect(firsts).toHaveText([/^Viljavarasto: pääkaupunki ensin/, /^Riippuvat puutarhat: pääkaupunki ensin/, /^Neuvonantaja päättää/]);
  await expect(firsts.last()).toHaveAttribute('aria-checked', 'true');
  await expect(card).toHaveAttribute('aria-modal', 'true');
  const writing = studies.filter({ hasText: 'Aakkoset' });
  await writing.click();
  // A choice keeps its button, and the focus on it (WCAG 2.4.3)
  await expect(writing).toBeFocused();
  await firsts.first().click();
  await expect(firsts.first()).toBeFocused();
  await expect(writing).toHaveAttribute('aria-checked', 'true');
  await expect(go).toBeEnabled();
  await go.click();
  await expect(card).toBeHidden();
  const s = await state(page);
  expect(s.research.target).toBe('alphabet');
  expect(s.cities[0].build).toBe('granary');
  expect(s.cities[0].first).toBe('granary');
  expect(s.cities[0].capital).toBe(true);
  // The answer is a command, and the days go on
  expect(s.commands.at(-1)).toMatchObject({ by: 'player', kind: 'learned' });
  await page.waitForFunction(d => (window as any).globeGame.state.day > d, s.day, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('under the state advisor its study waits ready, and a card waiting is saved', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.stepMode(true));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 20_000 });
  await page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' }).getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /Retkeilijä/ }).first().click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.evaluate(() => {
    const d = (window as any).globeDebug;
    d.advise('city', 'explore'); d.advise('province', 'explore'); d.advise('state', 'science'); d.advise('planet', 'explore');
  });
  // Step until the first advance's card: the other cards by their first choice
  const day = await page.evaluate(() => {
    const w = window as any;
    const dialogs = () => [...document.querySelectorAll('[role="dialog"]:not([hidden])')].filter(x => [...x.querySelectorAll('button')].some(b => (b as HTMLElement).offsetParent));
    for (let stuck = 0; w.globeGame.state.day < 400;) {
      if (document.querySelector('.advance-card:not([hidden])')) return w.globeGame.state.day;
      if (w.globeDebug.step()) { stuck = 0; continue; }
      const b = dialogs().flatMap(d => [...d.querySelectorAll<HTMLButtonElement>('button')]).find(x => x.offsetParent && !x.disabled && !/Sulje|Ohjaan itse/.test(x.textContent ?? ''));
      if (!b || ++stuck > 20) throw new Error(`stuck on day ${w.globeGame.state.day}`);
      b.click();
    }
    return -1;
  });
  expect(day).toBeGreaterThan(0);
  const card = page.locator('.advance-card');
  await expect(card).toBeVisible();
  const learned = (await state(page)).learned[0];
  // The scholar's study is chosen ready, and one tap goes on
  const chosen = card.getByRole('radiogroup', { name: 'Tutki seuraavaksi' }).getByRole('radio', { checked: true });
  await expect(chosen).toHaveCount(1);
  await expect(card.locator('.advance-suggestion')).toHaveText(/(Oppinut ehdottaa tätä|Tutkimus jatkuu)/);
  await expect(card.getByRole('button', { name: 'Jatka', exact: true })).toBeEnabled();
  // No day passes while it waits
  expect(await page.evaluate(() => (window as any).globeDebug.step())).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('advance-advisor.png') });

  // Saved and loaded, the card waits again
  await page.evaluate(() => (window as any).globeDebug.saveNow());
  await page.reload();
  await page.getByRole('button', { name: /^Jatka/ }).click();
  await expect(card).toBeVisible({ timeout: 30_000 });
  expect((await state(page)).learned[0]).toBe(learned);
  await card.getByRole('button', { name: 'Jatka', exact: true }).click();
  await expect(card).toBeHidden();
  expect((await state(page)).research.target).not.toBeNull();
  expect(errors).toEqual([]);
});
