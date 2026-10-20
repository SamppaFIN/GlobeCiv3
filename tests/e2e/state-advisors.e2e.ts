import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Map a share of the home province or state through the test hook. */
const mapShare = (page: Page, region: 'province' | 'state', share: number) => page.evaluate(([r, s]) => {
  const w = window as any;
  const div = r === 'province' ? 7 : 49;
  const home = Math.floor(w.globeGame.state.startCity / div);
  const table = w.globeRegions.tileTable();
  const ids: number[] = [];
  for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / div) === home) ids.push(id);
  const target = Math.ceil(ids.length * (s as number));
  const missing = ids.filter(id => !w.globeMap.isMapped(id));
  w.globeDebug.reveal(missing.slice(0, Math.max(0, target - (ids.length - missing.length))));
}, [region, share] as const);

const arrive = (page: Page, level: number) => page.waitForFunction(l => {
  const s = (window as any).globeLevels.state;
  return s.level === l && !s.flying;
}, level, { timeout: 20_000 });

test('state advisors: science, taxes, the line, the revolution and the target province', async ({ page }, testInfo) => {
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
  await page.getByRole('button', { name: 'Tauko' }).click();
  await mapShare(page, 'province', 0.61);
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.keyboard.press('-');
  await arrive(page, 2);
  await mapShare(page, 'state', 0.61);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 1);

  await page.getByRole('button', { name: 'Neuvonantaja: Oma ohjaus' }).click();
  const card = page.getByRole('dialog', { name: 'Neuvonantaja' });
  await expect(card.locator('.advisor-level')).toHaveText('Valtio');
  const options = card.getByRole('radio');
  await expect(options).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('state-advisors.png') });

  // Oppinut: the line Tutkimus, tax 30 %, writing first; and the revolution once Monarchy is known
  await options.filter({ hasText: 'Oppinut' }).click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => {
    const s = (window as any).globeGame.state;
    return s.stateLine === 'research' && s.tax === 30 && s.research.target === 'alphabet';
  }, null, { timeout: 30_000 });
  await expect(card.locator('.advisor-log')).toContainText('tutkitaan: Aakkoset');
  await page.evaluate(() => (window as any).globeDebug.learn('monarchy'));
  await expect(card.locator('.advisor-log')).toContainText('vallankumous Monarkiaan', { timeout: 30_000 });
  await page.waitForFunction(() => (window as any).globeGame.state.gov === 'monarchy', null, { timeout: 60_000 });

  // Laajentaja: the line Laajentuminen, tax 50 %, and a target province under 60 % mapped
  await options.filter({ hasText: 'Laajentaja' }).click();
  await page.waitForFunction(() => {
    const s = (window as any).globeGame.state;
    return s.stateLine === 'expand' && s.tax === 50 && s.targetProvince >= 0;
  }, null, { timeout: 30_000 });
  await expect(card.locator('.advisor-log')).toContainText('tavoitelääni:');

  // Kenraali: the line Puolustus and tax 70 %
  await options.filter({ hasText: 'Kenraali' }).click();
  await page.waitForFunction(() => {
    const s = (window as any).globeGame.state;
    return s.stateLine === 'defend' && s.tax === 70;
  }, null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect((await state(page)).stateAdvisor).toBe('war');
  await expect(page.getByRole('button', { name: 'Neuvonantaja: Kenraali' })).toBeVisible();
  expect(errors).toEqual([]);
});
