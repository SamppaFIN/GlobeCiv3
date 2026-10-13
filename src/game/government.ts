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
 * One turn is one game day.
 */
import { hash } from '../globe/terrain';
import type { Yield } from './terrainTypes';

export type Government = 'anarchy' | 'despotism' | 'monarchy';
export const GOVERNMENT_LIST: readonly Government[] = ['anarchy', 'despotism', 'monarchy'];

export const GOVERNMENTS: Record<Government, { name: string; penalty: boolean; freeUnits: number; empireBase: number; martialLaw: number }> = {
  anarchy: { name: 'Anarkia', penalty: true, freeUnits: 3, empireBase: 9, martialLaw: 100 },
  despotism: { name: 'Itsevaltius', penalty: true, freeUnits: 3, empireBase: 10, martialLaw: 100 },
  monarchy: { name: 'Monarkia', penalty: false, freeUnits: 0, empireBase: 11, martialLaw: 3 },
};

const cut = (v: number) => (v > 2 ? v - 1 : v);

/** A tile's yield under a government: over 2 loses 1 under Anarchy and Despotism. */
export const governed = (y: Yield, gov: Government): Yield =>
  GOVERNMENTS[gov].penalty ? { food: cut(y.food), shield: cut(y.shield), trade: cut(y.trade) } : y;

/** Days of anarchy for a revolution started on `day`: 1 to 5, from the seed. */
export const revolutionDays = (seed: number, day: number) =>
  1 + Math.min(4, Math.floor(((hash(day, 47, 0, seed) + 1) / 2) * 5));
