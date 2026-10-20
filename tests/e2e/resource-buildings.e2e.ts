import { expect, test } from '@playwright/test';

test('a known resource in the city area gives its building; the building stands on it, gives its bonus and, when done, its reward', async ({ page }, testInfo) => {
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
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Neuvonantaja' }).getByRole('button', { name: 'Sulje' }).click();

  // The start resource (seed 42: Hedelmällinen maa in the second ring), and the city grown over it
  const start = await page.evaluate(() => {
    const w = window as any;
    const c = w.globeGame.state.cities[0];
    let ring = new Set<number>([c.tile]);
    for (let r = 0; r < 2; r++) ring = new Set([...ring].flatMap((id: number) => [id, ...w.globeHexTiles.neighbors(id)]));
    const tile = [...ring].find(id => w.globeTileTypes.tileInfo(id).resource)!;
    w.globeDebug.setCitySize(0, 2);
    return { tile, kind: w.globeTileTypes.tileInfo(tile).resource as string, name: c.name as string };
  });
  expect(start.kind).toBe('fertile');
  const card = page.getByRole('dialog', { name: start.name });
  const builds = card.getByRole('radiogroup', { name: 'Rakenna' });
  const farmstead = builds.getByRole('radio', { name: /^Viljelmä/ });

  // Not known yet: no building
  await page.locator('.city-label', { hasText: start.name }).click();
  await expect(builds).toBeVisible();
  await expect(farmstead).toHaveCount(0);

  // Known, in the area: its building, what it gives and its reward (the open card follows)
  await page.evaluate(() => (window as any).globeDebug.setKinds(['fertile']));
  await expect(farmstead).toContainText('40 tuotantoa · Hedelmällinen maa alueella: +1 ruoka, +1 tuotanto päivässä; valmistuessa uudisasukas');
  await farmstead.click();
  expect((await page.evaluate(() => (window as any).globeGame.state.cities[0].build))).toBe('farmstead');
  await card.getByRole('button', { name: 'Sulje' }).click();
  const settlers = () => page.evaluate(() => (window as any).globeGame.state.units.filter((u: { kind: string }) => u.kind === 'settler').length as number);
  const before = await settlers();
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector('.hud-notice')!;
    w.notices = [];
    new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) w.notices.push(n.textContent); }).observe(el, { childList: true });
  });
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(() => (window as any).globeGame.state.cities[0].buildings.includes('farmstead'), null, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // The reward: a settler of no city; the building stands on the resource
  expect(await settlers()).toBe(before + 1);
  const notices = (await page.evaluate(() => (window as any).notices)) as string[];
  expect(notices).toContain('Viljelmä: uudisasukas liittyi joukkoon');
  await expect.poll(async () => (await page.evaluate(() => (window as any).globeDebug.placement(0).placed.farmstead))).toBe(start.tile);
  await page.screenshot({ path: testInfo.outputPath('farmstead.png') });
  expect(errors).toEqual([]);
});
