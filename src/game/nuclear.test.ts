import { describe, expect, it } from 'vitest';
import {
  alive, BLAST, canOrder, stops, citiesOf, LAST_ROUND, loaded, madeItem, MEGATONS, mishapOf, newWar, offends, peopleOf, pick, play, PLAYER, score, strikeTable,
  type Order, type Profile, type War, type WarEvent,
} from './nuclear';
import { allLines, lineOf, PERSONAS, PLAYER_PERSONA, TEMPERS } from './leaders';

const cities = (i: number) => Array.from({ length: 5 }, (_, c) => ({ state: i * 10 + c, name: `K${i}${c}` }));
const war = (seed = 42, profiles: Profile[] = [0, 1, 2, 3, 0]) => newWar(seed, ['a', 'b', 'c', 'd', 'sina'], profiles, [0, 1, 2, 3, 4].map(cities));
/** A war where nobody but the player does anything: the computer's leaders have nothing and only build. */
function still(w: War): War {
  for (let i = 0; i < PLAYER; i++) {
    const l = w.leaders[i];
    l.warheads = [0, 0, 0, 0]; l.missiles = [0, 0, 0, 0]; l.bombers = [0, 0]; l.defenses = [0, 0];
  }
  return w;
}
const kinds = (ev: WarEvent[]) => ev.map(e => e.kind);

/** A simple player for whole wars: launch what is loaded at the most populous foe, load a missile, else propaganda and build in turn. */
function autoOrder(w: War, n: number): Order {
  const me = w.leaders[PLAYER];
  if (!alive(me)) return { kind: 'watch' };
  const foe = [0, 1, 2, 3].filter(i => alive(w.leaders[i])).sort((a, b) => peopleOf(w.leaders[b]) - peopleOf(w.leaders[a]))[0];
  const city = w.leaders[foe].cities.reduce((at, c, i, all) => (c.people > all[at].people ? i : at), 0);
  const l = loaded(w);
  if (l) for (let c = 3; c >= 0; c--) {
    const o: Order = { kind: l.kind === 'missile' ? 'launch' : 'bomb', warhead: c, leader: foe, city };
    if (canOrder(w, o)) return o;
  }
  for (let m = 3; m >= 0; m--) if (me.missiles[m] > 0 && me.warheads.some((x, c) => x > 0 && MEGATONS[c] <= MEGATONS[m])) return { kind: 'loadMissile', missile: m };
  return n % 2 ? { kind: 'build' } : { kind: 'propaganda', leader: foe, city };
}
function wholeWar(seed: number, profiles: Profile[]): War {
  const w = war(seed, profiles);
  for (let n = 0; w.winner === null && n < LAST_ROUND + 5; n++) play(w, autoOrder(w, n));
  return w;
}

describe('a new war (initialize_state)', () => {
  it('each city holds people by its leader\'s temper, the player\'s as the first temper\'s', () => {
    const ranges: [number, number][] = [[10, 35], [15, 30], [20, 35], [1, 50], [5, 40]];
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of [0, 1, 2, 3, 4] as Profile[]) {
        const w = war(seed, [p, p, p, p, 0]);
        for (let i = 0; i < 5; i++) {
          const [lo, hi] = ranges[i === PLAYER ? 0 : p];
          for (const c of w.leaders[i].cities) {
            expect(c.people).toBeGreaterThanOrEqual(lo);
            expect(c.people).toBeLessThanOrEqual(hi);
          }
        }
      }
    }
  });

  it('the first stock by temper, and the player\'s a warhead, a missile and a defence', () => {
    const w = war(42, [0, 1, 2, 4, 0]);
    expect(w.leaders[0]).toMatchObject({ warheads: [1, 3, 0, 0], missiles: [1, 3, 0, 0], defenses: [1, 0], bombers: [0, 0] });
    expect(w.leaders[1]).toMatchObject({ warheads: [1, 2, 2, 0], missiles: [1, 1, 1, 0], bombers: [1, 0], defenses: [0, 0] });
    expect(w.leaders[2]).toMatchObject({ warheads: [3, 0, 0, 0], missiles: [3, 0, 0, 0], defenses: [1, 1] });
    expect(w.leaders[3]).toMatchObject({ warheads: [2, 2, 0, 0], missiles: [2, 2, 0, 0] });
    expect(w.leaders[PLAYER]).toMatchObject({ warheads: [1, 0, 0, 0], missiles: [1, 0, 0, 0], defenses: [1, 0], bombers: [0, 0] });
    // The unpredictable builds twice: twelve things from six cities' worth
    const u = war(42, [3, 3, 3, 3, 0]).leaders[0];
    expect([...u.warheads, ...u.missiles, ...u.bombers, ...u.defenses].reduce((s, n) => s + n, 0)).toBe(12);
  });

  it('the same seed, opponents and orders give the same war (rule 7)', () => {
    const a = wholeWar(7, [0, 1, 2, 3, 0]);
    const b = war(7, [0, 1, 2, 3, 0]);
    for (const o of a.orders) play(b, o);
    expect(b).toEqual(a);
    expect(war(8).leaders.map(peopleOf)).not.toEqual(war(7).leaders.map(peopleOf));
  });
});

describe('the tables (game_rules.cpp)', () => {
  it('a build makes by two rolls: warheads, missiles, bombers and defences at their bounds', () => {
    expect(madeItem(55, 25)).toEqual({ stock: 'warheads', cls: 0 });
    expect(madeItem(1, 26)).toEqual({ stock: 'warheads', cls: 1 });
    expect(madeItem(55, 65)).toEqual({ stock: 'warheads', cls: 1 });
    expect(madeItem(55, 90)).toEqual({ stock: 'warheads', cls: 2 });
    expect(madeItem(55, 91)).toEqual({ stock: 'warheads', cls: 3 });
    expect(madeItem(56, 20)).toEqual({ stock: 'missiles', cls: 0 });
    expect(madeItem(80, 55)).toEqual({ stock: 'missiles', cls: 1 });
    expect(madeItem(80, 85)).toEqual({ stock: 'missiles', cls: 2 });
    expect(madeItem(80, 86)).toEqual({ stock: 'missiles', cls: 3 });
    expect(madeItem(81, 60)).toEqual({ stock: 'bombers', cls: 0 });
    expect(madeItem(95, 61)).toEqual({ stock: 'bombers', cls: 1 });
    expect(madeItem(96, 60)).toEqual({ stock: 'defenses', cls: 0 });
    expect(madeItem(100, 61)).toEqual({ stock: 'defenses', cls: 1 });
  });

  it('a strike: two dice on the blast, a 100 Mt twelve takes the whole city', () => {
    expect(strikeTable(2, 12, 30, false, false)).toEqual({ loss: 0, outcome: 'dud' });
    expect(strikeTable(2, 12, 30, false, true)).toEqual({ loss: 0, outcome: 'crash' });
    expect(strikeTable(3, 12, 30, false, true)).toEqual({ loss: 0, outcome: 'miss' });
    expect(strikeTable(4, 12, 30, false, false).loss).toBe(10);
    expect(strikeTable(4, 1, 30, false, false).loss).toBe(0);
    expect(strikeTable(5, 12, 30, false, false).loss).toBe(13);
    expect(strikeTable(6, 12, 30, false, false)).toEqual({ loss: 12, outcome: 'hit' });
    expect(strikeTable(8, 12, 30, false, false).loss).toBe(14);
    expect(strikeTable(9, 12, 30, false, false).loss).toBe(17);
    expect(strikeTable(10, 12, 30, false, false).loss).toBe(22);
    expect(strikeTable(11, 12, 30, false, false).loss).toBe(24);
    expect(strikeTable(12, 8, 30, false, false).loss).toBe(24);
    expect(strikeTable(12, 26, 80, true, false).loss).toBe(80);
    expect(strikeTable(13, 30, 30, false, false)).toEqual({ loss: 0, outcome: 'stopped' });
    // Never more than the city holds
    expect(strikeTable(11, 30, 20, false, false).loss).toBe(20);
  });

  it('propaganda goes strange by a roll: 75 in 100 of them defectors', () => {
    const seen: Record<string, number> = {};
    for (let r = 1; r <= 100; r++) seen[mishapOf(r)] = (seen[mishapOf(r)] ?? 0) + 1;
    expect(seen).toEqual({ vanish: 4, weight: 2, ufo: 2, boom: 5, cow: 5, quake: 2, fallout: 3, exodus: 2, defect: 75 });
  });

  it('a temper picks its city: the last living, the largest, the smallest, or by chance', () => {
    const w = war();
    const t = w.leaders[0];
    t.cities.forEach((c, i) => { c.people = [12, 30, 0, 5, 0][i]; });
    expect(pick(w, 0, t)).toBe(3);
    expect(pick(w, 1, t)).toBe(1);
    expect(pick(w, 2, t)).toBe(3);
    for (let n = 0; n < 20; n++) expect([0, 1, 3]).toContain(pick(w, 3, t));
    t.cities.forEach(c => { c.people = 0; });
    expect(pick(w, 1, t)).toBe(-1);
  });
});

describe('the player\'s orders', () => {
  it('a missile is loaded in one round and launched in the next; the warhead must fit', () => {
    const w = still(war());
    const me = w.leaders[PLAYER];
    me.warheads = [1, 1, 0, 0];
    expect(canOrder(w, { kind: 'launch', warhead: 0, leader: 1, city: 0 })).toBe(false);
    const ev = play(w, { kind: 'loadMissile', missile: 0 })!;
    expect(ev.find(e => e.kind === 'load' && e.by === PLAYER)).toBeTruthy();
    expect(loaded(w)).toEqual({ kind: 'missile', cls: 0, load: 10 });
    expect(canOrder(w, { kind: 'launch', warhead: 1, leader: 1, city: 0 })).toBe(false);
    const before = w.leaders[1].cities[0].people;
    const strike = play(w, { kind: 'launch', warhead: 0, leader: 1, city: 0 })!.find(e => e.kind === 'strike')!;
    expect(strike).toMatchObject({ by: PLAYER, target: 1, city: 0, delivery: 'missile', warhead: 0 });
    if (strike.kind === 'strike') expect(w.leaders[1].cities[0].people).toBe(before - strike.loss);
    expect(me.warheads).toEqual([0, 1, 0, 0]);
    expect(loaded(w)).toBeNull();
  });

  it('a bomber flies again while its load lasts, and each warhead must fit what is left', () => {
    const w = still(war());
    const me = w.leaders[PLAYER];
    Object.assign(me, { bombers: [1, 0], warheads: [0, 0, 2, 0] });
    play(w, { kind: 'loadBomber', bomber: 0 });
    expect(loaded(w)).toEqual({ kind: 'bomber', cls: 0, load: 50 });
    w.rng = 1;
    const first = play(w, { kind: 'bomb', warhead: 2, leader: 1, city: 0 })!.find(e => e.kind === 'strike');
    if (first?.kind === 'strike' && (first.outcome === 'crash' || first.outcome === 'stopped')) return;
    expect(me.capacity).toBe(0);
    expect(canOrder(w, { kind: 'bomb', warhead: 2, leader: 1, city: 0 })).toBe(false);
    me.capacity = 50;
    expect(canOrder(w, { kind: 'bomb', warhead: 2, leader: 1, city: 0 })).toBe(true);
  });

  it('a defence of the first kind stops a missile but not a bomber, the second both', () => {
    expect([stops(0, false), stops(0, true), stops(1, false), stops(1, true)]).toEqual([true, false, true, true]);
    // The computer sees the player's strike at it and meets it with the defence it has
    for (const [cls, delivery] of [[0, 'missile'], [1, 'missile'], [1, 'bomber']] as const) {
      const w = still(war(42, [0, 1, 2, 4, 0]));
      const d = w.leaders[1];
      d.defenses = [cls === 0 ? 1 : 0, cls === 1 ? 1 : 0];
      w.leaders.forEach((l, i) => { if (i !== PLAYER) l.hostility[PLAYER] = 30000; });
      const me = w.leaders[PLAYER];
      Object.assign(me, delivery === 'missile' ? { doing: 'loadMissile', capacity: 10 } : { doing: 'loadBomber', capacity: 50 }, { warheads: [1, 0, 0, 0] });
      const ev = play(w, { kind: delivery === 'missile' ? 'launch' : 'bomb', warhead: 0, leader: 1, city: 0 })!;
      expect(ev.find(e => e.kind === 'defend' && e.by === 1)).toMatchObject({ cls });
      expect(ev.find(e => e.kind === 'strike' && e.by === PLAYER)).toMatchObject({ outcome: 'stopped', loss: 0 });
      // A bomber stopped is lost with what it still carried
      expect(loaded(w)).toBeNull();
    }
    // A strike at another leader is not met
    const w = still(war(42, [0, 1, 2, 4, 0]));
    w.leaders[1].defenses = [1, 0];
    w.leaders.forEach((l, i) => { if (i !== PLAYER) l.hostility[PLAYER] = 30000; });
    Object.assign(w.leaders[PLAYER], { doing: 'loadMissile', capacity: 10, warheads: [1, 0, 0, 0] });
    const ev = play(w, { kind: 'launch', warhead: 0, leader: 2, city: 0 })!;
    expect(ev.some(e => e.kind === 'defend' && e.by === 1)).toBe(false);
  });

  it('unloading a weapon or building twice in a row angers the computer\'s leaders', () => {
    // Without the unpredictable temper, whose moods swing ±18 000 after every round
    const w = still(war(42, [0, 1, 2, 4, 0]));
    expect(offends(w, { kind: 'build' })).toBe(false);
    play(w, { kind: 'build' });
    expect(offends(w, { kind: 'build' })).toBe(true);
    const before = w.leaders.map(l => l.hostility[PLAYER]);
    play(w, { kind: 'build' });
    // Each computer leader's hostility to the player rose by the penalty before its other moves
    w.leaders.slice(0, PLAYER).forEach((l, i) => expect(l.hostility[PLAYER]).toBeGreaterThan(before[i]));
    const v = still(war());
    play(v, { kind: 'loadMissile', missile: 0 });
    expect(offends(v, { kind: 'propaganda', leader: 1, city: 0 })).toBe(true);
    expect(offends(v, { kind: 'launch', warhead: 0, leader: 1, city: 0 })).toBe(false);
  });

  it('a stance is not a round; orders that are not allowed are refused', () => {
    const w = war();
    expect(play(w, { kind: 'stance', leader: 2, stance: -2 })).toEqual([]);
    expect(w.round).toBe(0);
    expect(w.leaders[PLAYER].stance[2]).toBe(-2);
    expect(play(w, { kind: 'stance', leader: 2, stance: 3 })).toBeNull();
    expect(play(w, { kind: 'defend', defense: 1 })).toBeNull();
    expect(play(w, { kind: 'watch' })).toBeNull();
    expect(play(w, { kind: 'propaganda', leader: PLAYER, city: 0 })).toBeNull();
  });
});

describe('a round', () => {
  it('propaganda moves its millions from the target\'s city to the player\'s smallest, or goes strange', () => {
    let moved = 0;
    let strange = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const w = still(war(seed));
      const ev = play(w, { kind: 'propaganda', leader: 1, city: 2 })!;
      const p = ev.find(e => e.kind === 'propaganda' && e.by === PLAYER);
      if (p?.kind === 'propaganda') {
        moved++;
        expect(p.moved).toBeGreaterThanOrEqual(1);
        expect(p.moved).toBeLessThanOrEqual(10);
        expect(p.target).toBe(1);
      } else if (ev.some(e => e.kind === 'mishap' && e.by === PLAYER)) strange++;
    }
    expect(moved + strange).toBe(60);
    expect(strange).toBeGreaterThan(5);
    expect(strange).toBeLessThan(30);
  });

  it('the people only move or die: no event makes people from nothing but a boom or a saucer', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = war(seed);
      let total = w.leaders.reduce((s, l) => s + peopleOf(l), 0);
      for (let n = 0; w.winner === null && n < 120; n++) {
        for (const e of play(w, autoOrder(w, n))!) {
          const now = e.people.flat().reduce((s, x) => s + x, 0);
          const grows = e.kind === 'mishap' && (e.mishap === 'boom' || e.mishap === 'ufo');
          if (!grows) expect(now).toBeLessThanOrEqual(total);
          expect(e.people.flat().every(x => x >= 0)).toBe(true);
          total = now;
        }
      }
    }
  });

  it('a fallen leader strikes back up to four times, a bomber in the air first, then does nothing', () => {
    const w = still(war());
    const d = w.leaders[1];
    d.cities.forEach((c, i) => { c.people = i === 0 ? 1 : 0; });
    Object.assign(d, { missiles: [0, 2, 0, 0], warheads: [3, 2, 0, 0], doing: 'loadBomber', capacity: 50, delivery: 0 });
    w.leaders[PLAYER].doing = 'loadMissile';
    w.leaders[PLAYER].capacity = 10;
    w.leaders[PLAYER].warheads = [1, 0, 0, 0];
    w.rng = 3;
    let ev: WarEvent[] = [];
    for (let n = 0; n < 10 && alive(d); n++) {
      if (!loaded(w)) { w.leaders[PLAYER].doing = 'loadMissile'; w.leaders[PLAYER].capacity = 10; w.leaders[PLAYER].warheads = [1, 0, 0, 0]; }
      ev = play(w, { kind: 'launch', warhead: 0, leader: 1, city: 0 })!;
    }
    expect(alive(d)).toBe(false);
    const fall = ev.findIndex(e => e.kind === 'fall' && e.who === 1);
    const back = ev.slice(fall + 1).filter(e => e.kind === 'strike' && e.by === 1 && e.revenge);
    expect(back.length).toBeGreaterThan(0);
    expect(back.length).toBeLessThanOrEqual(4);
    if (back[0]?.kind === 'strike') expect(back[0].delivery).toBe('bomber');
    // Targets in turn: no leader twice before the others
    const targets = back.map(e => (e.kind === 'strike' ? e.target : -1));
    expect(new Set(targets.slice(0, 3)).size).toBe(Math.min(3, targets.length));
    const after = play(w, { kind: 'build' })!;
    expect(after.some(e => 'by' in e && e.by === 1 && e.kind !== 'strike')).toBe(false);
  });

  it('every war of the computer\'s leaders ends within the round limit (seeds 1–20)', () => {
    const rounds: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const w = wholeWar(seed, [(seed % 5) as Profile, ((seed + 1) % 5) as Profile, ((seed + 2) % 5) as Profile, ((seed + 3) % 5) as Profile, 0]);
      expect(w.winner).not.toBeNull();
      rounds.push(w.round);
      expect(w.round).toBeLessThanOrEqual(LAST_ROUND);
      if (w.winner! >= 0) expect(alive(w.leaders[w.winner!])).toBe(true);
    }
    // Measured 2026-11-24: 37–78 rounds with this player
    expect(Math.max(...rounds)).toBeLessThan(LAST_ROUND);
  });

  it('a hostile temper strikes more than it talks; a propagandist talks more', () => {
    const count = (p: Profile) => {
      let strikes = 0;
      let talks = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const w = war(seed, [p, p, p, p, 0]);
        for (let n = 0; w.winner === null && n < 60; n++) {
          for (const e of play(w, autoOrder(w, n))!) {
            if (e.kind === 'strike' && e.by !== PLAYER) strikes++;
            if ((e.kind === 'propaganda' || e.kind === 'mishap') && e.by !== PLAYER) talks++;
          }
        }
      }
      return { strikes, talks };
    };
    const soldier = count(1);
    const talker = count(2);
    expect(soldier.strikes).toBeGreaterThan(soldier.talks);
    expect(talker.talks / (talker.strikes + talker.talks)).toBeGreaterThan(soldier.talks / (soldier.strikes + soldier.talks));
  });

  it('a score: the people and 25 for each living city after the first; the fallen 0', () => {
    const w = war();
    const l = w.leaders[0];
    l.cities.forEach((c, i) => { c.people = [10, 20, 0, 5, 0][i]; });
    expect(citiesOf(l)).toBe(3);
    expect(score(l)).toBe(35 + 50);
    l.cities.forEach(c => { c.people = 0; });
    expect(score(l)).toBe(0);
  });

  it('the round limit ends a war of builders by score', () => {
    const w = war();
    for (const l of w.leaders) { l.warheads = [0, 0, 0, 0]; l.missiles = [0, 0, 0, 0]; l.bombers = [0, 0]; l.defenses = [0, 0]; }
    w.round = LAST_ROUND - 1;
    // Nobody can strike this round: the computer only builds or talks
    const ev = play(w, { kind: 'build' })!;
    const end = ev.find(e => e.kind === 'end');
    expect(end).toMatchObject({ byScore: true });
    expect(w.winner).not.toBeNull();
    expect(kinds(ev).at(-1)).toBe('end');
  });
});

describe('the leaders (own)', () => {
  it('ten leaders, two of each temper, each with its own colour, and the player', () => {
    expect(PERSONAS).toHaveLength(10);
    for (const p of [0, 1, 2, 3, 4] as Profile[]) expect(PERSONAS.filter(x => x.profile === p)).toHaveLength(2);
    expect(new Set(PERSONAS.map(p => p.color)).size).toBe(10);
    expect(new Set(PERSONAS.map(p => p.name)).size).toBe(10);
    expect(Object.keys(TEMPERS)).toHaveLength(5);
    expect(PLAYER_PERSONA.name).toBe('Sinä');
  });

  it('every temper has three lines or more for each situation, and the same keys give the same line', () => {
    const { LINES, MISHAPS, OUTCOMES } = allLines();
    for (const t of Object.values(LINES)) for (const list of Object.values(t)) expect(list.length).toBeGreaterThanOrEqual(3);
    for (const list of [...Object.values(MISHAPS), ...Object.values(OUTCOMES)]) expect(list.length).toBeGreaterThanOrEqual(2);
    expect(lineOf(1, 'strike', 42, 3, 7)).toBe(lineOf(1, 'strike', 42, 3, 7));
  });

  it('blasts and megatons by class', () => {
    expect(MEGATONS).toEqual([10, 20, 50, 100]);
    expect(BLAST).toEqual([2, 5, 10, 25]);
  });
});
