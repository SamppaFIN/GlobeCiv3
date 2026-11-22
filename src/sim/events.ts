/**
 * events.ts — what the day's simulation tells the view (STORY-095, PLAN-092 phase B).
 *
 * The simulation changes only the game's state; what the player should see of it, a notice,
 * a glow on a tile, a card, comes out through these. The browser draws them; a run in Node
 * (src/sim/run.ts) keeps the notices and leaves the rest.
 */
import type { Rival } from '../game/rivals';
import type { Move } from '../game/chains';
import type { City } from '../game/cities';
import type { Rich } from '../game/rich';
import type { Unit } from '../game/units';

/** The glows of the game's moments (STORY-035): the same kinds as the view's pulses. */
export type MomentKind = 'city' | 'find' | 'raid' | 'victory' | 'unlock' | 'improve';

export interface SimEvents {
  /** A line in the notices. */
  notice(text: string | Rich): void;
  /** A moment glows on its tile; null: where the view is. */
  moment(kind: MomentKind, tile: number | null): void;
  /** Tiles mapped just now: the fog lifts there. */
  revealed(tiles: readonly number[]): void;
  /** A city of chains moved its goods today (STORY-101): the view may walk its carriers. */
  carriers(city: City, moves: readonly Move[], site: number | null): void;
  /** The first city was founded: its card opens. */
  firstCity(city: City): void;
  /** A city was lost: its card closes. */
  cityLost(city: City): void;
  /** A rival's proposal waits for its answer: its card shows. */
  treaty(): void;
  /** The last city fell. */
  over(by: Rival | null): void;
  /** A level's goal was reached and the next level opened (STORY-087): its card's title and text. */
  rise(opened: number, title: string, text: string): void;
  /** An advisor took a site, and the free settler set out for it: the view selects it. */
  sent(settler: Unit): void;
}

/** Events nobody watches: a run without a view keeps only the notices. */
export function quietEvents(notices: (string | Rich)[] = []): SimEvents {
  return {
    notice: t => { notices.push(t); },
    moment: () => {},
    revealed: () => {},
    carriers: () => {},
    firstCity: () => {},
    cityLost: () => {},
    treaty: () => {},
    over: () => {},
    rise: () => {},
    sent: () => {},
  };
}
