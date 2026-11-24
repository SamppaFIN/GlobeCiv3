/**
 * nuclear.ts — the planet level's nuclear war, a trial (STORY-126; replaces STORY-097's rules).
 *
 * The rules and numbers of an old Amiga war-of-leaders game, from the reconstruction
 * github.com/leetlamer/NuclearWar-ReNuked-Web (commit 691fa2b: wasm/src/game/game_rules.cpp,
 * wasm/src/game/ai/ai_controller.cpp and wasm/src/game/revenge/revenge_system.hpp). That
 * repository has no licence and carries the original game's pictures, sounds and texts, so
 * only rules and numbers are borrowed (rule 4): the code, names and texts are our own. A rule
 * of our own is marked "own". The numbers keep the original's 16-bit words where a table's
 * product can wrap (w16), so the leaders' moods follow the same arithmetic.
 *
 * Five leaders, the player last in the order of play as in the original. Each holds five
 * cities of people (millions). A round: the player gives an order, the computer's leaders
 * plan in order, their attitudes change, and the acts are resolved in order into a list of
 * events that the panel plays back. Same seed, same opponents and same orders, same war (rule 7).
 */

export const LEADERS = 5;
export const CITIES = 5;
/**
 * Own: the war ends at this round at the latest, the best score winning. Without it a war of
 * builders could go on for ever; the computer's wars of seeds 1–40 ended in 37–78 rounds.
 */
export const LAST_ROUND = 100;
/** The player's place, last in the order of play (the original's actor 4). */
export const PLAYER = 4;

export type Profile = 0 | 1 | 2 | 3 | 4;

/** Warhead sizes in megatons by class (class_capacity). */
export const MEGATONS = [10, 20, 50, 100] as const;
/** A warhead's blast in millions of people, before a die is added (class_effect). */
export const BLAST = [2, 5, 10, 25] as const;
/** What a bomber carries in megatons by class (select_human_delivery_fields: 50 × class + 50). */
export const BOMBER_LOAD = [50, 100] as const;

/** What a leader does this round (the original's action codes 0–7). */
export type Doing = 'idle' | 'launch' | 'loadMissile' | 'propaganda' | 'loadBomber' | 'bomb' | 'build' | 'defend';

export interface WarCity { state: number; name: string; people: number }

export interface Warlord {
  persona: string;
  profile: Profile;
  cities: WarCity[];
  /** Stock by class: warheads and missiles four, bombers and defences two. */
  warheads: number[];
  missiles: number[];
  bombers: number[];
  defenses: number[];
  /** Hostility to each leader, −32767 … 32767 (the original's scores); the most hostile is the foe. */
  hostility: number[];
  /** How this leader classes each leader, −2 … 2 (the player sets his own: a smile to a fist). */
  stance: number[];
  doing: Doing;
  /** The act's leader and city. */
  target: number;
  city: number;
  /** Propaganda's millions, a strike's blast, or a defence's class. */
  magnitude: number;
  /** The strike's warhead class, or −1 for none. */
  warhead: number;
  /** The loaded missile's or bomber's class. */
  delivery: number;
  /** Megatons the loaded missile or bomber still carries (prepared_capacity). */
  capacity: number;
}

export interface War {
  seed: number;
  rng: number;
  round: number;
  leaders: Warlord[];
  /** The leader the computer's leaders each chose as their foe this round. */
  foes: number[];
  /** The winner once the war is over: a leader, or −1 when none is left. */
  winner: number | null;
  /** The player's orders, in order (rule 7). */
  orders: Order[];
}

/** The player's orders, serialisable commands (rule 7). A stance does not end the round. */
export type Order =
  | { kind: 'build' }
  | { kind: 'propaganda'; leader: number; city: number }
  | { kind: 'loadMissile'; missile: number }
  | { kind: 'loadBomber'; bomber: number }
  | { kind: 'launch'; warhead: number; leader: number; city: number }
  | { kind: 'bomb'; warhead: number; leader: number; city: number }
  | { kind: 'defend'; defense: number }
  | { kind: 'stance'; leader: number; stance: number }
  /** Only when the player has fallen: the round goes on without him. */
  | { kind: 'watch' };

/** A strike's end: a hit, a dud (a bomber crashes), a miss, stopped by a defence, or on a city already empty. */
export type StrikeOutcome = 'hit' | 'dud' | 'miss' | 'stopped' | 'crash' | 'ruins';

/** A propaganda gone strange: the original's special events, by our own names. */
export type Mishap = 'vanish' | 'weight' | 'ufo' | 'boom' | 'cow' | 'quake' | 'fallout' | 'exodus' | 'defect';

export interface Made { warheads: number[]; missiles: number[]; bombers: number[]; defenses: number[] }

/** What happened in a round, in order, for the panel to play back. `people` is everyone's cities after it. */
export type WarEvent = { people: number[][] } & (
  | { kind: 'load'; by: number; what: 'missile' | 'bomber'; cls: number }
  | { kind: 'defend'; by: number; cls: number }
  | { kind: 'build'; by: number }
  | { kind: 'made'; by: number; made: Made }
  | { kind: 'propaganda'; by: number; target: number; from: number; to: number; moved: number }
  | { kind: 'mishap'; by: number; mishap: Mishap; leader: number; city: number; moved: number; to?: { leader: number; city: number } }
  | { kind: 'strike'; by: number; target: number; city: number; delivery: 'missile' | 'bomber'; warhead: number; roll: number; outcome: StrikeOutcome; loss: number; revenge: boolean }
  | { kind: 'fall'; who: number }
  /** The war's end: the last one standing, or at the round limit the best score (`byScore`). */
  | { kind: 'end'; winner: number; byScore: boolean }
);

// ─── Numbers (game_rules.cpp) ─

/** First people of a city by profile: random % MOD + BASE millions (initial_city_population). */
const POP_MOD = [26, 16, 16, 50, 36];
const POP_BASE = [10, 15, 20, 1, 5];
/** The computer's first stock by profile (initialize_state); profile 3 builds twice instead. */
const STOCK: Record<number, Partial<Made>> = {
  0: { warheads: [1, 3, 0, 0], missiles: [1, 3, 0, 0], defenses: [1, 0] },
  1: { warheads: [1, 2, 2, 0], missiles: [1, 1, 1, 0], bombers: [1, 0] },
  2: { warheads: [3, 0, 0, 0], missiles: [3, 0, 0, 0], defenses: [1, 1] },
  4: { warheads: [2, 2, 0, 0], missiles: [2, 2, 0, 0] },
};
/** The player's first stock: a 10 Mt warhead, a missile and a defence. */
const PLAYER_STOCK: Partial<Made> = { warheads: [1, 0, 0, 0], missiles: [1, 0, 0, 0], defenses: [1, 0] };

/** The chance of propaganda (category 1) and of weapons (2) by the foe's row and profile (ai_category tables). */
const PROPAGANDA_PCT = [[5, 0, 100, 30, 60], [15, 5, 94, 40, 50], [80, 10, 90, 35, 50], [50, 5, 80, 40, 60], [30, 0, 70, 50, 33]];

/** How a leader's hostility moves each round by its tier, the other's stance and its profile (attitude_tables), × 100. */
const ATTITUDE = [
  [[-5, 5, -5, 10, 2000], [-20, 10, -20, 20, -10], [10, 10, -5, 30, 20], [20, -5, 10, -5, 5], [30, 10, 20, -30, 2000]],
  [[5, -20, 5, -5, 2000], [-10, 5, -10, -5, 5], [-5, 20, -10, 20, -10], [5, -5, 10, -5, 5], [10, -10, 10, -20, 2000]],
  [[20, 30, -40, -20, 2000], [10, 20, -10, -10, -20], [-5, 5, -5, 10, -10], [30, -10, 5, 20, -5], [30, 30, 30, 30, 2000]],
];
/**
 * How onlookers' hostility to a leader moves by event, tier and profile (event_score_delta):
 * 0 an attack seen, 1 an attack suffered, 2 propaganda seen, 3 propaganda suffered, 4 a defence, 5 a build.
 */
const EVENT = [
  [[2, 1, 3, 0, 0], [0, -1, 1, -1, 1], [-2, -3, -1, -1, -1]],
  [[4, 2, 6, 3, 3], [4, 2, 6, 3, 3], [4, 2, 6, 3, 3]],
  [[3, 4, 2, 1, 1], [1, 2, -2, 0, 0], [-1, 0, -2, -1, -1]],
  [[3, 6, 1, 4, 3], [3, 6, 1, 4, 3], [3, 6, 1, 4, 3]],
  [[-100, 100, -200, 100, 200], [-50, 300, -100, 100, 100], [300, 500, -500, 0, 100]],
  [[0, -40, 60, -20, 20], [0, -40, 60, -20, 20], [0, -40, 60, -20, 20]],
];
/** The player's penalty: unloading a weapon or building twice in a row (human_commit). */
const PENALTY = 0x3332;

const MAX = 32767;
/** A 16-bit signed word, as the original stores its products. */
const w16 = (x: number) => (x << 16) >> 16;
const clamp = (x: number) => Math.max(-MAX, Math.min(MAX, x));

// ─── Random (own: our seeded generator in place of the original's) ─

/** mulberry32: the same seed gives the same war. */
function next(w: War): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** 0 … n − 1, the original's `random % n`. */
const roll = (w: War, n: number) => Math.floor(next(w) * n);

// ─── Helpers ─

export const peopleOf = (l: Warlord) => l.cities.reduce((s, c) => s + c.people, 0);
export const citiesOf = (l: Warlord) => l.cities.filter(c => c.people > 0).length;
export const alive = (l: Warlord) => citiesOf(l) > 0;
const highest = (a: number[]) => { for (let c = a.length - 1; c >= 0; c--) if (a[c] > 0) return c; return -1; };
/** The largest warhead that fits a load of megatons (fitting_warhead). */
function fitting(l: Warlord, load: number): number {
  for (let c = 3; c >= 0; c--) if (l.warheads[c] > 0 && load >= MEGATONS[c]) return c;
  return -1;
}
const tier = (h: number) => (h < -9000 ? 0 : h > 9000 ? 2 : 1);
/** −2 … 2: very friendly to very hostile (relationship_bucket). */
const bucket = (h: number) => (h < -18000 ? -2 : h < -9000 ? -1 : h > 18000 ? 2 : h > 9000 ? 1 : 0);
const snapshot = (w: War) => w.leaders.map(l => l.cities.map(c => c.people));

/**
 * A city of `of` as `by`'s profile picks it (choose_city): 0 the last living, 1 the largest,
 * 2 the smallest, 3 and 4 by chance. −1 when none lives.
 */
export function pick(w: War, profile: Profile, of: Warlord): number {
  const p = of.cities.map(c => c.people);
  if (!p.some(x => x > 0)) return -1;
  if (profile === 0) return p.reduce((at, x, i) => (x > 0 ? i : at), -1);
  if (profile === 1) return p.reduce((at, x, i) => (x > (at < 0 ? 0 : p[at]) ? i : at), -1);
  // Own: no cap of 255 million on the smallest (the original starts from 255)
  if (profile === 2) return p.reduce((at, x, i) => (x > 0 && x <= (at < 0 ? Infinity : p[at]) ? i : at), -1);
  let steps = roll(w, 5) + 1;
  for (let i = 0; ; i = (i + 1) % CITIES) if (p[i] > 0 && --steps === 0) return i;
}

/** The kind of thing a build makes from two rolls of 1 … 100 (production_item). */
export function madeItem(kind: number, cls: number): { stock: keyof Made; cls: number } {
  if (kind <= 55) return { stock: 'warheads', cls: cls <= 25 ? 0 : cls <= 65 ? 1 : cls <= 90 ? 2 : 3 };
  if (kind <= 80) return { stock: 'missiles', cls: cls <= 20 ? 0 : cls <= 55 ? 1 : cls <= 85 ? 2 : 3 };
  return { stock: kind <= 95 ? 'bombers' : 'defenses', cls: cls > 60 ? 1 : 0 };
}

/** A build: one item for each living city and one more (produce). */
function produce(w: War, l: Warlord): Made {
  const made: Made = { warheads: [0, 0, 0, 0], missiles: [0, 0, 0, 0], bombers: [0, 0], defenses: [0, 0] };
  for (let n = citiesOf(l) + 1; n > 0; n--) {
    const item = madeItem(roll(w, 100) + 1, roll(w, 100) + 1);
    l[item.stock][item.cls]++;
    made[item.stock][item.cls]++;
  }
  return made;
}

// ─── A new war ─

/**
 * A new war. `personas` are the leaders in order of play, the player last; `profiles` their
 * profiles; `cities` each leader's five cities (state and name), its capital first.
 */
export function newWar(seed: number, personas: string[], profiles: Profile[], cities: { state: number; name: string }[][]): War {
  const w: War = { seed, rng: seed | 0, round: 0, leaders: [], foes: [PLAYER, PLAYER, PLAYER, PLAYER, PLAYER], winner: null, orders: [] };
  for (let i = 0; i < LEADERS; i++) {
    // The player's cities are drawn as profile 0's (initial_city_population)
    const profile = i === PLAYER ? 0 : profiles[i];
    const l: Warlord = {
      persona: personas[i], profile,
      cities: cities[i].map(c => ({ ...c, people: roll(w, POP_MOD[profile]) + POP_BASE[profile] })),
      warheads: [0, 0, 0, 0], missiles: [0, 0, 0, 0], bombers: [0, 0], defenses: [0, 0],
      hostility: [0, 0, 0, 0, 0], stance: [0, 0, 0, 0, 0],
      doing: 'idle', target: 0, city: 0, magnitude: 0, warhead: -1, delivery: 0, capacity: 0,
    };
    w.leaders.push(l);
    const stock = i === PLAYER ? PLAYER_STOCK : STOCK[profile];
    if (stock) {
      for (const k of ['warheads', 'missiles', 'bombers', 'defenses'] as const) if (stock[k]) l[k] = [...stock[k]!];
    } else {
      produce(w, l);
      produce(w, l);
    }
  }
  return w;
}

// ─── Moods ─

/**
 * Onlookers' hostility to `actor` moves after an event (apply_relationship_event). The one
 * it was done to takes it harder: a friend turns into a foe at once.
 */
function feel(w: War, actor: number, event: number, affected: number, magnitude: number) {
  for (let i = 0; i < LEADERS; i++) {
    if (i === PLAYER || i === actor) continue;
    const o = w.leaders[i];
    const h = o.hostility[actor];
    const e = event + (affected === i && (event === 0 || event === 2) ? 1 : 0);
    const direct = e === 1 || e === 3;
    if (direct && h < -9000) { o.hostility[actor] = -h; continue; }
    let delta = w16(EVENT[e][tier(h)][o.profile] * (e === 4 ? 10 : 100));
    if (e < 4) delta = w16(delta * magnitude);
    o.hostility[actor] = clamp(h + delta + (direct ? 9000 : 0));
  }
}

/** Each round the computer's leaders' moods drift by their temper and the other's stance (update_attitudes). */
function drift(w: War) {
  const before = w.leaders.map(l => [...l.stance]);
  for (let i = 0; i < PLAYER; i++) {
    const a = w.leaders[i];
    for (let j = 0; j < LEADERS; j++) {
      if (j === i) continue;
      const raw = ATTITUDE[tier(a.hostility[j])][before[j][i] + 2][a.profile];
      a.hostility[j] = clamp(a.hostility[j] + w16(raw * 100));
    }
  }
  // As in the reconstruction, a leader's stance comes from its mood to itself, carried
  // along the row (the tier is reloaded only on the diagonal): mostly −1, −2 after penalties
  let t = 0;
  for (let i = 0; i < PLAYER; i++) {
    for (let j = 0; j < LEADERS; j++) {
      if (i === j) t = tier(w.leaders[i].hostility[i]);
      w.leaders[i].stance[j] = t - 2;
    }
  }
}

/** Profile 3, the unpredictable, swings its moods after every round (perturb_profile3_scores). */
function swing(w: War) {
  for (let i = 0; i < PLAYER; i++) {
    const a = w.leaders[i];
    if (a.profile !== 3 || !alive(a)) continue;
    for (let j = 0; j < LEADERS; j++) if (j !== i && alive(w.leaders[j])) a.hostility[j] = clamp(a.hostility[j] + w16((roll(w, 5) - 2) * 9000));
  }
}

// ─── The computer's plans (ai_controller.cpp) ─

/** The foe: the most hostile living leader, by chance among equals (select_opponent). Returns its row, −2 … 2. */
function chooseFoe(w: War, i: number): number {
  const a = w.leaders[i];
  const others = w.leaders.map((_, c) => c).filter(c => c !== i && alive(w.leaders[c]));
  w.foes[i] = PLAYER;
  if (!others.length) return bucket(a.hostility[i]);
  const max = Math.max(...others.map(c => a.hostility[c]));
  const best = others.filter(c => a.hostility[c] === max);
  const top = best[best.length - 1];
  w.foes[i] = top;
  if (best.length > 1) w.foes[i] = best[roll(w, best.length)];
  else {
    const rest = others.filter(c => a.hostility[c] !== max);
    if (rest.length) {
      const nextMax = Math.max(...rest.map(c => a.hostility[c]));
      const second = rest.filter(c => a.hostility[c] === nextMax).pop()!;
      if (roll(w, 100) + 1 > Math.min(max - nextMax, 50) + 50) w.foes[i] = second;
    }
  }
  return bucket(a.hostility[top]);
}

/**
 * A defence when the leader most hostile to it is about to strike (plan_defense): one that
 * already planned this round is seen launching, one later in the order is seen loaded.
 */
function planDefense(w: War, i: number): boolean {
  const a = w.leaders[i];
  let t = w.foes[i];
  let h = w.leaders[t].hostility[i];
  if (t !== PLAYER) {
    for (let c = 0; c < PLAYER; c++) {
      if (c !== i && alive(w.leaders[c]) && h < w.leaders[c].hostility[i]) { h = w.leaders[c].hostility[i]; t = c; }
    }
  }
  const doing = w.leaders[t].doing;
  const earlier = t < i || t === PLAYER;
  // Own: a strike already planned this round is met only when it is aimed at this leader
  if (earlier && (doing === 'launch' || doing === 'bomb') && w.leaders[t].target !== i) return false;
  let d = -1;
  if (doing === (earlier ? 'bomb' : 'loadBomber') && a.defenses[1] > 0) d = 1;
  if (doing === (earlier ? 'launch' : 'loadMissile')) d = a.defenses[0] > 0 ? 0 : a.defenses[1] > 0 ? 1 : -1;
  if (d < 0) return false;
  a.defenses[d]--;
  a.doing = 'defend';
  a.magnitude = d;
  return true;
}

/** Propaganda at the foe's city its profile picks: 1 … 10 million (plan_propaganda). */
function planPropaganda(w: War, i: number, t: number) {
  const a = w.leaders[i];
  const c = pick(w, a.profile, w.leaders[t]);
  // Own: with no city to pick the leader idles (the original keeps its last act)
  if (c < 0) { a.doing = 'idle'; return; }
  a.doing = 'propaganda';
  a.target = t;
  a.city = c;
  a.magnitude = roll(w, 10) + 1;
}

/**
 * Weapons (weapons_impl): a loaded missile is launched and a bomber strikes while its load
 * lasts; otherwise, with three warheads and three missiles or bombers, one is loaded, and
 * with fewer the leader builds.
 */
function planWeapons(w: War, i: number, t: number) {
  const a = w.leaders[i];
  const city = pick(w, a.profile, w.leaders[t]);
  const build = () => { a.doing = alive(a) ? 'build' : 'idle'; };
  if (a.doing === 'loadMissile' || a.doing === 'loadBomber' || a.doing === 'bomb') {
    if (a.doing === 'loadMissile') {
      const c = fitting(a, a.capacity);
      if (c >= 0) a.warheads[c]--;
      Object.assign(a, { doing: 'launch', target: t, city, warhead: c, magnitude: c >= 0 ? BLAST[c] : 0 });
      return;
    }
    // Own: the largest warhead that fits the load left, as for the player (the original may overload)
    const c = fitting(a, a.capacity);
    if (c < 0) { build(); return; }
    a.warheads[c]--;
    Object.assign(a, { doing: 'bomb', target: t, city, warhead: c, magnitude: BLAST[c], capacity: a.capacity - MEGATONS[c] });
    return;
  }
  const warhead = highest(a.warheads);
  const missile = highest(a.missiles);
  const bomber = highest(a.bombers);
  const load = warhead >= 0 ? MEGATONS[warhead] : 0;
  const sum = (x: number[]) => x.reduce((s, n) => s + n, 0);
  const heads = sum(a.warheads);
  const enough = sum(a.missiles) + sum(a.bombers) >= 3 && heads >= 3;
  const bomberLoad = bomber === 0 ? 50 : 100;
  let plan = 3;
  if (enough && bomber >= 0 && heads >= 5 && bomberLoad >= load) plan = 2;
  // Own: a missile carries its own class's load, as the player's does (the original gives the
  // computer's missile its largest warhead's), so one is loaded only when a warhead fits it
  if (enough && plan === 3 && missile >= 0 && fitting(a, MEGATONS[missile]) >= 0) plan = 1;
  if (enough && plan === 3 && bomber >= 0 && fitting(a, bomberLoad) > 0) plan = 2;
  if (plan === 1) {
    a.missiles[missile]--;
    Object.assign(a, { doing: 'loadMissile', delivery: missile, capacity: MEGATONS[missile] });
  } else if (plan === 2) {
    a.bombers[bomber]--;
    Object.assign(a, { doing: 'loadBomber', delivery: bomber, capacity: bomberLoad });
  } else build();
}

/** The computer's leaders plan in order (ai_turn). */
function plan(w: War) {
  for (let i = 0; i < PLAYER; i++) {
    const a = w.leaders[i];
    // Own: a fallen leader plans nothing
    if (!alive(a)) continue;
    const row = chooseFoe(w, i) + 2;
    if ((a.defenses[0] > 0 || a.defenses[1] > 0) && planDefense(w, i)) continue;
    const t = w.foes[i];
    const loaded = a.doing === 'loadBomber' || a.doing === 'bomb' || a.doing === 'loadMissile';
    const category = loaded ? 2 : roll(w, 100) + 1 <= PROPAGANDA_PCT[row][a.profile] ? 1 : 2;
    if (category === 1) planPropaganda(w, i, t);
    else planWeapons(w, i, t);
  }
}

// ─── The player's orders ─

/** Whether the player may give this order now. */
export function canOrder(w: War, o: Order): boolean {
  const me = w.leaders[PLAYER];
  if (w.winner !== null) return false;
  if (o.kind === 'watch') return !alive(me);
  if (!alive(me)) return false;
  const target = (leader: number, city: number) => leader >= 0 && leader < PLAYER && w.leaders[leader].cities[city]?.people > 0;
  switch (o.kind) {
    case 'build': return true;
    case 'stance': return o.leader >= 0 && o.leader < PLAYER && Number.isInteger(o.stance) && o.stance >= -2 && o.stance <= 2;
    case 'propaganda': return target(o.leader, o.city);
    case 'loadMissile': return me.missiles[o.missile] > 0;
    case 'loadBomber': return me.bombers[o.bomber] > 0;
    case 'defend': return me.defenses[o.defense] > 0;
    case 'launch': return me.doing === 'loadMissile' && me.warheads[o.warhead] > 0 && MEGATONS[o.warhead] <= me.capacity && target(o.leader, o.city);
    case 'bomb': return (me.doing === 'loadBomber' || me.doing === 'bomb') && me.capacity > 0 && me.warheads[o.warhead] > 0 && MEGATONS[o.warhead] <= me.capacity && target(o.leader, o.city);
  }
}

/** Whether the order unloads a weapon or builds twice in a row: the others take offence (human_commit). */
export function offends(w: War, o: Order): boolean {
  const d = w.leaders[PLAYER].doing;
  if (o.kind === 'stance' || o.kind === 'watch') return false;
  return (o.kind === 'build' && d === 'build') || (d === 'loadMissile' && o.kind !== 'launch') || (d === 'loadBomber' && o.kind !== 'bomb');
}

function commit(w: War, o: Order) {
  const me = w.leaders[PLAYER];
  if (offends(w, o)) {
    for (let i = 0; i < PLAYER; i++) {
      const h = w.leaders[i].hostility;
      h[PLAYER] = h[PLAYER] < 0x4df8 ? h[PLAYER] + PENALTY : MAX;
      for (let j = 0; j < PLAYER; j++) h[j] = h[j] <= -0x4df8 ? -MAX : h[j] - PENALTY;
    }
  }
  switch (o.kind) {
    case 'build': me.doing = 'build'; break;
    case 'propaganda': Object.assign(me, { doing: 'propaganda', target: o.leader, city: o.city, magnitude: roll(w, 10) + 1 }); break;
    case 'loadMissile': me.missiles[o.missile]--; Object.assign(me, { doing: 'loadMissile', delivery: o.missile, capacity: MEGATONS[o.missile] }); break;
    case 'loadBomber': me.bombers[o.bomber]--; Object.assign(me, { doing: 'loadBomber', delivery: o.bomber, capacity: BOMBER_LOAD[o.bomber] }); break;
    case 'defend': me.defenses[o.defense]--; Object.assign(me, { doing: 'defend', magnitude: o.defense }); break;
    case 'launch':
    case 'bomb':
      me.warheads[o.warhead]--;
      Object.assign(me, { doing: o.kind, target: o.leader, city: o.city, warhead: o.warhead, magnitude: BLAST[o.warhead], capacity: me.capacity - MEGATONS[o.warhead] });
      break;
  }
}

// ─── Resolving a round ─

/**
 * A strike (begin_attack_roll, prepare_combat_impact, damage_effect): two dice, a seven
 * thrown again; 2 a dud (a bomber is lost), 3 a miss, 4 two million fewer, 5 one more,
 * 8 two more, 9 five, 10 ten, 11 twice and 12 three times, or the whole city under a
 * 100 Mt warhead. A defence stops it: the first kind missiles, the second bombers too.
 */
function strike(w: War, events: WarEvent[], by: number, revenge: boolean) {
  const a = w.leaders[by];
  const d = w.leaders[a.target];
  const city = d.cities[a.city];
  const bomber = a.doing === 'bomb';
  const ruins = city.people === 0;
  let roll2: number;
  do roll2 = roll(w, 6) + roll(w, 6) + 2; while (roll2 === 7);
  const was25 = a.magnitude === 25;
  const blast = a.magnitude + roll(w, 6) + 1;
  const stopped = d.doing === 'defend' && stops(d.magnitude, bomber);
  const r = strikeTable(stopped ? 13 : roll2, blast, city.people, was25, bomber);
  let loss = r.loss;
  const outcome: StrikeOutcome = ruins && r.outcome === 'hit' ? 'ruins' : r.outcome;
  // A dud or a defence spends the weapon: a bomber is lost with what it still carries
  if (r.outcome === 'dud' || r.outcome === 'crash' || r.outcome === 'stopped') {
    a.capacity = 0;
    if (bomber) a.doing = 'idle';
  }
  city.people -= loss;
  feel(w, by, 0, a.target, loss);
  events.push({ kind: 'strike', by, target: a.target, city: a.city, delivery: bomber ? 'bomber' : 'missile', warhead: a.warhead, roll: roll2, outcome, loss, revenge, people: snapshot(w) });
}

/**
 * The strike table (damage_effect) on the blast (warhead + d6) and a city of `people`:
 * 13 stands for a defence. The loss is at most the city's people.
 */
export function strikeTable(effect: number, blast: number, people: number, was25: boolean, bomber: boolean): { loss: number; outcome: StrikeOutcome } {
  let loss = Math.min(blast, people);
  let outcome: StrikeOutcome = 'hit';
  switch (effect) {
    case 2: loss = 0; outcome = bomber ? 'crash' : 'dud'; break;
    case 3: loss = 0; outcome = 'miss'; break;
    case 4: loss = Math.max(0, loss - 2); break;
    case 5: loss += 1; break;
    case 8: loss += 2; break;
    case 9: loss += 5; break;
    case 10: loss += 10; break;
    case 11: loss *= 2; break;
    case 12: loss = (was25 ? people : loss) * 3; break;
    case 13: loss = 0; outcome = 'stopped'; break;
  }
  return { loss: Math.max(0, Math.min(loss, people)), outcome };
}

/** Whether a defence of a class stops a strike: the first kind missiles, the second bombers too (prepare_combat_impact). */
export const stops = (cls: number, bomber: boolean) => cls === 1 || (cls === 0 && !bomber);

/** The oddity of a roll of 1 … 100 (action3_event_for_roll). */
export function mishapOf(r: number): Mishap {
  return r <= 4 ? 'vanish' : r <= 6 ? 'weight' : r <= 8 ? 'ufo' : r <= 13 ? 'boom' : r <= 18 ? 'cow' : r <= 20 ? 'quake' : r <= 23 ? 'fallout' : r <= 25 ? 'exodus' : 'defect';
}

/** Propaganda's move: up to its millions from the target's city to the leader's own (propaganda_commit). */
function propaganda(w: War, events: WarEvent[], by: number) {
  const a = w.leaders[by];
  const from = w.leaders[a.target].cities[a.city];
  const moved = Math.min(a.magnitude, from.people);
  feel(w, by, 2, a.target, moved);
  from.people -= moved;
  // The player's people go to his smallest city (profile 2), as in the original
  const to = pick(w, by === PLAYER ? 2 : a.profile, a);
  a.cities[to].people += moved;
  events.push({ kind: 'propaganda', by, target: a.target, from: a.city, to, moved, people: snapshot(w) });
}

/**
 * Propaganda goes strange with a chance of 29 in 100 (gate below 30), and then by a roll of
 * 1 … 100 (action3_event_for_roll and the handlers): 1–4 a city vanishes, 5–6 a weight falls
 * on one, 7–8 a saucer doubles the largest, 9–13 a baby boom, 14–18 a cow tramples the
 * target, 19–20 a quake, 21–23 fallout on every city, 24–25 people emigrate to another
 * leader, and 26–100 people defect to the target.
 */
function mishap(w: War, events: WarEvent[], by: number): boolean {
  if (roll(w, 100) + 1 >= 30) return false;
  const a = w.leaders[by];
  const m = mishapOf(roll(w, 100) + 1);
  const first = a.cities.findIndex(c => c.people > 0);
  const push = (e: Omit<Extract<WarEvent, { kind: 'mishap' }>, 'kind' | 'by' | 'people'>) => events.push({ kind: 'mishap', by, ...e, people: snapshot(w) });
  if (m === 'vanish' || m === 'weight') {
    // A city vanishes, or a weight falls on it: the first living city is gone
    const moved = a.cities[first].people;
    a.cities[first].people = 0;
    push({ mishap: m, leader: by, city: first, moved });
  } else if (m === 'ufo') {
    // A saucer brings as many again to the largest city (double_largest_city)
    const c = a.cities.reduce((at, x, i) => (x.people > a.cities[at].people ? i : at), 0);
    const moved = a.cities[c].people;
    a.cities[c].people += moved;
    push({ mishap: 'ufo', leader: by, city: c, moved });
  } else if (m === 'boom' || m === 'cow') {
    // 5 … 25 million: a baby boom, or a cow in the target's city
    const moved = (roll(w, 5) + 1) * 5;
    if (m === 'boom') {
      // Own: the boom comes to the largest own city (the original adds to the own city of the target's index)
      const c = a.cities.reduce((at, x, i) => (x.people > a.cities[at].people ? i : at), 0);
      a.cities[c].people += moved;
      push({ mishap: 'boom', leader: by, city: c, moved });
    } else {
      const c = w.leaders[a.target].cities[a.city];
      const lost = Math.min(moved, c.people);
      c.people -= lost;
      push({ mishap: 'cow', leader: a.target, city: a.city, moved: lost });
    }
  } else if (m === 'quake') {
    // A quake: a living city by chance is gone (quake_event_prelude)
    let c = roll(w, CITIES);
    while (a.cities[c].people === 0) c = (c + 1) % CITIES;
    const moved = a.cities[c].people;
    a.cities[c].people = 0;
    push({ mishap: 'quake', leader: by, city: c, moved });
  } else if (m === 'fallout') {
    // Fallout: 1 … 5 million from every city (radiation_population_commit)
    const each = roll(w, 5) + 1;
    let moved = 0;
    for (const c of a.cities) if (c.people > 0) { const x = Math.min(each, c.people); c.people -= x; moved += x; }
    push({ mishap: 'fallout', leader: by, city: -1, moved });
  } else if (m === 'exodus') {
    // Emigrants: part of a city to another leader's largest city (transfer_event_prelude)
    const from = pick(w, a.profile, a);
    const moved = roll(w, a.cities[from].people) + 1;
    a.cities[from].people -= moved;
    // Own: never back to the leader itself (the original's scan can wrap round to it)
    const others = w.leaders.map((_, t) => t).filter(t => t !== by && alive(w.leaders[t]));
    const to = others[roll(w, others.length)];
    const city = pick(w, 1, w.leaders[to]);
    w.leaders[to].cities[city].people += moved;
    push({ mishap: 'exodus', leader: by, city: from, moved, to: { leader: to, city } });
  } else {
    // Defectors: the propaganda's millions from the own city to the target's (defection_commit)
    const from = pick(w, a.profile, a);
    const moved = Math.min(a.magnitude, a.cities[from].people);
    a.cities[from].people -= moved;
    w.leaders[a.target].cities[a.city].people += moved;
    push({ mishap: 'defect', leader: by, city: from, moved, to: { leader: a.target, city: a.city } });
  }
  return true;
}

/**
 * A fallen leader's revenge (revenge_system.hpp): up to four strikes, a bomber in the air
 * first while its load lasts, then the missiles from the smallest with the smallest warhead
 * that fits, each at a living leader not yet struck, its city by chance.
 */
function avenge(w: War, events: WarEvent[], by: number, queue: number[]) {
  const a = w.leaders[by];
  const struck = new Set<number>();
  for (let n = 0; n < 4; n++) {
    let kind: 'bomb' | 'launch' | null = null;
    let warhead = -1;
    if ((a.doing === 'loadBomber' || a.doing === 'bomb') && a.capacity > 0) {
      warhead = a.warheads.findIndex((x, c) => x > 0 && a.capacity >= MEGATONS[c]);
      if (warhead >= 0) kind = 'bomb';
    }
    if (!kind) {
      for (let m = 0; m < 4 && !kind; m++) {
        if (a.missiles[m] <= 0) continue;
        for (let c = 0; c <= m; c++) if (a.warheads[c] > 0) { kind = 'launch'; warhead = c; a.missiles[m]--; break; }
      }
    }
    if (!kind) return;
    let living = w.leaders.map((_, t) => t).filter(t => t !== by && alive(w.leaders[t]) && !struck.has(t));
    if (!living.length) { struck.clear(); living = w.leaders.map((_, t) => t).filter(t => t !== by && alive(w.leaders[t])); }
    if (!living.length) return;
    const t = living[roll(w, living.length)];
    const cities = w.leaders[t].cities.map((c, i) => (c.people > 0 ? i : -1)).filter(i => i >= 0);
    const city = cities[roll(w, cities.length)];
    struck.add(t);
    a.warheads[warhead]--;
    if (kind === 'bomb') a.capacity -= MEGATONS[warhead];
    Object.assign(a, { doing: kind, target: t, city, warhead, magnitude: BLAST[warhead] });
    const before = w.leaders.map(alive);
    strike(w, events, by, true);
    fallen(w, events, before, queue);
  }
}

/** Leaders who fell since `before`: their fall is told and their revenge waits in the queue. */
function fallen(w: War, events: WarEvent[], before: boolean[], queue: number[]) {
  w.leaders.forEach((l, i) => {
    if (before[i] && !alive(l)) {
      events.push({ kind: 'fall', who: i, people: snapshot(w) });
      queue.push(i);
    }
  });
}

/** Resolves one leader's act. */
function resolve(w: War, events: WarEvent[], i: number) {
  const a = w.leaders[i];
  switch (a.doing) {
    case 'launch':
    case 'bomb':
      strike(w, events, i, false);
      break;
    case 'propaganda':
      if (!mishap(w, events, i)) propaganda(w, events, i);
      break;
    case 'loadMissile':
    case 'loadBomber':
      events.push({ kind: 'load', by: i, what: a.doing === 'loadMissile' ? 'missile' : 'bomber', cls: a.delivery, people: snapshot(w) });
      break;
    case 'build':
      feel(w, i, 5, i, 0);
      events.push({ kind: 'build', by: i, people: snapshot(w) });
      break;
    case 'defend':
      feel(w, i, 4, i, 0);
      events.push({ kind: 'defend', by: i, cls: a.magnitude, people: snapshot(w) });
      break;
  }
}

/**
 * One round on the player's order: the computer plans, moods drift, the acts are resolved
 * in order, the builders build, and the war ends when one leader or none is left. Returns
 * the round's events, or null when the order is not allowed. A stance changes only the
 * stance and returns no events.
 */
export function play(w: War, o: Order): WarEvent[] | null {
  if (!canOrder(w, o)) return null;
  w.orders.push(o);
  if (o.kind === 'stance') { w.leaders[PLAYER].stance[o.leader] = o.stance; return []; }
  if (o.kind !== 'watch') commit(w, o);
  else w.leaders[PLAYER].doing = 'idle';
  w.round++;
  plan(w);
  drift(w);
  const events: WarEvent[] = [];
  const queue: number[] = [];
  for (let i = 0; i < LEADERS; i++) {
    if (!alive(w.leaders[i])) continue;
    const before = w.leaders.map(alive);
    resolve(w, events, i);
    fallen(w, events, before, queue);
    // Revenge in the order of the falls, up to five falls a round (the reconstruction's bound)
    for (let n = 0; queue.length && n < 5; n++) avenge(w, events, queue.shift()!, queue);
    queue.length = 0;
  }
  // The builders build; own: the player's goods come at the round's end as the computer's do
  for (let i = 0; i < LEADERS; i++) {
    const l = w.leaders[i];
    if (alive(l) && l.doing === 'build') events.push({ kind: 'made', by: i, made: produce(w, l), people: snapshot(w) });
  }
  swing(w);
  const standing = w.leaders.map((l, i) => (alive(l) ? i : -1)).filter(i => i >= 0);
  if (standing.length <= 1) {
    w.winner = standing.length ? standing[0] : -1;
    events.push({ kind: 'end', winner: w.winner, byScore: false, people: snapshot(w) });
  } else if (w.round >= LAST_ROUND) {
    // Own: at the limit the best score wins, the earlier in order among equals
    w.winner = standing.reduce((best, i) => (score(w.leaders[i]) > score(w.leaders[best]) ? i : best), standing[0]);
    events.push({ kind: 'end', winner: w.winner, byScore: true, people: snapshot(w) });
  }
  return events;
}

/** A leader's score: its people and 25 for each living city after the first (end_game_score). */
export function score(l: Warlord): number {
  // Own: a fallen leader scores 0, not −25
  return Math.max(0, peopleOf(l) + 25 * (citiesOf(l) - 1));
}

/** The orders the player can give now, for the panel: the act and what it needs. */
export function loaded(w: War): { kind: 'missile' | 'bomber'; cls: number; load: number } | null {
  const me = w.leaders[PLAYER];
  if (me.doing === 'loadMissile') return { kind: 'missile', cls: me.delivery, load: me.capacity };
  if ((me.doing === 'loadBomber' || me.doing === 'bomb') && me.capacity > 0) return { kind: 'bomber', cls: me.delivery, load: me.capacity };
  return null;
}
