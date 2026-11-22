import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** A new game on seed 42 in the player's own hand, paused at the city level. */
async function newGame(page: Page, errors: string[]) {
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
}

test('the science tree: its own button, every advance by what it needs, and each with a picture, what it does and a saying (STORY-109)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await newGame(page, errors);

  // Its own button in the top panel, with the city there is from the start
  await page.getByRole('button', { name: 'Tiedepuu' }).click();
  const tree = page.getByRole('dialog', { name: 'Tiedepuu' });
  await expect(tree).toBeVisible();
  await expect(tree.locator('.science-rates')).toContainText('tunnetaan 0 / 15');
  // Fifteen advances, and a line from each need (eleven needs in all)
  const nodes = tree.locator('.science-node');
  await expect(nodes).toHaveCount(15);
  await expect(tree.locator('.science-line')).toHaveCount(11);
  // Each node has its picture
  await expect(tree.locator('.science-node svg.advance-art')).toHaveCount(15);

  // The first advance open to study is on show: its picture, what it is, what it does and a saying
  const detail = tree.locator('.science-detail');
  await expect(detail.locator('.science-name')).toHaveText('Aakkoset');
  await expect(detail.locator('.science-status')).toHaveText('Voi tutkia · 10 tiedettä');
  await expect(detail.locator('.science-art svg.advance-art')).toBeVisible();
  await expect(detail.locator('.science-what')).toContainText('Oma merkki kullekin äänteelle');
  await expect(detail.locator('.science-effect')).not.toBeEmpty();
  await expect(detail.locator('.science-quote-text')).toContainText('Kadmoksen');
  await expect(detail.locator('.science-quote-who')).toHaveText('— Herodotos, Historiateos 5.58');
  await page.screenshot({ path: testInfo.outputPath('science-tree.png') });

  // An advance that waits: what it needs first, its own saying, and no button
  await nodes.filter({ hasText: 'Kirjoitus' }).click();
  await expect(detail.locator('.science-name')).toHaveText('Kirjoitus');
  await expect(detail.locator('.science-status')).toHaveText('Vaatii ensin: Aakkoset');
  await expect(detail.locator('.science-quote-who')).toContainText('Platon');
  await expect(detail.getByRole('button', { name: 'Tutki tätä' })).toBeHidden();
  await expect(nodes.filter({ hasText: 'Kirjoitus' })).toHaveAttribute('aria-pressed', 'true');
  // One from a resource tells the resource
  await nodes.filter({ hasText: 'Ratsastus' }).click();
  await expect(detail.locator('.science-status')).toContainText('resurssin');

  // The effect's links lead to the Tietokirja, over the tree
  await nodes.filter({ hasText: 'Kirjoitus' }).click();
  await detail.locator('.science-effect .rich-link').first().click();
  const codex = page.getByRole('dialog', { name: 'Tietokirja' });
  await expect(codex).toBeVisible();
  await codex.getByRole('button', { name: 'Sulje Tietokirja' }).click();
  await expect(tree).toBeVisible();

  // An advance open to study is chosen from the tree: a command, and the node tells it
  await nodes.filter({ hasText: 'Aakkoset' }).click();
  await detail.getByRole('button', { name: 'Tutki tätä' }).click();
  await expect.poll(async () => (await state(page)).research.target).toBe('alphabet');
  expect((await state(page)).commands.at(-1)).toMatchObject({ by: 'player', kind: 'study' });
  await expect(nodes.filter({ hasText: 'Aakkoset' }).locator('.science-node-state')).toHaveText('Tutkitaan 0 %');
  await expect(detail.locator('.science-status')).toHaveText(/^Tutkitaan 0 \/ 10/);
  await expect(detail.getByRole('button', { name: 'Tutki tätä' })).toBeHidden();

  // A known advance lights its lines
  await page.evaluate(() => (window as any).globeDebug.learn('alphabet'));
  await expect(nodes.filter({ hasText: 'Aakkoset' }).locator('.science-node-state')).toHaveText('Tunnettu');
  await expect(tree.locator('.science-line-known')).toHaveCount(4);
  await expect(tree.locator('.science-rates')).toContainText('tunnetaan 1 / 15');

  // Escape closes it
  await page.keyboard.press('Escape');
  await expect(tree).toBeHidden();
  expect(errors).toEqual([]);
});

test('the science tree fits a phone: three columns in its width, nodes big enough to tap (STORY-109)', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  await newGame(page, errors);
  // The top row keeps its room in the player's own hand, the button beside the list: the day sits on the panel's corner
  const top = await page.evaluate(() => {
    const row = document.querySelector('.hud-top .hud-row') as HTMLElement;
    const day = (document.querySelector('.hud-day') as HTMLElement).getBoundingClientRect();
    return { scroll: row.scrollWidth, client: row.clientWidth, day: { left: day.left, right: day.right, top: day.top } };
  });
  expect(top.scroll).toBeLessThanOrEqual(top.client);
  expect(top.day.left).toBeGreaterThanOrEqual(0);
  expect(top.day.right).toBeLessThanOrEqual(390);
  expect(top.day.top).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Tiedepuu' }).click();
  const tree = page.getByRole('dialog', { name: 'Tiedepuu' });
  await expect(tree).toBeVisible();
  const fit = await tree.locator('.science-scroll').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(fit.scroll).toBeLessThanOrEqual(fit.client);
  for (const box of await tree.locator('.science-node').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ w: r.width, h: r.height })))) {
    expect(box.w).toBeGreaterThanOrEqual(44);
    expect(box.h).toBeGreaterThanOrEqual(44);
  }
  // Every name fits its node
  const cut = await tree.locator('.science-node').evaluateAll(els => els.filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  expect(cut).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('science-tree-phone.png') });
  await tree.locator('.science-scroll').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('science-tree-phone-tree.png') });
  expect(errors).toEqual([]);
});
