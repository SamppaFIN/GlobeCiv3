import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  // Discoveries (STORY-027) stop the game; this test is about the city
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const speed = (page: Page, s: string) => page.locator('.hud-speed label', { hasText: s }).click();

/** Screen position (CSS px) of a tile centre. */
const onScreen = (page: Page, tile: number) => page.evaluate(t => {
  const w = window as any;
  const p = w.globeHexTiles.tileCenter(t).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
  return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight] as [number, number];
}, tile);

/** Select the settler, mark a land tile two steps away by tapping it, and found the city there. */
async function foundCapital(page: Page): Promise<number> {
  // The unit button cycles the units; the name changes on the next frame
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3; i++) {
    const prev = (await name.textContent())!;
    if (prev === 'Uudisasukas') break;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await expect(page.locator('.hud-unit-name')).toHaveText('Uudisasukas');
  const target: number = await page.evaluate(() => {
    const w = window as any;
    const s = w.globeGame.state;
    const near = (id: number) => [id, ...w.globeHexTiles.neighbors(id)];
    const from = s.units.find((u: any) => u.kind === 'settler').tile;
    // Not next to a unit, so the tap does not pick its figure
    const busy = new Set(s.units.flatMap((u: any) => near(u.tile)));
    const ring2 = new Set<number>(near(from).flatMap(near));
    for (const id of near(from)) ring2.delete(id);
    return [...ring2].find(id => w.globeTileTypes.tileInfo(id).terrain !== 'ocean' && !busy.has(id) && id !== s.site);
  });
  const [x, y] = await onScreen(page, target);
  await page.mouse.click(x, y);
  expect((await state(page)).site).toBe(target);
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await speed(page, '4×');
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return target;
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** The city card's builds (STORY-037): a choice of both, each with its cost, purpose and time. */
const BUILD_NAMES = { warrior: 'Soturi', settler: 'Uudisasukas', coinage: 'Kultaa' };
const buildOption = (card: ReturnType<Page['getByRole']>, build: keyof typeof BUILD_NAMES) =>
  card.getByRole('radiogroup', { name: 'Rakenna' }).getByRole('radio', { name: new RegExp(`^${BUILD_NAMES[build]}`) });

test('the settler founds the capital on the tapped tile; the city card shows its size, yields and build', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await startGame(page);
  const target = await foundCapital(page);
  const s = await state(page);
  const city = s.cities[0];
  expect(city.tile).toBe(target);
  expect(s.units.some((u: any) => u.kind === 'settler')).toBe(false);

  // Design 8a, with the numbers of the game state
  const card = page.getByRole('dialog', { name: 'Aamuranta' });
  await expect(card).toBeVisible();
  await expect(card.locator('.city-kicker')).toHaveText(/^Pääkaupunki · .+$/);
  await expect(card.locator('.city-size')).toHaveText(`Koko ${city.size}`);
  await expect(card.locator('.city-yield-n')).toHaveText([signed(city.yield.surplus), signed(city.yield.shield), signed(city.yield.trade)]);
  await expect(card.locator('.city-yield-label')).toHaveText(['Ruoka', 'Tuotanto', 'Kauppa']);
  await expect(card.locator('.city-grow')).toHaveText(/^(kasvaa \d+ pv|ei kasva|nälkää)$/);
  // The builds to choose from; a Soturi first (a slow runner may have finished it before
  // the pause, and the city gone on to gold)
  // Three units (Falangi: STORY-043), five buildings (STORY-038, 040, 044) and Kultaa (STORY-039)
  await expect(card.getByRole('radiogroup', { name: 'Rakenna' }).getByRole('radio')).toHaveCount(9);
  await expect(buildOption(card, 'warrior')).toContainText('10 tuotantoa · Puolustaa kaupunkia rosvoilta');
  await expect(buildOption(card, 'settler')).toContainText('40 tuotantoa ja 1 asukas · Perustaa uuden kaupungin tai kehittää maata');
  await expect(buildOption(card, 'warrior')).toContainText(/(valmis \d+ pv|valmis huomenna|ei tuotantoa)/);
  await expect(buildOption(card, 'settler')).toContainText(city.size > 1 ? /(valmis \d+ pv|valmis huomenna|ei tuotantoa)/ : /(vaatii koon 2|ei tuotantoa)/);
  await expect(buildOption(card, city.build)).toBeChecked();
  expect(city.yield.surplus > 0 || city.yield.shield > 0).toBe(true);
  await expect(page.locator('.hud-bottom')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('city.png') });

  // A tap chooses the other build, and back
  const other = city.build === 'warrior' ? 'settler' : 'warrior';
  await buildOption(card, other).click();
  await expect(buildOption(card, other)).toBeChecked();
  expect((await state(page)).cities[0].build).toBe(other);
  await buildOption(card, city.build).click();
  await expect(buildOption(card, city.build)).toBeChecked();
  expect((await state(page)).cities[0].build).toBe(city.build);

  // Close the card; a tap on the city opens it again
  await card.getByRole('button', { name: 'Sulje' }).click();
  await expect(card).toBeHidden();
  const [cx, cy] = await onScreen(page, city.tile);
  await page.mouse.click(cx, cy - 10);
  await expect(card).toBeVisible();
  // Without a pointer: the list (STORY-042) opens it from the keyboard
  await card.getByRole('button', { name: 'Sulje' }).click();
  await expect(card).toBeHidden();
  await page.getByRole('button', { name: 'Luettelo: kaupungit ja yksiköt' }).focus();
  await page.keyboard.press('Enter');
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  await expect(list).toBeVisible();
  await list.getByRole('button', { name: /^Aamuranta/ }).focus();
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(card).toBeVisible();

  // Days go on (4× is still chosen): the city grows or its Soturi is ready
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => {
    const g = (window as any).globeGame.state;
    return g.cities[0].size > 1 || g.units.some((u: any) => u.kind === 'warrior');
  }, null, { timeout: 90_000 });
  const later = await state(page);
  const soldier = later.units.find((u: any) => u.kind === 'warrior');
  if (soldier) {
    expect([soldier.name, soldier.tile, soldier.mode]).toEqual(['Soturi 1', city.tile, 'defend']);
    // A soldier in the city does not hide it: a tap still opens the card
    await card.getByRole('button', { name: 'Sulje' }).click();
    await expect(card).toBeHidden();
    const [sx, sy] = await onScreen(page, city.tile);
    await page.mouse.click(sx, sy - 10);
    await expect(card).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath('city-later.png') });
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the city card fits the screen with 44 px targets', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = await startGame(page);
    await foundCapital(page);
    const card = page.getByRole('dialog', { name: 'Aamuranta' });
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    // Buttons, the builds and the focus labels (its radio inputs are hidden inside them)
    for (const b of [...await card.getByRole('button').all(), ...await card.locator('.city-build').all(), ...await card.locator('.city-focus .seg-opt').all()]) {
      const r = (await b.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(43.5);
      expect(r.width).toBeGreaterThanOrEqual(43.5);
    }
    for (const b of await card.locator('.city-build').all()) expect(await b.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    // The top panel still fits with the list button
    const top = (await page.locator('.hud-top').boundingBox())!;
    expect(top.x + top.width).toBeLessThanOrEqual(390);
    const cityButton = (await page.getByRole('button', { name: 'Luettelo: kaupungit ja yksiköt' }).boundingBox())!;
    expect(cityButton.width).toBeGreaterThanOrEqual(43.5);
    expect(await page.locator('.hud-day').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('city-phone.png') });
    expect(errors).toEqual([]);
  });
});
