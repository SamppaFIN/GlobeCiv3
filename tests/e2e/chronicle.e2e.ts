import { expect, test, type Page } from '@playwright/test';

const capital = (page: Page) => page.evaluate(() => (window as any).globeGame.state.cities[0]);

async function open(page: Page) {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
}

/** The capital's card from its label, through the quick panel, with the chronicle opened. */
async function openStory(page: Page, name: string) {
  await page.locator('.city-label', { hasText: name }).click();
  await page.getByRole('group', { name: `Kaupunki ${name}: pikatoiminnot` }).getByRole('button', { name: 'Kaupunkikortti' }).click();
  const card = page.getByRole('dialog', { name });
  await card.locator('.city-story summary').click();
  const story = card.locator('.city-story-text');
  await expect(story).toBeVisible();
  return { card, story };
}

test('a city\'s chronicle names its founder, grows with its buildings, keeps its words over a save, and its links lead on (STORY-106)', async ({ page }, testInfo) => {
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

  // The founding: the settler who founded the capital is named, and the land told
  const c = await capital(page);
  expect(c.history[0]).toMatchObject({ kind: 'founded', day: 1, founder: expect.stringMatching(/^Uudisasukas \S/) });
  const founder = (c.history[0].founder as string).replace('Uudisasukas', 'uudisasukas');
  const { card, story } = await openStory(page, c.name);
  await expect(story.locator('.rich-person')).toHaveText(founder);
  await expect(story.locator('p').first()).toContainText(founder);
  await expect(story).toContainText(/nyt eletään varhaisaikaa\.$/);
  await story.scrollIntoViewIfNeeded();
  await card.screenshot({ path: testInfo.outputPath('founding.png') });

  // The lumberjack is built from the starting stock: the chronicle grows by it
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.waitForFunction(() => {
    if (!(window as any).globeGame.state.cities[0].buildings.includes('lumberjack')) return false;
    // By the state, not the label: the label follows the clock a frame late (CI 2026-11-24)
    if (!(window as any).globeGame.state.paused) (document.querySelector('.hud-pause') as HTMLButtonElement).click();
    return true;
  }, null, { timeout: 60_000 });
  const built = (await capital(page)).history.find((e: { kind: string }) => e.kind === 'built');
  expect(built).toMatchObject({ kind: 'built', building: 'lumberjack' });
  await expect(story.locator('.rich-building', { hasText: 'metsuri' })).toBeVisible();
  await expect(story).toContainText(`${built.day}`);
  const told = await story.textContent();
  const log = (await capital(page)).history;
  await story.scrollIntoViewIfNeeded();
  await card.screenshot({ path: testInfo.outputPath('lumberjack.png') });

  // Saved and loaded: the same log tells the same words
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  await open(page);
  await page.getByRole('button', { name: /^Jatka/ }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  // Saved paused, it comes back paused
  expect(await page.evaluate(() => (window as any).globeGame.state.paused)).toBe(true);
  expect((await capital(page)).history).toEqual(log);
  const again = await openStory(page, c.name);
  await expect(again.story).toHaveText(told!);

  // The city's own name is a link: to the city, its quick panel open and the card closed
  await again.story.getByRole('button', { name: `${c.name}, kaupunki` }).first().click();
  await expect(again.card).toBeHidden();
  await expect(page.getByRole('group', { name: `Kaupunki ${c.name}: pikatoiminnot` })).toBeVisible();
  expect(errors).toEqual([]);
});
