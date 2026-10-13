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
import type { Advance } from './science';
import type { StateLine } from './units';

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

/*
 * The province level (STORY-050): one of three runs the home province's city areas.
 *
 *   Asuttaja            marks the two best mapped areas without a city Asuta, and takes the
 *                       scouts' city sites itself (the capital builds a settler when none is free)
 *   Tutkimusmatkailija  clears Ohita, and sends an expedition to the nearest area less than
 *                       60 % mapped: in the home province, then in the home state
 *   Vartija             keeps the scouts in the home province; a city without a soldier builds
 *                       one, and a city near the province border builds walls
 * The province advisor's builds and expeditions go before the city advisor's.
 */
export type ProvinceAdvisor = 'none' | 'settle' | 'explore' | 'defend';
export const PROVINCE_ADVISOR_LIST: readonly ProvinceAdvisor[] = ['none', 'settle', 'explore', 'defend'];

export const PROVINCE_ADVISORS: Record<ProvinceAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Hoidat läänin painotukset ja retkikunnat itse.' },
  settle: { name: 'Asuttaja', does: 'Merkitsee läänin parhaat kartoitetut alueet asutettaviksi ja hyväksyy kaupunkipaikat itse. Pääkaupunki tekee uudisasukkaan, kun paikka odottaa.' },
  explore: { name: 'Tutkimusmatkailija', does: 'Poistaa Ohita-merkinnät ja lähettää retkikunnan lähimmälle alueelle, joka on alle 60 % kartoitettu: ensin läänissä, sitten valtiossa.' },
  defend: { name: 'Vartija', does: 'Tiedustelijat pysyvät läänissä. Kaupunki ilman sotilasta tekee sellaisen, ja läänin rajalla oleva kaupunki rakentaa muurin.' },
};

/** The areas the Asuttaja marks Asuta: the best of those without a city, mapped at least a quarter. */
export function settleAreas(areas: readonly { area: number; hasCity: boolean; share: number; best: number }[], count = 2): number[] {
  return areas
    .filter(a => !a.hasCity && a.share >= 0.25)
    .sort((a, b) => b.best - a.best || a.area - b.area)
    .slice(0, count)
    .map(a => a.area);
}

/** The area an expedition goes to: the nearest less than `enough` mapped, else the least mapped one left. */
export function expeditionTarget(areas: readonly { area: number; share: number; distance: number }[], enough = 0.6): number | null {
  const under = areas.filter(a => a.share < enough).sort((a, b) => a.distance - b.distance || a.area - b.area);
  if (under.length) return under[0].area;
  return exploreTarget(areas.map(a => [a.area, a.share] as const));
}

/** The province Vartija's build for a city: a soldier first, then walls near the border. */
export function provinceBuild(advisor: ProvinceAdvisor, n: { soldiers: number; border: boolean; available: Build[]; soldier: 'warrior' | 'phalanx'; walls: boolean }): Build | null {
  if (advisor !== 'defend') return null;
  if (n.soldiers < 1) return n.soldier;
  return n.border && !n.walls && n.available.includes('walls') ? 'walls' : null;
}

/*
 * The state level (STORY-051): one of three runs the realm's science, taxes and line, the
 * revolution to Monarchy, and the state's target province. Sami chose that science belongs here.
 *
 *   Laajentaja  the state line Laajentuminen, tax 50 %, advances for growth first, and the
 *               nearest province of the home state under 60 % mapped as the target
 *   Oppinut     the state line Tutkimus, tax 30 %, writing and trade first
 *   Kenraali    the state line Puolustus, tax 70 %, bronze and masonry first; it buys the
 *               soldier or walls a city under threat is building when the treasury allows
 * Each one starts the revolution to Monarchy once it is known, and puts trade into luxury a
 * step at a time while a city is in disorder, and back a step after ten calm days.
 */
export type StateAdvisor = 'none' | 'expand' | 'science' | 'war';
export const STATE_ADVISOR_LIST: readonly StateAdvisor[] = ['none', 'expand', 'science', 'war'];

export const STATE_ADVISORS: Record<StateAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Hoidat tutkimuksen, verot, valtion linjan ja tavoitteen itse.' },
  expand: { name: 'Laajentaja', does: 'Valtion linja Laajentuminen, vero 50 %, kasvun keksinnöt ensin. Tavoitteeksi lähin valtion lääni, joka on alle 60 % kartoitettu.' },
  science: { name: 'Oppinut', does: 'Valtion linja Tutkimus, vero 30 %, kirjoitus ja kauppa ensin.' },
  war: { name: 'Kenraali', does: 'Valtion linja Puolustus, vero 70 %, pronssi ja muuraus ensin. Ostaa uhatun kaupungin sotilaan tai muurin, kun kassa riittää.' },
};

/** Each advisor's state line, tax rate and order of advances. */
export const STATE_PLANS: Record<Exclude<StateAdvisor, 'none'>, { line: StateLine; tax: number; order: Advance[] }> = {
  expand: { line: 'expand', tax: 50, order: ['pottery', 'ceremonial', 'alphabet', 'law', 'monarchy', 'bronze', 'currency', 'masonry', 'writing'] },
  science: { line: 'research', tax: 30, order: ['alphabet', 'writing', 'bronze', 'currency', 'ceremonial', 'law', 'monarchy', 'pottery', 'masonry'] },
  war: { line: 'defend', tax: 70, order: ['bronze', 'masonry', 'ceremonial', 'alphabet', 'law', 'monarchy', 'pottery', 'currency', 'writing'] },
};

/** The next advance: the first of the order that can be researched, else any that can. */
export function nextAdvance(order: readonly Advance[], available: readonly Advance[]): Advance | null {
  return order.find(a => available.includes(a)) ?? available[0] ?? null;
}

/** Days without disorder before the luxury rate goes back a step. */
export const CALM_DAYS = 10;

/** The luxury rate for tomorrow: a step up in disorder, a step down after CALM_DAYS calm days. */
export function luxuryStep(lux: number, disorder: boolean, calmDays: number, rates: readonly number[]): number {
  const i = rates.indexOf(lux);
  if (disorder) return rates[Math.min(rates.length - 1, i + 1)];
  return calmDays >= CALM_DAYS ? rates[Math.max(0, i - 1)] : lux;
}
