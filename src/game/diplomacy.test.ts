import { describe, expect, it } from 'vitest';
import { accepts, attitudeWord, newTies, reasons, rivalMove, setState, tiesDay, ALLIANCE_BROKEN, OFFER_GAP, WAR_DECLARED } from './diplomacy';

describe('diplomacy (STORY-076, own rules)', () => {
  it('the attitude in words', () => {
    expect([60, 50, 20, 0, -19, -20, -49, -50, -100].map(attitudeWord)).toEqual(['ystävällinen', 'ystävällinen', 'myönteinen', 'varautunut', 'varautunut', 'epäluuloinen', 'epäluuloinen', 'vihamielinen', 'vihamielinen']);
  });

  it('nothing moves before the rival is met; then near borders and war lower it, an alliance raises it', () => {
    const t = newTies();
    tiesDay(t, 1, true);
    expect(t.attitude).toBe(0);
    t.met = true;
    tiesDay(t, 1, true);
    expect(t.attitude).toBe(-1);
    setState(t, 'war', 2);
    tiesDay(t, 3, true);
    expect(t.attitude).toBe(-3);
    setState(t, 'alliance', 4);
    tiesDay(t, 6, false);
    expect(t.attitude).toBe(-2);
    // Never past −100 or 100
    t.attitude = 100;
    tiesDay(t, 6, false);
    expect(t.attitude).toBe(100);
  });

  it('in peace with no borders near it drifts back toward nothing, a point every fifth day', () => {
    const t = { ...newTies(), met: true, attitude: -3 };
    for (let day = 1; day <= 10; day++) tiesDay(t, day, false);
    expect(t.attitude).toBe(-1);
    expect(reasons(t, false)).toEqual(['rauha: asenne palaa kohti varautunutta']);
    expect(reasons({ ...t, state: 'war' }, true)).toEqual(['rajat ovat lähellä (−1 päivässä)', 'sota jatkuu (−1 päivässä)']);
  });

  it('a declaration by the player costs attitude; peace and an alliance start the state anew', () => {
    const t = { ...newTies(), met: true, attitude: 10 };
    setState(t, 'war', 5, true);
    expect([t.state, t.attitude, t.since]).toEqual(['war', 10 - WAR_DECLARED, 5]);
    t.lost = 1;
    setState(t, 'peace', 30);
    expect([t.state, t.lost]).toEqual(['peace', 0]);
    // Breaking an alliance costs attitude too
    setState(t, 'alliance', 40);
    setState(t, 'peace', 50, true);
    expect(t.attitude).toBe(10 - WAR_DECLARED - ALLIANCE_BROKEN);
  });

  it('the rival declares war when hostile and stronger, proposes an alliance when friendly, and peace after a long war', () => {
    const t = { ...newTies(), met: true, attitude: -50 };
    expect(rivalMove(t, 1, false)).toBeNull();
    expect(rivalMove(t, 1, true)).toBe('war');
    expect(rivalMove({ ...t, attitude: 60 }, 1, false)).toBe('alliance');
    setState(t, 'war', 10);
    expect(rivalMove(t, 29, true)).toBeNull();
    expect(rivalMove({ ...t, lost: 1 }, 30, true)).toBe('peace');
    expect(rivalMove({ ...t, attitude: -40 }, 30, true)).toBe('peace');
    expect(rivalMove({ ...t, met: false, attitude: -100 }, 1, true)).toBeNull();
    // A proposal waits OFFER_GAP days after the last; war does not wait
    expect(rivalMove({ ...newTies(), met: true, attitude: 60, offered: 1 }, OFFER_GAP, false)).toBeNull();
    expect(rivalMove({ ...newTies(), met: true, attitude: 60, offered: 1 }, 1 + OFFER_GAP, false)).toBe('alliance');
    expect(rivalMove({ ...newTies(), met: true, attitude: -60, offered: 1 }, 2, true)).toBe('war');
  });

  it('the rival accepts peace after ten days of war unless very hostile, and an alliance when friendly', () => {
    const t = { ...newTies(), met: true, state: 'war' as const, since: 10, attitude: -60 };
    expect(accepts(t, 19, 'peace')).toBe(false);
    expect(accepts(t, 20, 'peace')).toBe(true);
    expect(accepts({ ...t, attitude: -61 }, 20, 'peace')).toBe(false);
    expect(accepts({ ...t, attitude: -61, lost: 1 }, 20, 'peace')).toBe(true);
    expect(accepts({ ...t, state: 'peace', attitude: 50 }, 20, 'alliance')).toBe(true);
    expect(accepts({ ...t, state: 'peace', attitude: 49 }, 20, 'alliance')).toBe(false);
  });
});
