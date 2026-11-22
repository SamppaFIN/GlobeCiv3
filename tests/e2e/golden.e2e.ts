import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { playOf, sha, simOf } from '../golden/hash';

/**
 * Golden runs (STORY-095): seed 42 under three sets of advisors, a day at a time with no
 * clock, the cards decided as an advisor would. The state on days 50, 100 and 200 must stay
 * the same byte for byte while the day's simulation moves out of the browser. GOLDEN_WRITE=1
 * writes tests/golden/seed42.json anew; every run leaves the states in test-results/golden. The
 * same games run in Node come to the same states (src/sim/run.test.ts).
 */
const FILE = 'tests/golden/seed42.json';
const DAYS = [50, 100, 200];
const COMBOS = {
  feed: { town: 'Ruokkija', city: ['growth', 'Kasvattaja'], province: ['settle', 'Asuttaja'], state: ['expand', 'Laajentaja'], planet: ['conquer', 'Valloittaja'] },
  build: { town: 'Rakentaja', city: ['defend', 'Vartija'], province: ['defend', 'Vartija'], state: ['war', 'Kenraali'], planet: ['fortify', 'Linnoittaja'] },
  roam: { town: 'Retkeilijä', city: ['explore', 'Kartoittaja'], province: ['explore', 'Tutkimusmatkailija'], state: ['science', 'Oppinut'], planet: ['explore', 'Löytöretkeilijä'] },
} as const;
type Combo = (typeof COMBOS)[keyof typeof COMBOS];

/** Per run and day: the whole state, the state without the notices (not saved), the game's own state (also without the view's selected unit, as a run in Node has it), and a summary. */
type Golden = Record<string, Record<string, { sha256: string; play: string; sim: string; day: number; cities: number; open: number; gold: number; units: number }>>;

const golden: Golden = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
const write = process.env.GOLDEN_WRITE === '1';

/** A new game of seed 42 under a set of advisors, in step mode from the start. */
async function start(page: Page, combo: Combo) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  // No day passes by the frames from here on: only by step()
  await page.evaluate(() => (window as any).globeDebug.stepMode(true));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeDebug.cityLevel().relief === 1, null, { timeout: 20_000 });
  await page.getByRole('dialog', { name: 'Sinä johdat, kansa rakentaa' }).getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: new RegExp(combo.town) }).first().click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.evaluate(c => {
    const d = (window as any).globeDebug;
    for (const level of ['city', 'province', 'state', 'planet'] as const) d.advise(level, c[level][0]);
  }, combo);
}

/** Step the days until a day, deciding the cards the game stops for as an advisor would; the state then. */
async function playUntil(page: Page, until: number, combo: Combo) {
  const reached = await page.evaluate(([until, c]) => {
    const w = window as any;
    // The advisor cards of a level that opens: the same role as chosen at the start
    const roles: Record<string, string> = { 'Kuka hoitaa kaupunkialuetta?': c.city[1], 'Kuka hoitaa lääniäsi?': c.province[1], 'Kuka hoitaa valtiotasi?': c.state[1], 'Kuka hoitaa suhteet muihin valtioihin?': c.planet[1] };
    // Open cards: a dialog with a button on screen
    const dialogs = () => [...document.querySelectorAll('[role="dialog"]:not([hidden])')].filter(x => [...x.querySelectorAll('button')].some(b => (b as HTMLElement).offsetParent));
    const titleOf = (x: Element) => x.getAttribute('aria-label') ?? (x.getAttribute('aria-labelledby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
    const press = (re: RegExp) => {
      for (const dlg of dialogs()) {
        const b = [...dlg.querySelectorAll('button')].find(x => re.test((x.textContent ?? '').trim()) && (x as HTMLElement).offsetParent) as HTMLButtonElement | undefined;
        if (b) { b.click(); return true; }
      }
      return false;
    };
    // A card the game stops for, decided as an advisor would: the first that fits, in this order
    const decide = () => {
      for (const dlg of dialogs()) {
        const role = roles[titleOf(dlg)];
        if (role && press(new RegExp(`^${role}`))) return true;
      }
      for (const re of [/^Rakenna kaupunki/, /^Lähetä/, /^Osta (soturi|falangi)/, /^Rakenna (soturi|falangi)/, /^Luota/, /^Kieltäydy/, /^Jatka$/, /^Myöhemmin/, /^Sulje$/]) if (press(re)) return true;
      return false;
    };
    let stuck = 0;
    while (w.globeGame.state.day < until) {
      if (w.globeDebug.over()) return w.globeGame.state.day;
      if (w.globeDebug.step()) { stuck = 0; continue; }
      if (!decide() || ++stuck > 20) throw new Error(`stuck on day ${w.globeGame.state.day}: ${dialogs().map(titleOf).join(' | ')}`);
    }
    return w.globeGame.state.day;
  }, [until, combo] as const);
  expect(reached).toBe(until);
  return page.evaluate(() => (window as any).globeDebug.golden()) as Promise<Record<string, unknown>>;
}

for (const [name, combo] of Object.entries(COMBOS)) {
  test(`golden run, seed 42, ${name}`, async ({ page }) => {
    test.setTimeout(600_000);
    await start(page, combo);
    mkdirSync('test-results/golden', { recursive: true });
    const got: Golden[string] = {};
    for (const day of DAYS) {
      const s = await playUntil(page, day, combo);
      writeFileSync(`test-results/golden/${name}-${day}.json`, JSON.stringify(s, null, 1));
      const sum = s as { day: number; cities: unknown[]; progress: { openLevel: number }; gold: number; units: { units: unknown[] } };
      got[day] = { sha256: sha(s), play: sha(playOf(s)), sim: sha(simOf(s)), day: sum.day, cities: sum.cities.length, open: sum.progress.openLevel, gold: sum.gold, units: sum.units.units.length };
    }
    if (write) {
      const all: Golden = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
      all[name] = got;
      mkdirSync('tests/golden', { recursive: true });
      writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`);
      return;
    }
    expect(golden[name], `no golden state for ${name}: run with GOLDEN_WRITE=1`).toBeTruthy();
    for (const day of DAYS) expect(got[day], `${name} on day ${day}`).toEqual(golden[name][day]);
  });
}

test('a game saved on day 100 and continued goes on as the one not stopped, city-states and all (feed)', async ({ page }) => {
  test.setTimeout(600_000);
  test.skip(write, 'compares with the golden file');
  await start(page, COMBOS.feed);
  const before = await playUntil(page, 100, COMBOS.feed);
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.reload();
  await ready;
  await page.evaluate(() => (window as any).globeDebug.stepMode(true));
  await page.getByRole('button', { name: /^Jatka/ }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 20_000 });
  // The city-states and tribes, found anew from the seed, are those of the game before the save
  const loaded = await page.evaluate(() => (window as any).globeDebug.golden()) as Record<string, unknown>;
  expect(loaded.natives).toEqual(before.natives);
  expect(loaded.tribes).toEqual(before.tribes);
  expect(sha(playOf(loaded))).toBe(golden.feed[100].play);
  const end = await playUntil(page, 200, COMBOS.feed);
  writeFileSync('test-results/golden/feed-200-loaded.json', JSON.stringify(end, null, 1));
  expect(sha(playOf(end))).toBe(golden.feed[200].play);
});
