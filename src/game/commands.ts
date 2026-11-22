/**
 * commands.ts — what the player and the advisors do, as data (STORY-086, project rule 7).
 *
 * An act that changes the game is a Command: founding a city or offering a site for one,
 * choosing what a city builds (in a city of chains a chain building starts a site, STORY-088),
 * moving a building and choosing a study, the answers to the cards the game stops for
 * (STORY-095), and the rest of the player's acts: a unit's mode and task, the city site, the
 * flag, a city's focus, the rates, the revolution, the plans of the levels and the target
 * state, and the dealings with the rivals (STORY-112). The game runs every one of them through
 * execute(), and the ones that took effect go into the CommandLog with their day and
 * actor. The log is saved, so a game can later be replayed and, with a server, shared.
 * What follows from the rules by itself (growth, a building placed when it is done, the
 * rivals) is the simulation, not a command.
 *
 * A saved log is not trusted (security rule 5): save.ts checks every entry.
 */
import type { AdvisorLevel } from './advisors';
import type { Build, Building, City, Focus } from './cities';
import { chainOpen, CHAIN_ONLY, isChainBuilding, startSite } from './chains';
import { move, spots, type Ground } from './placement';
import { LUX_RATES, NEEDS, TAX_RATES, type LuxRate, type Research, type Study, type TaxRate } from './science';
import type { ResourceKind } from './terrainTypes';
import type { AreaPlan, Mode, SettlerTask, StateLine } from './units';

export type Command =
  /** The selected settler sets out to found a city on its marked site (the HUD's button). */
  | { kind: 'found'; tile: number }
  /** A city on this site: a free settler goes there, or the capital builds one (the cards). */
  | { kind: 'settle'; tile: number }
  /** The city on the tile builds this next. */
  | { kind: 'build'; city: number; build: Build }
  /** The city on the tile moves its building onto another tile (STORY-071). */
  | { kind: 'move'; city: number; building: Building; tile: number }
  /** The people study this next (STORY-040, STORY-072). */
  | { kind: 'study'; target: Study }
  /** A level's advisor (STORY-096): one of its three, or 'none' for the player's own hand. */
  | { kind: 'advise'; level: AdvisorLevel; advisor: string }
  /** The city on the tile buys what it builds, out of the treasury (STORY-038, STORY-098). */
  | { kind: 'buy'; city: number }
  /** The realm aims at this province: the province level's goal (STORY-111). */
  | { kind: 'target'; province: number }
  /** The answer to the site the game stopped for (STORY-032): settle it, or later (STORY-095). */
  | { kind: 'site'; accept: boolean }
  /** The answer to the raid the game stopped for (STORY-034, STORY-108): build a soldier, buy one, or trust the defence. */
  | { kind: 'raid'; choice: RaidChoice }
  /** The answer to a rival's proposal (STORY-076): yes or no. */
  | { kind: 'treaty'; accept: boolean }
  /** A unit, by its id, explores, gathers or defends (STORY-025). */
  | { kind: 'mode'; unit: number; mode: Mode }
  /** A settler, by its id, founds cities or improves land (STORY-033). */
  | { kind: 'task'; unit: number; task: SettlerTask }
  /** The settler's city site: this tile, or the nearest land to it (STORY-025). */
  | { kind: 'pick'; tile: number }
  /** The next of the sites found instead (the HUD's skip, STORY-025). */
  | { kind: 'skip' }
  /** The exploring scouts toward a tile: the flag, an expedition or a target province (STORY-025, STORY-026). */
  | { kind: 'flag'; tile: number }
  /** The city on the tile weighs food, balance or production (STORY-039). */
  | { kind: 'focus'; city: number; focus: Focus }
  /** The share of trade to gold, the rest to science (STORY-040). */
  | { kind: 'tax'; tax: TaxRate }
  /** The share of trade to luxury (STORY-046). */
  | { kind: 'lux'; lux: LuxRate }
  /** The revolution toward Monarchy (STORY-047). */
  | { kind: 'revolution' }
  /** A city area's plan: explore, settle or skip (STORY-026). */
  | { kind: 'plan'; area: number; plan: AreaPlan }
  /** The state's line (STORY-026). */
  | { kind: 'line'; line: StateLine }
  /** The planet level's target state (STORY-057). */
  | { kind: 'aim'; state: number }
  /** A rival: war declared, the alliance broken, an alliance or peace proposed (STORY-076). */
  | { kind: 'pact'; rival: number; act: PactAct }
  /** A trade offered to a rival (STORY-078): what the player gives and gets, by the item's id (trade.ts). */
  | { kind: 'trade'; rival: number; give: string; get: string };

/** What the player does with a rival on its diplomacy card (STORY-076). */
export type PactAct = 'war' | 'break' | 'alliance' | 'peace';
export const PACT_ACTS: readonly PactAct[] = ['war', 'break', 'alliance', 'peace'];

/** What a raid card's buttons do (STORY-108). */
export type RaidChoice = 'build' | 'buy' | 'later';
export const RAID_CHOICES: readonly RaidChoice[] = ['build', 'buy', 'later'];

export type CommandKind = Command['kind'];
export const COMMAND_KINDS: readonly CommandKind[] = ['found', 'settle', 'build', 'move', 'study', 'advise', 'buy', 'target', 'site', 'raid', 'treaty',
  'mode', 'task', 'pick', 'skip', 'flag', 'focus', 'tax', 'lux', 'revolution', 'plan', 'line', 'aim', 'pact', 'trade'];

/** Who gave a command: the player, the people on their own, or an advisor's level. */
export type Actor = 'player' | 'people' | 'town' | 'city' | 'province' | 'state' | 'planet';
export const ACTORS: readonly Actor[] = ['player', 'people', 'town', 'city', 'province', 'state', 'planet'];

export interface Logged {
  day: number;
  by: Actor;
  cmd: Command;
}

/** What a command acts on. Founding and settling need the units and the notices, so the game gives them. */
export interface CommandWorld {
  cities: City[];
  research: Research;
  /** The kinds of resource found on the map, which become studies (STORY-072). */
  kindsFound: Iterable<ResourceKind>;
  ground: Ground;
  found(tile: number): boolean;
  settle(tile: number): boolean;
  /** Set a level's advisor; false when it is not one of that level's. */
  advise(level: AdvisorLevel, advisor: string): boolean;
  /** Buy what the city on the tile builds; false when there is nothing to buy or too little gold. */
  buy(tile: number): boolean;
  /** Aim at a province; false when it is no province to aim at (STORY-111). */
  target(province: number): boolean;
  /** Answer the card the game stopped for; false when no such card waits (STORY-095). */
  answerSite(accept: boolean): boolean;
  answerRaid(choice: RaidChoice): boolean;
  answerTreaty(accept: boolean): boolean;
  /** The player's other acts (STORY-112): each false when it changes nothing. */
  setMode(unit: number, mode: Mode): boolean;
  setTask(unit: number, task: SettlerTask): boolean;
  pickSite(tile: number): boolean;
  skipSite(): boolean;
  sendTo(tile: number): boolean;
  setTax(tax: TaxRate): boolean;
  setLux(lux: LuxRate): boolean;
  revolution(): boolean;
  setPlan(area: number, plan: AreaPlan): boolean;
  setLine(line: StateLine): boolean;
  aim(state: number): boolean;
  pact(rival: number, act: PactAct): boolean;
  trade(rival: number, give: string, get: string): boolean;
}

/**
 * Carries out a command under the same rules as the player's buttons. Returns whether it
 * took effect: a build whose advance is unknown, a study not open or a move onto a tile the
 * building may not stand on changes nothing.
 */
export function execute(cmd: Command, w: CommandWorld): boolean {
  switch (cmd.kind) {
    case 'found':
      return w.found(cmd.tile);
    case 'advise':
      return w.advise(cmd.level, cmd.advisor);
    case 'buy':
      return w.buy(cmd.city);
    case 'target':
      return w.target(cmd.province);
    case 'site':
      return w.answerSite(cmd.accept);
    case 'raid':
      return w.answerRaid(cmd.choice);
    case 'treaty':
      return w.answerTreaty(cmd.accept);
    case 'settle':
      return w.settle(cmd.tile);
    case 'mode':
      return w.setMode(cmd.unit, cmd.mode);
    case 'task':
      return w.setTask(cmd.unit, cmd.task);
    case 'pick':
      return w.pickSite(cmd.tile);
    case 'skip':
      return w.skipSite();
    case 'flag':
      return w.sendTo(cmd.tile);
    case 'focus': {
      const c = w.cities.find(x => x.tile === cmd.city);
      if (!c || c.focus === cmd.focus) return false;
      c.focus = cmd.focus;
      return true;
    }
    case 'tax':
      return (TAX_RATES as readonly number[]).includes(cmd.tax) && w.setTax(cmd.tax);
    case 'lux':
      return (LUX_RATES as readonly number[]).includes(cmd.lux) && w.setLux(cmd.lux);
    case 'revolution':
      return w.revolution();
    case 'plan':
      return w.setPlan(cmd.area, cmd.plan);
    case 'line':
      return w.setLine(cmd.line);
    case 'aim':
      return w.aim(cmd.state);
    case 'pact':
      return w.pact(cmd.rival, cmd.act);
    case 'trade':
      return w.trade(cmd.rival, cmd.give, cmd.get);
    case 'build': {
      const c = w.cities.find(x => x.tile === cmd.city);
      const need = NEEDS[cmd.build];
      if (!c || (need && !w.research.known.has(need))) return false;
      // A chain building is built of planks and stone on a site that has a tile (STORY-088)
      if (c.chain && isChainBuilding(cmd.build)) return chainOpen(c.chain, c.buildings, cmd.build) && spots(c, cmd.build, w.ground).length > 0 && startSite(c.chain, cmd.build);
      if (!c.chain && (CHAIN_ONLY as readonly string[]).includes(cmd.build)) return false;
      c.build = cmd.build;
      return true;
    }
    case 'move': {
      const c = w.cities.find(x => x.tile === cmd.city);
      return c !== undefined && move(c, cmd.building, cmd.tile, w.ground);
    }
    case 'study':
      if (!w.research.available(w.kindsFound).includes(cmd.target)) return false;
      w.research.target = cmd.target;
      return true;
  }
}

/** The commands that took effect, in order. */
export class CommandLog {
  readonly entries: Logged[];

  constructor(saved: readonly Logged[] = []) {
    this.entries = saved.map(copy);
  }

  record(day: number, by: Actor, cmd: Command) {
    this.entries.push({ day, by, cmd: { ...cmd } });
  }

  save(): Logged[] {
    return this.entries.map(copy);
  }
}

const copy = (e: Logged): Logged => ({ day: e.day, by: e.by, cmd: { ...e.cmd } });
