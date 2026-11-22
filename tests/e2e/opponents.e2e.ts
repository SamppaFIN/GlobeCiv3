import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const shown = (page: Page) => page.evaluate(() => (window as any).globeDebug.opponentsShown() as { natives: number; camps: number; rivals: number });

/** The next level by its goal, its card closed and its advisors left to the player's own hand. */
async function rise(page: Page, card: RegExp) {
  await page.evaluate(() => (window as any).globeDebug.rise());
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: card }) });
  await expect(dialog).toBeVisible();
  const text = (await dialog.textContent()) ?? '';
  await dialog.getByRole('button', { name: 'Myöhemmin' }).click();
  // Each level's advisors come as its card closes (STORY-105)
  await page.getByRole('dialog', { name: /^Kuka hoitaa/ }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  return text;
}

test('the opponents come into play at the state level: hidden and quiet below it, met with a card as it opens; the leaders\' war shows as coming later (STORY-094)', async ({ page }, testInfo) => {
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
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  await rise(page, /kaupunkialue avautui/);
  await rise(page, /lääni avautui/);
  expect((await state(page)).openLevel).toBe(2);

  // The neighbours' city-states and the rivals are there, and their tiles mapped: still none in play
  await page.waitForFunction(() => (window as any).globeDebug.natives().length > 0, null, { timeout: 30_000 });
  const natives: { tile: number }[] = await page.evaluate(() => (window as any).globeDebug.natives());
  const rivalCities: number[] = await page.evaluate(() => (window as any).globeDebug.rivals().flatMap((r: { cities: { tile: number }[] }) => r.cities.map(c => c.tile)));
  await page.evaluate(ids => (window as any).globeDebug.reveal(ids), [...natives.map(n => n.tile), ...rivalCities]);
  expect((await page.evaluate(() => (window as any).globeDebug.natives())).every((n: { mapped: boolean }) => n.mapped)).toBe(true);
  expect(await shown(page)).toEqual({ natives: 0, camps: 0, rivals: 0 });
  // No diplomacy below the state level (STORY-017)
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  await expect(list.getByText('Diplomatia', { exact: true })).toBeHidden();
  await list.getByRole('button', { name: 'Sulje' }).click();

  // The state level: the card tells who is there, and they show
  const met = await rise(page, /^Valtio avautui/);
  expect(met).toMatch(/Naapurivaltioissa on \d+ kaupunkivaltio(ta)? ja \d+ paimentolaisheimo(a)?/);
  expect(met).toContain('Diplomatia, sota ja kauppa alkavat nyt.');
  const now = await shown(page);
  expect(now.natives).toBeGreaterThan(0);
  expect(now.rivals).toBe(rivalCities.length);
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  await expect(list.getByText('Diplomatia', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('state-opponents.png') });
  await list.getByRole('button', { name: 'Sulje' }).click();

  // The planet opens as before, and the leaders' war is told as coming later
  const planet = await rise(page, /^Valtio vallattu/);
  expect(planet).toContain('Johtajien sota ja ydinaseet tulevat myöhemmin.');
  expect(errors).toEqual([]);
});
