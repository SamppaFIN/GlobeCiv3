import { describe, expect, it } from 'vitest';
import { baseContent, cityMood, foundCity, tileOutput } from './cities';
import { governed, revolutionDays } from './government';

describe('governments (Freeciv civ1)', () => {
  it('under Despotism and Anarchy a yield over 2 loses 1; Monarchy keeps it', () => {
    const y = { food: 3, shield: 2, trade: 6 };
    expect(governed(y, 'despotism')).toEqual({ food: 2, shield: 2, trade: 5 });
    expect(governed(y, 'anarchy')).toEqual({ food: 2, shield: 2, trade: 5 });
    expect(governed(y, 'monarchy')).toEqual(y);
  });

  it('the Republic adds a trade where a tile makes some, after the Colossus (STORY-125, Output_Inc_Tile)', () => {
    expect(governed({ food: 2, shield: 1, trade: 0 }, 'republic')).toEqual({ food: 2, shield: 1, trade: 0 });
    expect(governed({ food: 2, shield: 1, trade: 1 }, 'republic')).toEqual({ food: 2, shield: 1, trade: 2 });
    expect(governed({ food: 3, shield: 3, trade: 3 }, 'republic')).toEqual({ food: 3, shield: 3, trade: 4 });
    // With the Colossus both add one where there is trade, none where there is none
    const c = foundCity([], 0);
    c.buildings.push('colossus');
    expect(tileOutput(c, { food: 1, shield: 0, trade: 2 }, 'republic').trade).toBe(4);
    expect(tileOutput(c, { food: 2, shield: 0, trade: 0 }, 'republic').trade).toBe(0);
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
    // The Republic: from the 14th, and one fewer again from the 24th (Empire_Size_Base 13, Step 10)
    expect([13, 14, 23, 24, 25].map(n => baseContent(n, 'republic'))).toEqual([4, 3, 3, 2, 2]);
  });

  it('each soldier calms a citizen, at most 3 under Monarchy', () => {
    const c = foundCity([], 0);
    c.size = 9;
    expect(cityMood(c, 5, 1, {}, 0, 'despotism')).toMatchObject({ calmed: 5, unhappy: 0 });
    expect(cityMood(c, 5, 1, {}, 0, 'monarchy')).toMatchObject({ calmed: 3, unhappy: 2, disorder: true });
    // None under the Republic (no Martial_Law for it)
    expect(cityMood(c, 5, 1, {}, 0, 'republic')).toMatchObject({ calmed: 0, unhappy: 5 });
  });

  it('under the Republic each unit away makes a content citizen unhappy, then a happy one for two (STORY-125, citizen_happy_units)', () => {
    const c = foundCity([], 0);
    c.size = 4;
    expect(cityMood(c, 0, 1, {}, 0, 'republic', 0)).toMatchObject({ happy: 0, content: 4, unhappy: 0 });
    expect(cityMood(c, 0, 1, {}, 0, 'republic', 2)).toMatchObject({ happy: 0, content: 2, unhappy: 2, disorder: true });
    // None under Monarchy
    expect(cityMood(c, 0, 1, {}, 0, 'monarchy', 2)).toMatchObject({ content: 4, unhappy: 0 });
    // Luxury made all four happy (8): two away cost a happy one to unhappy, and so on
    expect(cityMood(c, 0, 1, {}, 8, 'republic', 2)).toMatchObject({ happy: 3, content: 0, unhappy: 1 });
    expect(cityMood(c, 0, 1, {}, 8, 'republic', 3)).toMatchObject({ happy: 2, content: 1, unhappy: 1 });
  });
});
