import { describe, expect, it } from 'vitest';
import { ADVANCE_ERA, ERA_KEYS, eraOf } from './eras';
import { ERAS } from './persons';
import { ADVANCES, ADVANCE_LIST } from './science';

describe('the seven eras and their keys (STORY-120)', () => {
  it('the era is the latest whose key is known; the early age comes with the game', () => {
    expect(eraOf(new Set())).toBe('early');
    expect(eraOf(new Set(['bronze', 'alphabet']))).toBe('early');
    expect(eraOf(new Set(['iron']))).toBe('iron');
  });

  it('with keys for all seven eras each comes by its key, a passed-over era stays unlived, and the era does not fall', () => {
    // Invented keys: the real ones come into the game with their eras' advances (STORY-121–123)
    const keys = { iron: 'k1', medieval: 'k2', renaissance: 'k3', industrial: 'k4', modern: 'k5', atomic: 'k6' };
    const known = new Set<string>();
    expect(eraOf(known, keys)).toBe('early');
    ERAS.slice(1).forEach((era, i) => {
      known.add(`k${i + 1}`);
      expect(eraOf(known, keys)).toBe(era);
    });
    // Trade may give a later key before an earlier one: the later era comes
    expect(eraOf(new Set(['k1', 'k3']), keys)).toBe('renaissance');
    // Knowing more never takes an era back
    expect(eraOf(new Set(['k1', 'k3', 'x', 'k2']), keys)).toBe('renaissance');
  });

  it('only the iron age has a key in the game now, an advance of its own and in its era', () => {
    expect(ERA_KEYS).toEqual({ iron: 'iron' });
    for (const era of ERAS) if (ERA_KEYS[era]) expect(ADVANCE_ERA[ERA_KEYS[era]!]).toBe(era);
    // An era whose key is not in the game never comes, whatever is known
    expect(eraOf(new Set(ADVANCE_LIST))).toBe('iron');
  });

  it('every advance belongs to an era no earlier than the advances it needs', () => {
    expect(Object.keys(ADVANCE_ERA).sort()).toEqual([...ADVANCE_LIST].sort());
    for (const a of ADVANCE_LIST) for (const n of ADVANCES[a].needs) expect(ERAS.indexOf(ADVANCE_ERA[n]), `${a} needs ${n}`).toBeLessThanOrEqual(ERAS.indexOf(ADVANCE_ERA[a]));
  });
});
