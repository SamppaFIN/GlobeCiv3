import { describe, expect, it } from 'vitest';
import { baseContent, cityMood, foundCity } from './cities';
import { governed, revolutionDays } from './government';

describe('governments (Freeciv civ1)', () => {
  it('under Despotism and Anarchy a yield over 2 loses 1; Monarchy keeps it', () => {
    const y = { food: 3, shield: 2, trade: 6 };
    expect(governed(y, 'despotism')).toEqual({ food: 2, shield: 2, trade: 5 });
    expect(governed(y, 'anarchy')).toEqual({ food: 2, shield: 2, trade: 5 });
    expect(governed(y, 'monarchy')).toEqual(y);
  });

  it('a revolution lasts 1 to 5 days, the same for the same seed and day', () => {
    const days = Array.from({ length: 200 }, (_, d) => revolutionDays(42, d));
    expect(Math.min(...days)).toBe(1);
    expect(Math.max(...days)).toBe(5);
    expect(revolutionDays(42, 17)).toBe(revolutionDays(42, 17));
  });
});

describe('governments and moods (Freeciv civ1)', () => {
  it('fewer citizens are content from the 10th, 11th or 12th city on', () => {
    expect([9, 10, 11, 12].map(n => baseContent(n, 'anarchy'))).toEqual([4, 3, 3, 3]);
    expect([10, 11].map(n => baseContent(n, 'despotism'))).toEqual([4, 3]);
    expect([11, 12, 21, 22].map(n => baseContent(n, 'monarchy'))).toEqual([4, 3, 3, 2]);
  });

  it('each soldier calms a citizen, at most 3 under Monarchy', () => {
    const c = foundCity([], 0);
    c.size = 9;
    expect(cityMood(c, 5, 1, false, 0, 'despotism')).toMatchObject({ calmed: 5, unhappy: 0 });
    expect(cityMood(c, 5, 1, false, 0, 'monarchy')).toMatchObject({ calmed: 3, unhappy: 2, disorder: true });
  });
});
