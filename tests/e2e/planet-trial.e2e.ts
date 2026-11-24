import { expect, test, type Page } from '@playwright/test';

const ready = (page: Page) => page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 30_000 });
const phase = (page: Page) => page.evaluate(() => (window as any).globeWar.phase as string);
/** The computer's leaders lay down their defences, so the player's strike lands (a test's war). */
const disarm = (page: Page) => page.evaluate(() => { for (const l of (window as any).globeWar.war.leaders.slice(0, 4)) l.defenses = [0, 0]; });
const roundDone = (page: Page) => page.waitForFunction(() => ['orders', 'end'].includes((window as any).globeWar.phase), null, { timeout: 120_000 });

/**
 * A tap on a foe's living country that shows above the panel, a little below its city's label
 * (the label marks the state's centre). Returns the city's name.
 */
async function tapFoeCountry(page: Page): Promise<string> {
  const panel = (await page.getByRole('region', { name: 'Ydinsota' }).boundingBox())!;
  const width = page.viewportSize()!.width;
  // A side panel (desktop) bounds the globe on the right, a bottom panel (phone) from below
  const side = panel.x > width / 2;
  const right = side ? panel.x - 10 : width - 10;
  const bottom = side ? page.viewportSize()!.height - 10 : panel.y;
  for (const mark of await page.locator('.nw-city:not([hidden]):not(.ruins)').all()) {
    if ((await mark.getAttribute('data-leader')) === '4') continue;
    const b = await mark.boundingBox();
    if (!b || b.y < 120 || b.y + 40 > bottom || b.x < 10 || b.x + b.width > right) continue;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2 + 18);
    return (await mark.textContent())!.replace(/ \d+$/, '');
  }
  throw new Error('no foe country in view');
}

/** The people each leader's row shows equal the war's own. */
async function rowMatchesWar(page: Page) {
  const shown = await page.locator('.nw-leader-people').allTextContents();
  const real = await page.evaluate(() => (window as any).globeWar.war.leaders.map((l: any) => l.cities.reduce((s: number, c: any) => s + c.people, 0)));
  expect(shown).toEqual(real.map((n: number) => `${n} milj.`));
}

async function startWar(page: Page, names?: RegExp[]) {
  const gallery = page.getByRole('region', { name: 'Valitse vastustajat' });
  await expect(gallery.getByRole('group', { name: 'Johtajat' }).getByRole('button')).toHaveCount(10);
  for (const b of await gallery.getByRole('button').all()) if (await b.isVisible()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  if (names) {
    for (const n of names) await gallery.getByRole('button', { name: n }).click();
  } else {
    await gallery.getByRole('button', { name: /Kenraali Ruutiparta/ }).click();
    await gallery.getByRole('button', { name: /Ministeri Megafoni/ }).click();
    await expect(gallery.getByText('Valittu 2 / 4')).toBeVisible();
    await expect(gallery.getByRole('button', { name: 'Sotaan!' })).toBeDisabled();
    await gallery.getByRole('button', { name: 'Arvo loput' }).click();
  }
  await expect(gallery.getByText('Valittu 4 / 4')).toBeVisible();
  await gallery.getByRole('button', { name: 'Sotaan!' }).click();
  await expect(gallery).toBeHidden();
  return page.getByRole('region', { name: 'Ydinsota' });
}

test('?planet: four opponents from the gallery, a missile loaded and launched on the globe, rounds played back (STORY-126)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  const r = ready(page);
  await page.goto('./?planet&seed=42');
  await r;
  await page.screenshot({ path: testInfo.outputPath('war-gallery.png') });
  const war = await startWar(page);
  const leaders = war.getByRole('list', { name: 'Johtajat' }).getByRole('listitem');
  await expect(leaders).toHaveCount(5);
  await expect(leaders.nth(0)).toContainText('Kenraali Ruutiparta');
  await expect(leaders.nth(4)).toContainText('Sinä');
  // Each leader has five cities on the globe, named and counted
  await expect(page.locator('.nw-city:not([hidden])').first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).globeWar.war.leaders.every((l: any) => l.cities.length === 5))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('war-start.png') });

  // Load a missile: the order is put together from the panel
  const acts = war.getByRole('group', { name: 'Tekosi tällä kierroksella' });
  await acts.getByRole('button', { name: 'Lataa ohjus' }).click();
  await war.getByRole('group', { name: 'Mikä ohjus?' }).getByRole('button', { name: /Kiitäjä · 10 Mt/ }).click();
  await expect(war.locator('.nw-summary')).toContainText('Laukaiset sen seuraavalla kierroksella');
  await war.getByRole('button', { name: 'Valmis' }).click();
  expect(await phase(page)).toBe('playback');
  await expect(war.getByRole('button', { name: 'Ohita' })).toBeVisible();
  await roundDone(page);
  await expect(war.getByRole('list', { name: 'Tapahtumat' }).getByRole('listitem').first()).toBeVisible();
  // A whole playback ends where the war is
  await rowMatchesWar(page);

  // Launch it at a foe's city from the list; the flight lasts its seconds on the wall clock (rule 5)
  await disarm(page);
  await acts.getByRole('button', { name: 'Laukaise' }).click();
  await war.getByRole('group', { name: 'Mikä kärki?' }).getByRole('button', { name: /^10 Mt/ }).click();
  const targets = war.locator('.nw-targets .nw-choice');
  const aim = (await targets.first().textContent())!.split(' · ')[0];
  await targets.first().click();
  await expect(war.locator('.nw-summary')).toContainText('ohjuksella kohti kaupunkia');
  // Every frame draws the missile's share of the way by the wall clock at the frame's own time
  // (rule 5): a slow frame neither stretches nor shortens it
  const frames = page.evaluate(() => new Promise<{ shown: number; due: number; seconds: number }[]>(done => {
    const seen: { shown: number; due: number; seconds: number }[] = [];
    let started = false;
    const look = (ts: number) => {
      const f = (window as any).globeWar.strikes().flights.find((x: any) => x.kind === 'missile');
      if (f) {
        started = true;
        if (f.shown > 0) seen.push({ shown: f.shown, due: Math.min(f.end, (ts - f.start) / 1000 / f.seconds), seconds: f.seconds });
      } else if (started) return done(seen);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }));
  await war.getByRole('button', { name: 'Valmis' }).click();
  await page.waitForFunction(() => (window as any).globeWar.strikes().flights.some((f: any) => f.kind === 'missile'), null, { timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath('war-missile.png') });
  const seen = await frames;
  expect(seen.length).toBeGreaterThan(0);
  for (const f of seen) {
    expect(f.seconds).toBeCloseTo(1.8, 5);
    expect(Math.abs(f.shown - f.due)).toBeLessThan(0.02);
  }
  expect(seen.at(-1)!.shown).toBe(1);
  await roundDone(page);
  expect(await page.evaluate(() => (window as any).globeWar.war.orders.at(-1).kind)).toBe('launch');
  // The log tells where the player's warhead went
  await expect(war.getByRole('list', { name: 'Tapahtumat' })).toContainText(`10 Mt kohti kaupunkia ${aim}`);

  // A tap on a foe's country opens its bubble, and its order goes at a tap
  const foeState = await tapFoeCountry(page);
  const pop = page.getByRole('dialog', { name: 'Kaupunki' });
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(foeState);
  await page.screenshot({ path: testInfo.outputPath('war-pop.png') });
  await pop.getByRole('button', { name: 'Propaganda' }).click();
  await expect(pop).toBeHidden();
  expect(await page.evaluate(() => (window as any).globeWar.war.orders.at(-1).kind)).toBe('propaganda');
  await war.getByRole('button', { name: 'Ohita' }).click();
  expect(await phase(page)).toBe('orders');
  // A skip ends where a whole playback does
  await rowMatchesWar(page);
  for (const b of await war.getByRole('button').all()) if (await b.isVisible()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);

  // To the end at once: the end card tells the winner and the scores
  await page.evaluate(() => {
    const g = window as any;
    const w = g.globeWar.war;
    for (const l of w.leaders.slice(1)) for (const c of l.cities) c.people = 0;
    w.leaders[0].cities[0].people = Math.max(1, w.leaders[0].cities[0].people);
  });
  // The others are gone, the player too: one more round, skipped, ends the war
  await page.evaluate(() => { const g = (window as any).globeWar; g.give({ kind: 'watch' }); g.skip(); });
  const end = page.getByRole('region', { name: 'Sota päättyi' });
  await expect(end).toBeVisible();
  await expect(end.getByRole('heading')).toContainText('Voittaja: Kenraali Ruutiparta');
  await expect(end.getByRole('list', { name: 'Pisteet' }).getByRole('listitem')).toHaveCount(5);
  await expect(end.getByRole('button', { name: 'Uusi sota' })).toBeFocused();
  for (const b of await end.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await page.screenshot({ path: testInfo.outputPath('war-end.png') });
  expect(errors).toEqual([]);
});

test('?planet on a phone: the gallery fits, the row is compact, a country\'s bubble gives orders (STORY-126)', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 640 });
  const r = ready(page);
  await page.goto('./?planet&seed=42');
  await r;
  await page.screenshot({ path: testInfo.outputPath('phone-gallery.png') });
  // The leaders with the longest short names (Utu's review)
  const war = await startWar(page, [/Kenraali Ruutiparta/, /Marsalkka Rautakoura/, /Tohtori Tuuliviiri/, /Puheenjohtaja Ukonvaaja/]);
  // The five leaders fit side by side without scrolling sideways
  const row = war.getByRole('list', { name: 'Johtajat' });
  const rowBox = (await row.boundingBox())!;
  expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(360);
  for (const li of await row.getByRole('listitem').all()) {
    const b = (await li.boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(352.5);
    // No name runs out of its column
    expect(await li.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('phone-war.png') });

  const panelTop = (await war.boundingBox())!.y;
  const name = await tapFoeCountry(page);
  const pop = page.getByRole('dialog', { name: 'Kaupunki' });
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(name);
  // The stance is in the bubble on a phone
  const stance = pop.getByRole('button', { name: /^Asenteesi: Ilmeetön/ });
  await stance.click();
  await expect(pop.getByRole('button', { name: /^Asenteesi: Mulkoilet/ })).toBeVisible();
  for (const b of await pop.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  const popBox = (await pop.boundingBox())!;
  expect(popBox.x).toBeGreaterThanOrEqual(0);
  expect(popBox.x + popBox.width).toBeLessThanOrEqual(360);
  await page.screenshot({ path: testInfo.outputPath('phone-pop.png') });
  await pop.getByRole('button', { name: 'Propaganda' }).click();
  await page.waitForFunction(() => (window as any).globeWar.phase === 'playback');
  await page.screenshot({ path: testInfo.outputPath('phone-playback.png') });
  await war.getByRole('button', { name: 'Ohita' }).click();
  expect(await phase(page)).toBe('orders');
  expect(panelTop).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test('?planet with reduced motion: no flights in the air and whole lines at once (STORY-126)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const r = ready(page);
  await page.goto('./?planet&seed=42');
  await r;
  const war = await startWar(page);
  await page.evaluate(() => (window as any).globeWar.give({ kind: 'loadMissile', missile: 0 }));
  await roundDone(page);
  await disarm(page);
  const target = await page.evaluate(() => {
    const w = (window as any).globeWar.war;
    for (let i = 0; i < 4; i++) { const c = w.leaders[i].cities.findIndex((x: any) => x.people > 0); if (c >= 0) return { leader: i, city: c }; }
    return null;
  });
  // Every flight seen is drawn at its end from its first frame: nothing flies with reduced motion
  const seen = page.evaluate(() => new Promise<{ shown: number; end: number }[]>(done => {
    const all: { shown: number; end: number }[] = [];
    const look = () => {
      for (const f of (window as any).globeWar.strikes().flights) if (f.shown > 0) all.push({ shown: f.shown, end: f.end });
      if ((window as any).globeWar.phase !== 'playback') return done(all);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }));
  await page.evaluate(t => (window as any).globeWar.give({ kind: 'launch', warhead: 0, ...t }), target!);
  await roundDone(page);
  const flights = await seen;
  expect(flights.length).toBeGreaterThan(0);
  for (const f of flights) expect(f.shown).toBe(f.end);
  // The bubble's line is whole, as the log tells it
  const said = await page.locator('.nw-speech-text').textContent();
  const logged = await war.getByRole('list', { name: 'Tapahtumat' }).getByRole('listitem').allTextContents();
  expect(logged.some(l => l.includes(said!))).toBe(true);
});

test('?planet: the sounds start only at the first tap, and a muted war stays muted (STORY-127)', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  let r = ready(page);
  await page.goto('./?planet&seed=42');
  await r;
  // No sound before the player has done anything
  expect(await page.evaluate(() => (window as any).globeWar.sound().started)).toBe(false);
  const war = await startWar(page);
  expect(await page.evaluate(() => (window as any).globeWar.sound().started)).toBe(true);
  const mute = war.getByRole('button', { name: 'Mykistä' });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  expect((await mute.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  // A round with sounds muted plays as before
  await page.evaluate(() => (window as any).globeWar.give({ kind: 'build' }));
  await page.waitForFunction(() => (window as any).globeWar.phase === 'playback');
  await war.getByRole('button', { name: 'Ohita' }).click();
  // The choice is kept for the next visit
  r = ready(page);
  await page.reload();
  await r;
  await startWar(page);
  await expect(page.getByRole('region', { name: 'Ydinsota' }).getByRole('button', { name: 'Mykistä' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('the trial leaves the game alone: no war without ?planet', async ({ page }) => {
  const r = ready(page);
  await page.goto('./?seed=42');
  await r;
  await expect(page.getByRole('button', { name: 'Uusi peli' })).toBeVisible();
  await expect(page.locator('.nw, .nw-gallery')).toHaveCount(0);
  expect(await page.evaluate(() => 'globeWar' in window)).toBe(false);
});

test('the start screen opens the trial, and back again the saved game waits as it was (STORY-119)', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // A game saved first
  let r = ready(page);
  await page.goto('./?seed=42');
  await r;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 20_000 });
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  r = ready(page);
  await page.reload();
  await r;
  const resume = page.getByRole('button', { name: /^Jatka/ });
  await expect(resume).toBeVisible();
  const before = await resume.textContent();

  // The trial from the start screen, the seed kept
  const trial = page.getByRole('button', { name: /^Ydinsota · kokeilu/ });
  await expect(trial).toBeVisible();
  const box = (await trial.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  await page.screenshot({ path: testInfo.outputPath('start-trial.png') });
  r = ready(page);
  await trial.click();
  await r;
  expect(new URL(page.url()).search).toBe('?planet&seed=42');
  // The trial opens on its gallery of leaders (STORY-126)
  const gallery = page.getByRole('region', { name: 'Valitse vastustajat' });
  await expect(gallery.getByRole('group', { name: 'Johtajat' }).getByRole('button')).toHaveCount(10);

  // Back to the start screen: the save as it was
  r = ready(page);
  await gallery.getByRole('button', { name: 'Aloitusnäyttöön' }).click();
  await r;
  expect(new URL(page.url()).search).toBe('?seed=42');
  await expect(page.getByRole('button', { name: /^Jatka/ })).toHaveText(before!);
  expect(errors).toEqual([]);
});
