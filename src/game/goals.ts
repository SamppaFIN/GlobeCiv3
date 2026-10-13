/**
 * goals.ts — a chain of goals that leads through the game (STORY-041): one at a time, each
 * with a hint and a reward in gold. Own design (the goals and the rewards); a goal is a
 * test on a summary of the game, so it is checked the same way in a new and a saved game.
 * STORY-056 goes on from three cities to the conquest of the home state.
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
  /** The deepest zoom-out level open: 3 city area, 2 province, 1 state, 0 planet. */
  openLevel: number;
  /** An advisor runs some level (STORY-049–051). */
  advisor: boolean;
  /** The government is Monarchy (STORY-047). */
  monarchy: boolean;
  /** The home state's provinces with a city (STORY-016). */
  provinces: number;
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
  { text: 'Valitse neuvonantaja', hint: 'Yläpaneelin rintakuva avaa tason neuvonantajan. Se hoitaa kaupungit, läänin tai valtion puolestasi.', reward: 30, done: s => s.advisor },
  { text: 'Kartoita valtiosi', hint: 'Kun 60 % valtiosta on kartoitettu, voit loitontaa valtioon. Retkikunnat ja Tutkimusmatkailija nopeuttavat.', reward: 60, done: s => s.openLevel <= 1 },
  { text: 'Siirry monarkiaan', hint: 'Tutki Lakikokoelma ja Monarkia, ja aloita vallankumous Tutkimus-kortista. Monarkiassa ruudut tuottavat täysin.', reward: 60, done: s => s.monarchy },
  { text: 'Kaupunki neljään lääniin', hint: 'Lääni on hallussa, kun siinä on kaupunkisi. Asuttaja ja Laajentaja ohjaavat uudisasukkaat uusiin lääneihin.', reward: 80, done: s => s.provinces >= 4 },
  { text: 'Kasvata kaupunki yli koon 10', hint: 'Koosta 10 ylöspäin kaupunki tarvitsee vesijohdon (Rakentaminen).', reward: 100, done: s => s.biggest >= 11 },
  { text: 'Valtaa kotivaltio', hint: 'Kaupunki kotivaltion jokaiseen seitsemään lääniin avaa planeetan ja naapurivaltiot.', reward: 150, done: s => s.openLevel === 0 },
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
