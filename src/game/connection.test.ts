import { describe, expect, it } from 'vitest';
import { connectedKinds, connectedShields, roadNetwork, strategicTiles, unconnected } from './connection';
import type { ResourceKind } from './terrainTypes';

// A strip of tiles 0 … 19: each tile's neighbours are the ones beside it; provinces of ten
const line = (t: number) => [t - 1, t + 1].filter(n => n >= 0 && n < 20);
const provinceOf = (t: number) => Math.floor(t / 10);

describe('roads join resources to the cities', () => {
  it('a chain of roads joins, a gap does not', () => {
    const roads = new Set([3, 4, 5, 7]);
    const net = roadNetwork([2], t => roads.has(t), line);
    expect([...net].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
    expect(net.has(7)).toBe(false);
  });

  it('only known strategic resources inside the border count, and one on the city tile is joined', () => {
    const kinds: Record<number, ResourceKind> = { 2: 'coal', 5: 'horses', 6: 'gold', 8: 'oil', 15: 'horses' };
    const known = (t: number) => (t === 8 ? null : kinds[t] ?? null);
    // Tile 15 is outside the border, 8's kind is not known, gold is no strategic resource
    const inside = strategicTiles([2, 5, 6, 8, 9], known, provinceOf);
    expect(inside.map(r => r.tile)).toEqual([2, 5]);
    const net = roadNetwork([2], () => false, line);
    expect(connectedKinds(inside, net)).toEqual(new Map([[0, new Set(['coal'])]]));
    expect(unconnected(inside, net).map(r => r.tile)).toEqual([5]);
  });

  it('serves the province of the resource, whichever city the road reaches, and a kind counts once', () => {
    // The city is on tile 12 (province 1); roads from 6 to 11 join horses on 6 and 8 (province 0)
    const roads = new Set([6, 7, 8, 9, 10, 11]);
    const net = roadNetwork([12], t => roads.has(t), line);
    const res = strategicTiles([6, 8, 12], t => (t === 6 || t === 8 ? 'horses' : null), provinceOf);
    const kinds = connectedKinds(res, net);
    expect(kinds).toEqual(new Map([[0, new Set(['horses'])]]));
    expect(connectedShields(kinds.get(0), [])).toBe(1);
    expect(connectedShields(kinds.get(1), [])).toBe(0);
  });

  it('gives each kind its building\'s shields, not to a city that has the building', () => {
    const all = new Set(['horses', 'coal', 'oil'] as const);
    expect(connectedShields(all, [])).toBe(6);
    expect(connectedShields(all, ['forge'])).toBe(4);
    expect(connectedShields(undefined, [])).toBe(0);
  });
});
