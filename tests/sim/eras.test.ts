import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/game/save';
import { TILE_COUNT } from '../../src/globe/hexTiles';
import { chronicleEraDay, eraNow, game, saveState, startGame } from '../../src/sim/game';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * The era in the game (STORY-120): worked out from the advances known, told once in every
 * city's chronicle as it changes, and a save keeps it without telling it again on load.
 */
const SCIENCE: Advisors = { town: 'explore', city: 'explore', province: 'explore', state: 'science', planet: 'explore' };
const limits = { tiles: TILE_COUNT, cityAreas: 362 * 49 };
const eras = () => saveState()!.cities.map(c => (c.history ?? []).filter(e => e.kind === 'era'));

describe('the era in the game (STORY-120)', () => {
  it('comes with its key, is told once, and a loaded game does not tell it again', () => {
    const run = Run.play(42, SCIENCE);
    expect(run.until(5)).toBe(true);
    expect(eraNow()).toBe('early');
    expect(eras().flat()).toEqual([]);
    // The key known (set here: the research itself is the science tests'), the next day tells the era
    run.state.research.known.add('iron');
    expect(eraNow()).toBe('iron');
    expect(run.until(7)).toBe(true);
    const told = eras();
    expect(told.length).toBeGreaterThan(0);
    for (const c of told) expect(c.map(e => e.era)).toEqual(['iron']);

    // Saved and loaded, the era comes from the advances known, and no city is told it again
    const saved = JSON.parse(JSON.stringify({ ...saveState()!, savedAt: 0, speed: 1, paused: false, selected: 0 }));
    const back = validateSave(saved, limits)!;
    expect(back).not.toBeNull();
    startGame(game!.startCity, back, {});
    expect(eraNow()).toBe('iron');
    chronicleEraDay();
    chronicleEraDay();
    for (const c of eras()) expect(c.map(e => e.era)).toEqual(['iron']);

    // A save's chronicle names one of the seven eras, or it fails (security rule 5)
    const withEra = (era: string) => ({ ...saved, cities: saved.cities.map((c: { history?: unknown[] }, i: number) => (i ? c : { ...c, history: [...(c.history ?? []), { kind: 'era', day: 6, era }] })) });
    expect(validateSave(withEra('atomic'), limits)).not.toBeNull();
    expect(validateSave(withEra('bronze-age'), limits)).toBeNull();
  }, 600_000);
});
