import { describe, expect, it } from 'vitest';
import { bonusText, defenseBonus, describeBonus, goldBonus, goodsBonus, scienceBonus, settleBonus, sightBonus, yieldBonus, type ActiveBonuses, type BonusKind } from './bonuses';
import { ALL_PERSONS } from './persons';
import { cityDay, type City } from './cities';
import { newChain, workDay } from './chains';
import { SIGHT, Units } from './units';

const city = (build: City['build'], shields: number): City => ({ id: 1, name: 'Kuusela', tile: 9, capital: false, size: 3, food: 0, shields, build, buildings: [], focus: 'balanced' });
const NONE: ActiveBonuses = {};

describe('the advisors\' bonuses (STORY-107)', () => {
  it('every one of the 30 persons has one bonus, of a kind its level has targets for, told in words', () => {
    expect(ALL_PERSONS.length).toBe(30);
    const kinds: Record<string, readonly BonusKind[]> = {
      town: ['food', 'shield', 'trade', 'goods', 'defense'], city: ['food', 'shield', 'trade', 'sight', 'defense'],
      province: ['settle', 'defense'], state: ['gold', 'science'], planet: ['defense'],
    };
    for (const p of ALL_PERSONS) {
      expect(kinds[p.level]).toContain(p.bonus.kind);
      expect(p.bonus.amount).toBeGreaterThan(p.bonus.kind === 'defense' ? 1 : 0);
      expect(describeBonus(p.level, p.bonus)).toMatch(/\S/);
    }
    // All nine kinds are in play
    expect(new Set(ALL_PERSONS.map(p => p.bonus.kind)).size).toBe(9);
  });

  it('food, shields and trade: the city level\'s bonus counts only in the capital, the city area\'s only in the others', () => {
    const active: ActiveBonuses = { town: { kind: 'shield', amount: 2 }, city: { kind: 'food', amount: 1 } };
    expect(yieldBonus(active, true)).toEqual({ food: 0, shield: 2, trade: 0 });
    expect(yieldBonus(active, false)).toEqual({ food: 1, shield: 0, trade: 0 });
    expect(yieldBonus({ city: { kind: 'trade', amount: 1 } }, false)).toEqual({ food: 0, shield: 0, trade: 1 });
    expect(yieldBonus(NONE, true)).toEqual({ food: 0, shield: 0, trade: 0 });
    // A bonus of another level's kind does nothing here
    expect(yieldBonus({ province: { kind: 'settle', amount: 10 } }, false)).toEqual({ food: 0, shield: 0, trade: 0 });
  });

  it('science and gold: the state\'s advisor alone', () => {
    expect(scienceBonus({ state: { kind: 'science', amount: 3 } })).toBe(3);
    expect(goldBonus({ state: { kind: 'gold', amount: 2 } })).toBe(2);
    expect(scienceBonus({ state: { kind: 'gold', amount: 2 } })).toBe(0);
    expect(goldBonus(NONE)).toBe(0);
  });

  it('goods: the city level\'s advisor brings bread to the capital\'s chains each day', () => {
    const s = newChain();
    workDay(s, [], [], goodsBonus({ town: { kind: 'goods', amount: 1 } }));
    expect(s.stock.bread).toBe(1);
    const t = newChain();
    workDay(t, [], [], goodsBonus({ city: { kind: 'goods', amount: 1 } }));
    expect(t.stock.bread ?? 0).toBe(0);
  });

  it('sight: the city area\'s advisor widens the scouts\' sight by its rings', () => {
    // The sight alone, without a world to land in
    const units: Units = Object.assign(Object.create(Units.prototype), { stateLine: null, extraSight: 0 });
    expect(units.sight).toBe(SIGHT);
    units.extraSight = sightBonus({ city: { kind: 'sight', amount: 1 } });
    expect(units.sight).toBe(SIGHT + 1);
    expect(sightBonus({ town: { kind: 'sight', amount: 1 } })).toBe(0);
  });

  it('settle: the province\'s advisor takes shields off a settler, and only a settler', () => {
    const off = settleBonus({ province: { kind: 'settle', amount: 10 } });
    expect(off).toBe(10);
    // 30 shields of 40 build a settler with 10 off, not without
    const a = city('settler', 25);
    expect(cityDay(a, { food: 6, shield: 5, trade: 0, surplus: 0 }, off)).toBe('settler');
    const b = city('settler', 25);
    expect(cityDay(b, { food: 6, shield: 5, trade: 0, surplus: 0 })).toBeNull();
    const c = city('warrior', 5);
    expect(cityDay(c, { food: 6, shield: 0, trade: 0, surplus: 0 }, off)).toBeNull();
  });

  it('defense: bandits at the capital answer to the city level, elsewhere to the city area, nomads to the province, rivals to the planet', () => {
    const active: ActiveBonuses = { town: { kind: 'defense', amount: 1.25 }, city: { kind: 'defense', amount: 1.5 }, province: { kind: 'defense', amount: 2 } };
    expect(defenseBonus(active, 'bandits', true)).toBe(1.25);
    expect(defenseBonus(active, 'bandits', false)).toBe(1.5);
    expect(defenseBonus(active, 'nomads', true)).toBe(2);
    expect(defenseBonus(active, 'rival', true)).toBe(1);
    expect(defenseBonus({ planet: { kind: 'defense', amount: 1.25 } }, 'rival', false)).toBe(1.25);
    // The own hand: nothing
    expect(defenseBonus(NONE, 'bandits', true)).toBe(1);
  });

  it('tells each bonus with where it counts', () => {
    expect(describeBonus('town', { kind: 'shield', amount: 1 })).toBe('+1 tuotanto pääkaupungissa');
    expect(describeBonus('city', { kind: 'food', amount: 2 })).toBe('+2 ruoka muissa kaupungeissa');
    expect(describeBonus('province', { kind: 'defense', amount: 1.25 })).toBe('puolustus ×1,25 paimentolaisia vastaan');
    expect(bonusText({ kind: 'settle', amount: 10 })).toBe('uudisasukas 10 tuotantoa halvempi');
  });
});
