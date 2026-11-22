/**
 * run.ts — a game without the browser (STORY-095, PLAN-092 phase G): the same simulation the
 * browser runs (game.ts), a new game of a seed started as the browser starts one, its days one
 * at a time, and the cards the game stops for answered through commands.
 *
 * A Run answers the cards as an advisor would, as the browser's golden runs do
 * (tests/e2e/golden.e2e.ts): a site is settled, a raid is met with a soldier bought when it
 * would come too late, a proposal is declined, and the advisors of a level that opens are those
 * chosen at the start. A replay gives the player's commands of a game's log instead, each on its
 * day before the step that follows it, the answers to the cards among them, and must come to the
 * same state; the advisors and the people give theirs again.
 *
 * The simulation holds one game at a time: a new Run takes it over from the one before, and the
 * old one then refuses to go on.
 */
import { GameClock } from '../game/clock';
import { advisorOfLevel, type CityAdvisor, type PlanetAdvisor, type ProvinceAdvisor, type StateAdvisor, type TownAdvisor } from '../game/advisors';
import type { Command, Logged } from '../game/commands';
import { withNeighbors } from '../game/mapping';
import { tilesInRings } from '../game/pathfinding';
import { FAIR_SITE } from '../game/sites';
import { chooseStartSite } from '../game/start';
import type { Rich } from '../game/rich';
import { quietEvents } from './events';
import { advisorsAnswer, bind, CITY_LEVEL_RINGS, dispatch, opponentsNow, prepareDay, raidPlan, reveal, riseCheck, setGame, simulateDay, startGame, stateOf, terrainOf, world } from './game';
import { pending, type GameState } from './state';
import { createWorld } from './world';

/** The advisor of every level, chosen at the start: the city level's first, as the welcome asks. */
export interface Advisors { town: TownAdvisor; city: CityAdvisor; province: ProvinceAdvisor; state: StateAdvisor; planet: PlanetAdvisor }

export class Run {
  /** The run the simulation holds now. */
  private static current: Run | null = null;
  readonly clock = new GameClock();
  /** The notices told, in order. */
  readonly notices: (string | Rich)[] = [];
  readonly state: GameState;
  readonly seed: number;
  /** Why a run stopped short of its day, if it did. */
  error: string | null = null;
  /** A level that opened, whose card waits to be closed: then its advisors are asked for. */
  private risen: number | null = null;
  /** The advisors that answer the cards, or (null) a replay of the player's commands of a log, and the next of them. */
  private readonly advisors: Advisors | null;
  private readonly log: readonly Logged[];
  private next = 0;

  private constructor(seed: number, advisors: Advisors | null, log: readonly Logged[]) {
    this.seed = seed;
    this.advisors = advisors;
    this.log = log;
    Run.current = this;
    const w = createWorld();
    const events = { ...quietEvents(this.notices), rise: (opened: number) => { this.risen = opened; } };
    bind({ ...w, clock: this.clock, events, classic: false });
    // A varied site with one special resource (STORY-070), mapped with its neighbours as the
    // flight comes down, and the city's rings as it lands (STORY-017)
    const site = chooseStartSite(w.regions, seed, {
      terrainOf,
      hasResource: t => (terrainOf(t), (w.tileTypes.codes[t] & 16) !== 0),
      good: t => Number.isFinite(world.cost(t)) && world.siteScore(t) >= FAIR_SITE,
    });
    setGame({ seed, startCity: site.city, capital: site.tile });
    reveal(withNeighbors(site.tile));
    reveal(tilesInRings(site.tile, CITY_LEVEL_RINGS));
    this.state = startGame(site.city, undefined, {});
  }

  /** A new game of a seed under advisors chosen at the start, as the player chooses them. */
  static play(seed: number, advisors: Advisors): Run {
    const run = new Run(seed, advisors, []);
    for (const level of ['town', 'city', 'province', 'state', 'planet'] as const) run.give({ kind: 'advise', level, advisor: advisors[level] });
    return run;
  }

  /** A game played again from its command log: the player's commands, the answers to the cards among them. */
  static replay(seed: number, log: readonly Logged[]): Run {
    return new Run(seed, null, log.filter(e => e.by === 'player'));
  }

  /** A command from the player: false when it did not take effect. */
  give(cmd: Command): boolean {
    this.live();
    return dispatch(cmd, 'player');
  }

  /**
   * One step, as a frame of the browser's golden run: a day if no card waits, then the cards an
   * advisor answers itself, and a level's rise due. Returns whether a day passed.
   */
  step(): boolean {
    this.live();
    prepareDay();
    const blocked = pending(this.state).length > 0 || this.risen !== null;
    if (!blocked) {
      this.clock.day++;
      simulateDay(this.clock.day);
    }
    advisorsAnswer();
    if (this.risen === null) riseCheck();
    return !blocked;
  }

  /** Answer what waits as an advisor would: a level's card closed (its advisors asked for), else the card the game stopped for. */
  decide(): boolean {
    const risen = this.risen;
    this.risen = null;
    const cmd = this.advisors && this.advisorsWay(this.advisors, risen);
    return !!cmd && this.give(cmd);
  }

  /** Play until a day: false when the game ended, a card waits that nothing answers, or a replay went its own way. */
  until(day: number): boolean {
    let stuck = 0;
    while (this.clock.day < day) {
      if (this.state.over) return false;
      if (this.advisors === null && !this.replayToday()) return false;
      if (this.step()) {
        stuck = 0;
        continue;
      }
      const answered = this.advisors ? this.decide() : this.next < this.log.length && this.log[this.next].day === this.clock.day;
      if (!answered || ++stuck > 20) {
        this.error ??= `day ${this.clock.day}: ${this.risen !== null ? 'a level opened' : pending(this.state).map(d => d.kind).join(', ')} waits, and nothing answers it`;
        return false;
      }
    }
    return true;
  }

  /** The game's state as the save keeps it (also when the game ended), and the city-states and tribes found anew. */
  snapshot() {
    this.live();
    return { ...stateOf()!, ...opponentsNow() };
  }

  /** The simulation is this run's still. */
  private live() {
    if (Run.current !== this) throw new Error('another run holds the simulation now');
  }

  /** A replay's commands of today, in their order, before the next step; false when the log fell behind the game. */
  private replayToday(): boolean {
    for (; this.next < this.log.length && this.log[this.next].day <= this.clock.day; this.next++) {
      const e = this.log[this.next];
      if (e.day < this.clock.day) {
        this.error = `the log's command of day ${e.day} (${e.cmd.kind}) came after the game had gone on to day ${this.clock.day}`;
        return false;
      }
      if (!this.give(e.cmd)) {
        this.error = `the log's command of day ${e.day} (${e.cmd.kind}) did not take effect`;
        return false;
      }
      // The advisors asked for close the card of the level that opened
      if (e.cmd.kind === 'advise') this.risen = null;
    }
    return true;
  }

  /** What an advisor would answer: the advisor of the level that just opened, or the card waiting. */
  private advisorsWay(advisors: Advisors, risen: number | null): Command | null {
    const s = this.state;
    // Every level from the city area out asks for its advisors as it opens (STORY-096, STORY-105): the one chosen at the start
    if (risen !== null) {
      const level = advisorOfLevel(risen);
      return { kind: 'advise', level, advisor: advisors[level] };
    }
    const d = pending(s)[0];
    if (!d) return null;
    if (d.kind === 'site') return { kind: 'site', accept: true };
    if (d.kind === 'treaty') return { kind: 'treaty', accept: false };
    if (d.kind === 'raid') {
      const band = s.raids.band;
      const c = band && s.cities.find(x => x.tile === band.city);
      const plan = c && raidPlan(c);
      // Bought when it would come too late and the treasury has it, as the card offers it (STORY-108)
      return { kind: 'raid', choice: plan && !plan.inTime && plan.price > 0 && plan.price <= s.gold ? 'buy' : 'build' };
    }
    return null;
  }
}
