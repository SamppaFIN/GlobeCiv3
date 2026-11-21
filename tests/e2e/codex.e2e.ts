import { expect, test, type Page } from '@playwright/test';

/** A new game on seed 42 at the city level, paused, in the player's own hand. */
async function newGame(page: Page, errors: string[]) {
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  return page.evaluate(() => (window as any).globeGame.state.cities[0].name as string);
}

test('the Tietokirja opens from the level panel and from a link in a text, follows its links, goes back and closes (STORY-104)', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  const name = await newGame(page, errors);
  const book = page.getByRole('dialog', { name: 'Tietokirja' });
  const back = page.getByRole('button', { name: 'Takaisin' });

  // From the level panel: the index, each kind with its pages, nothing to go back to
  await page.locator('.hud-area').click();
  await page.getByRole('region', { name: 'Alueen tiedot' }).getByRole('button', { name: 'Tietokirja' }).click();
  await expect(book).toBeVisible();
  await expect(book.locator('dt')).toHaveText(['Rakennukset', 'Yksiköt', 'Keksinnöt', 'Resurssit', 'Tavarat', 'Neuvonantajat', 'Aikakaudet']);
  await expect(back).toBeHidden();
  // The people know no kind of resource yet: the index names them by their terrain (STORY-072)
  const kinds = book.locator('dd').nth(3);
  await expect(kinds).toContainText('Tasangon resurssi');
  await expect(kinds).not.toContainText('Hevoset');
  await page.screenshot({ path: testInfo.outputPath('index.png') });

  // A link leads to its page, and the page's links lead on
  await book.getByRole('button', { name: 'Viljavarasto, rakennus' }).click();
  await expect(page.locator('#codex-title')).toHaveText('Viljavarasto');
  await expect(page.locator('#codex-title')).toBeFocused();
  await expect(book.locator('.codex-text')).toContainText('Säilyttää puolet ruoasta');
  await expect(book.locator('dt')).toHaveText(['Hinta', 'Ylläpito', 'Vaatii']);
  await expect(book.locator('dd')).toHaveText(['60 tuotantoa', '1 kulta päivässä', 'Keramiikka']);
  await book.getByRole('button', { name: 'Keramiikka, keksintö' }).click();
  await expect(page.locator('#codex-title')).toHaveText('Keramiikka');
  await expect(book.locator('dd').filter({ hasText: 'Viljavarasto' }).getByRole('button', { name: 'Riippuvat puutarhat, rakennus' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('advance.png') });
  // Back, step by step, to the index
  await back.click();
  await expect(page.locator('#codex-title')).toHaveText('Viljavarasto');
  await back.click();
  await expect(page.locator('#codex-title')).toHaveText('Tietokirja');
  await expect(back).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(book).toBeHidden();

  // From a text: the era in the city's chronicle opens its page over the city card
  await page.getByRole('region', { name: 'Alueen tiedot' }).getByRole('button', { name: 'Kaupunkikortti' }).click();
  const card = page.getByRole('dialog', { name });
  await card.locator('.city-story summary').click();
  await card.getByRole('button', { name: 'varhaisaikaa, aikakausi' }).click();
  await expect(book).toBeVisible();
  await expect(page.locator('#codex-title')).toHaveText('Varhaisaika');
  // The era's people link to their roles; a page reached from a text goes back to the index
  await book.getByRole('button', { name: 'Kustaa Kirvesmies, henkilö' }).click();
  await expect(page.locator('#codex-title')).toHaveText('Rakentaja');
  await expect(book.locator('dd').first()).toHaveText('Kustaa Kirvesmies: +1 tuotanto pääkaupungissa');
  await back.click();
  await back.click();
  await expect(page.locator('#codex-title')).toHaveText('Tietokirja');
  await page.screenshot({ path: testInfo.outputPath('over-card.png') });
  await book.getByRole('button', { name: 'Sulje Tietokirja' }).click();
  await expect(book).toBeHidden();
  await expect(card).toBeVisible();
  expect(errors).toEqual([]);
});
