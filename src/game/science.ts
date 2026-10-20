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
 *
 * Resources (STORY-072; Sami 2026-10-20: the people study a special resource and then see the
 * others on the map, finds bring new studies, and resources open advances). Own rules: each
 * kind of special resource found on the map is a study of STUDY_COST bulbs; until it is
 * studied the kind shows as unknown and yields nothing. Five advances need a kind studied:
 * Horseback Riding and The Wheel horses, Iron Working coal, Currency gold or gems, Map
 * Making fish. The old start (?classic) and saves from before know every kind.
 */
import type { Build } from './cities';
import { RESOURCES, TERRAINS, TERRAIN_RULES, type ResourceKind } from './terrainTypes';

export type Advance = 'alphabet' | 'bronze' | 'ceremonial' | 'pottery' | 'masonry' | 'currency' | 'writing' | 'law' | 'monarchy' | 'construction' | 'mapmaking' | 'horseback' | 'iron' | 'wheel' | 'mathematics';

/** An advance, or a kind of special resource to study (STORY-072). */
export type Study = Advance | ResourceKind;

export const ADVANCES: Record<Advance, { name: string; needs: Advance[]; from?: ResourceKind[] }> = {
  alphabet: { name: 'Aakkoset', needs: [] },
  bronze: { name: 'Pronssityö', needs: [] },
  ceremonial: { name: 'Hautajaisriitit', needs: [] },
  pottery: { name: 'Keramiikka', needs: [] },
  masonry: { name: 'Muuraus', needs: [] },
  currency: { name: 'Rahatalous', needs: ['bronze'], from: ['gold', 'gems'] },
  writing: { name: 'Kirjoitus', needs: ['alphabet'] },
  // Code of Laws and Monarchy (STORY-047): Monarchy opens the government
  law: { name: 'Lakikokoelma', needs: ['alphabet'] },
  monarchy: { name: 'Monarkia', needs: ['ceremonial', 'law'] },
  // Construction (STORY-054): the aqueduct and the arena
  construction: { name: 'Rakentaminen', needs: ['masonry', 'currency'] },
  // Map Making (STORY-059, techs.ruleset: Alphabet): units go along the coast as by trireme
  mapmaking: { name: 'Kartanteko', needs: ['alphabet'], from: ['fish'] },
  // The attack units' advances (STORY-064): Horseback Riding, Iron Working (Bronze Working),
  // The Wheel and Mathematics (Alphabet and Masonry)
  horseback: { name: 'Ratsastus', needs: [], from: ['horses'] },
  iron: { name: 'Rautatyö', needs: ['bronze'], from: ['coal'] },
  wheel: { name: 'Pyörä', needs: [], from: ['horses'] },
  mathematics: { name: 'Matematiikka', needs: ['alphabet', 'masonry'] },
};
export const ADVANCE_LIST = Object.keys(ADVANCES) as Advance[];

/** The kinds of special resource, one on each terrain. */
export const RESOURCE_KINDS = Object.keys(RESOURCES) as ResourceKind[];
export const isKind = (s: Study): s is ResourceKind => s in RESOURCES;
/** Bulbs to study a kind of resource (own: as much as the first advance). */
export const STUDY_COST = 10;
/** The terrain each kind is found on. */
export const KIND_TERRAIN = Object.fromEntries(TERRAINS.map(t => [TERRAIN_RULES[t].resource, t])) as Record<ResourceKind, (typeof TERRAINS)[number]>;
const TERRAIN_GENITIVE: Record<(typeof TERRAINS)[number], string> = {
  ocean: 'Valtameren', arctic: 'Arktisen maan', desert: 'Aavikon', forest: 'Metsän', grassland: 'Ruohomaan', hills: 'Kukkuloiden',
  jungle: 'Viidakon', mountains: 'Vuorten', plains: 'Tasangon', swamp: 'Suon', tundra: 'Tundran',
};
/** A study's name: an advance, a kind the people know by name, or one they do not know yet: "Tasangon resurssi". */
export const studyName = (s: Study, known = false) => (isKind(s) ? (known ? RESOURCES[s].name : `${TERRAIN_GENITIVE[KIND_TERRAIN[s]]} resurssi`) : ADVANCES[s].name);
/** The advances a kind of resource opens. */
export const opensFrom = (k: ResourceKind) => ADVANCE_LIST.filter(a => ADVANCES[a].from?.includes(k));

/** The advance each building and unit needs (buildings.ruleset and units.ruleset reqs). */
export const NEEDS: Partial<Record<Build, Advance>> = { granary: 'pottery', walls: 'masonry', market: 'currency', library: 'writing', phalanx: 'bronze', temple: 'ceremonial', aqueduct: 'construction', colosseum: 'construction', colossus: 'bronze', gardens: 'pottery', greatwall: 'masonry', horseman: 'horseback', swordsman: 'iron', chariot: 'wheel', catapult: 'mathematics' };

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
  /** Kinds of resource the people know (STORY-072): they show and yield on the map. */
  readonly kinds = new Set<ResourceKind>();
  /** What is researched, or null until the player chooses. */
  target: Study | null = null;
  bulbs = 0;

  /** Without kinds (the old start, a save from before STORY-072) every kind is known. */
  constructor(saved?: { known: Advance[]; target: Study | null; bulbs: number; kinds?: ResourceKind[] }) {
    for (const k of saved?.kinds ?? RESOURCE_KINDS) this.kinds.add(k);
    if (!saved) return;
    for (const a of saved.known) this.known.add(a);
    this.target = saved.target;
    this.bulbs = saved.bulbs;
  }

  save() {
    return { known: [...this.known], target: this.target, bulbs: this.bulbs, kinds: [...this.kinds] };
  }

  /**
   * What can be researched now: the kinds found on the map and not yet known, then the
   * advances not known whose needs are known and, if they come from a resource, one of its kinds.
   */
  available(found: Iterable<ResourceKind> = []): Study[] {
    const kinds = RESOURCE_KINDS.filter(k => !this.kinds.has(k) && new Set(found).has(k));
    return [...kinds, ...ADVANCE_LIST.filter(a => !this.known.has(a) && ADVANCES[a].needs.every(n => this.known.has(n))
      && (ADVANCES[a].from?.some(k => this.kinds.has(k)) ?? true))];
  }

  /** Bulbs a study costs: a kind STUDY_COST, an advance by the advances known. */
  costOf(s: Study): number {
    return isKind(s) ? STUDY_COST : advanceCost(this.known.size);
  }

  get cost(): number {
    return this.target ? this.costOf(this.target) : advanceCost(this.known.size);
  }

  /** A day's bulbs: they gather even without a target. Returns what was learned, if anything. */
  add(bulbs: number): Study | null {
    this.bulbs += bulbs;
    const target = this.target;
    if (!target || this.bulbs < this.cost) return null;
    this.bulbs -= this.cost;
    if (isKind(target)) this.kinds.add(target);
    else this.known.add(target);
    this.target = null;
    return target;
  }
}
