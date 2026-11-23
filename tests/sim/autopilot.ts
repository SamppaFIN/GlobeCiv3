/**
 * autopilot.ts — the game plays itself in Node under its advisors, and the measures of its pace
 * are taken (STORY-085). The measures are a report, not limits: only a level that does not open,
 * a run that stops or an invariant broken is a failure.
 *
 * Own definitions (STORY-085):
 * - A decision is a card the game asks the player to answer: a city site, raiders, a rival's
 *   proposal, or the advisors of a level that opens. In an autopilot game they are the player's
 *   commands in the log after the welcome's (the advisors of every level chosen at the start).
 * - An empty stretch is a run of days on which the game tells nothing: no decision, no notice,
 *   no moment (a city, a find, raiders, a victory, a level, an improvement) and no card.
 * - The confusion index is how many systems are new to the player within a minute of play at 1×
 *   speed (DAY_SECONDS a day, 40 days a minute): the most in any minute, and the mean. A system
 *   counts when the player can see it, whoever runs it: science the people choose, a government
 *   an advisor changes. A level comes with its own systems on the day it opens (the province
 *   with its borders), and each counts, for each is new to the player.
 * - The first decision comes after the welcome's (the advisors chosen at the start); under the
 *   advisors it is the card of the first level that opens.
 * - A run that stops (a card nothing answers) fails as a level not opened: the game cannot go on.
 * - What the game tells as a day is readied is stamped with the day before (Run.happened).
 * - Minutes are of play at 1× speed: a day is DAY_SECONDS of wall time (clock.ts).
 */
import { DAY_SECONDS } from '../../src/game/clock';
import { LUX_RATES, TAX_RATES } from '../../src/game/science';
import { TILE_COUNT } from '../../src/globe/hexTiles';
import { Run, type Advisors, type Happening } from '../../src/sim/run';
import type { GameState } from '../../src/sim/state';

/** The levels that open, as the progress counts them (4 the city, 0 the planet), with their names. */
export const LEVEL_NAMES: Record<number, string> = { 3: 'kaupunkialue', 2: 'lääni', 1: 'valtio', 0: 'planeetta' };
/** The levels of the MVP (CLAUDE.md, section 4): from the city to the state. */
export const MVP_LEVELS = [3, 2, 1];

/**
 * The systems a player meets (own list, from the levels of tasot-ja-aikakaudet.md), each seen
 * when it first shows: in the state, or in what the game told that day.
 */
const SYSTEMS: { name: string; seen: (s: GameState, today: Happening[]) => boolean }[] = [
  { name: 'rakennukset', seen: s => s.cities.some(c => c.buildings.length > 0) },
  { name: 'kantajat', seen: (_, t) => t.some(h => h.kind === 'carriers') },
  { name: 'kaupunkialue', seen: s => s.progress.openLevel <= 3 },
  { name: 'yksiköt', seen: s => s.units.units.length > 0 },
  { name: 'kaupunkipaikat', seen: s => s.offered.length > 0 },
  // A find is a ruin's or a site's moment (Utu's review): the ruins by the finds kept
  { name: 'rauniot', seen: s => s.found > 0 },
  { name: 'rosvot', seen: s => s.raids.band !== null },
  { name: 'maanparannus', seen: (_, t) => t.some(h => h.moment === 'improve') },
  { name: 'tiede', seen: s => s.research.target !== null || s.research.known.size > 0 },
  { name: 'uusi kaupunki', seen: s => s.cities.length > 1 },
  { name: 'lääni', seen: s => s.progress.openLevel <= 2 },
  { name: 'kulttuurirajat', seen: s => s.progress.openLevel <= 2 && s.cities.some(c => (c.culture ?? 0) > 0) },
  { name: 'työläiset', seen: s => s.units.units.some(u => u.kind === 'worker') },
  { name: 'valtio', seen: s => s.progress.openLevel <= 1 },
  { name: 'kilpailijat', seen: s => s.ties.some(t => t.met) },
  { name: 'diplomatia', seen: (s, t) => t.some(h => h.kind === 'treaty') || s.ties.some(x => x.state !== 'peace') },
  // A victory is a raid beaten off too (Utu's review): war by a campaign or a rival at war
  { name: 'sota', seen: s => s.war.target !== null || s.ties.some(x => x.state === 'war') },
  { name: 'hallitusmuoto', seen: s => s.gov !== 'despotism' },
  { name: 'planeetta', seen: s => s.progress.openLevel <= 0 },
];

/** What breaks the game's own rules on a day, if anything (STORY-085's invariants). */
export function broken(s: GameState, lastLevel: number): string | null {
  if (!Number.isFinite(s.gold) || s.gold < 0) return `gold ${s.gold}`;
  if (!(TAX_RATES as readonly number[]).includes(s.tax) || !(LUX_RATES as readonly number[]).includes(s.lux)) return `rates ${s.tax}/${s.lux}`;
  const tiles = new Set<number>();
  for (const c of s.cities) {
    if (!Number.isInteger(c.size) || c.size < 1) return `${c.name} size ${c.size}`;
    if (tiles.has(c.tile)) return `two cities on tile ${c.tile}`;
    tiles.add(c.tile);
  }
  for (const c of s.cities) if (c.food < 0 || c.shields < 0) return `${c.name} food ${c.food}, shields ${c.shields}`;
  if (s.pendingSite !== null && tiles.has(s.pendingSite)) return `the waiting site ${s.pendingSite} is a city`;
  for (const u of s.units.units) if (!Number.isInteger(u.tile) || u.tile < 0 || u.tile >= TILE_COUNT) return `${u.name} on tile ${u.tile}`;
  if (s.progress.openLevel > lastLevel) return `level ${lastLevel} closed again (${s.progress.openLevel})`;
  return null;
}

const minutes = (days: number) => Math.round((days * DAY_SECONDS / 60) * 10) / 10;

export interface Report {
  seed: number;
  advisors: Advisors;
  days: number;
  /** Why the run failed, if it did: a level not opened, the run stopped, or an invariant broken. */
  failure: string | null;
  firstDecision: { day: number; minutes: number; kind: string } | null;
  decisionsPerDay: number;
  decisions: number;
  longestEmpty: { days: number; minutes: number; from: number; to: number };
  /** Besides the five: the longest run of days without a decision. */
  longestWithoutDecision: { days: number; minutes: number; from: number; to: number };
  confusion: { peakPerMinute: number; peakAt: number; meanPerMinute: number };
  rises: { level: string; day: number; minutes: number }[];
  systems: { name: string; day: number }[];
  /** Besides the five: the most settlers at once (STORY-113's pile-up showed there). */
  mostSettlers: number;
}

/**
 * A new game of a seed under advisors, played until the state level opens (the MVP's last
 * rise) or the horizon, a day at a time, and measured.
 */
export function autopilot(seed: number, advisors: Advisors, horizon: number): Report {
  const run = Run.play(seed, advisors);
  const s = run.state;
  const welcome = s.commands.entries.length;
  const seen = new Map<string, number>();
  const rises: Report['rises'] = [];
  let level = s.progress.openLevel;
  let failure: string | null = null;
  let read = 0;
  let mostSettlers = 0;
  for (let day = 1; day <= horizon && !failure; day++) {
    if (!run.until(day)) { failure = `the run stopped on day ${run.clock.day}: ${run.state.over ? 'the game was lost' : run.error}`; break; }
    const today: Happening[] = [];
    for (; read < run.happened.length; read++) today.push(run.happened[read]);
    for (const sys of SYSTEMS) if (!seen.has(sys.name) && sys.seen(s, today)) seen.set(sys.name, day);
    failure = broken(s, level);
    mostSettlers = Math.max(mostSettlers, s.units.units.filter(u => u.kind === 'settler').length);
    while (s.progress.openLevel < level) {
      level--;
      rises.push({ level: LEVEL_NAMES[level], day, minutes: minutes(day) });
    }
    if (level <= Math.min(...MVP_LEVELS)) break;
  }
  // The last level's card answered too: its advisors are a decision
  if (!failure && !run.until(run.clock.day + 1)) failure = `the run stopped on day ${run.clock.day}: ${run.error}`;
  const days = run.clock.day;
  if (!failure) {
    const missing = MVP_LEVELS.filter(l => level > l).map(l => LEVEL_NAMES[l]);
    if (missing.length) failure = `not opened by day ${days}: ${missing.join(', ')}`;
  }
  // The decisions: the player's commands after the welcome's
  const decisions = run.snapshot().commands.slice(welcome).filter(e => e.by === 'player');
  const first = decisions[0];
  // The days on which the game told something (not the map lifting or the carriers walking), and the longest runs of days without
  const told = new Set(run.happened.filter(h => h.kind !== 'revealed' && h.kind !== 'carriers' && h.kind !== 'sent').map(h => h.day));
  const decided = new Set(decisions.map(e => e.day));
  const longest = (busy: (d: number) => boolean) => {
    let best = { days: 0, minutes: 0, from: 0, to: 0 };
    for (let from = 1, d = 1; d <= days + 1; d++) {
      if (d <= days && !busy(d)) continue;
      const length = d - from;
      if (length > best.days) best = { days: length, minutes: minutes(length), from, to: d - 1 };
      from = d + 1;
    }
    return best;
  };
  // Systems new within any minute of play
  const perMinute = Math.round(60 / DAY_SECONDS);
  const systems = [...seen].map(([name, day]) => ({ name, day })).sort((a, b) => a.day - b.day);
  let peak = 0, peakAt = 0;
  for (const { day } of systems) {
    const n = systems.filter(x => x.day >= day && x.day < day + perMinute).length;
    if (n > peak) { peak = n; peakAt = day; }
  }
  return {
    seed, advisors, days, failure,
    firstDecision: first ? { day: first.day, minutes: minutes(first.day), kind: first.cmd.kind } : null,
    decisions: decisions.length,
    decisionsPerDay: Math.round((decisions.length / Math.max(1, days)) * 1000) / 1000,
    longestEmpty: longest(d => decided.has(d) || told.has(d)),
    longestWithoutDecision: longest(d => decided.has(d)),
    confusion: { peakPerMinute: peak, peakAt, meanPerMinute: Math.round((systems.length / Math.max(0.1, minutes(days))) * 100) / 100 },
    rises,
    systems,
    mostSettlers,
  };
}
