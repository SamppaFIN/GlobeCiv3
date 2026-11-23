import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/game/save';
import { TILE_COUNT } from '../../src/globe/hexTiles';
import { firstChoices, saveState, suggestedStudy } from '../../src/sim/game';
import { pending } from '../../src/sim/state';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * An advance's card (STORY-118): an advance gained waits as a decision, no day passes until
 * its learned command, Node answers it with the advisor's study, a building can be put first,
 * and the waiting card is saved.
 */
const SCIENCE: Advisors = { town: 'explore', city: 'explore', province: 'explore', state: 'science', planet: 'explore' };

/** Step a run until an advance's card waits; the other cards answered as an advisor would. */
function untilCard(run: Run, horizon: number): boolean {
  while (run.clock.day < horizon) {
    if (run.state.learned.length) return true;
    if (!run.step() && !run.decide()) return false;
  }
  return false;
}

describe("an advance's card (STORY-118)", () => {
  it('waits as a decision, no day passes, and the answer chooses the study the advisor would', () => {
    const run = Run.play(42, SCIENCE);
    expect(untilCard(run, 400)).toBe(true);
    const s = run.state;
    const a = s.learned[0];
    expect(pending(s).map(d => d.kind)).toContain('learned');
    expect(s.research.known.has(a)).toBe(true);
    // No day passes while it waits
    const day = run.clock.day;
    expect(run.step()).toBe(false);
    expect(run.clock.day).toBe(day);
    // A study not open is refused, and a building another advance opened too
    expect(run.give({ kind: 'learned', study: a, first: null })).toBe(false);
    expect(run.give({ kind: 'learned', study: suggestedStudy(), first: { build: 'aqueduct', scope: 'all' } })).toBe(false);
    expect(s.learned[0]).toBe(a);
    // The advisor's answer: its study, and the builds left to the advisors
    const study = suggestedStudy();
    expect(study).not.toBeNull();
    expect(run.decide()).toBe(true);
    expect(s.learned).toEqual([]);
    expect(s.research.target).toBe(study);
    expect(s.commands.entries.at(-1)).toMatchObject({ by: 'player', cmd: { kind: 'learned', study, first: null } });
    expect(run.step()).toBe(true);
  }, 600_000);

  it('puts a building first in the capital or every city, and the advisors keep it until it stands', () => {
    const run = Run.play(42, SCIENCE);
    const s = run.state;
    // The card of an advance that opens a building
    let opened: string | null = null;
    while (run.clock.day < 600 && opened === null) {
      expect(untilCard(run, 600)).toBe(true);
      const a = s.learned[0];
      if (a === 'pottery' || a === 'writing' || a === 'ceremonial' || a === 'masonry' || a === 'currency') opened = a;
      else run.decide();
    }
    expect(opened).not.toBeNull();
    const build = ({ pottery: 'granary', writing: 'library', ceremonial: 'temple', masonry: 'walls', currency: 'market' } as const)[opened as 'pottery'];
    const capital = s.cities.find(c => c.capital)!;
    expect(run.give({ kind: 'learned', study: suggestedStudy(), first: { build, scope: 'capital' } })).toBe(true);
    expect(capital.first).toBe(build);
    expect(capital.build).toBe(build);
    expect(s.cities.filter(c => c !== capital).every(c => c.first === undefined)).toBe(true);
    // The advisors build it before their own choice, until it stands
    for (let d = 0; d < 400 && !capital.buildings.includes(build); d++) {
      if (!run.step()) run.decide();
      if (!capital.buildings.includes(build)) expect(capital.build).toBe(build);
    }
    expect(capital.buildings).toContain(build);
    expect(capital.first).toBeUndefined();
  }, 600_000);

  it("Utu's review: a wonder goes first only in the capital, a player's own build ends the priority, and a soldier against bandits stays", () => {
    const run = Run.play(42, SCIENCE);
    const s = run.state;
    // The card of an advance that opens a wonder and a building: Keramiikka (granary, gardens)
    let found = false;
    while (run.clock.day < 600 && !found) {
      expect(untilCard(run, 600)).toBe(true);
      if (s.learned[0] === 'pottery' && firstChoices('pottery').length === 2) found = true;
      else run.decide();
    }
    expect(found).toBe(true);
    const study = suggestedStudy();
    // A wonder in every city would be built by all and won by one
    expect(run.give({ kind: 'learned', study, first: { build: 'gardens', scope: 'all' } })).toBe(false);
    // A soldier against bandits on their way stays: the city keeps the granary first for later
    const capital = s.cities.find(c => c.capital)!;
    capital.build = 'warrior';
    s.raids.band = { city: capital.tile, bandits: [] } as never;
    expect(run.give({ kind: 'learned', study, first: { build: 'granary', scope: 'all' } })).toBe(true);
    expect(capital.build).toBe('warrior');
    expect(capital.first).toBe('granary');
    s.raids.band = null;
    // The player's own build ends the priority in that city
    expect(run.give({ kind: 'build', city: capital.tile, build: 'warrior' })).toBe(true);
    expect(capital.first).toBeUndefined();
  }, 600_000);

  it('two advances in a day wait one card after another, and a study under way waits ready', () => {
    const run = Run.play(42, SCIENCE);
    const s = run.state;
    expect(untilCard(run, 400)).toBe(true);
    // A second advance the same day (as from ruins), and a study chosen before the card
    const second = s.research.available().find((x): x is never => !['coal', 'horses', 'fish', 'gold', 'gems', 'oil'].includes(x as string) && x !== s.learned[0]) as unknown as string;
    s.research.known.add(second as never);
    s.learned.push(second as never);
    expect(run.decide()).toBe(true);
    const chosen = s.research.target;
    expect(s.learned).toEqual([second]);
    // The study chosen on the first card waits ready on the second
    expect(suggestedStudy()).toBe(chosen);
    expect(run.decide()).toBe(true);
    expect(s.learned).toEqual([]);
    expect(s.research.target).toBe(chosen);
  }, 600_000);

  it('a waiting card and a first building are saved, and a save from before has none', () => {
    const run = Run.play(42, SCIENCE);
    expect(untilCard(run, 400)).toBe(true);
    const s = run.state;
    s.cities[0].first = 'granary';
    const limits = { tiles: TILE_COUNT, cityAreas: 362 * 49 };
    const saved = JSON.parse(JSON.stringify({ ...saveState()!, savedAt: 0, speed: 1, paused: false, selected: 0 }));
    const back = validateSave(saved, limits)!;
    expect(back.learned).toEqual(s.learned);
    expect(back.cities[0].first).toBe('granary');
    // Before STORY-118 a save had no cards waiting and no first building
    delete saved.learned;
    delete saved.cities[0].first;
    const old = validateSave(saved, limits)!;
    expect(old).not.toBeNull();
    expect(old.learned).toBeUndefined();
    expect(old.cities[0].first).toBeUndefined();
    // A save is not trusted (security rule 5): an advance that is none fails it
    expect(validateSave({ ...saved, learned: ['nothing'] }, limits)).toBeNull();
    expect(validateSave({ ...saved, commands: [{ day: 1, by: 'player', cmd: { kind: 'learned', study: null, first: { build: 'granary', scope: 'everywhere' } } }] }, limits)).toBeNull();
  }, 600_000);
});
