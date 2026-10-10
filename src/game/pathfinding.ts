/**
 * pathfinding.ts — A* and breadth-first search over the hex tile graph.
 *
 * Entering a tile costs its terrain's movement cost (terrainTypes.ts, Freeciv civ1);
 * Infinity marks a tile a unit cannot enter. The A* heuristic is the angle to the goal
 * over the largest neighbour spacing, so it never overestimates the number of steps.
 */
import * as THREE from 'three';
import { FREQUENCY, neighbors, tileCenter } from '../globe/hexTiles';

/** Largest angle between neighbouring tile centres (the mean is acos(1/√5) / F; faces' middles are wider). */
const MAX_SPACING = (1.3 * Math.acos(1 / Math.sqrt(5))) / FREQUENCY;

class Heap {
  private readonly items: [number, number][] = [];
  get size() { return this.items.length; }
  push(priority: number, value: number) {
    const a = this.items;
    a.push([priority, value]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0][1];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Cheapest path from one tile to another: the tiles after `from` up to and including
 * `to`, or null if `to` cannot be reached within maxExpanded tiles.
 */
export function findPath(from: number, to: number, cost: (id: number) => number, maxExpanded = 20000): number[] | null {
  if (from === to) return [];
  if (!Number.isFinite(cost(to))) return null;
  const goal = tileCenter(to);
  const c = new THREE.Vector3();
  const h = (id: number) => tileCenter(id, c).angleTo(goal) / MAX_SPACING;
  const g = new Map<number, number>([[from, 0]]);
  const came = new Map<number, number>();
  const open = new Heap();
  open.push(h(from), from);
  let expanded = 0;
  while (open.size && expanded < maxExpanded) {
    const id = open.pop();
    if (id === to) {
      const path = [to];
      for (let k = came.get(to)!; k !== from; k = came.get(k)!) path.push(k);
      return path.reverse();
    }
    expanded++;
    const base = g.get(id)!;
    for (const n of neighbors(id)) {
      const step = cost(n);
      if (!Number.isFinite(step)) continue;
      const next = base + step;
      if (next < (g.get(n) ?? Infinity)) {
        g.set(n, next);
        came.set(n, id);
        open.push(next + h(n), n);
      }
    }
  }
  return null;
}

/**
 * The nearest tile (fewest steps over enterable tiles) that satisfies a test, or null.
 * The start itself is not considered.
 */
export function nearestTile(from: number, cost: (id: number) => number, test: (id: number) => boolean, maxVisited = 4000): number | null {
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length && seen.size < maxVisited) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const n of neighbors(id)) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (test(n)) return n;
        if (Number.isFinite(cost(n))) next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/** Tiles within a number of rings of a tile (the tile included). */
export function tilesInRings(center: number, rings: number): number[] {
  const seen = new Set([center]);
  let frontier = [center];
  for (let r = 0; r < rings; r++) {
    const next: number[] = [];
    for (const id of frontier) for (const n of neighbors(id)) if (!seen.has(n)) { seen.add(n); next.push(n); }
    frontier = next;
  }
  return [...seen];
}
