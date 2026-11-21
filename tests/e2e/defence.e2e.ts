import { expect, test, type Page } from '@playwright/test';

/** The old start on seed 42: only what the test calls stops the game. */
async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const speed = (page: Page, s: string) => page.locator('.hud-speed label', { hasText: s }).click();

/** Select a unit by name with the unit button. */
async function select(page: Page, unit: string) {
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 8 && (await name.textContent()) !== unit; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await expect(name).toHaveText(unit);
}

test('a second city does not open its card; the raid card tells the whole band\'s chance, the soldier\'s time and its price, and a plunder what would have helped (STORY-108)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors = await startGame(page);

  // The first city opens its card, as before
  await select(page, 'Uudisasukas');
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await speed(page, '4×');
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // A second one does not: a notice tells it, its name a link (PLAYTEST-002)
  const settler: string = await page.evaluate(() => (window as any).globeDebug.spawnSettler(0));
  await select(page, settler);
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await speed(page, '4×');
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 2, null, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const second: string = (await state(page)).cities[1].name;
  expect(await page.evaluate(() => (window as any).globeDebug.notices())).toContain(`Uusi kaupunki: ${second}`);
  await expect(page.getByRole('dialog', { name: second })).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Aamuranta' })).toBeHidden();

  // Bandits on the new city, with gold to buy: the card's chances are the band's, from the plan
  await page.evaluate(() => (window as any).globeDebug.setGold(500));
  expect(await page.evaluate(() => (window as any).globeDebug.raidNow(1))).toBe(true);
  const card = page.getByRole('dialog', { name: 'Rosvoja liikkeellä' });
  await expect(card).toBeVisible();
  const plan = await page.evaluate(() => (window as any).globeDebug.raidPlan());
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  expect(plan.now).toBe(0);
  expect(plan.withOne).toBeGreaterThan(0);
  await expect(card.locator('.discovery-body')).toContainText('Jokainen');
  const titles = card.locator('.discovery-option-title');
  const effects = card.locator('.discovery-option-effect');
  await expect(effects.last()).toHaveText('Ilman sotilasta rosvot ryöstävät kaupungin');
  if (plan.inTime) {
    await expect(titles).toHaveText(['Rakenna soturi', 'Luota puolustukseen']);
    await expect(effects.first()).toHaveText(`Valmis ${Math.max(1, plan.ready)} pv, ennen rosvoja · kaupunki kestää ${pct(plan.withOne)}`);
  } else {
    // Too late to build: buying is offered, its price and the chance it gives
    await expect(titles).toHaveText(['Rakenna soturi', 'Osta soturi', 'Luota puolustukseen']);
    await expect(effects.first()).toHaveText(plan.ready === null ? 'Kaupungilla ei ole tuotantoa' : `Valmis vasta ${plan.ready} pv: rosvot ehtivät ensin`);
    await expect(effects.nth(1)).toHaveText(`${plan.price} kultaa, valmis huomenna · kaupunki kestää ${pct(plan.withOne)}`);
  }
  testInfo.annotations.push({ type: 'plan', description: JSON.stringify(plan) });
  await page.screenshot({ path: testInfo.outputPath('raid-card.png') });

  // The soldier is bought when it would come too late, and built otherwise
  const choice = plan.inTime ? 'Rakenna soturi' : 'Osta soturi';
  await card.getByRole('button', { name: new RegExp(choice) }).click();
  await expect(card).toBeHidden();
  const after = await state(page);
  expect(after.cities[1].build).toBe('warrior');
  if (!plan.inTime) {
    expect(after.gold).toBe(500 - plan.price);
    expect(await page.evaluate(() => (window as any).globeDebug.notices())).toContain(`${second} osti soturin · ${plan.price} kultaa`);
  }

  // The fights decide it; a plunder says what would have held the city
  await speed(page, '4×');
  await page.waitForFunction(() => (window as any).globeGame.state.raid === null, null, { timeout: 120_000 });
  const notices: string[] = await page.evaluate(() => (window as any).globeDebug.notices().filter((n: string) => /rosvo/i.test(n)));
  testInfo.annotations.push({ type: 'raid', description: notices.join(' | ') });
  const last = notices.at(-1)!;
  if (last.includes('ryöstivät')) expect(last).toMatch(new RegExp(`· ${second}\\. Puolustukseksi auttaa (toinen sotilas|sotilas), falangi \\(Pronssityö\\) tai muuri \\(Muuraus\\)$`));
  else expect(last).toMatch(new RegExp(`(Soturi torjui rosvon|Soturit torjuivat \\d rosvoa) · ${second}$`));
  expect(errors).toEqual([]);
});
