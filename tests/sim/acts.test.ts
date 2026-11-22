import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/game/commands';
import { validateSave } from '../../src/game/save';
import { TILE_COUNT } from '../../src/globe/hexTiles';
import { world } from '../../src/sim/game';
import { Run, type Advisors } from '../../src/sim/run';
import { sha, simOf } from '../golden/hash';

/**
 * The player's own acts are commands (STORY-112, criterion 2): seed 42 played in Node with the
 * player acting themselves, and the game played again from its save's command log comes to the
 * same state. What the HUD, the cards and the panels do is given as the buttons give it.
 */
const FEED: Advisors = { town: 'feed', city: 'growth', province: 'settle', state: 'expand', planet: 'conquer' };
const LIMITS = { tiles: TILE_COUNT, cityAreas: 362 * 49 };

/** The log as a save keeps it, checked as a loaded save is (security rule 5), played again to the day. */
function replayed(run: Run, day: number, setup: Record<number, (r: Run) => void> = {}) {
  const played = run.snapshot();
  const save = validateSave(JSON.parse(JSON.stringify({ ...played, savedAt: 0, speed: 1, paused: false, selected: 0 })), LIMITS);
  expect(save).not.toBeNull();
  const again = Run.replay(run.seed, save!.commands!);
  // The same setup on the same day, before the day's commands, as in the game
  for (const d of Object.keys(setup).map(Number).sort((a, b) => a - b)) {
    expect(again.until(d), again.error ?? '').toBe(true);
    setup[d](again);
  }
  expect(again.until(day), again.error ?? '').toBe(true);
  return { played, replayed: again.snapshot() };
}

/** The kinds of the player's commands in the log, from a day on. */
const playerKinds = (run: Run, from = 0) => run.snapshot().commands.filter(e => e.by === 'player' && e.day >= from && e.cmd.kind !== 'site' && e.cmd.kind !== 'raid' && e.cmd.kind !== 'treaty').map(e => e.cmd.kind);

describe('the player\'s own acts (STORY-112)', () => {
  it('seed 42 played by the player\'s own hand comes again from its save\'s command log', () => {
    const run = Run.play(42, FEED);
    const give = (cmd: Command) => expect(run.give(cmd), cmd.kind).toBe(true);
    expect(run.until(45)).toBe(true);
    // The city area by the player's own hand, its units and the capital too
    give({ kind: 'advise', level: 'city', advisor: 'none' });
    const s = run.state;
    const scout = s.units.units.find(u => u.kind === 'scout')!;
    const settler = s.units.units.find(u => u.kind === 'settler')!;
    give({ kind: 'mode', unit: scout.id, mode: 'gather' });
    give({ kind: 'task', unit: settler.id, task: 'found' });
    const site = s.units.currentSite()!;
    give({ kind: 'skip' });
    give({ kind: 'pick', tile: site });
    give({ kind: 'flag', tile: site });
    const capital = s.cities[0];
    give({ kind: 'focus', city: capital.tile, focus: 'production' });
    give({ kind: 'tax', tax: 70 });
    give({ kind: 'lux', lux: 10 });
    give({ kind: 'plan', area: world.cityOf(capital.tile), plan: 'settle' });
    give({ kind: 'line', line: 'research' });
    expect(run.until(70)).toBe(true);
    give({ kind: 'mode', unit: scout.id, mode: 'explore' });
    give({ kind: 'focus', city: capital.tile, focus: 'food' });
    // The province level by the player's own hand: a target province of the home state
    expect(run.until(130)).toBe(true);
    expect(s.progress.openLevel).toBeLessThanOrEqual(2);
    give({ kind: 'advise', level: 'province', advisor: 'none' });
    const home = Math.floor(world.cityOf(capital.tile) / 49);
    give({ kind: 'target', province: home * 7 + ((s.targetProvince + 1) % 7) });
    expect(run.until(220)).toBe(true);
    give({ kind: 'advise', level: 'state', advisor: 'none' });
    give({ kind: 'tax', tax: 30 });
    give({ kind: 'line', line: 'defend' });
    expect(run.until(260)).toBe(true);

    expect(new Set(playerKinds(run))).toEqual(new Set(['advise', 'mode', 'task', 'skip', 'pick', 'flag', 'focus', 'tax', 'lux', 'plan', 'line', 'target']));
    const { played, replayed: again } = replayed(run, 260);
    expect(again.commands).toEqual(played.commands);
    expect(sha(simOf(again))).toBe(sha(simOf(played)));
  }, 600_000);

  it('the dealings with a rival, the revolution and the target state come again too', () => {
    // Not reached in a short game: the rival is met, Monarchy known and the target cleared on day 60, the same in the replay
    const setup = (r: Run) => {
      r.state.ties[0].met = true;
      r.state.research.known.add('monarchy');
      r.state.targetState = -1;
    };
    const run = Run.play(42, FEED);
    expect(run.until(60)).toBe(true);
    setup(run);
    const capital = run.state.cities[0];
    const home = Math.floor(world.cityOf(capital.tile) / 49);
    expect(run.give({ kind: 'trade', rival: 0, give: 'maps', get: 'nothing' })).toBe(true);
    expect(run.give({ kind: 'revolution' })).toBe(true);
    expect(run.give({ kind: 'aim', state: home })).toBe(true);
    // The same target again changes nothing, and stays out of the log
    expect(run.give({ kind: 'aim', state: home })).toBe(false);
    expect(run.give({ kind: 'pact', rival: 0, act: 'war' })).toBe(true);
    // At war: no trade, and no war declared twice
    expect(run.give({ kind: 'trade', rival: 0, give: 'nothing', get: 'maps' })).toBe(false);
    expect(run.give({ kind: 'pact', rival: 0, act: 'war' })).toBe(false);
    expect(run.until(75)).toBe(true);
    const peace = run.give({ kind: 'pact', rival: 0, act: 'peace' });
    expect(run.until(100)).toBe(true);
    // The advisors of the province level, asked for as it opens, come between
    expect(playerKinds(run, 60).filter(k => k !== 'advise')).toEqual(['trade', 'revolution', 'aim', 'pact', ...(peace ? ['pact'] : [])]);
    expect(run.state.ties[0].state).toBe(peace ? 'peace' : 'war');

    const { played, replayed: again } = replayed(run, 100, { 60: setup });
    expect(again.commands).toEqual(played.commands);
    expect(sha(simOf(again))).toBe(sha(simOf(played)));
  }, 600_000);
});
