/**
 * science.ts — trade becomes gold and science, and science brings advances (STORY-040).
 *
 * Civilization I's rules with Freeciv's numbers (GPL):
 *  - an advance costs base_tech_cost 20 × (1 + advances known) × sciencebox 50 %: the first
 *    10 bulbs, then 20, 30 … (data/civ1/game.ruleset tech_cost_style "Civ I|II";
 *    common/research.c research_total_bulbs_required and recalculate_techs_researched,
 *    commit 3a9e586b). Bulbs over the cost carry over.
 *  - the advances and what they need are from data/civ1/techs.ruleset; the names are own
 *  - the tax rate is the share of a city's trade that becomes gold, the rest is science
 *    (no luxury yet). Freeciv civ1 sets no cap by government (effects.ruleset Max_Rates 100).
 * Own: the start rate is half and half (Freeciv's player default is all science), and only
 * the advances that open something in the game are here so far.
 */
import type { Build } from './cities';

export type Advance = 'alphabet' | 'bronze' | 'ceremonial' | 'pottery' | 'masonry' | 'currency' | 'writing' | 'law' | 'monarchy' | 'construction';

export const ADVANCES: Record<Advance, { name: string; needs: Advance[] }> = {
  alphabet: { name: 'Aakkoset', needs: [] },
  bronze: { name: 'Pronssityö', needs: [] },
  ceremonial: { name: 'Hautajaisriitit', needs: [] },
  pottery: { name: 'Keramiikka', needs: [] },
  masonry: { name: 'Muuraus', needs: [] },
  currency: { name: 'Rahatalous', needs: ['bronze'] },
  writing: { name: 'Kirjoitus', needs: ['alphabet'] },
  // Code of Laws and Monarchy (STORY-047): Monarchy opens the government
  law: { name: 'Lakikokoelma', needs: ['alphabet'] },
  monarchy: { name: 'Monarkia', needs: ['ceremonial', 'law'] },
  // Construction (STORY-054): the aqueduct and the arena
  construction: { name: 'Rakentaminen', needs: ['masonry', 'currency'] },
};
export const ADVANCE_LIST = Object.keys(ADVANCES) as Advance[];

/** The advance each building and unit needs (buildings.ruleset and units.ruleset reqs). */
export const NEEDS: Partial<Record<Build, Advance>> = { granary: 'pottery', walls: 'masonry', market: 'currency', library: 'writing', phalanx: 'bronze', temple: 'ceremonial', aqueduct: 'construction', colosseum: 'construction', colossus: 'bronze', gardens: 'pottery', greatwall: 'masonry' };

/** Bulbs for the next advance when `known` advances are known. */
export const advanceCost = (known: number) => 10 * (1 + known);

/** Tax rates the player can choose: the share of trade that becomes gold. */
export const TAX_RATES = [30, 50, 70] as const;
export type TaxRate = (typeof TAX_RATES)[number];
/** Luxury rates (STORY-046): the share of trade that makes citizens happy. */
export const LUX_RATES = [0, 10, 20, 30] as const;

/** A city's trade split into gold, luxury and science (the rest) by the rates. */
export function splitTrade(trade: number, tax: number, lux = 0): { gold: number; luxury: number; science: number } {
  const gold = Math.round((trade * tax) / 100);
  const luxury = Math.min(trade - gold, Math.round((trade * lux) / 100));
  return { gold, luxury, science: trade - gold - luxury };
}

export class Research {
  readonly known = new Set<Advance>();
  /** What is researched, or null until the player chooses. */
  target: Advance | null = null;
  bulbs = 0;

  constructor(saved?: { known: Advance[]; target: Advance | null; bulbs: number }) {
    if (!saved) return;
    for (const a of saved.known) this.known.add(a);
    this.target = saved.target;
    this.bulbs = saved.bulbs;
  }

  save() {
    return { known: [...this.known], target: this.target, bulbs: this.bulbs };
  }

  /** Advances that can be researched now: not known, and all they need is known. */
  available(): Advance[] {
    return ADVANCE_LIST.filter(a => !this.known.has(a) && ADVANCES[a].needs.every(n => this.known.has(n)));
  }

  get cost(): number {
    return advanceCost(this.known.size);
  }

  /** A day's bulbs: they gather even without a target. Returns the advance learned, if any. */
  add(bulbs: number): Advance | null {
    this.bulbs += bulbs;
    const target = this.target;
    if (!target || this.bulbs < this.cost) return null;
    this.bulbs -= this.cost;
    this.known.add(target);
    this.target = null;
    return target;
  }
}
