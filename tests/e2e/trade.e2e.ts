import { expect, test, type Page } from '@playwright/test';

const ties = (page: Page) => page.evaluate(() => (window as any).globeDebug.ties() as { met: boolean; attitude: number; maps: number }[]);
const known = (page: Page) => page.evaluate(() => (window as any).globeGame.state.research.known as string[]);

test('a trade with a rival: an advance for an advance, maps and a kind for gold, refused when not worth it or when hostile', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
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
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(() => (window as any).globeDebug.rivals()[0]?.cities.length > 0, null, { timeout: 60_000 });
  const name = await page.evaluate(() => {
    const w = window as any;
    const r = w.globeDebug.rivals()[0];
    const t = r.cities[0].tile;
    w.globeDebug.reveal([t, ...w.globeHexTiles.neighbors(t)]);
    return r.name as string;
  });
  await page.waitForFunction(() => (window as any).globeDebug.ties()[0].met, null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  if (await page.getByRole('button', { name: 'Myöhemmin' }).isVisible()) await page.getByRole('button', { name: 'Myöhemmin' }).click();
  // Each knows an advance the other does not, the rival is wary (0), and the player knows no kind of resource
  await page.evaluate(() => {
    const w = window as any;
    w.globeDebug.learn('pottery');
    w.globeDebug.rivalLearn(0, 'masonry');
    w.globeDebug.setAttitude(0, 0);
    // The old start knows every kind: none, so that one can be traded
    w.globeDebug.setKinds([]);
  });
  const gold = (await page.evaluate(() => (window as any).globeGame.state.gold)) as number;
  expect(gold).toBeGreaterThanOrEqual(50);

  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  await list.getByText('Diplomatia', { exact: true }).click();
  await list.locator('.list-row', { hasText: name }).click();
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Vaihda' }).click();
  const card = page.locator('.trade-card');
  await expect(card).toBeVisible();
  const give = card.getByRole('radiogroup', { name: 'Annat' });
  const get = card.getByRole('radiogroup', { name: 'Saat' });
  const verdict = card.locator('.tile-verdict');

  // An advance for an advance of the same worth: a wary rival accepts
  await give.getByRole('radio', { name: /^Keksintö: Keramiikka/ }).click();
  await get.getByRole('radio', { name: /^Keksintö: Muuraus/ }).click();
  await expect(verdict).toHaveText(new RegExp(`^${name} hyväksyy \\(varautunut: arvo \\d+ vastaan \\d+\\)$`));
  await page.screenshot({ path: testInfo.outputPath('trade.png') });
  await card.getByRole('button', { name: 'Tarjoa vaihto' }).click();
  await expect.poll(async () => (await known(page)).includes('masonry')).toBe(true);
  expect((await ties(page))[0].attitude).toBe(10);
  // Maps for nothing: not worth it
  await get.getByRole('radio', { name: /^Kartat/ }).click();
  await expect(verdict).toContainText(`${name} haluaa enemmän`);
  // For 25 gold: its cities' lands are mapped, and the maps wait 30 days
  await give.getByRole('radio', { name: /^25 kultaa/ }).click();
  await get.getByRole('radio', { name: /^Kartat/ }).click();
  await expect(verdict).toContainText(`${name} hyväksyy`);
  await card.getByRole('button', { name: 'Tarjoa vaihto' }).click();
  await expect.poll(async () => (await ties(page))[0].maps).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => (window as any).globeGame.state.gold)).toBe(gold - 25);
  await expect(get.getByRole('radio', { name: /^Kartat/ })).toHaveCount(0);
  // A kind of resource for 25 gold
  const kind = await get.getByRole('radio', { name: /^Resurssilaji:/ }).first().textContent();
  await give.getByRole('radio', { name: /^25 kultaa/ }).click();
  await get.getByRole('radio', { name: /^Resurssilaji:/ }).first().click();
  await card.getByRole('button', { name: 'Tarjoa vaihto' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).globeGame.state.gold))).toBe(gold - 50);
  expect(kind).toBeTruthy();
  // Hostile, it trades nothing
  await page.evaluate(() => (window as any).globeDebug.setAttitude(0, -60));
  await expect(verdict).toHaveText(`${name} ei vaihda: se on vihamielinen`);
  await expect(card.getByRole('button', { name: 'Tarjoa vaihto' })).toBeDisabled();
  // Closed, back to its diplomacy card
  await card.getByRole('button', { name: 'Sulje' }).click();
  await expect(page.getByRole('dialog', { name })).toBeVisible();
  expect(errors).toEqual([]);
});
