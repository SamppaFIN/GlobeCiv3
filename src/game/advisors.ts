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
import type { ChainBuilding } from './chains';
import { isResourceBuilding, RESOURCE_BUILDINGS, SIZE_LIMIT, type Build, type City, type Focus } from './cities';
import type { Advance } from './science';
import type { StateLine } from './units';

/**
 * The levels with an advisor (STORY-049–051, STORY-057): the city level ('town', STORY-105),
 * the city area ('city'), the province, the state and the planet.
 */
export type AdvisorLevel = 'town' | 'city' | 'province' | 'state' | 'planet';
export const ADVISOR_LEVELS: readonly AdvisorLevel[] = ['town', 'city', 'province', 'state', 'planet'];
export const ADVISOR_LEVEL_NAMES: Record<AdvisorLevel, string> = { town: 'Kaupunki', city: 'Kaupunkialue', province: 'Lääni', state: 'Valtio', planet: 'Planeetta' };

/**
 * The city level's own three (STORY-105, own; Sami 2026-11-21: every level its advisors). They
 * run the capital of a new game: its chain sites whatever the level, and its focus until the
 * city area opens, which the ready settlement does (STORY-089).
 *
 *   Rakentaja   the chain's order: the base, then the field, the mill and the bakery; production
 *               focus once the settlement is ready
 *   Ruokkija    food focus; after the base the field and the fishery, then the mill and the bakery
 *   Retkeilijä  balanced focus; the ready settlement sends two scouts instead of one (main.ts)
 */
export type TownAdvisor = 'none' | 'build' | 'feed' | 'roam';
export const TOWN_ADVISOR_LIST: readonly TownAdvisor[] = ['none', 'build', 'feed', 'roam'];

export const TOWN_ADVISORS: Record<TownAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Valitset kaupungin rakennukset ja työmaat itse kaupunkikortista.' },
  build: { name: 'Rakentaja', does: 'Metsuri, saha ja louhos ensin, sitten pelto, mylly ja leipomo. Kun kaupunki on valmis settlementti, se painottaa tuotantoa.' },
  feed: { name: 'Ruokkija', does: 'Perustan jälkeen pelto ja kalastamo, sitten mylly ja leipomo, jotta leipää ja kalaa riittää. Kaupunki painottaa ruokaa.' },
  roam: { name: 'Retkeilijä', does: 'Perusta ja ruokaketju tasapainoisella painotuksella. Kun kaupunki on valmis settlementti, se lähettää kaksi tiedustelijaa yhden sijaan, jotta seuraava kartta tulee tutuksi nopeasti.' },
};

/** A save from before STORY-105 had the city area's advisor run the city level too. */
export const TOWN_OF_CITY: Record<CityAdvisor, TownAdvisor> = { none: 'none', growth: 'feed', explore: 'roam', defend: 'build' };

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
 * The chain building the city level's advisor starts next in a city of chains (STORY-088,
 * STORY-105), whatever the level: the base first, then bread, the Ruokkija the fishery before
 * the mill. The player's own hand starts none. `open` says whether a building may be started now.
 */
export function chainAdvice(advisor: TownAdvisor, open: (b: ChainBuilding) => boolean): ChainBuilding | null {
  if (advisor === 'none') return null;
  const order: ChainBuilding[] = advisor === 'feed'
    ? ['lumberjack', 'sawmill', 'quarry', 'field', 'fishery', 'mill', 'bakery']
    : ['lumberjack', 'sawmill', 'quarry', 'field', 'mill', 'bakery', 'fishery'];
  return order.find(open) ?? null;
}

/**
 * The capital's way while only the city level is open (STORY-105, STORY-089): its buildings are
 * built of planks and stone on their sites, and its citizens grow toward a ready settlement; it
 * builds no units, which wait for the city area. The advisor sets the focus; the Rakentaja's is
 * production only once the settlement is ready (own: with it from the start a capital stood at
 * size 2 with no food to spare, seed 42).
 */
export function townAdvice(advisor: TownAdvisor, ready = false): { focus: Focus; build: Build | null } | null {
  if (advisor === 'none') return null;
  return { focus: advisor === 'feed' ? 'food' : advisor === 'build' && ready ? 'production' : 'balanced', build: null };
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
 * Each of the three has a worker built for a province with a strategic resource inside the
 * border and no road to it, one worker a province (STORY-093, own); the Vartija's soldier first.
 * While the province is the top level, each serves its goal, four of the home state's provinces
 * held (STORY-111, Sami 2026-11-22): the nearest province of the home state without a hold is the
 * target. The Asuttaja sends the scouts there and marks its best mapped area Asuta, the
 * Tutkimusmatkailija maps it once the home province is mapped, and the Vartija lets the scouts
 * into the provinces held and the target.
 * The province advisor's builds and expeditions go before the city advisor's.
 */
export type ProvinceAdvisor = 'none' | 'settle' | 'explore' | 'defend';
export const PROVINCE_ADVISOR_LIST: readonly ProvinceAdvisor[] = ['none', 'settle', 'explore', 'defend'];

export const PROVINCE_ADVISORS: Record<ProvinceAdvisor, { name: string; does: string }> = {
  none: { name: 'Oma ohjaus', does: 'Hoidat läänin painotukset ja retkikunnat itse.' },
  settle: { name: 'Asuttaja', does: 'Merkitsee läänin parhaat kartoitetut alueet asutettaviksi ja hyväksyy kaupunkipaikat itse. Lähettää tiedustelijat lähimpään kotivaltion lääniin, jota ei vielä pidetä, ja asuttaa sen. Pääkaupunki tekee uudisasukkaan, kun paikka odottaa. Läänin kaupunki tekee työläisen, joka yhdistää resurssin tiellä.' },
  explore: { name: 'Tutkimusmatkailija', does: 'Poistaa Ohita-merkinnät ja lähettää retkikunnan lähimmälle alueelle, joka on alle 60 % kartoitettu: ensin läänissä, sitten lähimmässä kotivaltion läänissä, jota ei vielä pidetä. Läänin kaupunki tekee työläisen, joka yhdistää resurssin tiellä.' },
  defend: { name: 'Vartija', does: 'Tiedustelijat pysyvät hallussa olevissa lääneissä ja lähimmässä kotivaltion läänissä, jota ei vielä pidetä. Kaupunki ilman sotilasta tekee sellaisen, ja läänin rajalla oleva kaupunki rakentaa muurin. Sotilaan jälkeen läänin kaupunki tekee työläisen, joka yhdistää resurssin tiellä.' },
};

/**
 * The province level's target (STORY-111): the nearest province of the home state with land and
 * not held, leaving out those the scouts could not reach; ties by id. Null when none is left.
 */
export function provinceGoalTarget(provinces: readonly { province: number; held: boolean; land: boolean; reachable: boolean; distance: number }[]): number | null {
  const open = provinces.filter(p => !p.held && p.land && p.reachable).sort((a, b) => a.distance - b.distance || a.province - b.province);
  return open[0]?.province ?? null;
}

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

/**
 * The province advisor's build for a city: the Vartija's soldier first; then a worker when the
 * city is the one to build its province's (`worker`, STORY-093); then the Vartija's walls near
 * the border.
 */
export function provinceBuild(advisor: ProvinceAdvisor, n: { soldiers: number; border: boolean; available: Build[]; soldier: 'warrior' | 'phalanx'; walls: boolean; worker?: boolean }): Build | null {
  if (advisor === 'none') return null;
  if (advisor === 'defend' && n.soldiers < 1) return n.soldier;
  if (n.worker && n.available.includes('worker')) return 'worker';
  if (advisor !== 'defend') return null;
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
