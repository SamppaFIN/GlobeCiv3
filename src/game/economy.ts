/**
 * economy.ts — what the realm gets a day (STORY-048, Sami: "ekonomia tilasto, mikä kertoo
 * mitä resursseja valtio saa"): the cities' food, shields and trade summed, where the trade
 * goes, the gold in and out, and the special resources the citizens work.
 */

/** One city's day; `shield` is before unit upkeep, `gold` includes `coinage`. */
export interface CityEconomy {
  food: number;
  surplus: number;
  shield: number;
  unitUpkeep: number;
  trade: number;
  gold: number;
  coinage: number;
  science: number;
  luxury: number;
  buildingUpkeep: number;
  /** Names of the special resources on the tiles it works. */
  resources: string[];
}

export interface Economy extends Omit<CityEconomy, 'resources'> {
  /** Gold in less the buildings' upkeep. */
  net: number;
  /** Each special resource worked, and on how many tiles, most first. */
  resources: [string, number][];
}

export function economy(cities: CityEconomy[]): Economy {
  const sum = (k: keyof Omit<CityEconomy, 'resources'>) => cities.reduce((s, c) => s + c[k], 0);
  const counts = new Map<string, number>();
  for (const name of cities.flatMap(c => c.resources)) counts.set(name, (counts.get(name) ?? 0) + 1);
  const totals = {
    food: sum('food'), surplus: sum('surplus'), shield: sum('shield'), unitUpkeep: sum('unitUpkeep'), trade: sum('trade'),
    gold: sum('gold'), coinage: sum('coinage'), science: sum('science'), luxury: sum('luxury'), buildingUpkeep: sum('buildingUpkeep'),
  };
  return { ...totals, net: totals.gold - totals.buildingUpkeep, resources: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
}
