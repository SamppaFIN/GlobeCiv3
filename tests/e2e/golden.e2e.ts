import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Golden runs (STORY-095): seed 42 under three sets of advisors, a day at a time with no
 * clock, the cards decided as an advisor would. The state on days 50, 100 and 200 must stay
 * the same byte for byte while the day's simulation moves out of the browser. GOLDEN_WRITE=1
 * writes tests/golden/seed42.json anew; every run leaves the states in test-results/golden.
 */
const FILE = 'tests/golden/seed42.json';
const DAYS = [50, 100, 200];
const COMBOS = {
  feed: { town: 'Ruokkija', city: ['growth', 'Kasvattaja'], province: ['settle', 'Asuttaja'], state: ['expand', 'Laajentaja'], planet: ['conquer', 'Valloittaja'] },
  build: { town: 'Rakentaja', city: ['defend', 'Vartija'], province: ['defend', 'Vartija'], state: ['war', 'Kenraali'], planet: ['fortify', 'Linnoittaja'] },
  roam: { town: 'Retkeilijä', city: ['explore', 'Kartoittaja'], province: ['explore', 'Tutkimusmatkailija'], state: ['science', 'Oppinut'], planet: ['explore', 'Löytöretkeilijä'] },
} as const;

type Golden = Record<string, Record<string, { sha256: string; day: number; cities: number; open: number; gold: number; units: number }>>;

/** JSON with every object's keys sorted, so the order fields are built in does not count. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

const golden: Golden = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
const write = process.env.GOLDEN_WRITE === '1';

for (const [name, combo] of Object.entries(COMBOS)) {
  test(`golden run, seed 42, ${name}`, async ({ page }) => {
    test.setTimeout(600_000);
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

    const states: Record<number, unknown> = {};
    for (const day of DAYS) {
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
          for (const re of [/^Rakenna kaupunki/, /^Lähetä/, /^Osta soturi/, /^Rakenna soturi/, /^Luota/, /^Jatka$/, /^Myöhemmin/, /^Sulje$/]) if (press(re)) return true;
          return false;
        };
        let stuck = 0;
        while (w.globeGame.state.day < until) {
          if (w.globeDebug.over()) return w.globeGame.state.day;
          if (w.globeDebug.step()) { stuck = 0; continue; }
          if (!decide() || ++stuck > 20) throw new Error(`stuck on day ${w.globeGame.state.day}: ${dialogs().map(titleOf).join(' | ')}`);
        }
        return w.globeGame.state.day;
      }, [day, combo] as const);
      expect(reached).toBe(day);
      states[day] = await page.evaluate(() => (window as any).globeDebug.golden());
    }

    mkdirSync('test-results/golden', { recursive: true });
    const got: Golden[string] = {};
    for (const day of DAYS) {
      const s = states[day] as { day: number; cities: unknown[]; progress: { openLevel: number }; gold: number; units: { units: unknown[] } };
      const text = canonical(s);
      writeFileSync(`test-results/golden/${name}-${day}.json`, JSON.stringify(s, null, 1));
      got[day] = { sha256: createHash('sha256').update(text).digest('hex'), day: s.day, cities: s.cities.length, open: s.progress.openLevel, gold: s.gold, units: s.units.units.length };
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
