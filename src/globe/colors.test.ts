import { describe, expect, it } from 'vitest';
import { oklchToSrgb } from './colors';

describe('oklchToSrgb', () => {
  it('matches known sRGB colours', () => {
    // White, black and the Nocturne accent #9184d9 = oklch(0.660 0.125 289.2)
    expect(oklchToSrgb(1, 0, 0).map(v => Math.round(v * 255))).toEqual([255, 255, 255]);
    expect(oklchToSrgb(0, 0, 0)).toEqual([0, 0, 0]);
    const accent = oklchToSrgb(0.66, 0.125, 289.2).map(v => v * 255);
    [0x91, 0x84, 0xd9].forEach((c, i) => expect(Math.abs(accent[i] - c)).toBeLessThan(4));
  });
});
