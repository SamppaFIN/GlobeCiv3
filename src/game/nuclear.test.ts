import { describe, expect, it } from 'vitest';
import { act, ACT_DAYS, alive, canAct, day, LAST_DAY, newWar, nukesOpen, NUKES_AT, type NuclearWorld } from './nuclear';

const REALMS = [[0, 1, 2], [10, 11, 12], [20, 21, 22], [30, 31, 32], [40, 41, 42]];
const run = (w: NuclearWorld, days: number) => { for (let d = 0; d < days; d++) day(w); };

describe('the war of leaders (STORY-097, own rules)', () => {
  it('the same seed gives the same war', () => {
    const a = newWar(42, REALMS);
    const b = newWar(42, REALMS);
    run(a, 120);
    run(b, 120);
    expect(a).toEqual(b);
    expect(newWar(7, REALMS).leaders.map(l => l.people)).not.toEqual(newWar(42, REALMS).leaders.map(l => l.people));
  });

  it('each state holds 3 to 6 million people', () => {
    for (const l of newWar(42, REALMS).leaders) {
      expect(l.people).toBeGreaterThanOrEqual(9);
      expect(l.people).toBeLessThanOrEqual(18);
    }
  });

  it('envoys and propaganda come first; missiles and their defence only at high tension', () => {
    const w = newWar(42, REALMS);
    expect(nukesOpen(w)).toBe(false);
    expect(canAct(w, 0, { kind: 'build', what: 'missile' })).toBe(false);
    expect(canAct(w, 0, { kind: 'build', what: 'shield' })).toBe(false);
    expect(canAct(w, 0, { kind: 'envoy', to: 1 })).toBe(true);
    w.tension = NUKES_AT;
    expect(canAct(w, 0, { kind: 'build', what: 'missile' })).toBe(true);
    expect(canAct(w, 0, { kind: 'missile', to: 1 })).toBe(false);
  });

  it('one act at a time: the next after ACT_DAYS', () => {
    const w = newWar(42, REALMS);
    expect(act(w, 0, { kind: 'envoy', to: 2 })).toBe(true);
    expect(act(w, 0, { kind: 'envoy', to: 2 })).toBe(false);
    w.day += ACT_DAYS;
    expect(act(w, 0, { kind: 'envoy', to: 2 })).toBe(true);
  });

  it('two envoys each way make an alliance; propaganda turns people over and raises the tension', () => {
    const w = newWar(42, REALMS);
    w.leaders[2].ready = 0;
    for (let k = 0; k < 2; k++) {
      act(w, 0, { kind: 'envoy', to: 2 });
      act(w, 2, { kind: 'envoy', to: 0 });
      w.day += ACT_DAYS;
    }
    expect(w.leaders[0].ally).toBe(2);
    expect(w.leaders[2].ally).toBe(0);
    const [mine, theirs, tension] = [w.leaders[0].people, w.leaders[3].people, w.tension];
    act(w, 0, { kind: 'propaganda', to: 3 });
    expect(w.leaders[3].people).toBeLessThan(theirs);
    expect(w.leaders[0].people - mine).toBeCloseTo(theirs - w.leaders[3].people, 5);
    expect(w.tension).toBeGreaterThan(tension);
  });

  it('a missile kills a share of the target and spreads fallout; a defence may stop it', () => {
    const w = newWar(42, REALMS);
    w.tension = NUKES_AT;
    w.leaders[0].missiles = 1;
    const before = w.leaders.map(l => l.people);
    act(w, 0, { kind: 'missile', to: 1 });
    expect(w.leaders[1].people).toBeLessThan(before[1] * 0.86);
    expect(w.leaders[2].people).toBeLessThan(before[2]);
    expect(w.leaders[1].struckBy).toBe(0);
    // Defences: some missiles are stopped, and each stop spends one
    let stopped = 0;
    for (let s = 1; s <= 40; s++) {
      const v = newWar(s, REALMS);
      v.tension = NUKES_AT;
      v.leaders[0].missiles = 1;
      v.leaders[1].shields = 1;
      const p = v.leaders[1].people;
      act(v, 0, { kind: 'missile', to: 1 });
      if (v.leaders[1].people === p) {
        stopped++;
        expect(v.leaders[1].shields).toBe(0);
      }
    }
    expect(stopped).toBeGreaterThan(5);
    expect(stopped).toBeLessThan(35);
  });

  it('left to itself the war ends by the last day, with a winner standing', () => {
    const w = newWar(42, REALMS);
    run(w, LAST_DAY);
    expect(w.winner).not.toBeNull();
    expect(w.leaders.some(l => l.id === w.winner && alive(l))).toBe(true);
    // The computer's leaders went from words to weapons on their own
    expect(w.leaders.some(l => l.missiles > 0 || l.shields > 0) || w.log.join(' ').includes('Ohjusisku') || w.tension >= NUKES_AT).toBe(true);
  });
});
