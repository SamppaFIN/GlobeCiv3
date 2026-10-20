import { describe, expect, it } from 'vitest';
import { advance, startProgress } from './progress';

describe('the levels open (STORY-026, STORY-070)', () => {
  it('a new game starts at the city; its first scout or settler opens the city area, then mapping goes on as before', () => {
    const p = startProgress(true);
    expect(p).toEqual({ openLevel: 4, meter: 'city' });
    // Mapping does not open anything before the first unit
    expect(advance(p, 1, 1, false, false)).toBeNull();
    expect(advance(p, 0, 0, false, true)).toBe(3);
    expect(p).toEqual({ openLevel: 3, meter: 'province' });
    expect(advance(p, 0.6, 0, false, true)).toBe(2);
    // The old start (?classic) is at the city area
    expect(startProgress()).toEqual({ openLevel: 3, meter: 'province' });
  });
});
