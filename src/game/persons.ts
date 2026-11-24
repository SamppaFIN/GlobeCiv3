/**
 * persons.ts — the advisors as people (STORY-105; Sami 2026-11-21: every era's advisors have
 * names, pictures and bonuses of their own). The roles stay, and each era brings a new person to
 * each role. Own names and titles, none of the units' given names (personNames.ts), and no real
 * person's. Each person has one small bonus of one kind (STORY-107, bonuses.ts): the numbers
 * are own, to be calibrated in play.
 */
import type { AdvisorLevel } from './advisors';
import type { Bonus, BonusKind } from './bonuses';

/** The seven eras in their order (STORY-120, eras.ts; own split, docs/design/tiede-ja-aikakaudet.md). */
export type Era = 'early' | 'iron' | 'medieval' | 'renaissance' | 'industrial' | 'modern' | 'atomic';
export const ERAS: readonly Era[] = ['early', 'iron', 'medieval', 'renaissance', 'industrial', 'modern', 'atomic'];
export const ERA_NAMES: Record<Era, string> = {
  early: 'Varhaisaika', iron: 'Rauta-aika', medieval: 'Keskiaika', renaissance: 'Uusi aika',
  industrial: 'Teollinen aika', modern: 'Moderni aika', atomic: 'Atomiaika',
};

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
 * the planet the rivals' attacks. A defense amount is a multiplier. All own, the later eras
 * (STORY-120) too: a kind's amount does not fall from an era to the next in a role, a yield,
 * gold, science or bread grows to at most 5, defense to at most ×2 and a settler's discount to
 * at most 30, so a settler always costs at least 10. To be calibrated in play once the eras
 * are reached (STORY-121–123). The names are Finnish given names that are neither the units'
 * (personNames.ts) nor, with their titles, any known real person's.
 */
const PEOPLE: Record<AdvisorLevel, Record<string, Record<Era, [string, string, BonusKind, number]>>> = {
  town: {
    build: {
      early: ['Kustaa', 'Kirvesmies', 'shield', 1], iron: ['Brita', 'Rautanaula', 'shield', 2],
      medieval: ['Olavi', 'Kivimuurari', 'shield', 2], renaissance: ['Gabriel', 'Rakennusmestari', 'shield', 3],
      industrial: ['Aleksanteri', 'Tehtailija', 'shield', 3], modern: ['Aarne', 'Insinööri', 'shield', 4], atomic: ['Jukka', 'Automaatiosuunnittelija', 'shield', 4],
    },
    feed: {
      early: ['Anni', 'Leipämuori', 'goods', 1], iron: ['Heikki', 'Myllymestari', 'food', 2],
      medieval: ['Kaarina', 'Leipurimestari', 'goods', 2], renaissance: ['Kristiina', 'Kartanon emäntä', 'food', 3],
      industrial: ['Ida', 'Säilyketehtailija', 'goods', 3], modern: ['Elsa', 'Kotitalousneuvos', 'food', 4], atomic: ['Tuula', 'Elintarvikekemisti', 'goods', 4],
    },
    roam: {
      early: ['Juho', 'Polunpolkija', 'trade', 1], iron: ['Elli', 'Tähyäjä', 'defense', 1.25],
      medieval: ['Henrik', 'Kulkukauppias', 'trade', 2], renaissance: ['Johannes', 'Tullivartija', 'defense', 1.5],
      industrial: ['Konstantin', 'Ratamestari', 'trade', 3], modern: ['Reino', 'Palopäällikkö', 'defense', 1.75], atomic: ['Hannu', 'Logistikko', 'trade', 4],
    },
  },
  city: {
    growth: {
      early: ['Maija', 'Kylväjä', 'food', 1], iron: ['Aatu', 'Kastelija', 'food', 2],
      medieval: ['Birgitta', 'Peltovouti', 'food', 2], renaissance: ['Helena', 'Puutarhuri', 'food', 3],
      industrial: ['Fredrika', 'Maanviljelysneuvos', 'food', 3], modern: ['Helmi', 'Maatalousneuvos', 'food', 4], atomic: ['Marja', 'Kasvinjalostaja', 'food', 4],
    },
    explore: {
      early: ['Taneli', 'Tienraivaaja', 'sight', 1], iron: ['Sohvi', 'Kartanpiirtäjä', 'trade', 1],
      medieval: ['Jaakko', 'Pyhiinvaeltaja', 'sight', 2], renaissance: ['Sofia', 'Karttojen kaivertaja', 'trade', 2],
      industrial: ['Viktor', 'Maanmittausinsinööri', 'sight', 2], modern: ['Tauno', 'Lennättäjä', 'trade', 3], atomic: ['Pertti', 'Satelliittikuvaaja', 'sight', 3],
    },
    defend: {
      early: ['Erkki', 'Portinvartija', 'defense', 1.25], iron: ['Kreeta', 'Kilvenkantaja', 'defense', 1.5],
      medieval: ['Mikael', 'Linnanpäällikkö', 'defense', 1.5], renaissance: ['Kaarle', 'Muskettikapteeni', 'defense', 1.75],
      industrial: ['Amanda', 'Vartioston päällikkö', 'defense', 1.75], modern: ['Viljo', 'Väestönsuojelija', 'defense', 2], atomic: ['Leena', 'Turvallisuuspäällikkö', 'defense', 2],
    },
  },
  province: {
    settle: {
      early: ['Matti', 'Raivaaja', 'settle', 10], iron: ['Hulda', 'Kylänperustaja', 'settle', 20],
      medieval: ['Elisabet', 'Kylänvouti', 'settle', 20], renaissance: ['Magdaleena', 'Uudistilallinen', 'settle', 25],
      industrial: ['Edvard', 'Asutusneuvos', 'settle', 25], modern: ['Aune', 'Asutustoimen johtaja', 'settle', 30], atomic: ['Seppo', 'Kaavoittaja', 'settle', 30],
    },
    explore: {
      early: ['Iisakki', 'Erämies', 'defense', 1.25], iron: ['Valpuri', 'Retkenjohtaja', 'settle', 10],
      medieval: ['Klemetti', 'Erämaankulkija', 'defense', 1.5], renaissance: ['Petter', 'Löytöretkeilijä', 'settle', 20],
      industrial: ['Selma', 'Rajaseudun tutkija', 'defense', 1.5], modern: ['Irja', 'Retkikunnan johtaja', 'settle', 25], atomic: ['Riitta', 'Napatutkija', 'defense', 1.75],
    },
    defend: {
      early: ['Pekka', 'Rajavahti', 'defense', 1.5], iron: ['Tilda', 'Linnanvouti', 'defense', 2],
      medieval: ['Simo', 'Rajalinnan vouti', 'defense', 2], renaissance: ['Ulriikka', 'Linnoitusupseeri', 'defense', 2],
      industrial: ['August', 'Rajajääkäri', 'defense', 2], modern: ['Eino', 'Rajakomentaja', 'defense', 2], atomic: ['Markku', 'Rajavalvoja', 'defense', 2],
    },
  },
  state: {
    expand: {
      early: ['Kaapo', 'Maanmittari', 'gold', 1], iron: ['Riikka', 'Valtakunnankoko', 'gold', 2],
      medieval: ['Agnes', 'Kruununvouti', 'gold', 2], renaissance: ['Anders', 'Kauppaneuvos', 'gold', 3],
      industrial: ['Emilia', 'Pankkiiri', 'gold', 3], modern: ['Laina', 'Valtiovarainneuvos', 'gold', 4], atomic: ['Päivi', 'Talousjohtaja', 'gold', 4],
    },
    science: {
      early: ['Fanni', 'Tähtientuntija', 'science', 1], iron: ['Joonas', 'Kirjuri', 'science', 3],
      medieval: ['Katariina', 'Luostarikirjuri', 'science', 3], renaissance: ['Eleonoora', 'Luonnonfilosofi', 'science', 4],
      industrial: ['Albert', 'Professori', 'science', 4], modern: ['Yrjö', 'Tutkimusjohtaja', 'science', 5], atomic: ['Timo', 'Tietojenkäsittelijä', 'science', 5],
    },
    war: {
      early: ['Antti', 'Keihäsmies', 'gold', 2], iron: ['Maaret', 'Sotapäällikkö', 'gold', 3],
      medieval: ['Niklas', 'Ritarikunnan mestari', 'gold', 3], renaissance: ['Fredrik', 'Rykmentinkomentaja', 'gold', 3],
      industrial: ['Teodor', 'Esikuntapäällikkö', 'gold', 4], modern: ['Hilkka', 'Puolustusneuvos', 'gold', 4], atomic: ['Sirpa', 'Strategi', 'gold', 5],
    },
  },
  planet: {
    conquer: {
      early: ['Kalle', 'Valloittaja', 'defense', 1.25], iron: ['Ulla', 'Rautanyrkki', 'defense', 1.5],
      medieval: ['Ingrid', 'Sotaretken johtaja', 'defense', 1.5], renaissance: ['Juliana', 'Amiraali', 'defense', 1.75],
      industrial: ['Leonard', 'Marsalkka', 'defense', 1.75], modern: ['Pentti', 'Ylipäällikkö', 'defense', 2], atomic: ['Jari', 'Liittoutuman komentaja', 'defense', 2],
    },
    explore: {
      early: ['Hertta', 'Merenkävijä', 'defense', 1.25], iron: ['Oskari', 'Kaukomaiden kulkija', 'defense', 1.25],
      medieval: ['Bertil', 'Laivuri', 'defense', 1.5], renaissance: ['Mattias', 'Valtamerenpurjehtija', 'defense', 1.5],
      industrial: ['Vilhelmiina', 'Höyrylaivan kapteeni', 'defense', 1.75], modern: ['Sylvi', 'Lentäjä', 'defense', 1.75], atomic: ['Merja', 'Avaruuslentäjä', 'defense', 2],
    },
    fortify: {
      early: ['Eemil', 'Muurinladoja', 'defense', 1.5], iron: ['Kaisu', 'Linnoittaja', 'defense', 2],
      medieval: ['Regina', 'Linnanrakentaja', 'defense', 2], renaissance: ['Sabina', 'Linnoitusinsinööri', 'defense', 2],
      industrial: ['Augusta', 'Rannikkolinnoittaja', 'defense', 2], modern: ['Raimo', 'Suojarakentaja', 'defense', 2], atomic: ['Ville', 'Torjuntapäällikkö', 'defense', 2],
    },
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
