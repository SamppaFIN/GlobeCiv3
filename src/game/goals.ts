/**
 * goals.ts — each level's own goal, which is also how the player rises to the next level
 * (STORY-087; Sami 2026-11-19). A level rises on the finished output of the level below:
 * the city as a ready settlement (STORY-089), the city area on three of them (STORY-092), the province on the home
 * state's provinces held and the state on all seven. One goal shows at a time, with its
 * progress on the meter. Own design: the goals, the counts and the gold (the counts and the
 * gold are those of the goal chain of STORY-041 and STORY-056 that this replaces).
 */

/** What the level goals count, a summary of the game. */
export interface LevelState {
  /** The capital's steps to a ready settlement, of three: the base, a chain of food, three citizens (STORY-089). */
  settlement: number;
  /**
   * The cities that are ready settlements (STORY-092; Sami 2026-11-22): a city of chains once it
   * is (chains.ts settlementDone), one of the old rules as it stands.
   */
  settlements: number;
  /** The home state's provinces held, of seven: by a city, a border at the province level (STORY-093), or without land (STORY-016, STORY-058). */
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
    level: 4, name: 'Settlementti', text: 'Tee kaupungista valmis settlementti', reward: 30, need: 3, unit: '',
    hint: 'Kolme askelta: perusta (metsuri, saha ja louhos), ruokaketju (pelto, mylly ja leipomo tai kalastamo) ja kolme asukasta. Valmis settlementti avaa kaupunkialueen.',
    count: s => s.settlement,
    opens: { title: 'Valmis settlementti: kaupunkialue avautui, zoomaa ulos', text: 'Kaupunkisi on valmis settlementti, ja sen ensimmäinen tiedustelija lähti matkaan. Kaupunkialueella tiedustelijat kartoittavat maata ja uudisasukkaat perustavat kaupunkeja.' },
  },
  {
    level: 3, name: 'Settlementit', text: 'Kolme valmista settlementtiä', reward: 60, need: 3, unit: 'valmiina',
    hint: 'Perusta kaupunkeja uudisasukkailla ja kasvata ne valmiiksi settlementeiksi: kaupunki saa perustan ja ruokaketjun heti, ja kolmas asukas tekee siitä valmiin. Kolme valmista avaa läänin.',
    count: s => s.settlements,
    opens: { title: 'Kolme valmista settlementtiä: lääni avautui, zoomaa ulos', text: 'Läänissä ohjaat kaupunkialueita: tutki, asuta tai ohita, ja lähetä retkikunta kauemmas. Kaupunkien rajat kasvavat kulttuurista, ja työläiset yhdistävät hevoset, hiilen ja öljyn tiellä koko läänin hyödyksi.' },
  },
  {
    level: 2, name: 'Läänit', text: 'Pidä neljä kotivaltion lääniä', reward: 80, need: 4, unit: 'hallussa',
    hint: 'Lääni on hallussa, kun siinä on kaupunkisi tai rajasi kattavat siitä kymmenen maaruutua. Asuttaja ja retkikunnat vievät uudisasukkaat uusiin lääneihin, ja temppelit, kirjastot ja areenat kasvattavat kulttuurilla rajoja.',
    count: s => s.provinces,
    opens: { title: 'Valtio avautui, zoomaa ulos', text: 'Valtiossa valitset linjan ja tavoiteläänin, ja valtion neuvonantaja hoitaa tieteen ja verot.' },
  },
  {
    level: 1, name: 'Läänit', text: 'Valtaa kotivaltio', reward: 150, need: 7, unit: 'hallussa',
    hint: 'Kaupunki kotivaltion jokaiseen seitsemään lääniin avaa planeetan ja naapurivaltiot.',
    count: s => s.provinces,
    opens: { title: 'Valtio vallattu, zoomaa ulos', text: 'Planeetalla valitset kohdevaltion, ja naapurivaltiot avautuivat. Johtajien sota ja ydinaseet tulevat myöhemmin.' },
  },
];

/** The goal of the deepest open level, or null at the planet (nothing more opens yet). */
export const levelGoal = (openLevel: number): LevelGoal | null => LEVEL_GOALS.find(g => g.level === openLevel) ?? null;

/** How far a level's goal is: the count, capped at the need. */
export const goalCount = (g: LevelGoal, s: LevelState) => Math.min(g.need, g.count(s));
