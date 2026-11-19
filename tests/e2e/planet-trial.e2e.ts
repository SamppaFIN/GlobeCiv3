import { expect, test, type Page } from '@playwright/test';

const war = (page: Page) => page.evaluate(() => {
  const w = (window as any).globeWar.world;
  return { day: w.day as number, tension: w.tension as number, people: w.leaders.map((l: any) => l.people) as number[], log: w.log as string[] };
});

test('?planet: five leaders on the globe, an envoy before the weapons, and a missile once the tension opens them (STORY-097)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?planet&seed=42');
  await ready;

  const panel = page.getByRole('region', { name: 'Johtajien sota' });
  await expect(panel).toBeVisible();
  const leaders = panel.getByRole('list', { name: 'Johtajat' }).getByRole('button');
  await expect(leaders).toHaveCount(5);
  await expect(leaders.first()).toContainText('Sinä');
  await expect(panel.locator('.nuclear-tension-value')).toContainText('/ 60');
  // The realms on the globe: a capital for each leader
  await expect(page.locator('.nuclear-capital:not([hidden])').first()).toBeVisible();

  // Before the weapons: an envoy, then the next act waits
  await panel.getByRole('button', { name: 'Tauko' }).click();
  await leaders.nth(2).click();
  await expect(leaders.nth(2)).toHaveAttribute('aria-pressed', 'true');
  const acts = panel.getByRole('group', { name: 'Sinun tekosi' });
  await expect(acts.getByRole('button')).toHaveText(['Lähettiläs', 'Propaganda', 'Hyökkäys']);
  await acts.getByRole('button', { name: 'Lähettiläs' }).click();
  await expect(panel.locator('.nuclear-log li').first()).toHaveText('Lähettiläs: Sinä → Kuningatar Kuura');
  await expect(acts.getByRole('button', { name: 'Lähettiläs' })).toBeDisabled();
  await expect(acts.locator('.nuclear-ready')).toContainText('Seuraava tekosi');
  await page.screenshot({ path: testInfo.outputPath('planet-trial.png') });

  // Days pass by the clock
  await panel.getByText('4×').click();
  await page.waitForFunction(() => (window as any).globeWar.world.day >= 5, null, { timeout: 30_000 });
  await panel.getByRole('button', { name: 'Tauko' }).click();

  // High tension opens the missiles and their defence; a missile takes people
  await page.evaluate(() => {
    const w = (window as any).globeWar.world;
    w.tension = 70;
    w.leaders[0].missiles = 1;
    w.leaders[0].ready = w.day;
    w.leaders[3].shields = 0;
  });
  await leaders.nth(3).click();
  await expect(acts.getByRole('button')).toHaveText(['Lähettiläs', 'Propaganda', 'Ohjusisku', 'Rakenna ohjus', 'Rakenna torjunta']);
  const before = (await war(page)).people[3];
  await acts.getByRole('button', { name: 'Ohjusisku' }).click();
  await expect(panel.locator('.nuclear-log li').first()).toContainText('Ohjusisku: Sinä → Pääministeri Huuhkaja');
  expect((await war(page)).people[3]).toBeLessThan(before * 0.86);
  for (const b of await panel.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await page.screenshot({ path: testInfo.outputPath('planet-trial-missile.png') });
  expect(errors).toEqual([]);
});

test('the trial leaves the game alone: no war without ?planet', async ({ page }) => {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await expect(page.getByRole('button', { name: 'Uusi peli' })).toBeVisible();
  await expect(page.locator('.nuclear')).toHaveCount(0);
  expect(await page.evaluate(() => 'globeWar' in window)).toBe(false);
});
