import { describe, expect, it } from 'vitest';
import { layoutChips, spreadChips } from './levelUi';

const FREE = { top: 120, bottom: 690 };
const box = (y: number, h: number) => ({ top: y - h, bottom: y + h });
const overlap = (a: { x: number; w: number }, ay: number, b: { x: number; w: number }, by: number) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(ay - by) < 44;

describe('region chips', () => {
  it('stay on their regions inside the free band', () => {
    const chips = [{ x: 100, y: 300, w: 100 }, { x: 250, y: 420, w: 120 }];
    expect(layoutChips(chips, FREE)).toEqual([300, 420]);
  });

  it('are held inside the band, and two held at the same edge do not cover each other', () => {
    // Both regions lie under the bottom panel, side by side
    const chips = [{ x: 180, y: 720, w: 110 }, { x: 230, y: 760, w: 110 }, { x: 60, y: 400, w: 100 }];
    const ys = layoutChips(chips, FREE);
    for (const y of ys) {
      expect(box(y, 22).bottom).toBeLessThanOrEqual(FREE.bottom);
      expect(box(y, 22).top).toBeGreaterThanOrEqual(FREE.top);
    }
    expect(ys[2]).toBe(400);
    expect(overlap(chips[0], ys[0], chips[1], ys[1])).toBe(false);
    // The first stays at the edge; the second steps up from it
    expect(ys[0]).toBe(FREE.bottom - 26);
    expect(ys[1]).toBe(FREE.bottom - 26 - 52);
  });

  it('a held chip steps past a chip already on its region', () => {
    const chips = [{ x: 200, y: 664, w: 100 }, { x: 210, y: 800, w: 100 }];
    const ys = layoutChips(chips, FREE);
    expect(ys[0]).toBe(664);
    expect(overlap(chips[0], ys[0], chips[1], ys[1])).toBe(false);
  });
});

describe('spread chips (STORY-053)', () => {
  it('keeps the first chip on its region and moves overlapping ones outward until clear', () => {
    const chips = [{ x: 200, y: 400, w: 96 }, { x: 230, y: 410, w: 96 }, { x: 200, y: 400, w: 96 }, { x: 600, y: 100, w: 96 }];
    const at = spreadChips(chips);
    expect(at[0]).toEqual({ x: 200, y: 400 });
    // Far enough away already: not moved
    expect(at[3]).toEqual({ x: 600, y: 100 });
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
      const clear = Math.abs(at[i].x - at[j].x) >= 100 || Math.abs(at[i].y - at[j].y) >= 52;
      expect(clear).toBe(true);
    }
    // The second moved away from the first, to the right and down as it lay
    expect(at[1].x).toBeGreaterThan(230);
    expect(at[1].y).toBeGreaterThan(410);
  });
});
