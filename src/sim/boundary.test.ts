import { describe, expect, it } from 'vitest';

/**
 * The simulation's boundary (STORY-095, criterion 1): src/sim and every module it imports, all
 * the way down, do without the page and without drawing. Three.js comes in for its vector maths
 * (the world's tiles and regions) and the hex grid's nodes only (Sami 2026-11-22).
 */
const raw = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** Every module under src by its path from here: this folder's own come as ./name. */
const sources = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.startsWith('./') ? `../sim/${k.slice(2)}` : k, v]));

/** Modules of the simulation: these and what they import. */
const ROOTS = ['state', 'events', 'game', 'world', 'run'].map(n => `../sim/${n}.ts`);

/** Relative imports of a module, values and types alike, as keys of `sources`. */
function importsOf(file: string): string[] {
  const dir = file.slice(0, file.lastIndexOf('/'));
  const out: string[] = [];
  for (const m of sources[file].matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'(\.[^']+)'/gm)) {
    const parts = `${dir}/${m[1]}`.split('/');
    const path: string[] = [];
    for (const p of parts) {
      if (p === '..' && path.length && path[path.length - 1] !== '..') path.pop();
      else if (p !== '.') path.push(p);
    }
    out.push(`${path.join('/')}.ts`);
  }
  return out;
}

function reached(): Set<string> {
  const seen = new Set<string>();
  const todo = [...ROOTS];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    expect(sources[f], `${f} exists`).toBeDefined();
    seen.add(f);
    todo.push(...importsOf(f));
  }
  return seen;
}

/** The only modules of the view's folder it may use: the world's maths. */
const GLOBE_ALLOWED = ['hexTiles', 'regions', 'terrain', 'cubeSphere', 'regionLayout', 'hexGrid'].map(n => `../globe/${n}.ts`);

describe('the simulation\'s boundary (STORY-095)', () => {
  it('imports nothing of the user interface, and of the view only the world\'s maths', () => {
    const files = [...reached()];
    expect(files.filter(f => f.startsWith('../ui/'))).toEqual([]);
    expect(files.filter(f => f.startsWith('../globe/') && !GLOBE_ALLOWED.includes(f))).toEqual([]);
    expect(files.length).toBeGreaterThan(20);
  });

  it('touches no page and draws nothing: no document, window or storage, no renderer, scene, mesh or material', () => {
    const bad = /\b(document|window|localStorage|indexedDB|requestAnimationFrame)\b|WebGLRenderer|THREE\.(Scene|Mesh|\w*Material|DataTexture|Texture)\b/;
    const hits = [...reached()].flatMap(f => sources[f].split('\n').map((line, i) => ({ f, i: i + 1, line })))
      // comments may name them
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line) && bad.test(line.replace(/\/\/.*$/, '')));
    expect(hits.map(h => `${h.f}:${h.i}: ${h.line.trim()}`)).toEqual([]);
  });
});
