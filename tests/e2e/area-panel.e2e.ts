import { expect, test, type Page } from '@playwright/test';

/** A new game on seed 42 at the city level, paused, in the player's own hand (STORY-096). */
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
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  return page.evaluate(() => (window as any).globeGame.state.cities[0].name as string);
}

const arrived = (page: Page) => page.waitForFunction(() => !(window as any).globeCamera.flying, null, { timeout: 10_000 });

test('the level panel tells the level, the era and the area, and opens into its figures and quick actions; a city label tells in small and opens its quick panel (STORY-098)', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  const name = await newGame(page, errors);

  // At the city level: the city, and the era
  const head = page.locator('.hud-area');
  await expect(page.locator('.hud-area-kicker')).toHaveText('Kaupunki');
  await expect(page.locator('.hud-area-name')).toHaveText(name);
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  const info = page.getByRole('region', { name: 'Alueen tiedot' });
  await expect(info).toBeHidden();

  // A tap opens the infographic: four figures, the city's lines and its quick actions
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(info.locator('.hud-area-stat-label')).toHaveText(['Asukkaita', 'Tuotanto/pv', 'Kauppa/pv', 'Tiede/pv']);
  await expect(info.locator('.hud-area-stat-value').first()).toHaveText('1');
  await expect(info.locator('dt')).toHaveText(['Aikakausi', 'Kasvu', 'Tuotanto', 'Tuotot', 'Mieliala']);
  await expect(info.locator('dd').first()).toHaveText('Varhaisaika');
  await expect(info.locator('dd').nth(1)).toContainText('Koko 1');
  // Out to the city area only once it is open
  await expect(info.getByRole('button')).toHaveText(['Kaupunkikortti', /^Neuvonantaja: /, 'Tietokirja']);
  await page.screenshot({ path: testInfo.outputPath('city-level.png') });
  await info.getByRole('button', { name: 'Kaupunkikortti' }).click();
  const card = page.getByRole('dialog', { name });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Sulje' }).click();
  await page.evaluate(() => (window as any).globeDebug.rise());
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  // The city area's own advisors come as it opens (STORY-105)
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkialuetta?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  await expect(info.getByRole('button')).toHaveText(['Kaupunkikortti', /^Neuvonantaja: /, 'Kaupunkialueelle', 'Tietokirja']);

  // Up to the city area: its name, its details, and the key i closes the panel
  await info.getByRole('button', { name: 'Kaupunkialueelle' }).click();
  await arrived(page);
  await expect(page.locator('.hud-area-kicker')).toHaveText('Kaupunkialue');
  await expect(page.locator('.hud-area-name')).not.toHaveText(name);
  await expect(page.locator('.hud-area-name')).not.toBeEmpty();
  await expect(info.locator('dt')).toContainText(['Aikakausi', 'Painotus', 'Kartoitettu', 'Kaupungit']);
  await page.screenshot({ path: testInfo.outputPath('city-area-level.png') });
  await page.keyboard.press('i');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(info).toBeHidden();

  // The city's label: what it builds and how it grows, in small
  const label = page.locator('.city-label', { hasText: name });
  await expect(label.locator('.city-label-info')).toHaveText(/ · ruokaa [+−]\d+$/);
  // The first tap opens its quick panel, with its figures and actions of 44 px at least
  await label.click();
  const quick = page.getByRole('group', { name: `Kaupunki ${name}: pikatoiminnot` });
  await expect(quick).toBeVisible();
  await expect(label).toHaveAttribute('aria-expanded', 'true');
  await expect(quick.locator('li').first()).toContainText('Koko 1 · ruokaa');
  await expect(quick.locator('li').nth(1)).toContainText(/^Rakentaa /);
  await expect(quick.getByRole('button', { name: 'Lennä kaupunkiin' })).toBeVisible();
  for (const b of await quick.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('city-quick.png') });
  // A tap on the map closes it; the second tap on the label opens the card
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + box.height - 20);
  await expect(quick).toBeHidden();
  await label.click();
  await expect(quick).toBeVisible();
  await label.click();
  await expect(card).toBeVisible();
  await expect(quick).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 0.5 });

  test('the level panel and the quick panel fit the screen, with targets of 44 px (STORY-098)', async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    const name = await newGame(page, errors);
    // In the meter's row: the top panel takes no more of the screen (STORY-025)
    const head = page.locator('.hud-area');
    await expect(head).toContainText(name);
    expect((await head.boundingBox())!.height).toBeGreaterThanOrEqual(28);
    await head.tap();
    const info = page.getByRole('region', { name: 'Alueen tiedot' });
    await expect(info).toBeVisible();
    const panel = (await page.locator('.hud-top').boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(390);
    for (const b of await info.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath('phone-panel.png') });
    await page.evaluate(() => (window as any).globeDebug.rise());
    await page.getByRole('button', { name: 'Myöhemmin' }).tap();
    await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkialuetta?' }).getByRole('button', { name: /^Ohjaan itse/ }).tap();
    await info.getByRole('button', { name: 'Kaupunkialueelle' }).tap();
    await arrived(page);
    await head.tap();
    await page.locator('.city-label', { hasText: name }).tap();
    const quick = page.getByRole('group', { name: `Kaupunki ${name}: pikatoiminnot` });
    await expect(quick).toBeVisible();
    const q = (await quick.boundingBox())!;
    expect(q.x).toBeGreaterThanOrEqual(0);
    expect(q.x + q.width).toBeLessThanOrEqual(390);
    expect(q.y + q.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: testInfo.outputPath('phone-quick.png') });
    expect(errors).toEqual([]);
  });
});
