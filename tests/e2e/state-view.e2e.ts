import { expect, test, type Page } from '@playwright/test';

/**
 * The state level's view of a late game (STORY-114): a province's chip tells its cities, its
 * card lists them all as links to their quick panels without flying down, and the city labels
 * keep off the chips and off each other, at a phone's size and a desktop's.
 */

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

/** The chips and the shown city labels as rectangles on the screen, and the labels' names. */
const shownRects = (page: Page) => page.evaluate(() => {
  const rect = (e: Element) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const shown = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter(e => !e.hidden && e.offsetParent !== null);
  return {
    chips: shown('.chip').map(rect),
    labels: shown('.city-label').map(e => ({ ...rect(e), name: e.querySelector('.city-label-name')?.textContent ?? '' })),
  };
});

/** Pairs of rectangles that overlap by more than a pixel. */
function overlapping(rects: { left: number; top: number; right: number; bottom: number }[]) {
  const pairs: [number, number][] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) pairs.push([i, j]);
    }
  }
  return pairs;
}

for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  test(`${size.name}: the state level tells the cities by province, and no label covers a chip or a label (STORY-114)`, async ({ page }, testInfo) => {
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

    // A late game's home state: the province and state levels open, three, two, one and three
    // cities in four provinces, of different sizes
    await mapShare(page, 'province', 0.61);
    await page.evaluate(() => (window as any).globeDebug.rise());
    await page.getByRole('button', { name: 'Myöhemmin' }).click();
    await mapShare(page, 'state', 0.61);
    await page.evaluate(() => (window as any).globeDebug.rise());
    const provinces = await page.evaluate(() => {
      const w = window as any;
      const home = Math.floor(w.globeGame.state.startCity / 49);
      const used: number[] = [];
      const many = [3, 2, 1, 3];
      for (let k = 0; k < 7 && used.length < 4; k++) {
        const p = home * 7 + k;
        if (w.globeDebug.foundIn(p) === null) continue;
        for (let n = 1; n < many[used.length]; n++) w.globeDebug.foundIn(p);
        used.push(p);
      }
      (w.globeGame.state.cities as unknown[]).forEach((_, i) => w.globeDebug.setCitySize(i, 1 + ((i * 3) % 5)));
      return used;
    });
    expect(provinces.length).toBe(4);
    for (const button of ['Myöhemmin', 'Jatka', 'Sulje']) {
      const b = page.getByRole('button', { name: button, exact: true });
      if (await b.isVisible()) await b.click();
    }
    await page.keyboard.press('-');
    await arrive(page, 2);
    await page.keyboard.press('-');
    await arrive(page, 1);

    // Each held province's chip tells its cities
    const counts = await page.evaluate(ps => {
      const w = window as any;
      const cities = w.globeGame.state.cities as { tile: number }[];
      const table = w.globeRegions.tileTable();
      return (ps as number[]).map(p => cities.filter(c => Math.floor(table[c.tile] / 7) === p).length);
    }, provinces);
    expect(new Set(counts).size).toBeGreaterThan(1);
    for (const [k, p] of provinces.entries()) {
      const name = await page.evaluate(id => (window as any).globeDebug.regionView(1, id).title, p);
      const chip = page.locator('.chip:not([hidden])').filter({ has: page.locator('.chip-name', { hasText: new RegExp(`^${name}$`) }) });
      await expect(chip.locator('.chip-sub')).toHaveText(new RegExp(`^${counts[k]} ${counts[k] === 1 ? 'kaupunki' : 'kaupunkia'}`));
    }

    // The labels: a province's one is its capital, else its largest city (the first of equals),
    // and nothing on top of anything
    const { chips, labels } = await shownRects(page);
    const { expected, capital } = await page.evaluate(() => {
      const w = window as any;
      const table = w.globeRegions.tileTable();
      const best = new Map<number, { name: string; size: number; capital: boolean }>();
      for (const c of w.globeGame.state.cities as { name: string; size: number; tile: number; capital: boolean }[]) {
        const p = Math.floor(table[c.tile] / 7);
        const b = best.get(p);
        if (!b || (!b.capital && (c.capital || b.size < c.size))) best.set(p, c);
      }
      return { expected: [...best.values()].map(c => c.name), capital: (w.globeGame.state.cities as { name: string; capital: boolean }[]).find(c => c.capital)!.name };
    });
    const ownNames = await page.evaluate(() => (window as any).globeGame.state.cities.map((c: { name: string }) => c.name));
    const own = labels.filter(x => (ownNames as string[]).includes(x.name));
    for (const l of own) expect(expected).toContain(l.name);
    // On a desktop there is room for the capital's; on a phone the chips may take it all, and the chips tell the cities
    if (size.name === 'desktop') expect(own.map(l => l.name)).toContain(capital);
    expect(overlapping([...chips, ...labels])).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('state.png') });

    // A held province's card lists all its cities; a city opens its quick panel where the view is
    const target = provinces[counts.indexOf(Math.max(...counts))];
    const freeSpot = () => page.evaluate(p => {
      const w = window as any;
      const table = w.globeRegions.tileTable();
      const canvas = document.querySelector('canvas');
      for (let t = 0; t < table.length; t += 3) {
        if (Math.floor(table[t] / 7) !== p) continue;
        const q = w.globeHexTiles.tileCenter(t).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
        const x = ((q.x + 1) / 2) * innerWidth, y = ((1 - q.y) / 2) * innerHeight;
        if (x < 20 || y < 120 || x > innerWidth - 20 || y > innerHeight - 200) continue;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
      return null;
    }, target);
    const spot = await freeSpot();
    expect(spot).not.toBeNull();
    await page.mouse.click(spot!.x, spot!.y);
    const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
    await expect(card).toBeVisible();
    await expect(card.locator('.tile-kicker')).toHaveText(/^Lääni · /);
    const links = card.locator('.tile-rows .rich-city');
    await expect(links).toHaveCount(Math.max(...counts));
    await page.screenshot({ path: testInfo.outputPath('province-card.png') });
    const dist = await page.evaluate(() => (window as any).globeCamera.dist);
    const name = (await links.first().textContent())!;
    await links.first().click();
    await expect(card).toBeHidden();
    await expect(page.getByRole('group', { name: `Kaupunki ${name}: pikatoiminnot` })).toBeVisible();
    expect(await page.evaluate(() => (window as any).globeLevels.state.level)).toBe(1);
    expect(await page.evaluate(() => (window as any).globeCamera.dist)).toBeCloseTo(dist, 3);
    // Its label shows with the panel, which may cover a chip; the other labels still cover nothing
    await expect(page.locator('.city-label:not([hidden])', { hasText: name })).toBeVisible();
    const after = await shownRects(page);
    expect(overlapping([...after.chips, ...after.labels.filter(l => l.name !== name)])).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('quick.png') });

    // The province level: the province's own cities, clear of the chips
    const quick = page.getByRole('group', { name: /pikatoiminnot/ });
    await quick.getByRole('button', { name: 'Sulje' }).click();
    // The labels move back when the panel closes, so the map is looked for again
    await expect(quick).toBeHidden();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const again = await freeSpot();
    expect(again).not.toBeNull();
    await page.mouse.click(again!.x, again!.y);
    await page.mouse.click(again!.x, again!.y);
    await arrive(page, 2);
    const inProvince = await page.evaluate(() => {
      const w = window as any;
      const table = w.globeRegions.tileTable();
      const p = w.globeLevels.state.path[1]?.id;
      return (w.globeGame.state.cities as { name: string; tile: number }[]).filter(c => Math.floor(table[c.tile] / 7) === p).map(c => c.name);
    });
    const province = await shownRects(page);
    const ownInProvince = province.labels.filter(x => (ownNames as string[]).includes(x.name));
    for (const l of ownInProvince) expect(inProvince).toContain(l.name);
    if (size.name === 'desktop') expect(ownInProvince.length).toBeGreaterThan(0);
    expect(overlapping([...province.chips, ...province.labels])).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('province.png') });

    // The city area below: every label as before (rule 10.6: the third level's picture)
    const inner = await freeSpot();
    expect(inner).not.toBeNull();
    // The area's card goes in (a second tap may land on the card on a desktop)
    await page.mouse.click(inner!.x, inner!.y);
    await page.getByRole('button', { name: 'Sukella sisään' }).click();
    await arrive(page, 3);
    await page.screenshot({ path: testInfo.outputPath('area.png') });
    expect(errors).toEqual([]);
  });
}
