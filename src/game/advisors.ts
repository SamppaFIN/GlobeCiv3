/**
 * advisors.ts — advisors (STORY-049; Sami 2026-10-13: "jokaiselle karttazoomi tasolla on oma
 * advisor .. pelaaja voi valita kolmesta eri neuvonantajasta, jotka mikromanageroi alueen sun
 * puolesta"). At the city area level one of three runs the cities and the units each day, and
 * with none (Oma ohjaus) the player does. Own design; it uses the game's own rules.
 *
 *   Kasvattaja   food focus; a temple before a citizen more would bring disorder, an arena
 *                in disorder, an aqueduct a size before the limit, a settler of its own from size
 *                3, then a granary from size 2; settlers the cities built improve the land; in
 *                disorder, when no shields come, it buys the temple or arena (main.ts)
 *   Kartoittaja  balanced focus; the scouts explore, toward the home province's least mapped
 *                area when there is no flag
 *   Vartija      production focus; a soldier in every city, two and walls while bandits are
 *                on their way; it answers the bandit card by building the soldier
 */
import { isResourceBuilding, RESOURCE_BUILDINGS, SIZE_LIMIT, type Build, type City, type Focus } from './cities';
import type { Advance } from './science';
import type { StateLine } from './units';

export type CityAdvisor = 'none' | 'growth' | 'explore' | 'defend';
export const CITY_ADVISOR_LIST: readonly CityAdvisor[] = ['none', 'growth', 'explore', 'defend'];

export const CITY_ADVISORS: Record<CityAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Hoidat kaupungit ja yksiköt itse.' },
  growth: { name: 'Kasvattaja', does: 'Kaupungit painottavat ruokaa ja rakentavat temppelin tai areenan ennen levottomuutta, vesijohdon ennen kokorajaa ja viljavaraston. Kaupunkien uudisasukkaat kehittävät maata.' },
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
  /** The city is in disorder now (STORY-060: an arena only then, for its upkeep of 4). */
  disorder: boolean;
  /** Bandits are on their way to the city. */
  threat: boolean;
  /** The best soldier the city can build. */
  soldier: 'warrior' | 'phalanx';
  /** Settlers the city supports (STORY-060). */
  settlers: number;
}

/** A city advisor's focus and build for a city (build null: as it is); null with no advisor. */
export function cityAdvice(advisor: CityAdvisor, city: City, n: CityNeeds): { focus: Focus; build: Build | null } | null {
  const can = (b: Build) => n.available.includes(b);
  // With nothing else to build, a resource building (STORY-073): Kasvattaja one for food,
  // Vartija one for shields, Kartoittaja any
  const resource = n.available.filter(isResourceBuilding)
    .find(b => (advisor === 'growth' ? RESOURCE_BUILDINGS[b].food : advisor === 'defend' ? RESOURCE_BUILDINGS[b].shield : true)) ?? null;
  switch (advisor) {
    case 'none':
      return null;
    case 'growth':
      return {
        focus: 'food',
        build: n.unrestNear && can('temple') ? 'temple' : n.disorder && can('colosseum') ? 'colosseum'
          : city.size >= SIZE_LIMIT - 1 && can('aqueduct') ? 'aqueduct'
          // A settler of its own to improve the land, from size 3 (STORY-060: without one, no roads and no trade)
          : city.size >= 3 && n.settlers === 0 && can('settler') ? 'settler'
          : city.size >= 2 && can('granary') ? 'granary' : resource,
      };
    case 'explore':
      return { focus: 'balanced', build: resource };
    case 'defend':
      return {
        focus: 'production',
        build: n.soldiers < (n.threat ? 2 : 1) ? n.soldier : n.threat && can('walls') ? 'walls' : resource,
      };
  }
}

/**
 * The city stage of a new game (STORY-070; Sami 2026-10-20: everything by choosing a governor).
 * Before the next map opens each governor builds a terrain building first, as the units open
 * only after the first building, then the unit that opens the next map: Kartoittaja a scout,
 * Kasvattaja a settler once the city has grown, Vartija a soldier and then a scout.
 */
/** What each governor does at the city stage, for its card. */
export const START_DOES: Record<CityAdvisor, string> = {
  none: 'Valitset kaupungin rakennukset itse kaupunkikortista.',
  growth: 'Pelto tai kalastamo ensin, sitten kasvu ja uudisasukas, joka avaa seuraavan kartan.',
  explore: 'Saha tai louhos ensin, sitten tiedustelija, joka avaa seuraavan kartan.',
  defend: 'Saha tai louhos ensin, sitten soturi ja tiedustelija, joka avaa seuraavan kartan.',
};

export function startAdvice(advisor: CityAdvisor, city: City, n: { available: Build[]; built: boolean; soldiers: number }): { focus: Focus; build: Build | null } | null {
  if (advisor === 'none') return null;
  const can = (b: Build) => n.available.includes(b);
  const focus: Focus = advisor === 'growth' ? 'food' : 'production';
  if (!n.built) {
    const order: Build[] = advisor === 'growth' ? ['field', 'fishery', 'sawmill', 'quarry'] : ['sawmill', 'quarry', 'field', 'fishery'];
    return { focus, build: order.find(can) ?? null };
  }
  if (advisor === 'growth') return { focus, build: city.size >= 2 && can('settler') ? 'settler' : null };
  if (advisor === 'defend' && n.soldiers < 1 && can('warrior')) return { focus, build: 'warrior' };
  return { focus, build: can('scout') ? 'scout' : null };
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
 *               nearest province without a city as the target (STORY-016: a city holds it)
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
  expand: { name: 'Laajentaja', does: 'Valtion linja Laajentuminen, vero 50 %, kasvun keksinnöt ensin. Tavoitteeksi lähin lääni, jossa ei vielä ole kaupunkia.' },
  science: { name: 'Oppinut', does: 'Valtion linja Tutkimus, vero 30 %, kirjoitus ja kauppa ensin.' },
  war: { name: 'Kenraali', does: 'Valtion linja Puolustus, vero 70 %, pronssi, ratsastus ja rautatyö ensin. Etsii, rakentaa ja ostaa hyökkäysjoukon ja valtaa lähimmän kaupunkivaltion avoimessa valtiossa, Valloittajan kohdevaltiossa ensin. Ostaa uhatun kaupungin sotilaan tai muurin, kun kassa riittää.' },
};

/** Each advisor's state line, tax rate and order of advances. */
export const STATE_PLANS: Record<Exclude<StateAdvisor, 'none'>, { line: StateLine; tax: number; order: Advance[] }> = {
  expand: { line: 'expand', tax: 50, order: ['pottery', 'ceremonial', 'alphabet', 'law', 'monarchy', 'mapmaking', 'bronze', 'currency', 'masonry', 'construction', 'writing', 'horseback', 'iron', 'wheel', 'mathematics'] },
  science: { line: 'research', tax: 30, order: ['alphabet', 'writing', 'bronze', 'currency', 'ceremonial', 'law', 'monarchy', 'pottery', 'masonry', 'construction', 'mapmaking', 'horseback', 'iron', 'wheel', 'mathematics'] },
  war: { line: 'defend', tax: 70, order: ['bronze', 'horseback', 'iron', 'masonry', 'wheel', 'alphabet', 'mathematics', 'ceremonial', 'law', 'monarchy', 'pottery', 'currency', 'construction', 'writing', 'mapmaking'] },
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

/*
 * The planet level (STORY-057): one of three picks the target state among the open ones.
 *
 *   Valloittaja      the open state not yet conquered with the most land
 *   Löytöretkeilijä  the open state not yet conquered that is least mapped
 *   Linnoittaja      no new state: the scouts and city sites keep to the states held
 * The state advisor's Laajentaja aims at the target state's provinces first.
 */
export type PlanetAdvisor = 'none' | 'conquer' | 'explore' | 'fortify';
export const PLANET_ADVISOR_LIST: readonly PlanetAdvisor[] = ['none', 'conquer', 'explore', 'fortify'];

export const PLANET_ADVISORS: Record<PlanetAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Valitset itse kohdevaltion.' },
  conquer: { name: 'Valloittaja', does: 'Kohteeksi avoin valtio, jossa on eniten maata. Laajentaja asuttaa sen läänit ensin.' },
  explore: { name: 'Löytöretkeilijä', does: 'Kohteeksi avoin valtio, joka on vähiten kartoitettu, ja retkikunta sinne.' },
  fortify: { name: 'Linnoittaja', does: 'Ei uusia valtioita: tiedustelijat ja kaupunkipaikat pysyvät vallatuissa valtioissa.' },
};

/** The planet advisor's target state, or null (Linnoittaja, or none to take). */
export function planetTarget(advisor: PlanetAdvisor, states: readonly { state: number; land: number; mapped: number; conquered: boolean }[]): number | null {
  const open = states.filter(s => !s.conquered);
  if (!open.length || advisor === 'none' || advisor === 'fortify') return null;
  const best = advisor === 'conquer'
    ? open.reduce((a, b) => (b.land > a.land || (b.land === a.land && b.state < a.state) ? b : a))
    : open.reduce((a, b) => (b.mapped < a.mapped || (b.mapped === a.mapped && b.state < a.state) ? b : a));
  return best.state;
}
