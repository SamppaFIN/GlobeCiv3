/**
 * trade.ts — trades with a rival (STORY-078; Sami 2026-10-20: maps, advances and kinds of
 * resource can be traded, and the rival weighs a trade by its worth and its attitude). Own
 * rules, docs/design/diplomatia.md: an advance is worth what researching it would cost the one
 * who gets it, a kind of resource STUDY_COST, maps MAPS_WORTH and gold its amount. The rival
 * accepts when it gets at least what it gives times its attitude's factor; at war or when
 * hostile it trades nothing. An accepted trade raises its attitude by TRADE_ATTITUDE.
 */
import type { Relation } from './diplomacy';
import { advanceCost, STUDY_COST, type Advance } from './science';
import type { ResourceKind } from './terrainTypes';

export type TradeItem =
  | { kind: 'nothing' }
  | { kind: 'maps' }
  | { kind: 'advance'; id: Advance }
  | { kind: 'resource'; id: ResourceKind }
  | { kind: 'gold'; amount: number };

export const MAPS_WORTH = 10;
export const TRADE_ATTITUDE = 10;
/** Days between two trades of maps with a rival. */
export const MAPS_EVERY = 30;

/** What an item is worth to the one who gets it, who knows `known` advances. */
export function worth(item: TradeItem, known: number): number {
  switch (item.kind) {
    case 'nothing': return 0;
    case 'maps': return MAPS_WORTH;
    case 'advance': return advanceCost(known);
    case 'resource': return STUDY_COST;
    case 'gold': return item.amount;
  }
}

/** How much more than it gives the rival wants, by its attitude; null when it trades nothing. */
export function factor(attitude: number, state: Relation): number | null {
  if (state === 'war' || attitude <= -50) return null;
  return attitude >= 20 ? 0.75 : attitude > -20 ? 1 : 1.5;
}

/** Whether the rival accepts: it gets `got` and gives `given` (worth to each side). */
export function acceptsTrade(attitude: number, state: Relation, got: number, given: number): boolean {
  const f = factor(attitude, state);
  return f !== null && (got > 0 || given > 0) && got >= given * f;
}
