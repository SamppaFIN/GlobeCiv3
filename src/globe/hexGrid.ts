/**
 * hexGrid.ts — geodesic hex grid (dual of a subdivided icosahedron).
 * Detail 5 gives 362 nodes: 12 pentagons and 350 hexagons.
 */
import * as THREE from 'three';

export interface HexNode {
  position: THREE.Vector3;
  index: number;
  neighbors: number[];
}

export function buildHexGrid(radius: number, detail: number): { nodes: HexNode[]; edges: [number, number][] } {
  // IcosahedronGeometry is non-indexed (three r125+): every triangle has its own
  // three vertices, so shared corners appear several times in the position buffer.
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const posAttr = geo.getAttribute('position');

  // Deduplicate vertices into nodes and remember which node each buffer vertex belongs to
  const nodeIndexByKey = new Map<string, number>();
  const nodeOfVertex: number[] = [];
  const nodes: HexNode[] = [];

  for (let i = 0; i < posAttr.count; i++) {
    const x = Math.round(posAttr.getX(i) * 1000) / 1000;
    const y = Math.round(posAttr.getY(i) * 1000) / 1000;
    const z = Math.round(posAttr.getZ(i) * 1000) / 1000;
    const key = `${x},${y},${z}`;
    let index = nodeIndexByKey.get(key);
    if (index === undefined) {
      index = nodes.length;
      nodes.push({ position: new THREE.Vector3(x, y, z), index, neighbors: [] });
      nodeIndexByKey.set(key, index);
    }
    nodeOfVertex.push(index);
  }

  // Each consecutive vertex triple is a triangle; its sides are grid edges
  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < posAttr.count; i += 3) {
    const tri = [nodeOfVertex[i], nodeOfVertex[i + 1], nodeOfVertex[i + 2]];
    for (let k = 0; k < 3; k++) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      if (a === b) continue;
      const key = `${Math.min(a, b)}_${Math.max(a, b)}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([a, b]);
      nodes[a].neighbors.push(b);
      nodes[b].neighbors.push(a);
    }
  }

  return { nodes, edges };
}
