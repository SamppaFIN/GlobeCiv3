import { describe, expect, it } from 'vitest';
import { computePatterns } from './surfacePatterns';

describe('surface patterns', () => {
  it('are the same every time, with light and shade in every channel', () => {
    const a = computePatterns(64);
    const b = computePatterns(64);
    expect(a.data).toEqual(b.data);
    expect(a.data).toHaveLength(64 * 64 * 4);
    for (let c = 0; c < 4; c++) {
      expect(a.mean[c]).toBeGreaterThan(0.05);
      expect(a.mean[c]).toBeLessThan(0.95);
      // Not flat: the tile shader divides by the spread
      expect(a.std[c]).toBeGreaterThan(0.02);
    }
  });

  it('rarely saturate: clamping to bytes does not flatten the detail', () => {
    const { data } = computePatterns(64);
    for (let c = 0; c < 4; c++) {
      let clipped = 0;
      for (let i = c; i < data.length; i += 4) if (data[i] === 0 || data[i] === 255) clipped++;
      expect(clipped / (data.length / 4)).toBeLessThan(0.1);
    }
  });
});
