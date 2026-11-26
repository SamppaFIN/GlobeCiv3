/**
 * government.ts — governments (STORY-047), Freeciv civ1 (GPL, commit b6156f2e2d):
 *  - Despotism is the start (data/civ1/nations.ruleset); Monarchy needs the Monarchy
 *    advance (governments.ruleset), which needs Ceremonial Burial and Code of Laws (techs.ruleset)
 *  - under Anarchy and Despotism a tile's food, shields or trade over 2 loses 1
 *    (effects.ruleset Output_Penalty_Tile 2; common/city.c city_tile_output applies it after
 *    the Colossus)
 *  - a city supports 3 units free of shield upkeep under Anarchy and Despotism, none under
 *    Monarchy (Unit_Upkeep_Free_Per_City)
 *  - fewer citizens are content from the 10th / 11th / 12th city on (Empire_Size_Base 9, 10
 *    and 11 under Anarchy, Despotism and Monarchy)
 *  - each soldier in a city calms one citizen, at most 3 under Monarchy (Martial_Law_By_Unit 1,
 *    Martial_Law_Max 3; 100 under Anarchy and Despotism)
 *  - a revolution is 1 to 5 turns of Anarchy (server/plrhand.c revolentype_length with the
 *    defaults in common/game.h, REVOLEN_RANDOM and revolen 5), in which citizens spend all
 *    income rather than pay taxes or do research (governments.ruleset, Anarchy): all trade
 *    is luxury
 * The Republic (STORY-125), Freeciv civ1 commit 04852fb: it needs The Republic, which needs Code of
 * Laws and Literacy (techs.ruleset). A tile that makes trade makes one more (effects.ruleset
 * Output_Inc_Tile 1; common/city.c city_tile_output adds it only where the tile already makes
 * some), a settler eats 2 food (Upkeep_Pct 100 on its uk_food 1), no unit is free of upkeep and
 * no soldier calms anyone (neither Unit_Upkeep_Free_Per_City nor Martial_Law for it), fewer
 * citizens are content from the 14th city on (Empire_Size_Base 13), and each unit able to
 * attack that stands outside a city makes one citizen of its home city unhappy (Unhappy_Factor
 * 1 times uk_happy 1; common/unit.c unit_being_aggressive with civ1's borders off, game.ruleset).
 * Left out, as for every government: waste (Output_Waste), celebration (Rapture_Grow) and civil
 * war. Own: no senate (Sami 2026-11-26; civ1's Has_Senate would keep a peace from being broken).
 * One turn is one game day.
 */
import { hash } from '../globe/terrain';
import type { Yield } from './terrainTypes';

export type Government = 'anarchy' | 'despotism' | 'monarchy' | 'republic';
export const GOVERNMENT_LIST: readonly Government[] = ['anarchy', 'despotism', 'monarchy', 'republic'];

/** What a government does: the penalty and the trade over a tile, the free units, the settler's food, the empire's base, martial law and units away. */
export interface GovernmentRules { name: string; penalty: boolean; trade: number; freeUnits: number; settlerFood: number; empireBase: number; martialLaw: number; awayUnhappy: number }

export const GOVERNMENTS: Record<Government, GovernmentRules> = {
  anarchy: { name: 'Anarkia', penalty: true, trade: 0, freeUnits: 3, settlerFood: 1, empireBase: 9, martialLaw: 100, awayUnhappy: 0 },
  despotism: { name: 'Itsevaltius', penalty: true, trade: 0, freeUnits: 3, settlerFood: 1, empireBase: 10, martialLaw: 100, awayUnhappy: 0 },
  monarchy: { name: 'Monarkia', penalty: false, trade: 0, freeUnits: 0, settlerFood: 1, empireBase: 11, martialLaw: 3, awayUnhappy: 0 },
  republic: { name: 'Tasavalta', penalty: false, trade: 1, freeUnits: 0, settlerFood: 2, empireBase: 13, martialLaw: 0, awayUnhappy: 1 },
};

/** Governments a revolution can lead to; each needs the advance of its own name. */
export const REVOLUTION_TARGETS = ['monarchy', 'republic'] as const;
export type RevolutionTarget = (typeof REVOLUTION_TARGETS)[number];
/** "To Monarchy", "to the Republic". */
export const REVOLUTION_TO: Record<RevolutionTarget, string> = { monarchy: 'Monarkiaan', republic: 'Tasavaltaan' };

const cut = (v: number) => (v > 2 ? v - 1 : v);

/** A tile's yield under a government: the Republic adds a trade where there is trade, and over 2 loses 1 under Anarchy and Despotism. */
export function governed(y: Yield, gov: Government): Yield {
  const g = GOVERNMENTS[gov];
  const t = g.trade && y.trade > 0 ? { ...y, trade: y.trade + g.trade } : y;
  return g.penalty ? { food: cut(t.food), shield: cut(t.shield), trade: cut(t.trade) } : t;
}

/** Days of anarchy for a revolution started on `day`: 1 to 5, from the seed. */
export const revolutionDays = (seed: number, day: number) =>
  1 + Math.min(4, Math.floor(((hash(day, 47, 0, seed) + 1) / 2) * 5));
