import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  // Only site offers stop the game here
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => { const d = (window as any).globeDebug; d.setDiscoveries(false); d.setSiteOffers(true); });
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Days that pass over at least \`ms\` of wall time and three frames, measured inside the page. */
const daysOver = (page: Page, ms: number) => page.evaluate(span => new Promise<number>(resolve => {
  const w = window as any;
  const d0 = w.globeGame.state.day;
  let t0 = 0, frames = 0;
  const step = (t: number) => {
    t0 ||= t;
    if (++frames >= 3 && t - t0 >= span) resolve(w.globeGame.state.day - d0);
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), ms);

test('a scout suggests a good city site; the settler founds the city there, and its label finds it', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await startGame(page);
  // Send the scouts toward the nearest good site and run at 4×
  await page.evaluate(() => {
    const w = window as any;
    const [site] = w.globeDebug.goodSites(1);
    w.globeDebug.sendTo(site);
  });
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.offer !== null, null, { timeout: 120_000 });
  const offer = (await state(page)).offer;

  const card = page.getByRole('dialog');
  await expect(card).toBeVisible();
  await expect(page.locator('.discovery-kicker')).toHaveText(/^Kaupunkipaikka · Tiedustelija \d+$/);
  await expect(page.locator('.discovery-body')).toHaveText(/^Tiedustelija löysi hyvän paikan kaupungille\. Kahden renkaan säteellä on ruokaa \d+, tuotantoa \d+ ja kauppaa \d+\.$/);
  await expect(page.locator('.discovery-option-title')).toHaveText(['Rakenna kaupunki tänne', 'Myöhemmin']);
  await expect(page.locator('.discovery-option-effect').first()).toHaveText(/^Uudisasukas lähtee matkaan · \d+ pv$/);
  await expect(page.locator('.discovery-note')).toHaveText('Kaupunki työstää ruutuja kahden renkaan säteellä.');
  await page.screenshot({ path: testInfo.outputPath('offer.png') });
  // The game stands still until the choice
  expect(await daysOver(page, 2000)).toBe(0);

  // Later offers would stop the game again; this test is about the first
  await page.evaluate(() => (window as any).globeDebug.setSiteOffers(false));
  await page.getByRole('button', { name: /Rakenna kaupunki tänne/ }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Uudisasukas lähti perustamaan kaupunkia');
  const going = await state(page);
  expect([going.site, going.founding]).toEqual([offer.tile, true]);
  await expect(page.locator('.hud-unit-name')).toHaveText('Uudisasukas');

  // The settler walks there and founds the city on the suggested tile
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 120_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const founded = (await state(page)).cities[0];
  expect(founded.tile).toBe(offer.tile);
  // Its label is on the map; after the card is closed, the label opens it again. A slow
  // runner passes days before the pause, so the city may have grown already
  testInfo.annotations.push({ type: 'city', description: `size ${founded.size} on day ${(await state(page)).day}` });
  const label = page.getByRole('button', { name: `Kaupunki Aamuranta, koko ${founded.size}` });
  await page.getByRole('button', { name: 'Sulje' }).click();
  await expect(label).toBeVisible();
  await label.click();
  await expect(page.getByRole('dialog', { name: 'Aamuranta' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('city-label.png') });

  // Without a free settler the next suggestion has the capital build one for the site
  await page.getByRole('button', { name: 'Sulje' }).click();
  await page.evaluate(() => (window as any).globeDebug.setSiteOffers(true));
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.offer !== null, null, { timeout: 120_000 });
  const second = (await state(page)).offer;
  await expect(page.locator('.discovery-option-effect').first()).toHaveText('Aamuranta rakentaa uudisasukkaan, joka lähtee tänne');
  await page.evaluate(() => (window as any).globeDebug.setSiteOffers(false));
  await page.getByRole('button', { name: /Rakenna kaupunki tänne/ }).click();
  await expect(page.getByRole('status')).toHaveText('Aamuranta rakentaa uudisasukkaan kaupunkipaikalle');
  const waiting = await state(page);
  expect([waiting.cities[0].build, waiting.pendingSite]).toEqual(['settler', second.tile]);
  expect(errors).toEqual([]);
});
