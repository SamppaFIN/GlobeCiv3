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

/**
 * Every import of a text: static ones of values and types (from '…' or from "…", over several
 * lines too), re-exports, side-effect imports (import './x') and dynamic ones (import('./x')).
 */
const IMPORT = /^\s*(?:import|export)\s[^;]*?\bfrom\s*(['"])([^'"]+)\1|^\s*import\s*(['"])([^'"]+)\3|\bimport\s*\(\s*(['"])([^'"]+)\5\s*\)/gm;

/** What a text imports, as written. */
export function specifiersOf(text: string): string[] {
  return [...text.matchAll(IMPORT)].map(m => m[2] ?? m[4] ?? m[6]);
}

/** Relative imports of a module, values and types alike, as keys of `sources`. */
function importsOf(file: string): string[] {
  const dir = file.slice(0, file.lastIndexOf('/'));
  const out: string[] = [];
  for (const spec of specifiersOf(sources[file])) {
    if (!spec.startsWith('.')) continue;
    const parts = `${dir}/${spec.replace(/\.ts$/, '')}`.split('/');
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

/** The only packages it may import. */
const PACKAGES = ['three'];

/** What of Three.js it may use: vector maths, and the icosahedron the hex grid's nodes come from. */
const THREE_ALLOWED = ['Vector3', 'Matrix3', 'IcosahedronGeometry'];

/** Globals of the page, the browser and drawing it must not touch. */
const PAGE = /\b(document|window|navigator|localStorage|sessionStorage|indexedDB|requestAnimationFrame|cancelAnimationFrame|fetch|XMLHttpRequest|WebSocket|Worker|HTML\w*Element|Element|Node(?:List)?|Event(?:Target)?|CanvasRenderingContext2D|OffscreenCanvas|WebGL\w*|Image|Audio)\b/;

/** A text's lines without comments, numbered from 1. */
function codeLines(text: string): { i: number; line: string }[] {
  return text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n')
    .map((line, i) => ({ i: i + 1, line: line.replace(/\/\/.*$/, '') }));
}

/** Lines of a text that touch the page, as path:line: text. */
export function pageHits(file: string, text: string): string[] {
  // Text in quotes may name them (the game's own words, keys of saves)
  return codeLines(text).filter(({ line }) => PAGE.test(line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "''")))
    .map(({ i, line }) => `${file}:${i}: ${line.trim()}`);
}

/** What of Three.js a text uses, as THREE.Name or by name from 'three', besides what it may. */
export function threeHits(file: string, text: string): string[] {
  const used = new Set<string>();
  for (const { line } of codeLines(text)) for (const m of line.matchAll(/\bTHREE\.(\w+)/g)) used.add(m[1]);
  for (const m of text.matchAll(/^\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*(['"])three\2/gm)) {
    for (const name of m[1].split(',')) {
      const n = name.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
      if (n) used.add(n);
    }
  }
  return [...used].filter(n => !THREE_ALLOWED.includes(n)).map(n => `${file}: THREE.${n}`);
}

describe('the simulation\'s boundary (STORY-095)', () => {
  it('imports nothing of the user interface, and of the view only the world\'s maths', () => {
    const files = [...reached()];
    expect(files.filter(f => f.startsWith('../ui/'))).toEqual([]);
    expect(files.filter(f => f.startsWith('../globe/') && !GLOBE_ALLOWED.includes(f))).toEqual([]);
    expect(files.length).toBeGreaterThan(20);
  });

  it('imports no package but Three.js', () => {
    const files = [...reached()];
    expect(files.flatMap(f => specifiersOf(sources[f]).filter(s => !s.startsWith('.') && !PACKAGES.includes(s)).map(s => `${f}: ${s}`))).toEqual([]);
  });

  it('touches no page: no document, window, navigator, storage, network, worker or element', () => {
    expect([...reached()].flatMap(f => pageHits(f, sources[f]))).toEqual([]);
  });

  it('draws nothing: of Three.js only vector maths and the hex grid\'s icosahedron', () => {
    expect([...reached()].flatMap(f => threeHits(f, sources[f]))).toEqual([]);
  });

  it('the checks see what they look for, whichever way it is written', () => {
    expect(specifiersOf([
      "import { a } from './a';",
      'import type { B } from "../b";',
      'import {\n  c,\n  d,\n} from \'./cd\';',
      "import './side';",
      "export * from './again';",
      "const m = await import('../ui/late');",
      "import * as THREE from 'three';",
    ].join('\n'))).toEqual(['./a', '../b', './cd', './side', './again', '../ui/late', 'three']);
    expect(pageHits('x.ts', [
      'const w = navigator.userAgent;',
      'const el: HTMLElement | null = null;',
      'new Worker(url);',
      'await fetch(url);',
      '// window in a comment',
      '/* document\n in a block comment */',
      "notice('the window of the hall');",
    ].join('\n'))).toEqual(['x.ts:1: const w = navigator.userAgent;', 'x.ts:2: const el: HTMLElement | null = null;', 'x.ts:3: new Worker(url);', 'x.ts:4: await fetch(url);']);
    expect(threeHits('x.ts', [
      "import { Scene, Vector3, type Mesh as M } from 'three';",
      'const m = new THREE.MeshBasicMaterial();',
      'const v = new THREE.Vector3();',
    ].join('\n')).sort()).toEqual(['x.ts: THREE.Mesh', 'x.ts: THREE.MeshBasicMaterial', 'x.ts: THREE.Scene']);
  });
});

/**
 * The player's acts are commands (STORY-112, project rule 7): the view and its cards change the
 * game only through dispatch. These write the game's state directly; the debug hooks
 * (globeDebug) may, for the tests set up their games with them.
 */
const DIRECT_ACTS = [
  /\.units\.(setMode|setTask|nextSite|setSite|setAreaPlan|setStateLine|sendTo|recruit|spawn|disband)\(/,
  /\.units\.flag\s*=(?!=)/,
  /\.(tax|lux|focus|gov|targetProvince|targetState|attitude|maps|since|anarchyUntil|plan)\s*=(?!=)/,
  /\.(gold|bulbs)\s*(?:[-+*]?=)(?!=)/,
  /\b(setState|startRevolution|setTargetState|setStateLine|setAreaPlan)\(/,
  /\bresearch\.(known|kinds)\.(add|delete|clear)\(/,
  /\bresearch\.target\s*=(?!=)/,
];

/** The lines of the view and the cards that act on the game directly, as path:line: text. */
export function directActs(file: string, text: string): string[] {
  const open = text.indexOf('(window as any).globeDebug = {');
  const close = open < 0 ? -1 : text.indexOf('\n};', open);
  // The debug hooks blanked, their lines kept for the numbers
  const kept = open < 0 ? text : text.slice(0, open) + text.slice(open, close).replace(/[^\n]/g, ' ') + text.slice(close);
  return codeLines(kept).filter(({ line }) => {
    const code = line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "''");
    // A method of an interface only names it (a panel's setTargetState(): void)
    if (/^\s*\w+\??\([^)]*\)\s*:[^=]*;\s*$/.test(code)) return false;
    return DIRECT_ACTS.some(re => re.test(code));
  }).map(({ i, line }) => `${file}:${i}: ${line.trim()}`);
}

describe('the player\'s acts are commands (STORY-112)', () => {
  const VIEW = Object.keys(sources).filter(f => (f === '../globe/main.ts' || f.startsWith('../ui/')) && !f.endsWith('.test.ts'));

  it('the view and the cards change the game only through commands', () => {
    expect(VIEW.length).toBeGreaterThan(10);
    expect(VIEW.flatMap(f => directActs(f, sources[f]))).toEqual([]);
  });

  it('the check sees a direct act, and not one in the debug hooks', () => {
    expect(directActs('x.ts', [
      'play.units.setMode(u, mode);',
      'if (play) play.tax = tax;',
      'p.gold -= item.amount;',
      'setState(t, "war", day, true);',
      'const same = play.tax === 50;',
      '  setTargetState(): void;',
      '(window as any).globeDebug = {',
      '  setGold: (gold: number) => { play.gold = gold; },',
      '};',
    ].join('\n'))).toEqual(['x.ts:1: play.units.setMode(u, mode);', 'x.ts:2: if (play) play.tax = tax;', 'x.ts:3: p.gold -= item.amount;', 'x.ts:4: setState(t, "war", day, true);']);
  });
});
