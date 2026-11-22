import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

test('the city area rises on three ready settlements: the meter counts them, the hint tells each growing city, and its advisor goes on after the rise (STORY-092)', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
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
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).locator('.onboard-option').filter({ hasText: 'Ruokkija' }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  // The capital as it stands at the rise: a ready settlement
  await page.evaluate(() => {
    const d = (window as any).globeDebug;
    d.giveBuildings(0, ['lumberjack', 'sawmill', 'quarry', 'field', 'mill', 'bakery']);
    d.setCitySize(0, 3);
  });
  await page.waitForFunction(() => (window as any).globeGame.state.openLevel === 3, null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkialuetta?' }).locator('.onboard-option').filter({ hasText: 'Kartoittaja' }).click();

  // The goal: three ready settlements, the capital one of them
  await expect(page.locator('.hud-goal')).toHaveText('TavoiteKolme valmista settlementtiä+60 kultaa');
  await expect(page.locator('.hud-meter-value')).toHaveText('1 / 3 valmiina');

  // Two cities founded the way a settler founds: settlements, but growing
  const tiles: number[] = await page.evaluate(() => {
    const w = window as any;
    const capital: number = w.globeGame.state.cities[0].tile;
    const out: number[] = [];
    let ring = [capital];
    const seen = new Set(ring);
    for (let d = 1; d <= 9 && out.length < 2; d++) {
      ring = ring.flatMap((t: number) => w.globeHexTiles.neighbors(t) as number[]).filter((t: number) => !seen.has(t) && (seen.add(t), true));
      if (d < 4) continue;
      for (const t of ring) {
        if (out.length < 2 && w.globeDebug.site(t).block === null) {
          w.globeDebug.foundHere(t);
          out.push(t);
        }
      }
    }
    return out;
  });
  expect(tiles).toHaveLength(2);
  const s = await state(page);
  expect(s.cities.slice(1).map((c: { size: number }) => c.size)).toEqual([1, 1]);
  await expect(page.locator('.hud-meter-value')).toHaveText('1 / 3 valmiina');
  // The hint tells each growing city and what it lacks
  await page.locator('.hud-goal').click();
  const hint = page.getByRole('status');
  await expect(hint).toContainText('Valmiita settlementtejä 1 / 3 · kasvamassa:');
  for (const c of s.cities.slice(1)) await expect(hint).toContainText(c.buildings.includes('lumberjack') ? `${c.name} koko 1 / 3` : c.name);

  // The second grows ready: 2 / 3, and nothing opens yet
  await page.evaluate(() => (window as any).globeDebug.setCitySize(1, 3));
  await expect(page.locator('.hud-meter-value')).toHaveText('2 / 3 valmiina');
  expect((await state(page)).openLevel).toBe(3);

  // The third: the province opens, its gold is paid, and the card tells it
  const gold = (await state(page)).gold;
  await page.evaluate(() => (window as any).globeDebug.setCitySize(2, 3));
  await expect(page.getByRole('heading', { name: 'Kolme valmista settlementtiä: lääni avautui, zoomaa ulos' })).toBeVisible();
  const risen = await state(page);
  expect([risen.openLevel, risen.gold]).toEqual([2, gold + 60]);
  await page.screenshot({ path: testInfo.outputPath('province-open.png') });
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa lääniäsi?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();

  // The city area's advisor goes on after the rise: it still commands the cities
  const before = (await state(page)).commands.length;
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(n => (window as any).globeGame.state.commands.slice(n).some((c: { by: string }) => c.by === 'city'), before, { timeout: 90_000 });
  expect((await state(page)).cityAdvisor).toBe('explore');
  expect(errors).toEqual([]);
});
