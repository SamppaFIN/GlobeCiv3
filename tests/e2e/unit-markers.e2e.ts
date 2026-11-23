import { expect, test, type Page } from '@playwright/test';

/**
 * The player's units above the city areas (STORY-115): a marker of at least 12 px for each
 * unit at the province and state levels, merged with a count where the touch targets would
 * meet, clear of the chips and labels; a tap selects the unit and turns the view to it without
 * going down. The list opens up there too, also when an advisor runs the level, its units by
 * province.
 */

type Rect = { left: number; top: number; right: number; bottom: number };

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

const frames = (page: Page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** The markers, chips and labels on the screen, and the units a marker should stand for. */
const view = (page: Page) => page.evaluate(() => {
  const w = window as any;
  const rect = (e: Element) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const shown = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter(e => !e.hidden && e.offsetParent !== null);
  const top = document.querySelector('.hud-top')!.getBoundingClientRect().bottom;
  const bottomPanel = document.querySelector('.level-bottom:not([hidden])');
  const bottom = bottomPanel ? bottomPanel.getBoundingClientRect().top : innerHeight;
  const units = (w.globeGame.state.units as { name: string; tile: number }[]).filter(u => {
    const at = w.globeDebug.tileScreen(u.tile);
    return at !== null && at[1] > top && at[1] < bottom;
  });
  return {
    band: { top, bottom, width: innerWidth },
    markers: shown('.unit-marker').map(e => ({
      target: rect(e), dot: rect(e.querySelector('.unit-marker-dot')!), label: e.getAttribute('aria-label') ?? '',
      count: Number(e.querySelector('.unit-marker-dot')!.textContent || 1), over: e.classList.contains('unit-marker-over'),
    })),
    chips: shown('.chip').map(rect),
    labels: shown('.city-label').map(rect),
    units: units.map(u => u.name),
  };
});

const meet = (a: Rect, b: Rect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

/** Every unit in view has a marker, of 12 px at least, none under a chip or a label, their targets apart. */
async function checkMarkers(page: Page) {
  const v = await view(page);
  expect(v.markers.reduce((n, m) => n + m.count, 0)).toBe(v.units.length);
  for (const m of v.markers) {
    expect(m.dot.right - m.dot.left).toBeGreaterThanOrEqual(12);
    expect(m.dot.bottom - m.dot.top).toBeGreaterThanOrEqual(12);
  }
  // Between the panels and inside the view, where a tap reaches them (Utu's review)
  for (const m of v.markers) {
    expect(m.dot.left).toBeGreaterThanOrEqual(0);
    expect(m.dot.right).toBeLessThanOrEqual(v.band.width);
    expect(m.dot.top).toBeGreaterThanOrEqual(v.band.top);
    expect(m.dot.bottom).toBeLessThanOrEqual(v.band.bottom);
  }
  const placed = v.markers.filter(m => !m.over);
  for (const m of placed) for (const r of [...v.chips, ...v.labels]) expect(meet(m.dot, r)).toBe(false);
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(meet(placed[i].target, placed[j].target)).toBe(false);
  return v;
}

const near = (page: Page, tile: number) => page.evaluate(t => {
  const at = (window as any).globeDebug.tileScreen(t);
  return at ? Math.hypot(at[0] - innerWidth / 2, at[1] - innerHeight / 2) : Infinity;
}, tile);

for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  test(`${size.name}: every unit shows as a marker above the city areas, a tap turns to it, and the list tells them by province (STORY-115)`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
    await page.goto('./?classic&seed=42');
    await ready;
    await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
    await page.getByRole('button', { name: 'Uusi peli' }).click();
    await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Tauko' }).click();

    // A late game's home state: two cities in each of four provinces, a soldier at each, and three
    // units on one tile
    await mapShare(page, 'province', 0.61);
    await page.evaluate(() => (window as any).globeDebug.rise());
    await page.getByRole('button', { name: 'Myöhemmin' }).click();
    await mapShare(page, 'state', 0.61);
    await page.evaluate(() => (window as any).globeDebug.rise());
    const stack = await page.evaluate(() => {
      const w = window as any;
      const home = Math.floor(w.globeGame.state.startCity / 49);
      const used: number[] = [];
      for (let k = 0; k < 7 && used.length < 4; k++) {
        const p = home * 7 + k;
        if (w.globeDebug.foundIn(p) === null) continue;
        w.globeDebug.foundIn(p);
        used.push(p);
      }
      const cities = w.globeGame.state.cities as { tile: number }[];
      for (const c of cities) w.globeDebug.spawnUnitAt('warrior', c.tile);
      const tile = cities[cities.length - 1].tile;
      w.globeDebug.spawnUnitAt('horseman', tile);
      w.globeDebug.spawnUnitAt('scout', tile);
      // And one alone, in the middle of a province without cities
      const table = w.globeRegions.tileTable();
      const empty = Array.from({ length: 7 }, (_, k) => home * 7 + k).find(p => !used.includes(p))!;
      const inside: number[] = [];
      for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / 7) === empty) inside.push(id);
      w.globeDebug.spawnUnitAt('scout', inside[inside.length >> 1]);
      return tile;
    });
    for (const button of ['Myöhemmin', 'Sulje']) {
      const b = page.getByRole('button', { name: button, exact: true });
      if (await b.isVisible()) await b.click();
    }
    // Still paused, so that the units stand still
    const pause = page.getByRole('button', { name: 'Tauko', exact: true });
    if (await pause.isVisible()) await pause.click();
    await page.keyboard.press('-');
    await arrive(page, 2);
    await page.keyboard.press('-');
    await arrive(page, 1);
    await frames(page);

    // The state level: a marker for every unit, merged where they meet
    const state = await checkMarkers(page);
    expect(state.units.length).toBeGreaterThan(8);
    expect(state.markers.some(m => m.count >= 3)).toBe(true);
    if (size.name === 'desktop') expect(state.markers.filter(m => m.over)).toEqual([]);
    console.log('MARKERS', size.name, JSON.stringify({ units: state.units.length, markers: state.markers.length, over: state.markers.filter(m => m.over).length }));
    await page.screenshot({ path: testInfo.outputPath('state.png') });

    // A single marker: its unit selected, the view turned to it at the same distance
    const dist = await page.evaluate(() => (window as any).globeCamera.dist);
    const single = state.markers.find(m => m.count === 1 && m.target.left > 0 && m.target.right < size.width)!;
    expect(single).toBeTruthy();
    await page.mouse.click((single.target.left + single.target.right) / 2, (single.target.top + single.target.bottom) / 2);
    const picked = await page.evaluate(name => {
      const s = (window as any).globeGame.state;
      return { selected: s.selected, index: (s.units as { name: string }[]).findIndex(u => u.name === name), tile: (s.units as { name: string; tile: number }[]).find(u => u.name === name)!.tile };
    }, single.label);
    expect(picked.selected).toBe(picked.index);
    await frames(page);
    expect(await page.evaluate(() => (window as any).globeLevels.state.level)).toBe(1);
    expect(await page.evaluate(() => (window as any).globeCamera.dist)).toBeCloseTo(dist, 3);
    expect(await near(page, picked.tile)).toBeLessThan(40);

    // The merged marker of the three on one tile gives its units in turn
    const stacked: string[] = await page.evaluate(t => (window as any).globeGame.state.units.filter((u: { tile: number }) => u.tile === t).map((u: { name: string }) => u.name), stack);
    expect(stacked.length).toBeGreaterThanOrEqual(3);
    const namesOf = (label: string) => (label.includes(': ') ? label.split(': ')[1].split('; ') : [label]);
    const selectedName = () => page.evaluate(() => { const s = (window as any).globeGame.state; return s.units[s.selected].name as string; });
    // The marker that holds the stack, found anew for each tap: the view turns, and its group may change
    const tapStack = async () => {
      // Found and tapped in one go: its label may change from one frame to the next
      const label = await page.evaluate(names => {
        const split = (l: string) => (l.includes(': ') ? l.split(': ')[1].split('; ') : [l]);
        const b = [...document.querySelectorAll<HTMLButtonElement>('.unit-marker-many:not([hidden])')].find(e => names.every(n => split(e.getAttribute('aria-label') ?? '').includes(n)));
        b?.click();
        return b?.getAttribute('aria-label') ?? null;
      }, stacked);
      expect(label).not.toBeNull();
      const name = await selectedName();
      expect(namesOf(label!)).toContain(name);
      await frames(page);
      return name;
    };
    // Twice as many taps as the stack holds reach each of its units (Utu's review: the turn went between two)
    const turns: string[] = [];
    for (let tap = 0; tap < 2 * stacked.length; tap++) turns.push(await tapStack());
    for (const n of stacked) expect(turns).toContain(n);
    await frames(page);
    await checkMarkers(page);
    await page.screenshot({ path: testInfo.outputPath('state-picked.png') });

    // The list at the state level, its units by province; a row selects without going down
    await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
    const list = page.getByRole('dialog', { name: 'Luettelo' });
    await expect(list).toBeVisible();
    await list.locator('label', { hasText: /^Yksiköt/ }).click();
    await expect(list.locator('.list-group').first()).toBeVisible();
    const heads = await list.locator('.list-group').allTextContents();
    const total = (await page.evaluate(() => (window as any).globeGame.state.units.length)) as number;
    expect(heads.length).toBeGreaterThan(1);
    expect(heads.reduce((n, h) => n + Number(h.match(/· (\d+) yksikkö/)![1]), 0)).toBe(total);
    expect(new Set(heads.map(h => h.split(' · ')[0])).size).toBe(heads.length);
    await page.screenshot({ path: testInfo.outputPath('list.png') });
    // A city row opens the city's quick panel where the view is
    await list.locator('label', { hasText: /^Kaupungit/ }).click();
    await expect(list.locator('.list-group')).toHaveCount(0);
    const cityRow = list.locator('.list-rows button').first();
    const cityName = (await cityRow.locator('.city-build-name').textContent())!;
    await cityRow.click();
    await expect(list).toBeHidden();
    await expect(page.getByRole('group', { name: `Kaupunki ${cityName}: pikatoiminnot` })).toBeVisible();
    expect(await page.evaluate(() => (window as any).globeLevels.state.level)).toBe(1);
    await page.getByRole('group', { name: `Kaupunki ${cityName}: pikatoiminnot` }).getByRole('button', { name: 'Sulje' }).click();
    await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
    await list.locator('label', { hasText: /^Yksiköt/ }).click();
    await expect(list.locator('.list-group').first()).toBeVisible();
    const row = list.locator('.list-group').nth(1).locator('xpath=following-sibling::button[1]');
    const rowName = (await row.locator('.city-build-name').textContent())!;
    await row.click();
    await expect(list).toBeHidden();
    const chosen = await page.evaluate(name => {
      const s = (window as any).globeGame.state;
      return { selected: s.selected, index: (s.units as { name: string }[]).findIndex(u => u.name === name) };
    }, rowName);
    expect(chosen.selected).toBe(chosen.index);
    expect(await page.evaluate(() => (window as any).globeLevels.state.level)).toBe(1);
    expect(await page.evaluate(() => (window as any).globeCamera.dist)).toBeCloseTo(dist, 3);

    // The province level: the same markers, and none at the city area
    const spot = await page.evaluate(() => {
      const w = window as any;
      const table = w.globeRegions.tileTable();
      const p = Math.floor(table[w.globeGame.state.cities[0].tile] / 7);
      const canvas = document.querySelector('canvas');
      for (let t = 0; t < table.length; t += 3) {
        if (Math.floor(table[t] / 7) !== p) continue;
        const at = w.globeDebug.tileScreen(t);
        if (!at || at[1] < 160 || at[1] > innerHeight - 220 || at[0] < 20 || at[0] > innerWidth - 20) continue;
        if (document.elementFromPoint(at[0], at[1]) === canvas) return at as [number, number];
      }
      return null;
    });
    expect(spot).not.toBeNull();
    await page.mouse.click(spot![0], spot![1]);
    await page.getByRole('button', { name: 'Sukella sisään' }).click();
    await arrive(page, 2);
    await frames(page);
    await checkMarkers(page);
    await page.screenshot({ path: testInfo.outputPath('province.png') });
    // The markers' own JS in the last frames (the 8 ms budget, STORY-115)
    const ms: number[] = await page.evaluate(() => (window as any).globeDebug.markerMs());
    ms.sort((a, b) => a - b);
    console.log('MARKER_MS', size.name, JSON.stringify({ n: ms.length, median: ms[ms.length >> 1], p95: ms[Math.floor(ms.length * 0.95)], max: ms[ms.length - 1] }));
    expect(ms[ms.length >> 1]).toBeLessThan(2);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}

test('the list opens at the province and state levels also when an advisor runs them, and not at the city area (STORY-115)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Valitse neuvonantaja' }).click();
  await page.getByRole('dialog', { name: 'Kuka hoitaa kaupunkiasi?' }).getByRole('button', { name: /Ruokkija/ }).first().click();
  await page.getByRole('dialog', { name: 'Opastus' }).getByRole('button', { name: 'Ohita' }).click();
  await page.getByRole('button', { name: 'Tauko' }).click();
  const listButton = page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' });
  // Each level opened, its card closed, and an advisor chosen for it
  for (const [card, advisor] of [[/kaupunkialue avautui/, /Vartija/], [/lääni avautui/, /Vartija/], [/^Valtio avautui/, /Oppinut/]] as const) {
    await page.evaluate(() => (window as any).globeDebug.rise());
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: card }) });
    await dialog.getByRole('button', { name: 'Myöhemmin' }).click();
    await page.getByRole('dialog', { name: /^Kuka hoitaa/ }).getByRole('button', { name: advisor }).first().click();
  }
  // Down at the city area the advisor keeps the list out of sight (STORY-096)
  await page.waitForFunction(() => (window as any).globeLevels.state.level === 3 && !(window as any).globeLevels.state.flying, null, { timeout: 20_000 });
  await expect(listButton).toBeHidden();
  // Above it the list is there
  for (const level of [2, 1]) {
    await page.keyboard.press('-');
    await arrive(page, level);
    await expect(listButton).toBeVisible();
  }
  await listButton.click();
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  await expect(list).toBeVisible();
  await list.locator('label', { hasText: /^Yksiköt/ }).click();
  await expect(list.locator('.list-group').first()).toBeVisible();
});
