/**
 * rich.ts — the texts of the game as data (STORY-103): plain text and references to a city, a
 * unit, a person, a building, an advance, a resource or an era. The game writes them; the view
 * draws them (src/ui/richText.ts). Kept apart from the drawing so the simulation has them
 * without the page (STORY-095).
 */

export type RefKind = 'city' | 'unit' | 'person' | 'building' | 'unittype' | 'advance' | 'resource' | 'good' | 'era';
/** The kinds that are terms of the Tietokirja. */
export type TermKind = Exclude<RefKind, 'city' | 'unit'>;

export type Ref =
  | { ref: 'city'; tile: number; name: string }
  | { ref: 'unit'; id: number; name: string }
  | { ref: TermKind; name: string; page?: string };

export type Segment = string | Ref;
export type Rich = readonly Segment[];

/** The text without its colours: for the notice log, the tests and the tab title. */
export const plain = (r: Rich | string): string => (typeof r === 'string' ? r : r.map(s => (typeof s === 'string' ? s : s.name)).join(''));

/** Shorthands for writing texts. */
export const city = (tile: number, name: string): Ref => ({ ref: 'city', tile, name });
export const unit = (id: number, name: string): Ref => ({ ref: 'unit', id, name });
export const term = (ref: TermKind, name: string, page?: string): Ref => (page ? { ref, name, page } : { ref, name });
