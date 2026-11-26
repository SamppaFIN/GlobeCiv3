import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const capital = (page: Page) => page.evaluate(() => (window as any).globeGame.state.cities[0]);

async function open(page: Page) {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
}

/** Run the game until a building stands in the capital, then pause. */
async function until(page: Page, building: string) {
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(b => {
    if (!(window as any).globeGame.state.cities[0].buildings.includes(b)) return false;
    // By the state, not the label: the label follows the clock a frame late (CI 2026-11-24)
    if (!(window as any).globeGame.state.paused) (document.querySelector('.hud-pause') as HTMLButtonElement).click();
    return true;
  }, building, { timeout: 60_000 });
}

test('the capital builds of planks and stone: the base first, from the starting stock, and the chain is saved (STORY-088)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' }).getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();

  // The capital starts with Freeserf's smallest stock and the lumberjack's site; its shields make gold
  let c = await capital(page);
  expect(c.chain.stock).toEqual({ plank: 7, stone: 2 });
  expect(c.chain.site).toMatchObject({ building: 'lumberjack' });
  expect(c.build).toBe('coinage');
  const name = c.name;
  await page.locator('.city-label', { hasText: name }).click();
  await page.getByRole('group', { name: `Kaupunki ${name}: pikatoiminnot` }).getByRole('button', { name: 'Kaupunkikortti' }).click();
  const card = page.getByRole('dialog', { name });
  await expect(card.locator('.city-chain')).toHaveText('Varasto: lankkuja 7, kiveä 2 · Työmaa: Metsuri, valmis 2 pv');
  const sites = card.getByRole('radiogroup', { name: 'Työmaalle' });
  await expect(sites.getByRole('radio', { name: /^Metsuri/ })).toHaveAttribute('aria-checked', 'true');
  await expect(sites.getByRole('radio', { name: /^Metsuri/ })).toContainText('2 lankkua');
  await expect(sites.getByRole('radio', { name: /^Saha/ })).toContainText('3 lankkua ja 2 kiveä');
  // One site at a time, and the field waits for the base
  await expect(sites.getByRole('radio', { name: /^Saha/ })).toBeDisabled();
  await expect(sites.getByRole('radio', { name: /^Pelto/ })).toBeDisabled();
  await expect(sites.getByRole('radio', { name: /^Pelto/ })).toContainText('metsurin, sahan ja louhoksen jälkeen');
  // The shields build no chain building
  await expect(card.getByRole('radiogroup', { name: 'Rakenna' }).getByRole('radio', { name: /^(Metsuri|Saha|Louhos|Pelto|Mylly|Leipomo)/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('stock.png') });

  // The lumberjack is done of its two planks; the player puts the sawmill and the quarry on the site
  await until(page, 'lumberjack');
  await sites.getByRole('radio', { name: /^Saha/ }).click();
  expect((await capital(page)).chain.site.building).toBe('sawmill');
  await until(page, 'sawmill');
  await sites.getByRole('radio', { name: /^Louhos/ }).click();
  await until(page, 'quarry');
  c = await capital(page);
  // The starting stock built the base exactly; the lumberjack has felled logs meanwhile. At 4×
  // two days may finish in one frame (STORY-117), so the quarry may have cut stone for a day or
  // so before the pause: no more stone than its days (CI 2026-11-26)
  expect(c.chain.stock.plank ?? 0).toBeLessThanOrEqual(2);
  const quarried = (await state(page)).day - c.history.find((e: { kind: string; building?: string }) => e.kind === 'built' && e.building === 'quarry').day;
  expect(c.chain.stock.stone ?? 0).toBeLessThanOrEqual(quarried);
  await expect(sites.getByRole('radio', { name: /^Pelto/ })).toBeEnabled();
  // The buildings were the player's commands, and each stands on a tile at the city level
  expect((await state(page)).commands.filter((e: { by: string; kind: string }) => e.by === 'player' && e.kind === 'build')).toHaveLength(2);
  expect(Object.keys(c.placed)).toEqual(expect.arrayContaining(['lumberjack', 'sawmill', 'quarry']));

  // The field: planks come from the sawmill now, stone from the quarry
  await sites.getByRole('radio', { name: /^Pelto/ }).click();
  await until(page, 'field');
  c = await capital(page);
  await page.screenshot({ path: testInfo.outputPath('field.png') });

  // Saved mid-chain, and loaded as it was
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  await open(page);
  await page.getByRole('button', { name: /^Jatka/ }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  const back = await capital(page);
  expect([back.buildings, back.chain]).toEqual([c.buildings, c.chain]);
  expect(errors).toEqual([]);
});
