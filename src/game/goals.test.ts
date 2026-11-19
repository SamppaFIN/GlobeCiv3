import { describe, expect, it } from 'vitest';
import { goalCount, LEVEL_GOALS, levelGoal, type LevelState } from './goals';

const start: LevelState = { built: false, firstUnit: false, cities: 1, provinces: 1 };

describe('level goals (STORY-087)', () => {
  it('each level from the city to the state has one goal, and the planet none yet', () => {
    expect([4, 3, 2, 1].map(l => levelGoal(l)!.text)).toEqual([
      'Rakenna rakennus ja ensimmäinen yksikkö', 'Perusta kolme kaupunkia', 'Pidä neljä kotivaltion lääniä', 'Valtaa kotivaltio',
    ]);
    expect(levelGoal(0)).toBeNull();
  });

  it('a level rises on the output of the level below: a unit, cities, provinces, all seven (Sami 2026-11-19)', () => {
    const [city, area, province, state] = [4, 3, 2, 1].map(l => levelGoal(l)!);
    expect(goalCount(city, start)).toBe(0);
    expect(goalCount(city, { ...start, built: true })).toBe(1);
    expect(goalCount(city, { ...start, built: true, firstUnit: true })).toBe(city.need);
    expect([goalCount(area, { ...start, cities: 2 }), area.need]).toEqual([2, 3]);
    expect([goalCount(province, { ...start, provinces: 4 }), province.need]).toEqual([4, 4]);
    expect([goalCount(state, { ...start, provinces: 6 }), state.need]).toEqual([6, 7]);
  });

  it('the count stops at the need, and mapping counts for nothing', () => {
    expect(goalCount(levelGoal(3)!, { ...start, cities: 9 })).toBe(3);
    expect(LEVEL_GOALS.every(g => g.reward > 0 && g.hint.length > 0 && g.opens.title.endsWith('zoomaa ulos'))).toBe(true);
  });
});
