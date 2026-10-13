/**
 * advisors.ts — advisors (STORY-049; Sami 2026-10-13: "jokaiselle karttazoomi tasolla on oma
 * advisor .. pelaaja voi valita kolmesta eri neuvonantajasta, jotka mikromanageroi alueen sun
 * puolesta"). At the city area level one of three runs the cities and the units each day, and
 * with none (Oma ohjaus) the player does. Own design; it uses the game's own rules.
 *
 *   Kasvattaja   food focus; a temple before a citizen more would bring disorder, then a
 *                granary from size 2; settlers the cities built improve the land
 *   Kartoittaja  balanced focus; the scouts explore, toward the home province's least mapped
 *                area when there is no flag
 *   Vartija      production focus; a soldier in every city, two and walls while bandits are
 *                on their way; it answers the bandit card by building the soldier
 */
import type { Build, City, Focus } from './cities';

export type CityAdvisor = 'none' | 'growth' | 'explore' | 'defend';
export const CITY_ADVISOR_LIST: readonly CityAdvisor[] = ['none', 'growth', 'explore', 'defend'];

export const CITY_ADVISORS: Record<CityAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Hoidat kaupungit ja yksiköt itse.' },
  growth: { name: 'Kasvattaja', does: 'Kaupungit painottavat ruokaa ja rakentavat temppelin ennen levottomuutta ja viljavaraston. Kaupunkien uudisasukkaat kehittävät maata.' },
  explore: { name: 'Kartoittaja', does: 'Tiedustelijat tutkivat ja suuntaavat kotiläänin vähiten kartoitetulle alueelle. Kaupungit tasapainottavat.' },
  defend: { name: 'Vartija', does: 'Kaupungit painottavat tuotantoa, ja jokaisessa on sotilas. Rosvojen uhatessa kaupunki saa toisen sotilaan ja muurin.' },
};

/** What a city advisor needs to know about a city. */
export interface CityNeeds {
  /** Builds the city may start: known, not built, and no wonder another city has. */
  available: Build[];
  soldiers: number;
  /** The city is in disorder, or would be with one citizen more. */
  unrestNear: boolean;
  /** Bandits are on their way to the city. */
  threat: boolean;
  /** The best soldier the city can build. */
  soldier: 'warrior' | 'phalanx';
}

/** A city advisor's focus and build for a city (build null: as it is); null with no advisor. */
export function cityAdvice(advisor: CityAdvisor, city: City, n: CityNeeds): { focus: Focus; build: Build | null } | null {
  const can = (b: Build) => n.available.includes(b);
  switch (advisor) {
    case 'none':
      return null;
    case 'growth':
      return { focus: 'food', build: n.unrestNear && can('temple') ? 'temple' : city.size >= 2 && can('granary') ? 'granary' : null };
    case 'explore':
      return { focus: 'balanced', build: null };
    case 'defend':
      return {
        focus: 'production',
        build: n.soldiers < (n.threat ? 2 : 1) ? n.soldier : n.threat && can('walls') ? 'walls' : null,
      };
  }
}

/** The area the Kartoittaja sends the scouts to: the least mapped one not yet all mapped. */
export function exploreTarget(shares: readonly (readonly [area: number, share: number])[]): number | null {
  let best: number | null = null, low = 1;
  for (const [area, share] of shares) if (share < low) { low = share; best = area; }
  return best;
}
