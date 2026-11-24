import { expect, test, type Page } from '@playwright/test';

const level = (page: Page) => page.evaluate(() => (window as any).globeDebug.cityLevel());

/** A new game in the own hand, paused at the city level once the land has risen. */
async function newGame(page: Page, reduced: boolean, errors: string[]) {
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' }).getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /^Ohjaan itse/ }).click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
}

/** Run at 1× and stop as the day turns to `day`, in the frame it turns. */
async function runTo(page: Page, day: number) {
  await page.evaluate(() => (window as any).globeDebug.fastForward(1));
  await page.waitForFunction(d => {
    if ((window as any).globeGame.state.day < d) return false;
    // By the state, not the label: the label follows the clock a frame late (CI 2026-11-24)
    if (!(window as any).globeGame.state.paused) (document.querySelector('.hud-pause') as HTMLButtonElement).click();
    return true;
  }, day, { timeout: 60_000, polling: 'raf' });
  return page.evaluate(() => { const s = (window as any).globeGame.state; return { day: s.day, chain: s.cities[0].chain, buildings: s.cities[0].buildings }; });
}

test('carriers walk the day\'s goods over the risen ground, 24 at most, none with reduced motion, and change nothing (STORY-101)', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const page = await browser.newPage();
  await newGame(page, false, errors);

  // The site takes planks and stone from the centre: carriers walk with them during the day
  await page.evaluate(() => (window as any).globeDebug.fastForward(1));
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().carriers > 0, null, { timeout: 30_000, polling: 'raf' });
  await page.screenshot({ path: testInfo.outputPath('carriers.png') });
  const target: number = (await page.evaluate(() => (window as any).globeGame.state.day)) + 2;
  const walked = await runTo(page, target);

  // 30 asked for, 24 walk; paused at dawn, they stay where they are
  expect(await page.evaluate(() => (window as any).globeDebug.carryTest(30))).toBe(30);
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().carriers === 24, null, { timeout: 5_000, polling: 'raf' });
  await page.screenshot({ path: testInfo.outputPath('carriers-24.png') });

  // The carriers' own JS a frame (24 walking), and the whole frame's main thread with them and without
  const walkMs: number = await page.evaluate(() => (window as any).globeDebug.carryBench(2000));
  const sample = async () => {
    const from: number = await page.evaluate(() => (window as any).globeDebug.frames());
    await page.waitForFunction(f => (window as any).globeDebug.frames() >= f + 30, from, { timeout: 60_000 });
    const ms: number[] = (await page.evaluate(() => (window as any).globeDebug.frameMs())).slice(-30).sort((a: number, b: number) => a - b);
    return { median: ms[15], p95: ms[28] };
  };
  const loaded = await sample();
  await page.evaluate(() => (window as any).globeDebug.carryTest(0));
  const empty = await sample();
  const measured = { walkMs, frame24: loaded, frame0: empty };
  testInfo.annotations.push({ type: 'frame-ms', description: JSON.stringify(measured) });
  console.log('FRAME-MS', JSON.stringify(measured));
  // An absolute frame budget needs a real GPU: here the carriers' own share is checked
  expect(walkMs).toBeLessThan(0.5);

  // With reduced motion: no carriers, and the same day ends in the same state
  await page.close();
  const calm = await browser.newPage();
  await newGame(calm, true, errors);
  await calm.evaluate(() => (window as any).globeDebug.fastForward(1));
  const same = await runTo(calm, target);
  const left = (await level(calm)).carriers;
  // A page of browser.newPage() is not closed by the test runner: left open, its game ran on
  // into the next test and slowed its start past 20 s
  await calm.close();
  expect(left).toBe(0);
  expect(same).toEqual(walked);
  expect(errors).toEqual([]);
});
