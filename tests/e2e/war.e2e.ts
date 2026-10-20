import { expect, test } from '@playwright/test';

test('the Kenraali builds an army against the nearest city-state, marches and takes it', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
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

  // The home state conquered: a city in each of its provinces, and the neighbours open
  await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 49);
    for (let k = 0; k < 7; k++) w.globeDebug.foundIn(home * 7 + k);
  });
  // Past day 60 every city-state is of size 2 at least, so it is taken, not destroyed; not much
  // faster, as a slow runner finds the city-states over many frames
  await page.evaluate(() => (window as any).globeDebug.fastForward(8));
  await page.waitForFunction(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 49);
    const states = new Set(w.globeDebug.natives().map((n: { state: number }) => n.state));
    return w.globeGame.state.day >= 60 && w.globeRegions.neighbors[home].every((s: number) => states.has(s));
  }, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // The city-state nearest to the capital comes in sight
  const native = await page.evaluate(() => {
    const w = window as any;
    const capital = w.globeHexTiles.tileCenter(w.globeGame.state.cities[0].tile);
    const n = w.globeDebug.natives().sort((a: { tile: number }, b: { tile: number }) =>
      capital.angleTo(w.globeHexTiles.tileCenter(a.tile)) - capital.angleTo(w.globeHexTiles.tileCenter(b.tile)))[0];
    w.globeDebug.reveal([n.tile, ...w.globeHexTiles.neighbors(n.tile)]);
    w.globeDebug.learn('iron');
    w.globeDebug.setAdvisors({ state: 'war' });
    // Slowly from here, so that a slow runner does not let the city-state grow far
    w.globeDebug.fastForward(2);
    return n as { tile: number; name: string; size: number };
  });

  // The target is chosen, and the city nearest to it builds the strongest attacker it can
  await page.waitForFunction(t => {
    const w = window as any;
    return w.globeDebug.war().target === t && w.globeGame.state.cities.some((c: { build: string }) => c.build === 'swordsman');
  }, native.tile, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const card = await page.evaluate(t => (window as any).globeDebug.tileView(t).rows.find((r: { label: string }) => r.label === 'Sotaretki')?.value, native.tile);
  // A slow runner may have finished an attacker before the pause
  expect(card).toMatch(/^Kenraalin kohde · \d+ \/ \d+ hyökkääjää( · hyökkäys käynnissä)?$/);

  // An army in that city, strong enough that the dice of a slow runner's days cannot stop it:
  // it sets off, beats the defenders and takes the city
  await page.evaluate(() => {
    const w = window as any;
    const at = w.globeGame.state.cities.findIndex((c: { build: string }) => c.build === 'swordsman');
    for (let k = 0; k < 12; k++) w.globeDebug.spawnUnit('swordsman', at);
  });
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.war().marching, null, { timeout: 30_000 });
  const marching = await page.evaluate(() => (window as any).globeGame.state.units.filter((u: { kind: string; path: number }) => u.kind === 'swordsman' && u.path > 0));
  expect(marching.length).toBeGreaterThan(0);
  // The army on the map (the unlock card of the test's cities set aside)
  await page.getByRole('button', { name: 'Tauko' }).click();
  if (await page.getByRole('button', { name: 'Myöhemmin' }).isVisible()) await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.evaluate(t => {
    const w = window as any;
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeCamera.dist, 0);
  }, marching[0].tile);
  await page.screenshot({ path: testInfo.outputPath('march.png') });
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(t => {
    const w = window as any;
    return w.globeGame.state.cities.some((c: { tile: number }) => c.tile === t) || w.globeDebug.war().army === 0;
  }, native.tile, { timeout: 120_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  const taken = await page.evaluate(t => (window as any).globeGame.state.cities.find((c: { tile: number }) => c.tile === t), native.tile);
  expect(taken).toBeTruthy();
  expect(taken.name).toBe(native.name);
  expect(taken.native).toBe(true);
  expect(taken.size).toBeGreaterThanOrEqual(1);
  const view = await page.evaluate(t => (window as any).globeDebug.tileView(t), native.tile);
  expect(view.rows.some((r: { label: string }) => r.label === 'Kaupunkivaltio')).toBe(false);
  expect(view.rows.find((r: { label: string }) => r.label === 'Kaupunki').value).toBe(`${native.name}, koko ${taken.size}`);
  expect(await page.evaluate(() => (window as any).globeDebug.war())).toMatchObject({ target: null, marching: false });
  testInfo.annotations.push({ type: 'war', description: `${native.name} (koko ${native.size}) vallattiin päivänä ${await page.evaluate(() => (window as any).globeGame.state.day)}; joukkoa jäljellä ${await page.evaluate(() => (window as any).globeDebug.war().army)}` });

  // In sight: the player's city now, with a label of its own
  if (await page.getByRole('button', { name: 'Myöhemmin' }).isVisible()) await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.evaluate(t => {
    const w = window as any;
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeCamera.dist, 0);
  }, native.tile);
  await expect(page.locator('.city-label:not(.city-label-native)', { hasText: native.name })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('taken.png') });
  expect(errors).toEqual([]);
});
