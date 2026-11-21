import { describe, expect, it } from 'vitest';
import type { LevelState } from './goals';
import { advance, startProgress } from './progress';

const none: LevelState = { settlement: 0, cities: 1, provinces: 1 };

describe('the levels open on their goals (STORY-070, STORY-087)', () => {
  it('a new game starts at the city; the ready settlement opens the city area (STORY-089)', () => {
    const p = startProgress(true);
    expect(p).toEqual({ openLevel: 4, meter: 'city' });
    // Cities and provinces do not count before the city level's own goal
    expect(advance(p, { ...none, cities: 3, provinces: 7 })).toBeNull();
    expect(advance(p, { ...none, settlement: 2 })).toBeNull();
    expect(advance(p, { ...none, settlement: 3 })).toBe(3);
    expect(p).toEqual({ openLevel: 3, meter: 'province' });
  });

  it('three cities open the province, four provinces held the state, all seven the planet, one at a time', () => {
    const p = startProgress();
    expect(p).toEqual({ openLevel: 3, meter: 'province' });
    expect(advance(p, { ...none, cities: 2 })).toBeNull();
    // A game ahead of its levels (an older save) opens one level a call
    const ahead = { ...none, cities: 5, provinces: 7 };
    expect(advance(p, ahead)).toBe(2);
    expect(p).toEqual({ openLevel: 2, meter: 'state' });
    expect(advance(p, { ...ahead, provinces: 3 })).toBeNull();
    expect(advance(p, ahead)).toBe(1);
    expect(p).toEqual({ openLevel: 1, meter: 'conquest' });
    expect(advance(p, { ...ahead, provinces: 6 })).toBeNull();
    expect(advance(p, ahead)).toBe(0);
    expect(p).toEqual({ openLevel: 0, meter: 'done' });
    expect(advance(p, ahead)).toBeNull();
  });
});
