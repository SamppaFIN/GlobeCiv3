/**
 * goals.ts — a chain of goals that leads through the game (STORY-041): one at a time, each
 * with a hint and a reward in gold. Own design (the goals and the rewards); a goal is a
 * test on a summary of the game, so it is checked the same way in a new and a saved game.
 */

/** What the goals look at. */
export interface GoalState {
  cities: number;
  /** The biggest city's size. */
  biggest: number;
  /** An advance is being researched, or one is known. */
  researching: boolean;
  advances: number;
  improvements: number;
  buildings: number;
  /** The deepest zoom-out level open: 3 city area, 2 province, 1 state. */
  openLevel: number;
}

export interface Goal {
  text: string;
  hint: string;
  reward: number;
  done(s: GoalState): boolean;
}

export const GOALS: readonly Goal[] = [
  { text: 'Perusta ensimmäinen kaupunki', hint: 'Valitse uudisasukas ja paina Perusta kaupunki tähän, tai napauta karttaa valitaksesi paikan.', reward: 20, done: s => s.cities >= 1 },
  { text: 'Valitse tutkimus', hint: 'Napauta Valitse tutkimus ja valitse keksintö. Tiede tulee kaupungin kaupasta.', reward: 10, done: s => s.researching },
  { text: 'Kasvata kaupunki kokoon 2', hint: 'Avaa kaupunki ja valitse Kansalaiset työstävät: Ruoka. Kun ruokavarasto täyttyy, kaupunki kasvaa ja sen alue laajenee.', reward: 20, done: s => s.biggest >= 2 },
  { text: 'Kehitä maata', hint: 'Kaupunki voi rakentaa uudisasukkaan. Valitse sille Kehitä, niin se kastelee, kaivaa ja rakentaa teitä.', reward: 20, done: s => s.improvements >= 1 },
  { text: 'Tee ensimmäinen keksintö', hint: 'Tiede kertyy kaupasta. Teitä ja meriruutuja työstävä kaupunki tuo kauppaa.', reward: 20, done: s => s.advances >= 1 },
  { text: 'Rakenna ensimmäinen rakennus', hint: 'Kaupunkikortissa näkyvät rakennukset ja niiden vaatimat keksinnöt. Kullalla voi ostaa rakentamisen valmiiksi.', reward: 30, done: s => s.buildings >= 1 },
  { text: 'Perusta toinen kaupunki', hint: 'Tiedustelija ehdottaa hyviä paikkoja, tai rakenna uudisasukas ja valitse Asuta.', reward: 40, done: s => s.cities >= 2 },
  { text: 'Kartoita läänisi', hint: 'Tiedustelijat kartoittavat itse. Kun 60 % läänistä on kartoitettu, voit loitontaa lääniin.', reward: 40, done: s => s.openLevel <= 2 },
  { text: 'Kasvata kaupunki kokoon 5', hint: 'Koossa 5 kaupungin alue laajenee kolmeen renkaaseen. Kastelu ja viljavarasto nopeuttavat kasvua.', reward: 50, done: s => s.biggest >= 5 },
  { text: 'Perusta kolme kaupunkia', hint: 'Lisää kaupunkeja tuo lisää kauppaa, tiedettä ja tuotantoa.', reward: 60, done: s => s.cities >= 3 },
];

/**
 * Goals done in a row from `index` on; the index after them and the gold they bring. A saved
 * game from before goals catches up at once.
 */
export function advanceGoals(index: number, s: GoalState): { index: number; done: Goal[] } {
  const done: Goal[] = [];
  while (index < GOALS.length && GOALS[index].done(s)) done.push(GOALS[index++]);
  return { index, done };
}
