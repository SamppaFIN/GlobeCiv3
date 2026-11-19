/**
 * nuclear.ts — the planet level's war of leaders, a trial (STORY-097).
 *
 * The mechanics of an old war-of-leaders game: leaders hold realms of people; envoys and
 * propaganda come first, and only when the world's tension is high enough do missiles and
 * their defence open. The last leader standing, or the most people at the end, wins.
 *
 * Every name, text and number here is our own (rule 4): no open source of the model game
 * is known. Sami's choices (2026-11-19): the game's day clock, one act at a time, a
 * tension meter that opens the weapons, and the realms on the globe. The trial does not
 * touch the real game.
 */

export type Trait = 'hawk' | 'dove' | 'talker';

export interface Leader {
  id: number;
  name: string;
  trait: Trait;
  /** The states of the realm, its capital first. */
  states: number[];
  /** People, millions. */
  people: number;
  missiles: number;
  shields: number;
  /** Attitude to each leader, −100 … 100. */
  ties: number[];
  ally: number | null;
  /** The day of the next act. */
  ready: number;
  /** Who struck this leader last with a missile, for the reply. */
  struckBy: number | null;
}

export type Act =
  | { kind: 'envoy'; to: number }
  | { kind: 'propaganda'; to: number }
  | { kind: 'raid'; to: number }
  | { kind: 'missile'; to: number }
  | { kind: 'build'; what: 'missile' | 'shield' };

export interface NuclearWorld {
  day: number;
  /** The world's tension, 0 … 100; the weapons open at NUKES_AT. */
  tension: number;
  leaders: Leader[];
  /** What happened lately, newest first. */
  log: string[];
  /** The winner, once the war is over. */
  winner: number | null;
  rng: number;
}

// Own numbers (STORY-097), for the trial; Sami and the playtest tune them.
/** Days between a leader's acts. */
export const ACT_DAYS = 4;
/** Tension at which the missiles and their defence open for everyone. */
export const NUKES_AT = 60;
/** The war ends on this day at the latest; the most people wins. */
export const LAST_DAY = 365;
export const MAX_SHIELDS = 3;
/** A leader with fewer people than this has fallen (millions). */
const FALLEN = 1;
/** Tension each act adds; tuned so that left alone the weapons open after some two months (seed 42). */
const TENSION: Record<Act['kind'] | 'broken', number> = { envoy: -4, propaganda: 2, raid: 3, missile: 10, build: 2, broken: 8 };
/** The tension cools this much a day. */
const COOL = 0.3;
/** Every missile that hits takes this share of everyone's people with the fallout. */
const FALLOUT = 0.01;
/** A defence stops a missile with this chance, and is spent. */
const INTERCEPT = 0.5;

const NAMES: [string, Trait][] = [
  ['Sinä', 'dove'],
  ['Marsalkka Rautakoura', 'hawk'],
  ['Kuningatar Kuura', 'dove'],
  ['Pääministeri Huuhkaja', 'talker'],
  ['Puheenjohtaja Ukonvaaja', 'hawk'],
];

/** A small seeded generator (mulberry32): the same seed and acts give the same war. */
function next(w: NuclearWorld): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const round = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => `${round(n).toLocaleString('fi-FI')} milj.`;

/**
 * A new war: a realm for each leader (the player first), each state 3–6 million people.
 * `realms` are the states of each realm, its capital first.
 */
export function newWar(seed: number, realms: number[][]): NuclearWorld {
  const w: NuclearWorld = { day: 0, tension: 10, leaders: [], log: [], winner: null, rng: seed | 0 };
  realms.forEach((states, id) => {
    let people = 0;
    for (let k = 0; k < states.length; k++) people += 3 + 3 * next(w);
    const [name, trait] = NAMES[id % NAMES.length];
    // The leaders act on different days, not all at once
    w.leaders.push({ id, name, trait, states, people: round(people), missiles: 0, shields: 0, ties: realms.map(() => 0), ally: null, ready: id === 0 ? 0 : 1 + (id % ACT_DAYS), struckBy: null });
  });
  return w;
}

export const alive = (l: Leader) => l.people >= FALLEN;
export const nukesOpen = (w: NuclearWorld) => w.tension >= NUKES_AT;

/** Whether the leader may do this now. */
export function canAct(w: NuclearWorld, by: number, act: Act): boolean {
  const l = w.leaders[by];
  if (w.winner !== null || !l || !alive(l) || w.day < l.ready) return false;
  if (act.kind === 'build') return nukesOpen(w) && (act.what === 'missile' || l.shields < MAX_SHIELDS);
  const t = w.leaders[act.to];
  if (!t || t === l || !alive(t)) return false;
  if (act.kind === 'missile') return nukesOpen(w) && l.missiles > 0;
  return true;
}

function tense(w: NuclearWorld, by: number) {
  w.tension = Math.max(0, Math.min(100, w.tension + by));
}

function feel(w: NuclearWorld, a: number, b: number, by: number) {
  for (const [x, y] of [[a, b], [b, a]]) {
    const l = w.leaders[x];
    l.ties[y] = Math.max(-100, Math.min(100, l.ties[y] + by));
    // Allies part when their attitude falls below zero; a broken alliance raises the tension
    if (l.ally === y && l.ties[y] < 0) {
      l.ally = w.leaders[y].ally = null;
      tense(w, TENSION.broken);
      w.log.unshift(`Liitto purkautui: ${l.name} ja ${w.leaders[y].name}`);
    }
  }
}

function lose(w: NuclearWorld, l: Leader, people: number) {
  l.people = round(Math.max(0, l.people - people));
  if (!alive(l)) w.log.unshift(`Kukistui: ${l.name}`);
}

/** Carries out an act, a command of the trial; returns whether it took effect. */
export function act(w: NuclearWorld, by: number, a: Act): boolean {
  if (!canAct(w, by, a)) return false;
  const l = w.leaders[by];
  l.ready = w.day + ACT_DAYS;
  tense(w, TENSION[a.kind]);
  if (a.kind === 'build') {
    if (a.what === 'missile') l.missiles++;
    else l.shields++;
    w.log.unshift(`Rakennus: ${l.name}, ${a.what === 'missile' ? 'ohjus' : 'torjunta'}`);
    return true;
  }
  const t = w.leaders[a.to];
  if (a.kind === 'envoy') {
    feel(w, by, a.to, 15);
    if (l.ties[a.to] >= 50 && t.ties[by] >= 50 && l.ally === null && t.ally === null) {
      l.ally = a.to;
      t.ally = by;
      w.log.unshift(`Liitto: ${l.name} ja ${t.name}`);
    } else w.log.unshift(`Lähettiläs: ${l.name} → ${t.name}`);
  } else if (a.kind === 'propaganda') {
    const moved = round(t.people * (0.01 + 0.03 * next(w)));
    lose(w, t, moved);
    l.people = round(l.people + moved);
    feel(w, by, a.to, -20);
    w.log.unshift(`Propaganda: ${l.name} → ${t.name}, ${fmt(moved)} siirtyi`);
  } else if (a.kind === 'raid') {
    const dead = round(t.people * (0.01 + 0.02 * next(w)));
    lose(w, t, dead);
    lose(w, l, round(l.people * 0.005));
    feel(w, by, a.to, -30);
    w.log.unshift(`Hyökkäys: ${l.name} → ${t.name}, −${fmt(dead)}`);
  } else {
    l.missiles--;
    feel(w, by, a.to, -60);
    t.struckBy = by;
    if (t.shields > 0 && next(w) < INTERCEPT) {
      t.shields--;
      w.log.unshift(`Torjunta: ${t.name} pysäytti ohjuksen (${l.name})`);
    } else {
      const dead = round(t.people * (0.15 + 0.15 * next(w)));
      lose(w, t, dead);
      for (const x of w.leaders) if (alive(x)) lose(w, x, round(x.people * FALLOUT));
      w.log.unshift(`Ohjusisku: ${l.name} → ${t.name}, −${fmt(dead)}`);
    }
  }
  w.log.length = Math.min(w.log.length, 8);
  return true;
}

/** What a leader of the computer does when its turn comes, by its trait. */
export function choose(w: NuclearWorld, by: number): Act | null {
  const l = w.leaders[by];
  const others = w.leaders.filter(x => x !== l && alive(x));
  if (!others.length) return null;
  const foes = others.filter(x => x.id !== l.ally).sort((a, b) => l.ties[a.id] - l.ties[b.id] || a.id - b.id);
  const weakest = [...foes].sort((a, b) => a.people - b.people || a.id - b.id)[0];
  const biggest = [...foes].sort((a, b) => b.people - a.people || a.id - b.id)[0];
  const options: Act[] = [];
  if (nukesOpen(w)) {
    // A missile answers a missile
    if (l.struckBy !== null && alive(w.leaders[l.struckBy])) options.push({ kind: 'missile', to: l.struckBy });
    if (l.trait === 'hawk' && foes[0]) options.push({ kind: 'missile', to: foes[0].id });
    if (l.trait !== 'dove' && l.missiles < 2) options.push({ kind: 'build', what: 'missile' });
    if (l.shields < 2) options.push({ kind: 'build', what: 'shield' });
  }
  if (l.trait === 'hawk' && weakest) options.push({ kind: 'raid', to: weakest.id });
  if (l.trait === 'talker' && biggest) options.push({ kind: 'propaganda', to: biggest.id });
  if (foes[0]) options.push({ kind: 'envoy', to: foes[0].id });
  return options.find(a => canAct(w, by, a)) ?? null;
}

/** One day passes: the tension cools a little, the computer's leaders act, and the war may end. */
export function day(w: NuclearWorld) {
  if (w.winner !== null) return;
  w.day++;
  tense(w, -COOL);
  for (const l of w.leaders) {
    if (l.id === 0 || !alive(l) || w.day < l.ready) continue;
    const a = choose(w, l.id);
    if (a) act(w, l.id, a);
    else l.ready = w.day + ACT_DAYS;
  }
  const standing = w.leaders.filter(alive);
  if (standing.length <= 1 || w.day >= LAST_DAY || !alive(w.leaders[0])) {
    const top = [...standing].sort((a, b) => b.people - a.people || a.id - b.id)[0];
    w.winner = top ? top.id : -1;
    w.log.unshift(top ? `Sota päättyi: voittaja ${top.name}` : 'Sota päättyi: kukaan ei jäänyt');
  }
}
