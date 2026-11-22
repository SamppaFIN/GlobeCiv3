import { expect, test, type Page } from '@playwright/test';

type Province = {
  open: boolean; owned: number; byBorder: number[];
  joined: { province: number; kinds: string[] }[];
  waiting: { tile: number; kind: string; province: number }[];
  workers: { name: string; tile: number; joining: string | null }[];
  cities: { tile: number; size: number; culture: number; gain: number; rings: number; shields: number; province: number }[];
  builders: number[]; territoryEdges: number;
};
const province = (page: Page): Promise<Province> => page.evaluate(() => (window as any).globeDebug.province());
const debug = <T>(page: Page, fn: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(([f, a]) => (window as any).globeDebug[f as string](...(a as unknown[])), [fn, args] as const);
const rowsOf = (view: { rows: { label: string; value: unknown }[] }) => Object.fromEntries(view.rows.map(r => [r.label, typeof r.value === 'string' ? r.value : JSON.stringify(r.value)]));

/** The next level by its goal, its card closed and its advisors left to the player's own hand. */
async function rise(page: Page, card: RegExp) {
  await page.evaluate(() => (window as any).globeDebug.rise());
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: card }) });
  await expect(dialog).toBeVisible();
  const text = (await dialog.textContent()) ?? '';
  await dialog.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.getByRole('dialog', { name: /^Kuka hoitaa/ }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  return text;
}

test('the province level: culture widens the border, a worker joins a strategic resource by road for the whole province, and a border holds a province (STORY-093)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
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
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  await rise(page, /kaupunkialue avautui/);
  // Below the province level the border, the joins and the workers are not in play
  expect((await province(page)).open).toBe(false);
  const opens = await rise(page, /lääni avautui/);
  expect(opens).toContain('työläiset yhdistävät hevoset, hiilen ja öljyn tiellä');
  expect(await page.evaluate(() => (window as any).globeGame.state.openLevel)).toBe(2);
  const start = await province(page);
  expect(start.open).toBe(true);
  // Size 1: radius_sq 5 + 1, two rings (Freeciv civ2civ3 with the hex fit); the capital's palace gives culture
  expect(start.cities[0]).toMatchObject({ size: 1, rings: 2, gain: 1 });
  expect(start.owned).toBe(19);

  // A strategic resource inside the border, known: it waits for a road
  await debug(page, 'setCitySize', 0, 4);
  const near: { tile: number; kind: string }[] = await debug(page, 'strategicAround', 0, 3);
  expect(near.length).toBeGreaterThan(0);
  const res = near[0];
  await debug(page, 'reveal', [res.tile]);
  await debug(page, 'setKinds', [res.kind]);
  const waiting = await province(page);
  expect(waiting.waiting.map(r => r.tile)).toContain(res.tile);
  expect(waiting.builders).toEqual([0]);
  expect(rowsOf(await debug(page, 'tileView', res.tile))['Yhteys']).toBe('ei yhdistetty: työläinen rakentaa tien');
  // The province advisor has the province's worker built
  await debug(page, 'setAdvisors', { province: 'settle' });
  await debug(page, 'fastForward', 4);
  await page.waitForFunction(() => (window as any).globeDebug.site(0).builds[0] === 'worker', null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await debug(page, 'setAdvisors', { province: 'none' });

  // A worker builds the road from the resource to the city
  await debug(page, 'spawnUnit', 'worker', 0);
  await debug(page, 'fastForward', 4);
  await page.waitForFunction(kind => ((window as any).globeDebug.province().joined as { kinds: string[] }[]).some(j => j.kinds.includes(kind)), res.kind, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const joined = await province(page);
  const shields: Record<string, number> = { horses: 1, coal: 2, oil: 3 };
  expect(joined.cities[0].shields).toBe(shields[res.kind]);
  expect(joined.joined).toEqual([{ province: joined.cities[0].province, kinds: [res.kind] }]);
  expect(rowsOf(await debug(page, 'tileView', res.tile))['Yhteys']).toMatch(/^yhdistetty tiellä: läänin kaupungit \+\d tuotantoa$/);
  const panel = rowsOf(await debug(page, 'regionView', 1, joined.cities[0].province));
  expect(panel['Yhdistetyt']).toMatch(/tuotantoa joka kaupunkiin$/);
  expect(panel['Kulttuuri']).toMatch(/^\d+ · \+1 päivässä$/);
  expect(await page.evaluate(() => (window as any).globeDebug.notices().join(' '))).toContain('Tie valmis');

  // Culture: every 20 adds one to radius_sq 5 + size; set it a day short of the next ring
  const ringsAt = (size: number, culture: number) => Math.min(5, Math.floor(Math.sqrt(5 + size + Math.floor(culture / 20))));
  const before = (await province(page)).cities[0];
  const short = ((before.rings + 1) ** 2 - 5 - before.size) * 20 - 1;
  await debug(page, 'setCulture', 0, short);
  expect((await province(page)).cities[0].rings).toBe(before.rings);
  const day = await page.evaluate(() => (window as any).globeGame.state.day);
  await debug(page, 'fastForward', 1);
  await page.waitForFunction(d => (window as any).globeGame.state.day > d, day, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const after = (await province(page)).cities[0];
  expect(after.culture).toBeGreaterThan(short);
  expect(after.rings).toBe(ringsAt(after.size, after.culture));
  expect(after.rings).toBe(before.rings + 1);
  expect(await page.evaluate(() => (window as any).globeDebug.notices().join(' '))).toContain(`laajensi rajojaan: ${after.rings} ruudun päähän`);

  // A wide border holds the provinces it covers ten land tiles of, beside the city's own
  await debug(page, 'setCulture', 0, 100_000);
  await debug(page, 'setCitySize', 0, 8);
  const wide = await province(page);
  expect(wide.cities[0].rings).toBe(5);
  const other = wide.byBorder.filter(p => p !== wide.cities[0].province);
  expect(other.length).toBeGreaterThan(0);
  expect(rowsOf(await debug(page, 'regionView', 1, other[0]))['Tila']).toMatch(/^hallussa: rajasi kattavat \d+ maaruutua$/);

  // The province goal shows, and its rise opens the state
  await expect(page.locator('.hud-meter-value')).toHaveText(/^\d \/ 4 hallussa$/);
  // At the province level the border is drawn as one outline, and not at the city area
  expect((await province(page)).territoryEdges).toBe(0);
  for (let k = 0; k < 3 && (await page.evaluate(() => (window as any).globeLevels.state.level)) > 2; k++) {
    await page.keyboard.press('-');
    await page.waitForFunction(() => !(window as any).globeLevels.state.flying, null, { timeout: 20_000 });
  }
  await page.waitForFunction(() => (window as any).globeLevels.state.level === 2 && (window as any).globeDebug.province().territoryEdges > 0, null, { timeout: 20_000 });
  await page.screenshot({ path: testInfo.outputPath('province-border.png') });
  await rise(page, /^Valtio avautui/);
  expect(await page.evaluate(() => (window as any).globeGame.state.openLevel)).toBe(1);
  expect(errors).toEqual([]);
});
