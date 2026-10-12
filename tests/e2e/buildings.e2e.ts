import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

test('trade is gold; gold buys a granary, which the card lists and the city pays for', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await startGame(page);
  // The capital on the settler's first site
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const card = page.getByRole('dialog', { name: 'Aamuranta' });
  await expect(card).toBeVisible();

  // The treasury, and twelve builds: three units, five buildings with their upkeep, three wonders and Kultaa
  const s = await state(page);
  await expect(card.locator('.city-gold')).toHaveText(new RegExp(`^Kassa ${s.gold} kultaa · [+−]\\d+/pv$`));
  const builds = card.getByRole('radiogroup', { name: 'Rakenna' });
  await expect(builds.getByRole('radio')).toHaveCount(12);
  const granary = builds.getByRole('radio', { name: /^Viljavarasto/ });
  await expect(granary).toContainText('60 tuotantoa, 1 kulta/pv · Säilyttää puolet ruoasta, kun kaupunki kasvaa');
  await expect(builds.getByRole('radio', { name: /^Muuri/ })).toContainText('120 tuotantoa, 2 kultaa/pv · Soturit kolminkertaisesti vahvempia rosvoja vastaan');
  await expect(builds.getByRole('radio', { name: /^Tori/ })).toContainText('80 tuotantoa, 1 kulta/pv · Kaupasta 50 % enemmän kultaa');

  // The granary: too dear for the treasury at first, then bought
  // A granary waits for Keramiikka (STORY-040)
  await expect(granary).toBeDisabled();
  await expect(granary).toContainText('vaatii: Keramiikka');
  await page.evaluate(() => (window as any).globeDebug.learn('pottery'));
  await expect(granary).toBeEnabled();
  await granary.click();
  await expect(granary).toBeChecked();
  const buyButton = card.locator('.city-buy');
  await page.evaluate(() => (window as any).globeDebug.setGold(5));
  await expect(buyButton).toBeDisabled();
  await expect(buyButton).toHaveText(/^Osta viljavarasto · \d+ kultaa \(kassassa 5\)$/);
  await page.evaluate(() => (window as any).globeDebug.setGold(500));
  await expect(buyButton).toBeEnabled();
  const price = Number((await buyButton.textContent())!.match(/(\d+) kultaa/)![1]);
  // Freeciv: 2 gold a missing shield, twice as much with nothing in store
  const shields = (await state(page)).cities[0].shields;
  expect(price).toBe((shields === 0 ? 2 : 1) * 2 * (60 - shields));
  await buyButton.click();
  await expect(page.getByRole('status')).toHaveText(`Aamuranta osti: Viljavarasto · ${price} kultaa`);
  expect((await state(page)).gold).toBe(500 - price);
  await expect(buyButton).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('bought.png') });

  // The next day it is built: listed in the card, gone from the builds, and paid for each day
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities[0].buildings.includes('granary'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(card.locator('.city-buildings')).toHaveText('Rakennukset: Viljavarasto');
  await expect(builds.getByRole('radio')).toHaveCount(11);
  await expect(builds.getByRole('radio', { name: /^Viljavarasto/ })).toHaveCount(0);
  const after = await state(page);
  expect(after.cities[0].build).toBe('coinage');
  await expect(card.locator('.city-gold')).toHaveText(new RegExp(`^Kassa ${after.gold} kultaa · [+−]\\d+/pv$`));
  await page.screenshot({ path: testInfo.outputPath('built.png') });
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the city card with five builds and buying fits the screen', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const errors = await startGame(page);
    const name = page.locator('.hud-unit-name');
    for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
      const prev = (await name.textContent())!;
      await page.locator('.hud-unit').tap();
      await expect(name).not.toHaveText(prev);
    }
    await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).tap();
    await page.locator('.hud-speed label', { hasText: '4×' }).tap();
    await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Tauko' }).tap();
    const card = page.getByRole('dialog', { name: 'Aamuranta' });
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    for (const b of [...await card.getByRole('radio').all(), card.locator('.city-buy')]) {
      if (!(await b.isVisible())) continue;
      const r = (await b.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(43.5);
    }
    for (const b of await card.locator('.city-build').all()) expect(await b.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('city-phone.png') });
    expect(errors).toEqual([]);
  });
});
