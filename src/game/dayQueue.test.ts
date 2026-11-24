import { describe, expect, it } from 'vitest';
import { DAY_BUDGET_MS, frameDays, MAX_DAYS_DUE, type DayWork } from './dayQueue';

/**
 * A fake game: each day takes `work` ms, and a step works on it for at most the time it is
 * given, so a day goes over frames as a late day does on a slow device, and its last slice may
 * leave time in the frame for the next day.
 */
type Fake = { day: number; started: number; held: boolean; work: DayWork };

function game(work: number): Fake {
  let t = 0;
  let left = 0;
  const g: Fake = {
    day: 0,
    started: 0,
    held: false,
    work: {
      running: () => left > 0,
      start: () => { g.day++; g.started++; left = work; },
      step: (ms: number) => { const d = Math.min(ms, left); t += d; left -= d; return left <= 0; },
      held: () => g.held,
      now: () => t,
    },
  };
  return g;
}

describe('the day queue (STORY-117)', () => {
  it('works out a day over several frames, begins the next one in the frame the last ends, and keeps at most two days waiting', () => {
    const g = game(7);
    let due = frameDays(0, 5, false, false, g.work);
    expect(g.started).toBe(1);
    expect(due).toBe(MAX_DAYS_DUE - 1);
    due = frameDays(due, 0, false, false, g.work);
    expect(g.started).toBe(1);
    // The first day ends 1 ms into the third frame, and the second begins in what is left of it
    due = frameDays(due, 0, false, false, g.work);
    expect(g.started).toBe(2);
    expect(due).toBe(0);
    expect(DAY_BUDGET_MS).toBe(3);
  });

  it('a pause in the middle of a day lets that day end, and no day begins after it (CI 2026-11-24)', () => {
    const g = game(4);
    // A day under way and one waiting behind it, as on a slow runner
    let due = frameDays(0, 3, false, false, g.work);
    expect(g.work.running()).toBe(true);
    expect(due).toBe(1);
    // Paused: the running day is worked out to its end, as a command and a save need, and then
    // the game stands, however many frames pass
    for (let k = 0; k < 10; k++) due = frameDays(due, 0, true, false, g.work);
    expect(g.work.running()).toBe(false);
    expect(g.started).toBe(1);
    expect(due).toBe(0);
  });

  it('a card waiting lets the running day end and holds the days after it', () => {
    const g = game(4);
    let due = frameDays(0, 3, false, false, g.work);
    g.held = true;
    for (let k = 0; k < 5; k++) due = frameDays(due, 0, false, true, g.work);
    expect(g.started).toBe(1);
    expect(due).toBe(0);
  });
});
