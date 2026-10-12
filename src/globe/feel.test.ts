import { describe, expect, it } from 'vitest';
import { moveWell, newWell, pressWell, releaseWell, stepWell } from './gravityWell';
import { pulseLook, PULSE_S } from './pulses';

/** Run a well for `s` seconds in 60 Hz frames. */
const run = (w: ReturnType<typeof newWell>, s: number) => { for (let t = 0; t < s; t += 1 / 60) stepWell(w, 1 / 60); };

describe('gravity well (STORY-035)', () => {
  it('starts under a press, grows while held and fades after the release', () => {
    const w = newWell();
    pressWell(w, 0.3, -0.2);
    expect([w.x, w.y, w.g]).toEqual([0.3, -0.2, 0]);
    run(w, 0.25);
    expect(w.g).toBeGreaterThan(0.7);
    run(w, 1);
    expect(w.g).toBeGreaterThan(0.99);
    releaseWell(w);
    run(w, 0.25);
    expect(w.g).toBeLessThan(0.3);
    run(w, 2);
    expect(w.g).toBe(0);
  });

  it('follows the pointer smoothly; a press on a live well moves it, on a faded one starts it anew', () => {
    const w = newWell();
    pressWell(w, 0, 0);
    run(w, 1);
    moveWell(w, 0.5, 0);
    stepWell(w, 1 / 60);
    expect(w.x).toBeGreaterThan(0);
    expect(w.x).toBeLessThan(0.15);
    run(w, 1);
    expect(w.x).toBeCloseTo(0.5, 3);
    // Still strong: the well glides to the new press
    pressWell(w, -0.5, 0);
    expect(w.x).toBeCloseTo(0.5, 3);
    releaseWell(w);
    run(w, 3);
    pressWell(w, -0.5, 0.4);
    expect([w.x, w.y]).toEqual([-0.5, 0.4]);
  });
});

describe('pulses (STORY-035)', () => {
  it('a glow and two rings that grow and fade, gone after 1.6 s', () => {
    const early = pulseLook('city', 0.1, false)!;
    const later = pulseLook('city', 0.8, false)!;
    expect(early.rings).toHaveLength(1);
    expect(later.rings).toHaveLength(2);
    expect(later.rings[0].size).toBeGreaterThan(early.rings[0].size);
    expect(later.rings[0].a).toBeLessThan(early.rings[0].a);
    expect(later.glowA).toBeLessThan(pulseLook('city', 0.2, false)!.glowA);
    expect(pulseLook('city', PULSE_S, false)).toBeNull();
    expect(pulseLook('city', -0.1, false)).toBeNull();
  });

  it('with reduced motion only the glow, at one size', () => {
    const a = pulseLook('raid', 0.3, true)!;
    const b = pulseLook('raid', 1.2, true)!;
    expect([a.rings, b.rings]).toEqual([[], []]);
    expect(a.glow).toBe(b.glow);
    expect(b.glowA).toBeLessThan(a.glowA);
  });

  it('the big moments are bigger than an improvement', () => {
    const size = (k: Parameters<typeof pulseLook>[0]) => pulseLook(k, 0.5, false)!.glow;
    expect(size('unlock')).toBeGreaterThan(size('city'));
    expect(size('city')).toBeGreaterThan(size('improve'));
  });
});
