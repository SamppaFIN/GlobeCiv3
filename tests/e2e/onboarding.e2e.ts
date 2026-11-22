import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Frames pass; the day the game shows after them. */
const dayAfterFrames = (page: Page, frames: number) => page.evaluate(n => new Promise<number>(resolve => {
  let left = n;
  const step = () => (--left > 0 ? requestAnimationFrame(step) : resolve((window as any).globeGame.state.day));
  requestAnimationFrame(step);
}), frames);

async function newGame(page: Page, errors: string[]) {
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
}

test('a new game greets, the player picks one of three advisors, a short tour shows the HUD, and only the essentials show (STORY-096)', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await newGame(page, errors);

  // The welcome stops the game
  const welcome = page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('Valitset jokaiselle tasolle neuvonantajan');
  const day = (await state(page)).day;
  expect(await dayAfterFrames(page, 30)).toBe(day);
  await page.screenshot({ path: testInfo.outputPath('welcome.png') });

  // The city level's own three advisors as big cards with this era's people and faces (STORY-105),
  // and Ohjaan itse below them
  await welcome.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  const pick = page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' });
  await expect(pick.locator('.onboard-option-name')).toHaveText(['Rakentaja', 'Ruokkija', 'Retkeilijä']);
  await expect(pick.locator('.onboard-option-person')).toHaveText(['Kustaa Kirvesmies', 'Anni Leipämuori', 'Juho Polunpolkija']);
  await expect(pick.locator('.onboard-option svg')).toHaveCount(3);
  await expect(pick).toContainText('Kaupunki · Varhaisaika');
  await expect(pick.getByRole('button', { name: /^Ohjaan itse/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pick.png') });
  await pick.locator('.onboard-option').filter({ hasText: 'Ruokkija' }).click();
  const s = await state(page);
  expect([s.townAdvisor, s.cityAdvisor]).toEqual(['feed', 'none']);
  // The choice is a command (STORY-086)
  expect(s.commands).toContainEqual({ day: expect.any(Number), by: 'player', kind: 'advise' });

  // The tour: the goal, the speed and the advisor, one at a time; the game still stands
  const tour = page.getByRole('dialog', { name: 'Opastus' });
  await expect(tour).toContainText('1 / 3');
  await expect(page.locator('.hud-goal')).toHaveClass(/tour-target/);
  await tour.getByRole('button', { name: 'Seuraava' }).click();
  await expect(tour).toContainText('2 / 3');
  await expect(page.locator('.hud-speed')).toHaveClass(/tour-target/);
  await tour.getByRole('button', { name: 'Seuraava' }).click();
  await expect(tour).toContainText('3 / 3');
  await expect(page.locator('.hud-advisor')).toHaveClass(/tour-target/);
  await page.screenshot({ path: testInfo.outputPath('tour.png') });
  expect(await dayAfterFrames(page, 10)).toBe(day);
  await tour.getByRole('button', { name: 'Aloita' }).click();
  await expect(tour).toBeHidden();
  await expect(page.locator('.tour-target')).toHaveCount(0);

  // Under an advisor only the essentials: the goal, the time and the advisor
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(page.locator('.hud-goal')).toBeVisible();
  // The level's faces: the chosen one, and the two others to choose by a tap
  await expect(page.getByRole('button', { name: 'Neuvonantaja: Ruokkija, Anni Leipämuori' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Neuvonantajat' }).getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /^Vaihda neuvonantajaksi Rakentaja/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' })).toBeHidden();
  await expect(page.locator('.hud-research')).toBeHidden();
  // The city card tells, and its builds wait for the player's own hand
  await page.locator('.city-label', { hasText: s.cities[0].name }).click();
  // The label opens the city's quick panel first (STORY-098)
  await page.getByRole('group', { name: `Kaupunki ${s.cities[0].name}: pikatoiminnot` }).getByRole('button', { name: 'Kaupunkikortti' }).click();
  const city = page.getByRole('dialog', { name: s.cities[0].name });
  await expect(city.locator('.city-advisor')).toHaveText('Neuvonantaja Ruokkija (Anni Leipämuori) hoitaa työmaat ja rakentamisen.');
  await expect(city.getByRole('radiogroup', { name: 'Rakenna' })).toBeHidden();
  await expect(city.getByRole('radiogroup', { name: 'Kansalaiset työstävät' })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('city-advisor.png') });
  await city.getByRole('button', { name: 'Sulje' }).click();

  // A face chooses another advisor: a command too. Its bonus is in its name and counts at once
  // in the capital (STORY-107): Anni's bread makes no shields, Kustaa's +1 does
  const shields = (await state(page)).cities[0].yield.shield;
  await page.getByRole('button', { name: /^Vaihda neuvonantajaksi Rakentaja/ }).click();
  await expect(page.getByRole('button', { name: 'Neuvonantaja: Rakentaja, Kustaa Kirvesmies: +1 tuotanto pääkaupungissa' })).toBeVisible();
  expect((await state(page)).townAdvisor).toBe('build');
  expect((await state(page)).cities[0].yield.shield).toBe(shields + 1);
  // Ohjaan itse brings every menu out
  await page.getByRole('button', { name: 'Neuvonantaja: Rakentaja, Kustaa Kirvesmies' }).click();
  const card = page.getByRole('dialog', { name: 'Neuvonantaja' });
  await expect(card.getByRole('radio')).toHaveCount(3);
  await expect(card.locator('.advisor-person')).toHaveText(['Kustaa Kirvesmies', 'Anni Leipämuori', 'Juho Polunpolkija']);
  await expect(card.locator('.advisor-bonus')).toHaveText(['Bonus: +1 tuotanto pääkaupungissa', 'Bonus: +1 leipä päivässä pääkaupungissa', 'Bonus: +1 kauppa pääkaupungissa']);
  await card.getByRole('button', { name: /^Ohjaan itse/ }).click();
  await expect(card.getByRole('button', { name: /^Ohjaan itse/ })).toHaveAttribute('aria-pressed', 'true');
  // The own hand has no bonus
  expect((await state(page)).cities[0].yield.shield).toBe(shields);
  await card.getByRole('button', { name: 'Sulje' }).click();
  await expect(page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' })).toBeVisible();
  await page.locator('.city-label', { hasText: s.cities[0].name }).click();
  // The label opens the city's quick panel first (STORY-098)
  await page.getByRole('group', { name: `Kaupunki ${s.cities[0].name}: pikatoiminnot` }).getByRole('button', { name: 'Kaupunkikortti' }).click();
  await expect(city.getByRole('radiogroup', { name: 'Rakenna' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a continued game does not greet again', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await newGame(page, errors);
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.locator('.onboard-option').filter({ hasText: 'Rakentaja' }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.reload();
  await ready;
  await page.getByRole('button', { name: /^Jatka/ }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  await expect(page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' })).toHaveCount(0);
  expect((await state(page)).townAdvisor).toBe('build');
  // A site the capital found may wait on its card (STORY-032); put off, the HUD shows the advisor kept
  const later = page.getByRole('button', { name: /^Myöhemmin/ });
  if (await later.isVisible()) await later.click();
  await expect(page.getByRole('button', { name: /^Neuvonantaja: Rakentaja/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a level with advisors of its own offers its three once its rise card is closed', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await newGame(page, errors);
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.locator('.onboard-option').filter({ hasText: 'Retkeilijä' }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  // The city area has its own three now (STORY-105): after its card, they come
  await page.evaluate(() => (window as any).globeDebug.rise());
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  const area = page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkialuetta?' });
  await expect(area.locator('.onboard-option-name')).toHaveText(['Kasvattaja', 'Kartoittaja', 'Vartija']);
  await area.locator('.onboard-option').filter({ hasText: 'Kartoittaja' }).click();
  // The province has its own: after its card, its three
  await page.evaluate(() => (window as any).globeDebug.rise());
  await expect(page.getByRole('heading', { name: 'Kolme valmista settlementtiä: lääni avautui, zoomaa ulos' })).toBeVisible();
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  const pick = page.getByRole('dialog', { name: 'Kuka hoitaa lääniäsi?' });
  await expect(pick.locator('.onboard-option-name')).toHaveText(['Asuttaja', 'Tutkimusmatkailija', 'Vartija']);
  await pick.locator('.onboard-option').filter({ hasText: 'Asuttaja' }).click();
  const s = await state(page);
  expect([s.townAdvisor, s.cityAdvisor, s.provinceAdvisor]).toEqual(['roam', 'explore', 'settle']);
  // No tour this time
  await expect(page.getByRole('dialog', { name: 'Opastus' })).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the welcome and the three cards fit the screen with 44 px targets', async ({ page }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    await newGame(page, errors);
    const fits = async (sel: string) => {
      const boxes = await page.locator(sel).evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(390);
        expect(b.top).toBeGreaterThanOrEqual(0);
        expect(b.bottom).toBeLessThanOrEqual(844);
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
    };
    await fits('.onboard-card:not([hidden]) .btn');
    await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
    await fits('.onboard-card:not([hidden]) .onboard-option');
    await fits('.onboard-card:not([hidden]) .onboard-own');
    await page.locator('.onboard-option').first().click();
    await fits('.tour-tip:not([hidden]) .btn');
    expect(errors).toEqual([]);
  });
});
