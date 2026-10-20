import { describe, expect, it } from 'vitest';
import { advanceCost, STUDY_COST } from './science';
import { acceptsTrade, factor, worth, MAPS_WORTH } from './trade';

describe('trades (STORY-078, own rules)', () => {
  it('an advance is worth its research to the one who gets it; a kind, maps and gold their own worth', () => {
    expect(worth({ kind: 'advance', id: 'bronze' }, 3)).toBe(advanceCost(3));
    expect(worth({ kind: 'resource', id: 'horses' }, 3)).toBe(STUDY_COST);
    expect(worth({ kind: 'maps' }, 0)).toBe(MAPS_WORTH);
    expect(worth({ kind: 'gold', amount: 25 }, 0)).toBe(25);
    expect(worth({ kind: 'nothing' }, 9)).toBe(0);
  });

  it('a friendly rival is content with 75 %, a wary one with an even trade, a suspicious one wants 150 %; hostile or at war, nothing', () => {
    expect([30, 20, 0, -19, -20, -49].map(a => factor(a, 'peace'))).toEqual([0.75, 0.75, 1, 1, 1.5, 1.5]);
    expect(factor(-50, 'peace')).toBeNull();
    expect(factor(80, 'war')).toBeNull();
    expect(factor(80, 'alliance')).toBe(0.75);
  });

  it('it accepts when it gets enough for what it gives, a gift always, and never nothing for nothing', () => {
    expect(acceptsTrade(0, 'peace', 20, 20)).toBe(true);
    expect(acceptsTrade(0, 'peace', 19, 20)).toBe(false);
    expect(acceptsTrade(30, 'peace', 15, 20)).toBe(true);
    expect(acceptsTrade(-30, 'peace', 29, 20)).toBe(false);
    expect(acceptsTrade(-30, 'peace', 30, 20)).toBe(true);
    expect(acceptsTrade(0, 'peace', 10, 0)).toBe(true);
    expect(acceptsTrade(0, 'peace', 0, 0)).toBe(false);
    expect(acceptsTrade(0, 'war', 100, 0)).toBe(false);
  });
});
