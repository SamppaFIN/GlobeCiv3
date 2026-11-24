/**
 * bonuses.ts — what each era's advisor adds (STORY-107; Sami 2026-11-21: every era's advisors
 * have bonuses of their own). Each person has one small bonus of one kind. It counts only
 * while the person is the active advisor of the level, and only on that level's targets:
 *
 *  - the city level (town): the capital, its goods, and the bandits at its gate
 *  - the city area (city): the other cities, the bandits at theirs, and the scouts' sight
 *  - the province: the settlers' cost and the nomads' raids
 *  - the state: the treasury and the research
 *  - the planet: the rivals' attacks on the player's cities
 *
 * The player's own hand has no bonus. Every number is own (rule 4), to be calibrated in play:
 * the seven eras' persons (STORY-120, persons.ts) keep a kind's amount from falling in a role,
 * and bound it to 5 a day, a defense of ×2 and a settler's discount of 30.
 */
import type { AdvisorLevel } from './advisors';

export type BonusKind = 'food' | 'shield' | 'trade' | 'science' | 'goods' | 'sight' | 'defense' | 'settle' | 'gold';
/** One kind and its amount: units a day, rings, shields off, or for defense a multiplier. */
export interface Bonus { kind: BonusKind; amount: number }

/** The bonuses of the levels' active advisors today, by level; a level in the own hand has none. */
export type ActiveBonuses = Partial<Record<AdvisorLevel, Bonus>>;

const sum = (active: ActiveBonuses, level: AdvisorLevel, kind: BonusKind) => (active[level]?.kind === kind ? active[level]!.amount : 0);

/** The yield a city gains: the capital from the city level's advisor, the others from the city area's. */
export function yieldBonus(active: ActiveBonuses, capital: boolean): { food: number; shield: number; trade: number } {
  const level: AdvisorLevel = capital ? 'town' : 'city';
  return { food: sum(active, level, 'food'), shield: sum(active, level, 'shield'), trade: sum(active, level, 'trade') };
}

/** Bread a day for the capital's chains (the city level). */
export const goodsBonus = (active: ActiveBonuses) => sum(active, 'town', 'goods');

/** Rings more the scouts see (the city area). */
export const sightBonus = (active: ActiveBonuses) => sum(active, 'city', 'sight');

/** Shields off a settler (the province). */
export const settleBonus = (active: ActiveBonuses) => sum(active, 'province', 'settle');

/** Gold and science a day (the state). */
export const goldBonus = (active: ActiveBonuses) => sum(active, 'state', 'gold');
export const scienceBonus = (active: ActiveBonuses) => sum(active, 'state', 'science');

/** Who attacks: bandits, nomads (STORY-066) or a rival's army (STORY-069). */
export type Attacker = 'bandits' | 'nomads' | 'rival';

/**
 * The defense multiplier of a city under attack: bandits at the capital answer to the city
 * level, bandits elsewhere to the city area, nomads to the province and rivals to the planet.
 */
export function defenseBonus(active: ActiveBonuses, attacker: Attacker, capital: boolean): number {
  const level: AdvisorLevel = attacker === 'nomads' ? 'province' : attacker === 'rival' ? 'planet' : capital ? 'town' : 'city';
  return active[level]?.kind === 'defense' ? active[level]!.amount : 1;
}

const fmt = (n: number) => String(n).replace('.', ',');

/** The bonus in words, for the advisor's button and card: "+1 tuotanto pääkaupungissa". */
export function bonusText(b: Bonus): string {
  switch (b.kind) {
    case 'food': case 'shield': case 'trade': {
      const what = { food: 'ruoka', shield: 'tuotanto', trade: 'kauppa' }[b.kind];
      return `+${b.amount} ${what}`;
    }
    case 'goods': return `+${b.amount} leipä päivässä`;
    case 'sight': return `tiedustelijat näkevät ${b.amount} ${b.amount === 1 ? 'renkaan' : 'rengasta'} kauemmas`;
    case 'settle': return `uudisasukas ${b.amount} tuotantoa halvempi`;
    case 'gold': return `+${b.amount} kultaa päivässä`;
    case 'science': return `+${b.amount} tiedettä päivässä`;
    case 'defense': return `puolustus ×${fmt(b.amount)}`;
  }
}

/** Where a level's bonus counts, after its words: "pääkaupungissa", "muissa kaupungeissa". */
export function bonusWhere(level: AdvisorLevel, b: Bonus): string {
  if (b.kind === 'defense') return { town: 'rosvoja vastaan pääkaupungissa', city: 'rosvoja vastaan muissa kaupungeissa', province: 'paimentolaisia vastaan', state: '', planet: 'kilpailijoiden hyökkäyksiä vastaan' }[level];
  if (b.kind === 'food' || b.kind === 'shield' || b.kind === 'trade') return level === 'town' ? 'pääkaupungissa' : 'muissa kaupungeissa';
  return b.kind === 'goods' ? 'pääkaupungissa' : '';
}

/** The whole line: "+1 tuotanto pääkaupungissa". */
export const describeBonus = (level: AdvisorLevel, b: Bonus) => [bonusText(b), bonusWhere(level, b)].filter(Boolean).join(' ');
