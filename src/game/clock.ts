/**
 * clock.ts — the game day.
 *
 * A day passes every DAY_SECONDS of wall time at 1× speed (rule 5: the wall clock,
 * not frames). One frame catches up at most MAX_DAYS_PER_FRAME days, so returning
 * to a hidden tab does not run hundreds of days at once.
 */
export const DAY_SECONDS = 1.5;
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
const MAX_DAYS_PER_FRAME = 8;

export class GameClock {
  day = 1;
  speed: Speed = 1;
  paused = false;
  private carry = 0;

  /** Advance by wall-clock seconds; returns the number of days that passed. */
  advance(seconds: number): number {
    if (this.paused || seconds <= 0) return 0;
    this.carry += seconds * this.speed;
    let days = Math.floor(this.carry / DAY_SECONDS);
    this.carry -= days * DAY_SECONDS;
    if (days > MAX_DAYS_PER_FRAME) {
      days = MAX_DAYS_PER_FRAME;
      this.carry = 0;
    }
    this.day += days;
    return days;
  }
}
