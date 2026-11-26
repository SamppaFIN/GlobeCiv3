import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile } from '../globe/hexTiles';
import { BUILDS, cityGold, cityScience, foundCity, UPKEEP } from './cities';
import { advanceCost, opensFrom, studyName, treeLayout, ADVANCES, ADVANCE_LIST, NEEDS, Research, RESOURCE_KINDS, STUDY_COST, splitTrade } from './science';
import { ADVANCE_LORE } from './advanceLore';

const START = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());

describe('science (STORY-040, Freeciv civ1)', () => {
  it('an advance costs 10 bulbs for each advance known, plus one', () => {
    expect([0, 1, 2, 5].map(advanceCost)).toEqual([10, 20, 30, 60]);
  });

  it('only what an advance needs opens it; a building needs its advance', () => {
    const r = new Research();
    // Horseback Riding and The Wheel need nothing (STORY-064, techs.ruleset), Iron Working Bronze Working
    expect(r.available()).toEqual(['alphabet', 'bronze', 'ceremonial', 'pottery', 'masonry', 'horseback', 'wheel']);
    r.known.add('bronze');
    expect(r.available()).toContain('currency');
    expect(r.available()).toContain('iron');
    expect(r.available()).not.toContain('writing');
    expect(NEEDS).toEqual({ granary: 'pottery', walls: 'masonry', market: 'currency', library: 'writing', phalanx: 'bronze', temple: 'ceremonial', aqueduct: 'construction', colosseum: 'construction', colossus: 'bronze', gardens: 'pottery', greatwall: 'masonry', horseman: 'horseback', swordsman: 'iron', chariot: 'wheel', catapult: 'mathematics',
      oracle: 'mysticism', greatlibrary: 'literacy', observatory: 'astronomy', caravan: 'trade' });
  });
  it('the Republic needs Code of Laws and Literacy, and comes last (STORY-125, civ1 techs.ruleset)', () => {
    expect(ADVANCES.republic).toEqual({ name: 'Tasavalta', needs: ['law', 'literacy'] });
    expect(ADVANCE_LIST.at(-1)).toBe('republic');
    const r = new Research();
    for (const a of ['alphabet', 'writing', 'law'] as const) r.known.add(a);
    expect(r.available()).not.toContain('republic');
    r.known.add('literacy');
    expect(r.available()).toContain('republic');
  });

  it('the early and iron age advances need what Freeciv civ1 says, and come after the older ones (STORY-121)', () => {
    expect(ADVANCES.mysticism.needs).toEqual(['ceremonial']);
    expect(ADVANCES.literacy.needs).toEqual(['writing', 'law']);
    expect(ADVANCES.trade.needs).toEqual(['currency', 'law']);
    expect(ADVANCES.philosophy.needs).toEqual(['mysticism', 'literacy']);
    expect(ADVANCES.astronomy.needs).toEqual(['mysticism', 'mathematics']);
    expect(ADVANCES.bridges.needs).toEqual(['iron', 'construction']);
    // The older advances keep their places, so that ruins and the tree pick as before
    expect(ADVANCE_LIST.slice(-7, -1)).toEqual(['mysticism', 'literacy', 'trade', 'philosophy', 'astronomy', 'bridges']);
    expect(ADVANCE_LIST).toHaveLength(22);
    const r = new Research();
    r.known.add('ceremonial');
    expect(r.available()).toContain('mysticism');
    expect(r.available()).not.toContain('philosophy');
  });

  it('bulbs gather even without a target; the target is learned when they reach its cost, and the rest carries over', () => {
    const r = new Research();
    expect(r.add(6)).toBeNull();
    r.target = 'pottery';
    expect(r.add(3)).toBeNull();
    expect(r.add(4)).toBe('pottery');
    expect([r.bulbs, r.target, [...r.known]]).toEqual([3, null, ['pottery']]);
    // The second costs 20
    r.target = 'masonry';
    expect(r.add(16)).toBeNull();
    expect(r.add(1)).toBe('masonry');
    expect(new Research(r.save()).save()).toEqual(r.save());
  });

  it('the tax rate splits trade into gold and science; a marketplace and a library add half', () => {
    expect(splitTrade(5, 50)).toEqual({ gold: 3, luxury: 0, science: 2 });
    expect(splitTrade(5, 30)).toEqual({ gold: 2, luxury: 0, science: 3 });
    // Luxury takes its share before science (STORY-046)
    expect(splitTrade(10, 50, 30)).toEqual({ gold: 5, luxury: 3, science: 2 });
    expect(splitTrade(10, 70, 30)).toEqual({ gold: 7, luxury: 3, science: 0 });
    const c = foundCity([], START);
    const y = { food: 0, shield: 0, trade: 10 };
    expect([cityGold(c, y, 30), cityScience(c, y, 30)]).toEqual([3, 7]);
    c.buildings.push('market', 'library');
    expect([cityGold(c, y, 30), cityScience(c, y, 30)]).toEqual([4, 10]);
    expect([BUILDS.library.cost, UPKEEP.library]).toEqual([80, 1]);
  });

  it('the Observatory gives its city +100 % science and +50 % more with a library, added up (STORY-121, Freeciv civ1)', () => {
    const c = foundCity([], START);
    const y = { food: 0, shield: 0, trade: 10 };
    // 7 science at a 30 % tax
    c.buildings.push('observatory');
    expect(cityScience(c, y, 30)).toBe(14);
    c.buildings.push('library');
    expect(cityScience(c, y, 30)).toBe(Math.floor(7 * 3));
    expect(UPKEEP.observatory).toBe(0);
  });

  it('resources (STORY-072, own): a kind found on the map is a study; until it is studied the advances from it stay shut', () => {
    const r = new Research({ known: [], target: null, bulbs: 0, kinds: [] });
    // Horseback Riding and The Wheel need horses studied; nothing is found yet
    expect(r.available()).toEqual(['alphabet', 'bronze', 'ceremonial', 'pottery', 'masonry']);
    expect(r.available(['horses', 'fish'])).toEqual(['fish', 'horses', 'alphabet', 'bronze', 'ceremonial', 'pottery', 'masonry']);
    expect(studyName('horses')).toBe('Tasangon resurssi');
    expect(studyName('horses', true)).toBe('Hevoset');
    expect(opensFrom('horses')).toEqual(['horseback', 'wheel']);
    expect(opensFrom('gems')).toEqual(['currency']);
    // A study costs STUDY_COST whatever is known, and does not raise the cost of advances
    r.known.add('alphabet');
    r.target = 'horses';
    expect(r.cost).toBe(STUDY_COST);
    expect(r.add(STUDY_COST)).toBe('horses');
    expect([...r.kinds]).toEqual(['horses']);
    expect(r.costOf('bronze')).toBe(advanceCost(1));
    expect(r.available(['horses'])).toEqual(['bronze', 'ceremonial', 'pottery', 'masonry', 'writing', 'law', 'horseback', 'wheel']);
    // Currency needs Bronze Working and gold or gems; Map Making fish
    r.known.add('bronze');
    expect(r.available()).not.toContain('currency');
    r.kinds.add('gems');
    expect(r.available()).toContain('currency');
    expect(r.available()).not.toContain('mapmaking');
    expect(new Research(r.save()).save()).toEqual(r.save());
  });

  it('the old start and saves from before STORY-072 know every kind', () => {
    expect([...new Research().kinds]).toEqual(RESOURCE_KINDS);
    expect([...new Research({ known: [], target: null, bulbs: 0 }).kinds]).toEqual(RESOURCE_KINDS);
  });
});

describe('the science tree (STORY-109)', () => {
  it('puts every advance once, after what it needs, in rows without gaps', () => {
    const layout = treeLayout();
    expect(layout.map(n => n.advance).sort()).toEqual([...ADVANCE_LIST].sort());
    const at = new Map(layout.map(n => [n.advance, n]));
    for (const n of layout) for (const need of ADVANCES[n.advance].needs) expect(at.get(need)!.col).toBeLessThan(n.col);
    // A column's depth is the longest chain: Monarchy needs Code of Laws, which needs the Alphabet
    expect(at.get('alphabet')!.col).toBe(0);
    expect(at.get('law')!.col).toBe(1);
    expect(at.get('monarchy')!.col).toBe(2);
    for (const c of new Set(layout.map(n => n.col))) {
      const rows = layout.filter(n => n.col === c).map(n => n.row).sort((a, b) => a - b);
      expect(rows).toEqual(rows.map((_, i) => i));
    }
    // The same every time
    expect(treeLayout()).toEqual(layout);
  });
  it('orders the first column by what each leads to, those leading nowhere last', () => {
    const first = treeLayout().filter(n => n.col === 0).sort((a, b) => a.row - b.row).map(n => n.advance);
    const leads = (a: string) => ADVANCE_LIST.some(n => (ADVANCES[n].needs as string[]).includes(a));
    const lastLeading = first.map(leads).lastIndexOf(true);
    expect(first.slice(lastLeading + 1).every(a => !leads(a))).toBe(true);
    expect(first.slice(0, lastLeading + 1).every(leads)).toBe(true);
  });
  it('gives every advance what it is and a saying with who said it and where', () => {
    for (const a of ADVANCE_LIST) {
      const l = ADVANCE_LORE[a];
      expect(l.what.length, a).toBeGreaterThan(40);
      expect(l.quote.text.length, a).toBeGreaterThan(10);
      expect(l.quote.who, a).not.toBe('');
      expect(l.quote.where, a).not.toBe('');
    }
  });
});
