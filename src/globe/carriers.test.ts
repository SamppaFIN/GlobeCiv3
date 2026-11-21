import { describe, expect, it } from 'vitest';
import { along, ARRIVE_AT, MAX_CARRIERS, tripsOf } from './carriers';
import type { Move } from '../game/chains';

const WHERE: Record<string, number> = { centre: 1, lumberjack: 5, sawmill: 3, site: 9 };
const where = (at: string) => WHERE[at] ?? null;
// A straight line of tiles, both ends included
const route = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + Math.sign(b - a) * i);

describe('carriers (STORY-101)', () => {
  it('turns each of the day\'s moves into a walk between the tiles of its places', () => {
    const moves: Move[] = [
      { good: 'log', from: 'lumberjack', to: 'centre' },
      { good: 'log', from: 'centre', to: 'sawmill' },
      { good: 'plank', from: 'centre', to: 'site' },
    ];
    expect(tripsOf(moves, where, route)).toEqual([
      { path: [5, 4, 3, 2, 1], good: 'log' },
      { path: [1, 2, 3], good: 'log' },
      { path: [1, 2, 3, 4, 5, 6, 7, 8, 9], good: 'plank' },
    ]);
  });

  it('leaves out a move without a place or a way, and stops at the cap', () => {
    expect(tripsOf([{ good: 'fish', from: 'fishery', to: 'centre' }], where, route)).toEqual([]);
    expect(tripsOf([{ good: 'log', from: 'lumberjack', to: 'centre' }], where, () => null)).toEqual([]);
    const many: Move[] = Array.from({ length: 40 }, () => ({ good: 'stone', from: 'centre', to: 'site' }));
    expect(tripsOf(many, where, route).length).toBe(MAX_CARRIERS);
  });

  it('walks from the start at dawn to the end before the day is over', () => {
    expect(along(5, 0, 0)).toEqual({ leg: 0, f: 0 });
    const end = along(5, ARRIVE_AT, 0);
    expect(end.leg).toBe(3);
    expect(end.f).toBeCloseTo(1);
    expect(along(5, 0.99, 0)).toEqual(end);
    // Half way through the walk, half way along the path
    const mid = along(5, ARRIVE_AT / 2, 0);
    expect(mid.leg + mid.f).toBeCloseTo(2);
  });

  it('sets the carriers off one after another, and every one still arrives within the day', () => {
    expect(along(3, 0.02, 0).f).toBeGreaterThan(0);
    expect(along(3, 0.02, 5)).toEqual({ leg: 0, f: 0 });
    for (let i = 0; i < MAX_CARRIERS; i++) {
      const at = along(4, ARRIVE_AT, i);
      expect(at.leg + at.f).toBeCloseTo(3);
    }
  });

  it('gives the same walk for the same day: nothing but the clock moves it', () => {
    expect(along(6, 0.4, 3)).toEqual(along(6, 0.4, 3));
  });
});
