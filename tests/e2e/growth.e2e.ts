import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Found the capital on the settler's first site, then pause with its card open. */
async function foundCapital(page: Page) {
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
}

test('the city card tells how the city grows; the focus picks the tiles; the area and the tiles\' yields are on the map', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await startGame(page);
  await foundCapital(page);
  const card = page.getByRole('dialog', { name: 'Aamuranta' });
  await expect(card).toBeVisible();
  let s = await state(page);
  let city = s.cities[0];

  // Where the food goes, the area and the focus
  await expect(card.locator('.city-food')).toHaveText(`Ruokaa ${city.yield.food} · asukkaat syövät 2 · varastossa ${city.food}/20`);
  await expect(card.locator('.city-area')).toHaveText('Alue 1 rengas · laajenee koossa 2');
  const focus = card.getByRole('radiogroup', { name: 'Kansalaiset työstävät' });
  await expect(focus.getByRole('radio', { name: 'Tasapaino' })).toBeChecked();
  await expect(card.locator('.city-hint')).toBeVisible({ visible: city.yield.surplus <= 1 });

  // A chip over each worked tile: the centre and one tile at size 1
  const chips = page.locator('.tile-yield:not([hidden])');
  await expect(chips).toHaveCount(2);
  await expect(page.locator('.tile-yield-centre')).toHaveCount(1);
  expect(city.worked).toHaveLength(2);
  await page.screenshot({ path: testInfo.outputPath('size1.png') });

  // Ruoka: the citizen works for food; Tuotanto: for shields
  await focus.getByText('Ruoka').click();
  s = await state(page);
  expect(s.cities[0].focus).toBe('food');
  const food = s.cities[0].yield.food;
  await focus.getByText('Tuotanto').click();
  s = await state(page);
  expect(s.cities[0].focus).toBe('production');
  expect(s.cities[0].yield.food).toBeLessThanOrEqual(food);
  await focus.getByText('Ruoka').click();

  // The city grows: two rings, and a chip more
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities[0].size >= 2, null, { timeout: 120_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  s = await state(page);
  city = s.cities[0];
  expect(city.rings).toBe(2);
  await expect(card.locator('.city-area')).toHaveText('Alue 2 rengasta · laajenee koossa 5');
  await expect(chips).toHaveCount(city.size + 1);
  await page.screenshot({ path: testInfo.outputPath('size2.png') });
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the city card leaves the city and its tiles in view above it', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const errors = await startGame(page);
    await foundCapital(page);
    const card = page.getByRole('dialog', { name: 'Aamuranta' });
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(844 * 0.56);
    // The city's centre chip stands between the top panel and the card
    const top = (await page.locator('.hud-top').boundingBox())!;
    await expect.poll(async () => {
      const chip = await page.locator('.tile-yield-centre').boundingBox();
      return chip ? chip.y > top.y + top.height && chip.y + chip.height < box.y : false;
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('phone.png') });
    expect(errors).toEqual([]);
  });
});
