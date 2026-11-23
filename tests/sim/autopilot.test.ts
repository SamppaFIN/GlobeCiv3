import { mkdirSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { Advisors } from '../../src/sim/run';
import { autopilot, type Report } from './autopilot';

/**
 * The autopilot (STORY-085): a new game of seed 42 plays itself under its advisors in Node, once
 * for each way the golden runs play (tests/golden), and the five measures of its pace are
 * reported (tests/sim/autopilot.ts says how each is taken). The measures are a report, not
 * limits: a test fails only when a level of the MVP does not open by the horizon, the run stops,
 * or an invariant breaks. The report is printed and written to test-results/autopilot/.
 */
const SEED = 42;
const HORIZON = 900;
const WAYS: Record<string, Advisors> = {
  feed: { town: 'feed', city: 'growth', province: 'settle', state: 'expand', planet: 'conquer' },
  build: { town: 'build', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' },
  roam: { town: 'roam', city: 'explore', province: 'explore', state: 'science', planet: 'explore' },
};

/** The report in a few lines, in the game's language. */
function lines(way: string, r: Report): string[] {
  const span = (x: { days: number; minutes: number; from: number; to: number }) => `${x.days} pv (${x.minutes} min, päivät ${x.from}–${x.to})`;
  return [
    `Autopilotti ${way}, siemen ${r.seed}: ${r.days} päivää${r.failure ? ` · PUNAINEN: ${r.failure}` : ''}`,
    `  1 aika ensimmäiseen päätökseen: ${r.firstDecision ? `päivä ${r.firstDecision.day} (${r.firstDecision.minutes} min, ${r.firstDecision.kind})` : 'ei päätöksiä'}`,
    `  2 päätöksiä pelipäivää kohden: ${r.decisionsPerDay} (${r.decisions} päätöstä)`,
    `  3 pisin tyhjä jakso: ${span(r.longestEmpty)} · ilman päätöstä ${span(r.longestWithoutDecision)}`,
    `  4 sekavuusindeksi: enintään ${r.confusion.peakPerMinute} uutta järjestelmää minuutissa (päivästä ${r.confusion.peakAt}), keskimäärin ${r.confusion.meanPerMinute}`,
    `  5 nousut: ${r.rises.map(x => `${x.level} päivä ${x.day} (${x.minutes} min)`).join(' · ') || 'ei nousuja'}`,
    `  järjestelmät: ${r.systems.map(x => `${x.name} ${x.day}`).join(', ')}`,
    `  uudisasukkaita enimmillään: ${r.mostSettlers}`,
  ];
}

describe('the autopilot plays seed 42 under its advisors (STORY-085)', () => {
  const reports: Record<string, Report> = {};

  for (const [way, advisors] of Object.entries(WAYS)) {
    it(`${way}: the levels of the MVP open, and nothing breaks`, () => {
      const r = autopilot(SEED, advisors, HORIZON);
      reports[way] = r;
      console.log(lines(way, r).join('\n'));
      // Red only for a level not opened, a run stopped or an invariant broken (Utu's review: not for a measure)
      expect(r.failure).toBeNull();
    }, 600_000);
  }

  // The report of the ways that ran, also when only some did (Utu's review)
  afterAll(() => {
    mkdirSync('test-results/autopilot', { recursive: true });
    writeFileSync(`test-results/autopilot/seed-${SEED}.json`, `${JSON.stringify(reports, null, 2)}\n`);
  });
});
