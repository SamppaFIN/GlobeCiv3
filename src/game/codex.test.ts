import { describe, expect, it } from 'vitest';
import { ADVISOR_LEVELS } from './advisors';
import { GOODS } from './chains';
import { BUILDINGS } from './cities';
import { advanceRef, buildRef, codexKeys, codexPage, eraRef, goodRef, personRef, resourceRef, UNIT_KINDS, type Page } from './codex';
import { ALL_PERSONS, ERAS, ROLES } from './persons';
import { ADVANCE_LIST, RESOURCE_KINDS } from './science';
import { RESOURCES } from './terrainTypes';
import type { Ref, Rich } from '../ui/richText';

const refs = (r: Rich): Ref[] => r.filter((s): s is Ref => typeof s !== 'string');
const allRefs = (p: Page) => [...refs(p.text), ...p.facts.flatMap(f => refs(f.value))];
const words = (r: Rich) => r.map(s => (typeof s === 'string' ? s : s.name)).join('');
const none = () => false;
const pageOf = (r: Ref) => ('page' in r ? r.page : undefined);

describe('Tietokirja (STORY-104)', () => {
  it('has a page with a text and facts for every building, unit kind, advance, resource, good, advisor and era', () => {
    const keys = [
      ...BUILDINGS.map(b => `building/${b}`), ...UNIT_KINDS.map(u => `unit/${u}`), ...ADVANCE_LIST.map(a => `advance/${a}`),
      ...RESOURCE_KINDS.map(k => `resource/${k}`), ...GOODS.map(g => `good/${g}`),
      ...ADVISOR_LEVELS.flatMap(l => ROLES[l].map(r => `advisor/${l}/${r}`)), ...ERAS.map(e => `era/${e}`),
    ];
    expect(codexKeys()).toEqual(['index', ...keys]);
    // Seven eras since STORY-120
    expect(keys.length).toBe(28 + 9 + 15 + 11 + 7 + 15 + 7);
    for (const key of codexKeys()) {
      const p = codexPage(key)!;
      expect(p.key, key).toBe(key);
      expect(p.title.length, key).toBeGreaterThan(0);
      expect(words(p.text).length, key).toBeGreaterThan(10);
      expect(p.facts.length, key).toBeGreaterThan(0);
      for (const f of p.facts) expect(words(f.value).length, `${key} ${f.label}`).toBeGreaterThan(0);
    }
    expect(codexPage('building/nothing')).toBeNull();
    expect(codexPage('advisor/town/none')).toBeNull();
    expect(codexPage('')).toBeNull();
  });

  it('links every reference to a page that exists, whatever the people know', () => {
    for (const known of [undefined, none]) {
      for (const key of codexKeys()) {
        for (const r of allRefs(codexPage(key, known)!)) {
          if (r.ref === 'city' || r.ref === 'unit') throw new Error(`${key}: a living reference`);
          expect(r.page, `${key}: ${r.name}`).toBeDefined();
          expect(codexPage(r.page!, known), `${key} → ${r.page}`).not.toBeNull();
        }
      }
    }
    // The index reaches every page
    expect(new Set(allRefs(codexPage('index')!).map(r => (r as { page?: string }).page))).toEqual(new Set(codexKeys().slice(1)));
  });

  it('shows the numbers of the rules: costs, upkeep, needs, attack and defence, the chain and the bonuses', () => {
    const facts = (key: string) => Object.fromEntries(codexPage(key)!.facts.map(f => [f.label, words(f.value)]));
    expect(facts('building/granary')).toMatchObject({ Hinta: '60 tuotantoa', Ylläpito: '1 kulta päivässä', Vaatii: 'Keramiikka' });
    expect(facts('building/sawmill')).toMatchObject({ Hinta: '30 tuotantoa', Pääkaupungissa: '3 lankkua ja 2 kiveä', Käyttää: 'Tukit', Tuottaa: 'Lankut' });
    expect(facts('building/lumberjack')).toMatchObject({ Hinta: '2 lankkua', Tuottaa: 'Tukit' });
    expect(facts('building/stable')).toMatchObject({ Resurssi: 'Hevoset', Valmistuessa: 'Ratsumies' });
    expect(facts('unit/phalanx')).toMatchObject({ Hinta: '20 tuotantoa', Vaatii: 'Pronssityö', Puolustus: '2' });
    expect(facts('unit/catapult')).toMatchObject({ Hyökkäys: '6', Vaatii: 'Matematiikka' });
    expect(facts('unit/settler').Hinta).toBe('40 tuotantoa ja 1 asukas');
    // An advance tells each build it opens with its numbers (STORY-118)
    expect(facts('advance/bronze')).toMatchObject({ Vaatii: 'ei aiempia keksintöjä', Yksikkö: 'Falangi: Puolustaa kaupunkia, kaksi kertaa soturia vahvempi · 20 tuotantoa · puolustus 2', Ihme: 'Kolossi: Ihme: +1 kauppa jokaiseen kaupungin ruutuun, jossa on kauppaa · 200 tuotantoa · kerran pelissä', Johtaa: 'Rahatalous ja Rautatyö' });
    expect(facts('advance/writing').Rakennus).toBe('Kirjasto: Tieteeseen 50 % lisää, ylhäällä +1 päivässä · 80 tuotantoa · ylläpito 1 kulta päivässä');
    expect(facts('advance/currency').Resurssista).toBe('Kulta ja Jalokivet');
    expect(facts('resource/horses')).toMatchObject({ Maasto: 'tasanko', 'Tuotto ruudulla': '+2 tuotanto', 'Avaa tutkimuksen': 'Ratsastus ja Pyörä', Rakennus: 'Talli' });
    expect(facts('good/bread')).toMatchObject({ Tekijä: 'Leipomo', 'Raaka-aine': 'Jauhot', Ravinto: 'Yksi ruokkii asukkaan päiväksi (2 ruokaa)' });
    expect(words(codexPage('good/bread')!.text)).toBe('Ketju: Vilja → Jauhot → Leipä.');
    // A role's page lists its person of each of the seven eras (STORY-120)
    expect(facts('advisor/town/build')).toMatchObject({ Varhaisaika: 'Kustaa Kirvesmies: +1 tuotanto pääkaupungissa', 'Rauta-aika': 'Brita Rautanaula: +2 tuotanto pääkaupungissa', Atomiaika: 'Jukka Automaatiosuunnittelija: +4 tuotanto pääkaupungissa' });
    expect(Object.keys(facts('advisor/town/build'))).toHaveLength(7);
    expect(words(codexPage('era/iron')!.text)).toContain('Rautatyö');
    expect(facts('era/early').Neuvonantajat.split(', ').length).toBe(14);
  });

  it('names no source on its pages (Sami 2026-11-21)', () => {
    for (const key of codexKeys()) {
      const p = codexPage(key)!;
      const all = [p.kicker, p.title, words(p.text), ...p.facts.flatMap(f => [f.label, words(f.value)])].join(' ');
      expect(all, key).not.toMatch(/Freeciv|Freeserf|Unciv|ruleset|civ1|lähde:/i);
    }
  });

  it('keeps an unknown kind of resource secret, as the map does (STORY-072)', () => {
    const names = new Set(Object.values(RESOURCES).map(r => r.name));
    for (const key of codexKeys()) {
      const p = codexPage(key, none)!;
      for (const r of allRefs(p)) if (r.ref === 'resource') expect(names.has(r.name), `${key}: ${r.name}`).toBe(false);
      if (key.startsWith('resource/') || key.startsWith('building/')) expect([...names].some(n => words(p.text).startsWith(`${n} `)), key).toBe(false);
    }
    expect(codexPage('resource/horses', none)!.title).toBe('Tasangon resurssi');
    expect(codexPage('resource/horses', k => k === 'horses')!.title).toBe('Hevoset');
  });

  it('gives the game\'s texts their references: a building, a unit kind, an advance, a resource, a good, an era and a person', () => {
    expect(buildRef('granary')).toEqual({ ref: 'building', name: 'Viljavarasto', page: 'building/granary' });
    expect(buildRef('warrior')).toEqual({ ref: 'unittype', name: 'Soturi', page: 'unit/warrior' });
    expect(buildRef('coinage')).toEqual({ ref: 'building', name: 'Kultaa' });
    expect(pageOf(advanceRef('iron'))).toBe('advance/iron');
    expect(resourceRef('fish', false, true)).toEqual({ ref: 'resource', name: 'valtameren resurssi', page: 'resource/fish' });
    expect(goodRef('plank', 'lankkua')).toEqual({ ref: 'good', name: 'lankkua', page: 'good/plank' });
    expect(pageOf(eraRef('iron', 'rauta-aikaa'))).toBe('era/iron');
    for (const p of ALL_PERSONS) expect(codexPage(pageOf(personRef(p))!), p.id).not.toBeNull();
  });
});

describe('the eras in the Tietokirja (STORY-120)', () => {
  const facts = (key: string) => Object.fromEntries(codexPage(key)!.facts.map(f => [f.label, words(f.value)]));

  it('has a page for each of the seven eras: how it begins, its advances in the game and its fifteen persons as links', () => {
    expect(ERAS).toHaveLength(7);
    for (const e of ERAS) {
      const p = codexPage(`era/${e}`)!;
      const people = p.facts.find(f => f.label === 'Neuvonantajat')!;
      expect(refs(people.value).filter(r => r.ref === 'person'), e).toHaveLength(15);
    }
    expect(words(codexPage('era/early')!.text)).toMatch(/^Pelin alku\./);
    expect(words(codexPage('era/iron')!.text)).toMatch(/^Alkaa, kun kansa keksii Rautatyö\./);
    expect(facts('era/iron').Keksinnöt).toBe('Monarkia, Rakentaminen, Rautatyö ja Matematiikka');
    // An era whose key is not in the game yet says so, and lists no advances
    for (const e of ['medieval', 'renaissance', 'industrial', 'modern', 'atomic']) {
      expect(words(codexPage(`era/${e}`)!.text), e).toMatch(/^Aikakauden keksinnöt tulevat peliin myöhemmin\./);
      expect(facts(`era/${e}`).Keksinnöt, e).toBeUndefined();
    }
    // The index lists all seven
    expect(refs(codexPage('index')!.facts.find(f => f.label === 'Aikakaudet')!.value)).toHaveLength(7);
  });

  it('tells the era an advance opens from the era keys, on its page and among its effects', () => {
    expect(facts('advance/iron').Aikakausi).toBe('Rauta-aika alkaa, ja neuvonantajiksi tulevat uudet henkilöt omine bonuksineen');
    expect(facts('advance/bronze').Aikakausi).toBeUndefined();
  });
});
