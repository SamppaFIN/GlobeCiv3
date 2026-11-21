/**
 * persons.ts — the advisors as people (STORY-105; Sami 2026-11-21: every era's advisors have
 * names, pictures and bonuses of their own). The roles stay, and each era brings a new person to
 * each role. Own names and titles, none of the units' given names (personNames.ts), and no real
 * person's. Each person has one small bonus of one kind (STORY-107, bonuses.ts): the numbers
 * are own, to be calibrated in play.
 */
import type { AdvisorLevel } from './advisors';
import type { Bonus, BonusKind } from './bonuses';

/** The eras with people so far: the early age and the iron age (tasot-ja-aikakaudet.md). */
export type Era = 'early' | 'iron';
export const ERAS: readonly Era[] = ['early', 'iron'];
export const ERA_NAMES: Record<Era, string> = { early: 'Varhaisaika', iron: 'Rauta-aika' };

/** The roles of each level, the player's own hand aside. */
export const ROLES: Record<AdvisorLevel, readonly string[]> = {
  town: ['build', 'feed', 'roam'],
  city: ['growth', 'explore', 'defend'],
  province: ['settle', 'explore', 'defend'],
  state: ['expand', 'science', 'war'],
  planet: ['conquer', 'explore', 'fortify'],
};

export interface Person {
  /** "town/build/early": the level, the role and the era. */
  id: string;
  name: string;
  /** What the person is called by, after the name: "Kirvesmies". */
  title: string;
  level: AdvisorLevel;
  role: string;
  era: Era;
  /** What the person adds while the level's active advisor (STORY-107). */
  bonus: Bonus;
}

/**
 * [name, title, bonus kind, amount] for each level, role and era. Each kind counts only on its
 * level's targets (bonuses.ts): the city level the capital, the city area the other cities and
 * the scouts, the province the settlers and the nomads, the state the treasury and research,
 * the planet the rivals' attacks. A defense amount is a multiplier. All own.
 */
const PEOPLE: Record<AdvisorLevel, Record<string, Record<Era, [string, string, BonusKind, number]>>> = {
  town: {
    build: { early: ['Kustaa', 'Kirvesmies', 'shield', 1], iron: ['Brita', 'Rautanaula', 'shield', 2] },
    feed: { early: ['Anni', 'Leipämuori', 'goods', 1], iron: ['Heikki', 'Myllymestari', 'food', 2] },
    roam: { early: ['Juho', 'Polunpolkija', 'trade', 1], iron: ['Elli', 'Tähyäjä', 'defense', 1.25] },
  },
  city: {
    growth: { early: ['Maija', 'Kylväjä', 'food', 1], iron: ['Aatu', 'Kastelija', 'food', 2] },
    explore: { early: ['Taneli', 'Tienraivaaja', 'sight', 1], iron: ['Sohvi', 'Kartanpiirtäjä', 'trade', 1] },
    defend: { early: ['Erkki', 'Portinvartija', 'defense', 1.25], iron: ['Kreeta', 'Kilvenkantaja', 'defense', 1.5] },
  },
  province: {
    settle: { early: ['Matti', 'Raivaaja', 'settle', 10], iron: ['Hulda', 'Kylänperustaja', 'settle', 20] },
    explore: { early: ['Iisakki', 'Erämies', 'defense', 1.25], iron: ['Valpuri', 'Retkenjohtaja', 'settle', 10] },
    defend: { early: ['Pekka', 'Rajavahti', 'defense', 1.5], iron: ['Tilda', 'Linnanvouti', 'defense', 2] },
  },
  state: {
    expand: { early: ['Kaapo', 'Maanmittari', 'gold', 1], iron: ['Riikka', 'Valtakunnankoko', 'gold', 2] },
    science: { early: ['Fanni', 'Tähtientuntija', 'science', 1], iron: ['Joonas', 'Kirjuri', 'science', 3] },
    war: { early: ['Antti', 'Keihäsmies', 'gold', 2], iron: ['Maaret', 'Sotapäällikkö', 'gold', 3] },
  },
  planet: {
    conquer: { early: ['Kalle', 'Valloittaja', 'defense', 1.25], iron: ['Ulla', 'Rautanyrkki', 'defense', 1.5] },
    explore: { early: ['Hertta', 'Merenkävijä', 'defense', 1.25], iron: ['Oskari', 'Kaukomaiden kulkija', 'defense', 1.25] },
    fortify: { early: ['Eemil', 'Muurinladoja', 'defense', 1.5], iron: ['Kaisu', 'Linnoittaja', 'defense', 2] },
  },
};

/** The person in a role of a level in an era, or null for the player's own hand. */
export function personOf(level: AdvisorLevel, role: string, era: Era): Person | null {
  const p = PEOPLE[level][role]?.[era];
  return p ? { id: `${level}/${role}/${era}`, name: p[0], title: p[1], level, role, era, bonus: { kind: p[2], amount: p[3] } } : null;
}

/** Every person of every level and era. */
export const ALL_PERSONS: readonly Person[] = (Object.keys(ROLES) as AdvisorLevel[]).flatMap(level =>
  ROLES[level].flatMap(role => ERAS.map(era => personOf(level, role, era)!)));
