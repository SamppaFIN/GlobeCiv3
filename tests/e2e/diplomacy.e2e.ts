import { expect, test, type Page } from '@playwright/test';

type Tie = { name: string; met: boolean; state: 'peace' | 'war' | 'alliance'; attitude: number; since: number };
const ties = (page: Page) => page.evaluate(() => (window as any).globeDebug.ties() as Tie[]);
const watchNotices = (page: Page) => page.evaluate(() => {
  const w = window as any;
  const el = document.querySelector('.hud-notice')!;
  w.notices = [];
  new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) w.notices.push(n.textContent); }).observe(el, { childList: true });
});
const notices = (page: Page) => page.evaluate(() => (window as any).notices as string[]);

test('a rival met has a diplomacy card: its ties and attitude, war, peace and an alliance, its own proposals, and the save', async ({ page }, testInfo) => {
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
  await watchNotices(page);
  await page.evaluate(() => (window as any).globeDebug.fastForward(8));
  await page.waitForFunction(() => (window as any).globeDebug.rivals().length && (window as any).globeDebug.rivals()[0].cities.length > 0, null, { timeout: 60_000 });
  expect((await ties(page))[0].met).toBe(false);

  // Its capital on the map: met the next day
  const rival = await page.evaluate(() => {
    const w = window as any;
    const r = w.globeDebug.rivals()[0];
    const t = r.cities[0].tile;
    w.globeDebug.reveal([t, ...w.globeHexTiles.neighbors(t)]);
    return { name: r.name as string, tile: t as number };
  });
  await page.waitForFunction(() => (window as any).globeDebug.ties()[0].met, null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  if (await page.getByRole('button', { name: 'Myöhemmin' }).isVisible()) await page.getByRole('button', { name: 'Myöhemmin' }).click();
  expect(await notices(page)).toContain(`Tapasitte kilpailijan: ${rival.name} · diplomatia luettelossa`);

  // The list's Diplomatia tab opens its card
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  await list.getByText('Diplomatia', { exact: true }).click();
  await list.locator('.list-row', { hasText: rival.name }).click();
  const card = page.getByRole('dialog', { name: rival.name });
  await expect(card).toBeVisible();
  await expect(card.locator('.tile-kicker')).toHaveText('Diplomatia');
  await expect(card.locator('.tile-rows')).toContainText(/Suhde\s*rauha · \d+ pv/);
  await expect(card.locator('.tile-rows')).toContainText(/Asenne\s*varautunut \([+-]?\d+\)/);
  await expect(card.locator('.tile-rows')).toContainText(/Kaupungit\s*\S+ \(\d+\) · 1 tunnettua/);
  await expect(card.locator('.tile-rows')).toContainText(/Sotavoima\s*\d+ soturia/);
  await page.screenshot({ path: testInfo.outputPath('diplomacy.png') });

  // An alliance: refused while it is wary, accepted when it is friendly; then broken
  await card.getByRole('button', { name: 'Ehdota liittoa' }).click();
  await expect.poll(async () => (await notices(page)).at(-1)).toMatch(new RegExp(`^${rival.name} kieltäytyi · asenne varautunut`));
  expect((await ties(page))[0].state).toBe('peace');
  await page.evaluate(() => (window as any).globeDebug.setAttitude(0, 70));
  await expect(card.locator('.tile-rows')).toContainText('ystävällinen (+70)');
  await card.getByRole('button', { name: 'Ehdota liittoa' }).click();
  await expect.poll(async () => (await ties(page))[0].state).toBe('alliance');
  await card.getByRole('button', { name: 'Pura liitto' }).click();
  await expect.poll(async () => (await ties(page))[0]).toMatchObject({ state: 'peace', attitude: 50 });

  // War declared costs 50; peace is refused before ten days of war
  await card.getByRole('button', { name: 'Julista sota' }).click();
  await expect.poll(async () => (await ties(page))[0]).toMatchObject({ state: 'war', attitude: 0 });
  await expect(card.locator('.tile-rows')).toContainText(/Rauha\s*ei ennen kuin sota on kestänyt 10 päivää/);
  await card.getByRole('button', { name: 'Ehdota rauhaa' }).click();
  expect((await ties(page))[0].state).toBe('war');
  await card.getByRole('button', { name: 'Sulje' }).click();

  // After twenty days of war, not too hostile, the rival proposes peace on a card that stops the game
  await page.getByRole('button', { name: 'Jatka', exact: true }).click();
  await page.evaluate(() => (window as any).globeDebug.fastForward(8));
  const proposal = page.getByRole('dialog').filter({ hasText: 'Rauhanehdotus' });
  await expect(proposal).toBeVisible({ timeout: 90_000 });
  const day = await page.evaluate(() => (window as any).globeGame.state.day);
  await expect(proposal).toContainText('Rauhassa asenne palaa vähitellen kohti varautunutta.');
  await page.screenshot({ path: testInfo.outputPath('peace-proposal.png') });
  await proposal.getByRole('button', { name: /Tee rauha/ }).click();
  await expect.poll(async () => (await ties(page))[0].state).toBe('peace');
  expect((await ties(page))[0].since).toBeGreaterThanOrEqual(day);

  // The ties are saved (a save takes the speeds 1, 2 and 4)
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.getByRole('button', { name: 'Tauko' }).click();
  const before = (await ties(page))[0];
  await page.evaluate(() => (window as any).globeDebug.saveNow());
  const ready2 = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.reload();
  await ready2;
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  expect((await ties(page))[0]).toMatchObject({ met: true, state: 'peace', attitude: before.attitude, since: before.since });
  expect(errors).toEqual([]);
});
