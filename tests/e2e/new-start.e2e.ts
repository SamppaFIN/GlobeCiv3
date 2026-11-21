import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
/** How many of the tiles exactly four rings from a tile are mapped: the city level shows three rings. */
const ring4Mapped = (page: Page, tile: number) => page.evaluate(t => {
  const w = window as any;
  const rings: Set<number>[] = [new Set([t])];
  for (let r = 0; r < 4; r++) rings.push(new Set([...rings[r]].flatMap((id: number) => [id, ...w.globeHexTiles.neighbors(id)])));
  return [...rings[4]].filter(id => !rings[3].has(id) && w.globeMap.isMapped(id)).length;
}, tile);

test('a new game flies down to the city level of a built capital; a building opens the units, and a scout the city area', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  // The flight ends at the city level, and the land rises
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const s = await state(page);
  expect(s.cities).toHaveLength(1);
  expect(s.units).toHaveLength(0);
  expect(s.openLevel).toBe(4);
  expect(await page.evaluate(() => (window as any).globeCamera.maxDist)).toBeLessThan(await page.evaluate(() => (window as any).globeLevels.state.frames[3] * 0.6));
  // The city level's goal (STORY-087): a building, then a scout (Sami 2026-11-20)
  await expect(page.locator('.hud-goal')).toHaveText('TavoiteRakenna rakennus ja tiedustelija+30 kultaa');
  // Only the city level shows: its three rings are mapped, the city area beyond them is not (STORY-017)
  expect(await ring4Mapped(page, s.cities[0].tile)).toBe(0);
  await expect(page.locator('.hud-meter-value')).toHaveText('0 / 2');

  // A varied site: three kinds of land or more, and exactly one special resource, within two rings
  const site = await page.evaluate(t => {
    const w = window as any;
    let ring = new Set<number>([t]);
    for (let r = 0; r < 2; r++) ring = new Set([...ring].flatMap((id: number) => [id, ...w.globeHexTiles.neighbors(id)]));
    const info = [...ring].map(id => w.globeTileTypes.tileInfo(id));
    return { kinds: new Set(info.map((i: { terrain: string }) => i.terrain).filter((k: string) => k !== 'ocean')).size, resources: info.filter((i: { resource: string | null }) => i.resource).length };
  }, s.cities[0].tile);
  expect(site.kinds).toBeGreaterThanOrEqual(3);
  expect(site.resources).toBe(1);

  // The game greets, and the governor's three cards come next (STORY-096); the player's own
  // hand here, so that the city card shows its builds
  const welcome = page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' });
  await expect(welcome).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('landing.png') });
  await welcome.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  const pick = page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' });
  await expect(pick.locator('.onboard-option')).toHaveCount(3);
  await pick.getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  const governor = page.getByRole('dialog', { name: 'Neuvonantaja' });

  // Before the first building the city builds no units: a building is under way
  await page.locator('.city-label', { hasText: s.cities[0].name }).click();
  // The label opens the city's quick panel first (STORY-098)
  await page.getByRole('group', { name: `Kaupunki ${s.cities[0].name}: pikatoiminnot` }).getByRole('button', { name: 'Kaupunkikortti' }).click();
  const card = page.getByRole('dialog', { name: s.cities[0].name });
  const builds = card.getByRole('radiogroup', { name: 'Rakenna' });
  await expect(builds).toBeVisible();
  const units = builds.getByRole('radio', { name: /Tiedustelija|Soturi|Uudisasukas/ });
  await expect(units.first()).toBeDisabled();
  for (const radio of await units.all()) await expect(radio).toBeDisabled();
  await expect(card).toContainText('ensimmäisen rakennuksen jälkeen');
  // The settler belongs to the city area: it waits for it even after the building
  await expect(card).toContainText('kun kaupunkialue avautuu');
  // The building is the lumberjack, on its site of planks from the stock (STORY-088)
  expect((await state(page)).cities[0].chain.site.building).toBe('lumberjack');
  await card.getByRole('button', { name: 'Sulje' }).click();

  // The Kartoittaja: its building, then a scout, which opens the city area
  await page.getByRole('button', { name: /Neuvonantaja/ }).click();
  await governor.getByRole('radio').filter({ hasText: 'Kartoittaja' }).click();
  await governor.getByRole('button', { name: 'Sulje' }).click();
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  // Pause in the frame the building is done: at 4x the scout can follow before a later check
  await page.waitForFunction(() => {
    if (!((window as any).globeGame.state.cities[0].buildings.length > 0)) return false;
    (document.querySelector('button[aria-label="Tauko"]') as HTMLButtonElement | null)?.click();
    return true;
  }, null, { timeout: 60_000 });
  await expect(page.locator('.hud-meter-value')).toHaveText('1 / 2');
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.openLevel === 3, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect((await state(page)).units.map((u: { kind: string }) => u.kind)).toContain('scout');
  // Every character has a given name from the seed (STORY-102)
  for (const u of (await state(page)).units) expect(u.name).toMatch(/^(Tiedustelija|Soturi|Uudisasukas) \p{Lu}\p{Ll}+/u);
  await expect(page.getByRole('heading', { name: 'Kaupunkialue avautui, zoomaa ulos' })).toBeVisible();
  // The scout shows the next level: the city area is mapped now
  expect(await ring4Mapped(page, s.cities[0].tile)).toBeGreaterThan(0);
  // No city sites were offered at the city level
  expect((await state(page)).offered).toHaveLength(0);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await page.waitForFunction(() => !(window as any).globeLevels.state.flying, null, { timeout: 15_000 });
  // Out at the city area round the capital: the land has sunk
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 0, null, { timeout: 15_000 });
  const out = await page.evaluate(t => {
    const w = window as any;
    return { dist: w.globeCamera.dist / w.globeLevels.state.frames[3], off: w.globeHexTiles.tileCenter(t).angleTo(w.globeCamera.target.clone().normalize()) };
  }, s.cities[0].tile);
  expect(out.dist).toBeGreaterThan(0.9);
  expect(out.off).toBeLessThan(0.01);
  await page.screenshot({ path: testInfo.outputPath('city-area.png') });
  expect(errors).toEqual([]);
});
