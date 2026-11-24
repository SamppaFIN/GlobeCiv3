/**
 * eras.ts — the seven eras and what opens them (STORY-120; Sami 2026-11-23: all the eras, each
 * opened by a key advance). Freeciv's civ1 rules have no eras, so the split, the order and the
 * keys are own (docs/design/tiede-ja-aikakaudet.md): the order is the common one of history,
 * joined to the two eras the game already had, and each key needs the one before it.
 *
 * A key is listed only once its advance is in the game: the iron age now, and the gunpowder,
 * metallurgy, steel, automobile and nuclear fission keys with their eras' advances in
 * STORY-121, 122 and 123 (Sami 2026-11-24). An era whose key is not listed never comes.
 */
import type { Era } from './persons';
import { ERAS } from './persons';
import type { Advance } from './science';

/** The advance that opens each era; the early age is there from the start. */
export const ERA_KEYS: Partial<Record<Era, Advance>> = { iron: 'iron' };

/**
 * The era each advance in the game belongs to, for the science tree's order and the era's page
 * (own split by the design table). The era itself changes only by its key.
 */
export const ADVANCE_ERA: Record<Advance, Era> = {
  alphabet: 'early', bronze: 'early', ceremonial: 'early', pottery: 'early', masonry: 'early', horseback: 'early',
  wheel: 'early', writing: 'early', law: 'early', mapmaking: 'early', currency: 'early',
  iron: 'iron', mathematics: 'iron', monarchy: 'iron', construction: 'iron',
};

/** The era an advance opens: the one whose key it is, if any. */
export const eraOpenedBy = (a: Advance): Era | undefined => ERAS.find(e => ERA_KEYS[e] === a);

/**
 * The era now: the latest whose key is known. Own research follows the chain, but trade and a
 * resource building's reward may give an advance without what it needs, so an era can be
 * passed over: the chronicle then tells the new one, and the one between is never lived (own
 * rule). The keys are a parameter so that a test can run all seven eras.
 */
export function eraOf(known: { has(a: string): boolean }, keys: Partial<Record<Era, string>> = ERA_KEYS): Era {
  let era: Era = 'early';
  for (const e of ERAS) if (keys[e] && known.has(keys[e]!)) era = e;
  return era;
}
