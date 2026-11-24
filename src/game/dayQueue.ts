/**
 * dayQueue.ts — the clock's days, worked out a slice a frame (STORY-117).
 *
 * A day goes over several frames, at most DAY_BUDGET_MS of each, so a late game does not stutter
 * at every day's turn. The budget is 3 ms and not 4: a part of a day, one unit's search at most,
 * takes up to about 5 ms (Node, days 300–330), and the slice that ends with it stays within the
 * frame's 8 ms (Utu's review). Moved here from main.ts so that a test can drive it frame by frame.
 *
 * Copyright (C) 2026 Sami Räisänen / Infinite
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** At most this many days wait in the queue (own): a slow device plays slower rather than works days out in one frame. */
export const MAX_DAYS_DUE = 2;
export const DAY_BUDGET_MS = 3;

/** The game's days as the queue sees them. */
export interface DayWork {
  /** A day begun and not yet worked out. */
  running(): boolean;
  /** Begins the next day. */
  start(): void;
  /** Works on the running day for at most this many ms; true once it is done. */
  step(ms: number): boolean;
  /** A card waits for an answer: no new day begins. */
  held(): boolean;
  now(): number;
}

/**
 * One frame's days: the clock's new days join the queue (unless a card or the onboarding blocks
 * the clock), and the queue is worked out within the budget. Returns the days still due.
 */
export function frameDays(due: number, fresh: number, paused: boolean, blocked: boolean, d: DayWork, budget = DAY_BUDGET_MS): number {
  if (!blocked) due = Math.min(MAX_DAYS_DUE, due + fresh);
  // A pause or a card: the days after it wait as before. A day under way is worked out to its end
  // (a command and a save take the game at a day's turn), but after a pause no day begins:
  // the queue went on past the pause while a day ran (CI 2026-11-24)
  if (paused || (blocked && !d.running())) due = 0;
  const started = d.now();
  while (d.running() || (due > 0 && !d.held())) {
    const left = budget - (d.now() - started);
    if (left <= 0) break;
    if (!d.running()) {
      due--;
      d.start();
    }
    if (!d.step(left)) break;
  }
  if (!d.running() && d.held()) due = 0;
  return due;
}
