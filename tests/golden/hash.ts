/**
 * hash.ts — how the golden runs compare states (STORY-095): the browser's golden runs
 * (tests/e2e/golden.e2e.ts) and the runs in Node (src/sim/run.test.ts) hash them alike.
 */
import { createHash } from 'node:crypto';

/** JSON with every object's keys sorted, so the order fields are built in does not count. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const sha = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');

/** Without the defaults a load fills in (a city's entertainers), so a loaded game hashes as the live one. */
const strip = (v: unknown): unknown => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k, x]) => !(k === 'entertainers' && x === 0)).map(([k, x]) => [k, strip(x)])) : v);

/** The game without the notices, which are not saved. */
export function playOf(s: Record<string, unknown>): unknown {
  const { notices: _notices, ...rest } = s;
  return strip(rest);
}

/** The game's own state: also without the selected unit, which is the view's (and the wall clock and speed, never in it). */
export function simOf(s: Record<string, unknown>): unknown {
  const { notices: _notices, selected: _selected, savedAt: _at, speed: _speed, paused: _paused, ...rest } = s;
  return strip(rest);
}
