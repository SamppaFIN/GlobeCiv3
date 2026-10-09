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
