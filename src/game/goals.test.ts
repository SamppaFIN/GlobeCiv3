import { describe, expect, it } from 'vitest';
import { advanceGoals, GOALS, type GoalState } from './goals';

const start: GoalState = { cities: 0, biggest: 0, researching: false, advances: 0, improvements: 0, buildings: 0, openLevel: 3 };

describe('goals (STORY-041)', () => {
  it('one at a time, in order; nothing is done at the start', () => {
    expect(advanceGoals(0, start)).toEqual({ index: 0, done: [] });
    const city = advanceGoals(0, { ...start, cities: 1, biggest: 1 });
    expect([city.index, city.done.map(g => g.text)]).toEqual([1, ['Perusta ensimmäinen kaupunki']]);
    // Size 2 before choosing research: the chain waits at research
    expect(advanceGoals(1, { ...start, cities: 1, biggest: 2 }).index).toBe(1);
  });

  it('a game ahead of the chain catches up at once, with every reward', () => {
    const ahead: GoalState = { cities: 3, biggest: 5, researching: true, advances: 2, improvements: 4, buildings: 1, openLevel: 2 };
    const r = advanceGoals(0, ahead);
    expect(r.index).toBe(GOALS.length);
    expect(r.done.reduce((sum, g) => sum + g.reward, 0)).toBe(GOALS.reduce((sum, g) => sum + g.reward, 0));
    expect(advanceGoals(GOALS.length, ahead)).toEqual({ index: GOALS.length, done: [] });
  });
});
