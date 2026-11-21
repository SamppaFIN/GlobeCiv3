/**
 * persons.ts — the advisors as people (STORY-105; Sami 2026-11-21: every era's advisors have
 * names, pictures and bonuses of their own). The roles stay, and each era brings a new person to
 * each role. Own names and titles, none of the units' given names (personNames.ts), and no real
 * person's. The bonuses come in STORY-107.
 */
import type { AdvisorLevel } from './advisors';

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
}

/** [name, title] for each level, role and era. */
const PEOPLE: Record<AdvisorLevel, Record<string, Record<Era, [string, string]>>> = {
  town: {
    build: { early: ['Kustaa', 'Kirvesmies'], iron: ['Brita', 'Rautanaula'] },
    feed: { early: ['Anni', 'Leipämuori'], iron: ['Heikki', 'Myllymestari'] },
    roam: { early: ['Juho', 'Polunpolkija'], iron: ['Elli', 'Tähyäjä'] },
  },
  city: {
    growth: { early: ['Maija', 'Kylväjä'], iron: ['Aatu', 'Kastelija'] },
    explore: { early: ['Taneli', 'Tienraivaaja'], iron: ['Sohvi', 'Kartanpiirtäjä'] },
    defend: { early: ['Erkki', 'Portinvartija'], iron: ['Kreeta', 'Kilvenkantaja'] },
  },
  province: {
    settle: { early: ['Matti', 'Raivaaja'], iron: ['Hulda', 'Kylänperustaja'] },
    explore: { early: ['Iisakki', 'Erämies'], iron: ['Valpuri', 'Retkenjohtaja'] },
    defend: { early: ['Pekka', 'Rajavahti'], iron: ['Tilda', 'Linnanvouti'] },
  },
  state: {
    expand: { early: ['Kaapo', 'Maanmittari'], iron: ['Riikka', 'Valtakunnankoko'] },
    science: { early: ['Fanni', 'Tähtientuntija'], iron: ['Joonas', 'Kirjuri'] },
    war: { early: ['Antti', 'Keihäsmies'], iron: ['Maaret', 'Sotapäällikkö'] },
  },
  planet: {
    conquer: { early: ['Kalle', 'Valloittaja'], iron: ['Ulla', 'Rautanyrkki'] },
    explore: { early: ['Hertta', 'Merenkävijä'], iron: ['Oskari', 'Kaukomaiden kulkija'] },
    fortify: { early: ['Eemil', 'Muurinladoja'], iron: ['Kaisu', 'Linnoittaja'] },
  },
};

/** The person in a role of a level in an era, or null for the player's own hand. */
export function personOf(level: AdvisorLevel, role: string, era: Era): Person | null {
  const p = PEOPLE[level][role]?.[era];
  return p ? { id: `${level}/${role}/${era}`, name: p[0], title: p[1], level, role, era } : null;
}

/** Every person of every level and era. */
export const ALL_PERSONS: readonly Person[] = (Object.keys(ROLES) as AdvisorLevel[]).flatMap(level =>
  ROLES[level].flatMap(role => ERAS.map(era => personOf(level, role, era)!)));
