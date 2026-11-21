import { describe, expect, it } from 'vitest';
import { givenName, GIVEN_NAMES } from './personNames';

describe('given names (STORY-102)', () => {
  it('the same seed and id give the same name, and other seeds others', () => {
    expect(givenName(42, 7, new Set())).toBe(givenName(42, 7, new Set()));
    const names = new Set(Array.from({ length: 20 }, (_, seed) => givenName(seed, 0, new Set())));
    expect(names.size).toBeGreaterThan(10);
  });

  it('a name taken by the living is not given again; past the list a name repeats with a numeral', () => {
    const taken = new Set<string>();
    for (let id = 0; id < GIVEN_NAMES.length; id++) taken.add(givenName(42, id, taken));
    expect(taken.size).toBe(GIVEN_NAMES.length);
    expect(givenName(42, 999, taken)).toMatch(/ II$/);
  });

  it('the list holds no name twice', () => {
    expect(new Set(GIVEN_NAMES).size).toBe(GIVEN_NAMES.length);
  });
});
