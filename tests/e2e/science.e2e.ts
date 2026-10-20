import { expect, test, type Page } from '@playwright/test';

async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  // Before the game starts: a slow runner passes days before the first check
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

test('science: choose an advance, split trade, learn it, and the building it opens', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await startGame(page);
  // No city yet: nothing to research
  await expect(page.getByRole('button', { name: 'Valitse tutkimus', exact: true })).toBeHidden();
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
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // The pill opens the science card: seven advances to start (Ratsastus and Pyörä: STORY-064), 10 bulbs each
  await page.getByRole('button', { name: 'Valitse tutkimus', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Tutkimus' });
  await expect(card).toBeVisible();
  await expect(card.locator('.research-current')).toHaveText('Valitse, mitä tutkitaan. Tiede kertyy odottamaan.');
  const options = card.getByRole('radiogroup', { name: 'Tutki seuraavaksi' }).getByRole('radio');
  await expect(options).toHaveCount(7);
  const pottery = options.filter({ hasText: 'Keramiikka' });
  await expect(pottery).toContainText('10 tiedettä');
  await expect(pottery).toContainText('Avaa: Viljavarasto');
  await expect(options.filter({ hasText: 'Pronssityö' })).toContainText('Avaa: Falangi, Kolossi, tutkimuksen Rahatalous');
  await expect(card.locator('.research-known')).toHaveText('Ei vielä keksintöjä');
  await page.screenshot({ path: testInfo.outputPath('science.png') });

  // Choose Keramiikka; the rate of gold is 50 % and can change
  await pottery.click();
  await expect(pottery).toHaveAttribute('aria-checked', 'true');
  expect((await state(page)).research.target).toBe('pottery');
  const tax = card.getByRole('radiogroup', { name: 'Kaupasta kultaa, loput tieteeseen' });
  await expect(tax.getByRole('radio', { name: '50 %' })).toBeChecked();
  await tax.getByText('30 %').click();
  expect((await state(page)).tax).toBe(30);
  // Luxury (STORY-046): none at first, and a share can be chosen
  const lux = card.getByRole('radiogroup', { name: /^Kaupasta ylellisyyteen/ });
  await expect(lux.getByRole('radio', { name: '0 %', exact: true })).toBeChecked();
  await lux.getByText('20 %').click();
  expect((await state(page)).lux).toBe(20);
  await lux.getByText('0 %', { exact: true }).click();
  await expect(card.locator('.research-rates')).toHaveText(/^Tiedettä \+\d+\/pv · kultaa [+−]\d+\/pv$/);

  // Learned: a notice, the target is free again and the granary opens in the city card
  // The science pill stays: what is researched and how far, and it opens the card (STORY-052)
  await page.getByRole('button', { name: 'Sulje' }).click();
  const pill = page.getByRole('button', { name: /^Tiede · Keramiikka \d+ %$/ });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(card).toBeVisible();
  await page.evaluate(() => (window as any).globeDebug.addBulbs(10));
  await page.getByRole('button', { name: 'Sulje' }).click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.research.known.includes('pottery'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const s = await state(page);
  expect([s.research.target, s.research.cost]).toEqual([null, 20]);
  await expect(page.getByRole('button', { name: 'Valitse tutkimus', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  await page.getByRole('dialog', { name: 'Luettelo' }).getByRole('button', { name: /^Aamuranta/ }).click();
  const city = page.getByRole('dialog', { name: 'Aamuranta' });
  await expect(city.getByRole('radio', { name: /^Viljavarasto/ })).toBeEnabled();
  await expect(city.getByRole('radio', { name: /^Muuri/ })).toBeDisabled();
  await expect(city.locator('.city-research')).toHaveText('Tutkimus: valitse seuraava');
  // The city card leads to science too
  await city.locator('.city-research').click();
  await expect(card).toBeVisible();
  await expect(card.locator('.research-known')).toHaveText('Tunnetut: Keramiikka');
  await expect(options).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('learned.png') });
  expect(errors).toEqual([]);
});
