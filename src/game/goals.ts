/**
 * goals.ts — each level's own goal, which is also how the player rises to the next level
 * (STORY-087; Sami 2026-11-19). A level rises on the finished output of the level below:
 * the city on its first unit, the city area on its cities, the province on the home
 * state's provinces held and the state on all seven. One goal shows at a time, with its
 * progress on the meter. Own design: the goals, the counts and the gold (the counts and the
 * gold are those of the goal chain of STORY-041 and STORY-056 that this replaces).
 */

/** What the level goals count, a summary of the game. */
export interface LevelState {
  /** A city has a building (the city level's first step, STORY-070). */
  built: boolean;
  /** A scout or a settler is on the map. */
  firstUnit: boolean;
  cities: number;
  /** The home state's provinces held, of seven; one without land counts (STORY-016, STORY-058). */
  provinces: number;
}

export interface LevelGoal {
  /** The level whose goal this is: 4 the city, 3 city area, 2 province, 1 state. */
  level: number;
  /** The meter's name in the HUD. */
  name: string;
  text: string;
  hint: string;
  /** Gold when the goal is reached and the next level opens. */
  reward: number;
  need: number;
  /** The word after the count on the meter ("2 / 3 kaupunkia"), if any. */
  unit: string;
  count(s: LevelState): number;
  /** The card of the level this opens: its title and what the player does there. */
  opens: { title: string; text: string };
}

export const LEVEL_GOALS: readonly LevelGoal[] = [
  {
    level: 4, name: 'Kaupunki', text: 'Rakenna rakennus ja ensimmäinen yksikkö', reward: 30, need: 2, unit: '',
    hint: 'Valitse kaupunkikortista maaston rakennus. Kun se valmistuu, kaupunki voi rakentaa tiedustelijan tai uudisasukkaan, ja ensimmäinen niistä avaa kaupunkialueen.',
    count: s => (s.built ? 1 : 0) + (s.firstUnit ? 1 : 0),
    opens: { title: 'Kaupunkialue avautui, zoomaa ulos', text: 'Kaupunkialueella tiedustelijat kartoittavat maata ja uudisasukkaat perustavat kaupunkeja.' },
  },
  {
    level: 3, name: 'Kaupungit', text: 'Perusta kolme kaupunkia', reward: 60, need: 3, unit: 'kaupunkia',
    hint: 'Tiedustelija ehdottaa hyviä paikkoja, tai rakenna uudisasukas ja valitse Asuta. Kolme kaupunkia avaa läänin.',
    count: s => s.cities,
    opens: { title: 'Lääni avautui, zoomaa ulos', text: 'Läänissä ohjaat kaupunkialueita: tutki, asuta tai ohita, ja lähetä retkikunta kauemmas.' },
  },
  {
    level: 2, name: 'Läänit', text: 'Pidä neljä kotivaltion lääniä', reward: 80, need: 4, unit: 'hallussa',
    hint: 'Lääni on hallussa, kun siinä on kaupunkisi. Asuttaja ja retkikunnat vievät uudisasukkaat uusiin lääneihin.',
    count: s => s.provinces,
    opens: { title: 'Valtio avautui, zoomaa ulos', text: 'Valtiossa valitset linjan ja tavoiteläänin, ja valtion neuvonantaja hoitaa tieteen ja verot.' },
  },
  {
    level: 1, name: 'Läänit', text: 'Valtaa kotivaltio', reward: 150, need: 7, unit: 'hallussa',
    hint: 'Kaupunki kotivaltion jokaiseen seitsemään lääniin avaa planeetan ja naapurivaltiot.',
    count: s => s.provinces,
    opens: { title: 'Valtio vallattu, zoomaa ulos', text: 'Planeetalla valitset kohdevaltion, ja naapurivaltiot avautuivat.' },
  },
];

/** The goal of the deepest open level, or null at the planet (nothing more opens yet). */
export const levelGoal = (openLevel: number): LevelGoal | null => LEVEL_GOALS.find(g => g.level === openLevel) ?? null;

/** How far a level's goal is: the count, capped at the need. */
export const goalCount = (g: LevelGoal, s: LevelState) => Math.min(g.need, g.count(s));
