import { expect, test, type Page } from '@playwright/test';

interface RigState {
  dist: number;
  centerDist: number;
  tilt: number;
  point: [number, number, number] | null;
}

async function openGame(page: Page): Promise<void> {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./');
  await ready;
}

/** Camera state and the surface point under the given client pixel. */
function rigState(page: Page, x: number, y: number): Promise<RigState> {
  return page.evaluate(([cx, cy]) => {
    const rig = (window as any).globeCamera;
    const ndc = { x: (cx / innerWidth) * 2 - 1, y: -((cy / innerHeight) * 2 - 1) };
    const p = rig.raycast(ndc);
    return {
      dist: rig.dist,
      centerDist: rig.camera.position.length(),
      tilt: rig.tilt(),
      point: p ? [p.x, p.y, p.z] : null,
    };
  }, [x, y] as const);
}

const nextFrame = (page: Page) => page.evaluate(() => new Promise(requestAnimationFrame));
const gap = (a: RigState, b: RigState) => Math.hypot(a.point![0] - b.point![0], a.point![1] - b.point![1], a.point![2] - b.point![2]);

test('mouse wheel zooms toward the cursor by the same factor at every altitude', async ({ page }) => {
  await openGame(page);
  const [x, y] = [800, 350];
  await page.mouse.move(x, y);

  for (let round = 0; round < 3; round++) {
    const before = await rigState(page, x, y);
    expect(before.point).not.toBeNull();
    await page.mouse.wheel(0, -100);
    await nextFrame(page);
    const after = await rigState(page, x, y);
    expect(after.dist / before.dist).toBeCloseTo(Math.exp(-0.2), 6);
    expect(gap(before, after)).toBeLessThan(1e-6);
    // Descend a few notches before the next measurement
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -100);
    await nextFrame(page);
  }
});

test('the camera goes beyond the old OrbitControls limits and tilts near the surface', async ({ page }, testInfo) => {
  await openGame(page);
  await page.mouse.move(640, 400);
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -400);
  await nextFrame(page);
  const near = await rigState(page, 640, 400);
  expect(near.centerDist).toBeLessThan(6);
  expect(near.tilt).toBeGreaterThan(0.5);
  await page.screenshot({ path: testInfo.outputPath('near.png') });

  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 400);
  await nextFrame(page);
  const far = await rigState(page, 640, 400);
  expect(far.centerDist).toBeGreaterThan(30);
  expect(far.tilt).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('far.png') });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('two-finger pinch zooms by the finger spread and keeps the midpoint fixed', async ({ page, context }) => {
    await openGame(page);
    const cdp = await context.newCDPSession(page);
    const before = await rigState(page, 740, 400);
    expect(before.point).not.toBeNull();

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 690, y: 400, id: 1 }, { x: 790, y: 400, id: 2 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 640, y: 400, id: 1 }, { x: 840, y: 400, id: 2 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await nextFrame(page);

    const after = await rigState(page, 740, 400);
    expect(after.dist / before.dist).toBeCloseTo(0.5, 6);
    expect(gap(before, after)).toBeLessThan(1e-6);
  });
});

/** Unit vector of the hex node nearest to the surface point under a client pixel. */
function nearestHex(page: Page, x: number, y: number): Promise<[number, number, number]> {
  return page.evaluate(([cx, cy]) => {
    const w = window as any;
    const ndc = { x: (cx / innerWidth) * 2 - 1, y: -((cy / innerHeight) * 2 - 1) };
    const p = w.globeCamera.raycast(ndc).normalize();
    let best = null;
    let bestD = Infinity;
    for (const n of w.globeNodes) {
      const v = n.position.clone().normalize();
      const d = v.distanceToSquared(p);
      if (d < bestD) { bestD = d; best = v; }
    }
    return [best.x, best.y, best.z];
  }, [x, y] as const);
}

function flightState(page: Page): Promise<{ flying: boolean; target: [number, number, number] }> {
  return page.evaluate(() => {
    const rig = (window as any).globeCamera;
    const t = rig.target.clone().normalize();
    return { flying: rig.flying, target: [t.x, t.y, t.z] };
  });
}

const angle = (a: number[], b: number[]) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));

test('double-click flies to the nearest hex in about a second, without an overlay', async ({ page }) => {
  await openGame(page);
  const dest = await nearestHex(page, 760, 330);
  await page.mouse.dblclick(760, 330);
  await page.waitForTimeout(300);
  const mid = await flightState(page);
  expect(mid.flying).toBe(true);
  expect(angle(mid.target, dest)).toBeGreaterThan(1e-3);
  // Duration is checked separately with slow frames; here wait for the arrival itself
  await page.waitForFunction(() => !(window as any).globeCamera.flying, null, { timeout: 3_000 });
  const end = await flightState(page);
  expect(angle(end.target, dest)).toBeLessThan(1e-6);
  expect(await page.locator('#sim-overlay, #sim-close').count()).toBe(0);
});

test('with reduced motion the double-click jumps at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGame(page);
  const dest = await nearestHex(page, 760, 330);
  await page.mouse.dblclick(760, 330);
  await nextFrame(page);
  const now = await flightState(page);
  expect(now.flying).toBe(false);
  expect(angle(now.target, dest)).toBeLessThan(1e-6);
});

test('the mouse wheel interrupts a flight', async ({ page }) => {
  await openGame(page);
  const dest = await nearestHex(page, 760, 330);
  await page.mouse.dblclick(760, 330);
  await page.waitForTimeout(200);
  await page.mouse.wheel(0, -100);
  await nextFrame(page);
  expect((await flightState(page)).flying).toBe(false);
  await page.waitForTimeout(1100);
  expect(angle((await flightState(page)).target, dest)).toBeGreaterThan(1e-3);
});

test('a flight lasts about a second of wall time even when frames are slow', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const w = window as any;
    // Make every frame take ~150 ms, longer than any per-frame time step clamp
    const burn = () => { const t = performance.now(); while (performance.now() - t < 150) { /* busy */ } requestAnimationFrame(burn); };
    requestAnimationFrame(burn);
    // Time the flight from the game's own update calls
    const rig = w.globeCamera;
    const update = rig.update.bind(rig);
    w.__flight = { calls: [] as number[], clickAt: 0 };
    document.addEventListener('dblclick', () => { w.__flight.clickAt = performance.now(); });
    rig.update = (dt: number) => {
      const flying = rig.flying;
      update(dt);
      if (flying) w.__flight.calls.push(performance.now());
      if (flying && !rig.flying) w.__flight.done = true;
    };
  });
  await page.mouse.dblclick(760, 330);
  await page.waitForFunction(() => (window as any).__flight.done === true, null, { timeout: 10_000 });
  const { calls, clickAt } = await page.evaluate(() => (window as any).__flight);
  const elapsed = calls[calls.length - 1] - clickAt;
  const maxGap = Math.max(...calls.slice(1).map((t, i) => t - calls[i]));
  expect(maxGap).toBeGreaterThan(100);
  // The first step also counts the frame before the click, and the flight ends on
  // the first frame after one second, so allow one frame either way
  expect(elapsed).toBeGreaterThan(1000 - maxGap - 50);
  expect(elapsed).toBeLessThanOrEqual(1000 + maxGap + 50);
});
