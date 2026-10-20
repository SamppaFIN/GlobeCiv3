/**
 * diplomacy.ts — the player's ties with each rival (STORY-076; Sami 2026-10-20: "diplomatia
 * määrää", and the rival's attitude steers it). Own rules, docs/design/diplomatia.md: a rival
 * met is at peace; war and alliance come by declaration or a proposal accepted. The rival's
 * attitude to the player, −100 to 100, falls with borders near and with war, rises with an
 * alliance, and drifts back toward nothing in peace. The rival declares war, or proposes an
 * alliance or peace, by its attitude, and answers the player's proposals by it.
 */

export type Relation = 'peace' | 'war' | 'alliance';

export interface Ties {
  met: boolean;
  state: Relation;
  /** −100 … 100. */
  attitude: number;
  /** The day the state began. */
  since: number;
  /** Cities the rival has lost to the player in this war (STORY-077). */
  lost: number;
  /** The day of the rival's last proposal. */
  offered: number;
}

export const newTies = (): Ties => ({ met: false, state: 'peace', attitude: 0, since: 0, lost: 0, offered: -1000 });

/** Tiles between cities that make borders near. */
export const BORDER_TILES = 8;
/** Attitude lost when the player declares war, and when the player breaks an alliance. */
export const WAR_DECLARED = 50;
export const ALLIANCE_BROKEN = 20;
/** Days between the rival's proposals. */
export const OFFER_GAP = 20;

const clamp = (a: number) => Math.max(-100, Math.min(100, a));

/** The attitude in words. */
export function attitudeWord(a: number): string {
  return a >= 50 ? 'ystävällinen' : a >= 20 ? 'myönteinen' : a > -20 ? 'varautunut' : a > -50 ? 'epäluuloinen' : 'vihamielinen';
}

/** What moves the attitude now, for the diplomacy card. */
export function reasons(t: Ties, borderNear: boolean): string[] {
  return [
    ...(borderNear ? ['rajat ovat lähellä (−1 päivässä)'] : []),
    ...(t.state === 'war' ? ['sota jatkuu (−1 päivässä)'] : []),
    ...(t.state === 'alliance' ? ['liitto (+1 päivässä)'] : []),
    ...(t.state === 'peace' && !borderNear && t.attitude !== 0 ? ['rauha: asenne palaa kohti varautunutta'] : []),
  ];
}

/** A day of the ties: the attitude moves by the borders and the state. */
export function tiesDay(t: Ties, day: number, borderNear: boolean): void {
  if (!t.met) return;
  let a = t.attitude;
  if (borderNear) a -= 1;
  if (t.state === 'war') a -= 1;
  if (t.state === 'alliance') a += 1;
  // In peace with no borders near it drifts back toward nothing, a point every fifth day
  if (t.state === 'peace' && !borderNear && day % 5 === 0 && a !== 0) a -= Math.sign(a);
  t.attitude = clamp(a);
}

/** What the rival does today, if anything: it declares war, proposes an alliance or peace. */
export function rivalMove(t: Ties, day: number, stronger: boolean): 'war' | 'alliance' | 'peace' | null {
  if (!t.met) return null;
  if (t.state === 'peace' && t.attitude <= -50 && stronger) return 'war';
  if (day - t.offered < OFFER_GAP) return null;
  if (t.state === 'peace' && t.attitude >= 60) return 'alliance';
  if (t.state === 'war' && day - t.since >= 20 && (t.lost > 0 || t.attitude >= -40)) return 'peace';
  return null;
}

/** Whether the rival accepts the player's proposal of peace or an alliance. */
export function accepts(t: Ties, day: number, proposal: 'peace' | 'alliance'): boolean {
  if (proposal === 'peace') return t.state === 'war' && day - t.since >= 10 && (t.attitude >= -60 || t.lost > 0);
  return t.state === 'peace' && t.attitude >= 50;
}

/** The state changes: war or peace (the attitude falls when the player declares war or breaks an alliance), or an alliance. */
export function setState(t: Ties, state: Relation, day: number, byPlayer = false): void {
  if (state === 'war' && byPlayer) t.attitude = clamp(t.attitude - WAR_DECLARED);
  if (state === 'peace' && t.state === 'alliance' && byPlayer) t.attitude = clamp(t.attitude - ALLIANCE_BROKEN);
  t.state = state;
  t.since = day;
  if (state !== 'war') t.lost = 0;
}
