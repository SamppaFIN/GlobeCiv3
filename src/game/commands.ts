/**
 * commands.ts — what the player and the advisors do, as data (STORY-086, project rule 7).
 *
 * An act that changes the game is a Command: founding a city or offering a site for one,
 * choosing what a city builds (in a city of chains a chain building starts a site, STORY-088),
 * moving a building and choosing a study, and the answers to the cards the game stops for
 * (STORY-095). The game runs every one of them through
 * execute(), and the ones that took effect go into the CommandLog with their day and
 * actor. The log is saved, so a game can later be replayed and, with a server, shared.
 * What follows from the rules by itself (growth, a building placed when it is done, the
 * rivals) is the simulation, not a command.
 *
 * A saved log is not trusted (security rule 5): save.ts checks every entry.
 */
import type { AdvisorLevel } from './advisors';
import type { Build, Building, City } from './cities';
import { chainOpen, CHAIN_ONLY, isChainBuilding, startSite } from './chains';
import { move, spots, type Ground } from './placement';
import { NEEDS, type Research, type Study } from './science';
import type { ResourceKind } from './terrainTypes';

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
  | { kind: 'treaty'; accept: boolean };

/** What a raid card's buttons do (STORY-108). */
export type RaidChoice = 'build' | 'buy' | 'later';
export const RAID_CHOICES: readonly RaidChoice[] = ['build', 'buy', 'later'];

export type CommandKind = Command['kind'];
export const COMMAND_KINDS: readonly CommandKind[] = ['found', 'settle', 'build', 'move', 'study', 'advise', 'buy', 'target', 'site', 'raid', 'treaty'];

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
