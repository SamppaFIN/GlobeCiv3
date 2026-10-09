import { describe, expect, it } from 'vitest';
import { buildHexGrid } from './hexGrid';

// IcosahedronGeometry(radius, 5) subdivides each of the 20 faces linearly (three r125+),
// giving 10 * (5 + 1)^2 + 2 = 362 unique vertices and 30 * (5 + 1)^2 = 1080 edges.
describe('buildHexGrid', () => {
  it('builds 362 nodes and 1080 edges for detail 5', () => {
    const { nodes, edges } = buildHexGrid(5, 5);
    expect(nodes).toHaveLength(362);
    expect(edges).toHaveLength(1080);
  });

  it('has 12 pentagons and 350 hexagons', () => {
    const { nodes } = buildHexGrid(5, 5);
    const degrees = new Map<number, number>();
    for (const node of nodes) {
      degrees.set(node.neighbors.length, (degrees.get(node.neighbors.length) ?? 0) + 1);
    }
    expect(Object.fromEntries(degrees)).toEqual({ 5: 12, 6: 350 });
  });

  it('returns edges as valid node index pairs that match the neighbour lists', () => {
    const { nodes, edges } = buildHexGrid(5, 5);
    for (const [a, b] of edges) {
      expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true);
      expect(a).not.toBe(b);
      expect(nodes[a].neighbors).toContain(b);
      expect(nodes[b].neighbors).toContain(a);
    }
  });

  it('places every node on the sphere', () => {
    const { nodes } = buildHexGrid(5, 5);
    for (const node of nodes) {
      expect(node.position.length()).toBeCloseTo(5, 2);
    }
  });
});
