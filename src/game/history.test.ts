import { describe, expect, it } from 'vitest';
import { HISTORY_MAX, marksPassed, narrate, record, type HistoryEvent } from './history';
import type { City } from './cities';
import { plain, type Rich, type Ref } from '../ui/richText';

const town = (history?: HistoryEvent[]): City => ({
  id: 0, name: 'Aamuranta', tile: 500, capital: true, size: 4, food: 0, shields: 0, build: 'coinage',
  buildings: ['lumberjack', 'temple'], focus: 'balanced', ...(history ? { history } : {}),
});
const founded: HistoryEvent = { kind: 'founded', day: 0, founder: 'Uudisasukas Aino', terrain: 'forest', resource: 'Hiili', near: { name: 'Kuusela', tile: 777 } };
const text = (paras: Rich[]) => paras.map(plain).join('\n');
const refs = (paras: Rich[]) => paras.flat().filter((s): s is Ref => typeof s !== 'string');

describe('the chronicle (STORY-106)', () => {
  it('records each event, and a full log folds its oldest after the founding, keeping the eras', () => {
    const c = town();
    record(c, founded);
    record(c, { kind: 'era', day: 3, era: 'iron' });
    for (let d = 1; d <= HISTORY_MAX + 5; d++) record(c, { kind: 'grew', day: 10 + d, size: 3 });
    const log = c.history!;
    expect(log.length).toBe(HISTORY_MAX);
    expect(log[0]).toEqual(founded);
    expect(log[1]).toEqual({ kind: 'era', day: 3, era: 'iron' });
    // 47 events in, 40 kept: the founding, the era, one fold of the first 8 and the last 37
    expect(log[2]).toEqual({ kind: 'early', until: 18, count: 8 });
    expect(log.filter(e => e.kind === 'grew').length + 8).toBe(HISTORY_MAX + 5);
    expect(log[log.length - 1]).toEqual({ kind: 'grew', day: 10 + HISTORY_MAX + 5, size: 3 });
  });

  it('marks the sizes 3, 5 and 8 passed', () => {
    expect(marksPassed(2, 3)).toEqual([3]);
    expect(marksPassed(4, 9)).toEqual([5, 8]);
    expect(marksPassed(3, 4)).toEqual([]);
  });

  it('tells the founding with its founder, land, resource and neighbour, the founder and neighbour as references', () => {
    const story = narrate(town([founded]), 42, 'early', 'forest');
    const all = text(story);
    expect(all).toContain('uudisasukas Aino');
    expect(all).toContain('metsän syliin');
    expect(all).toContain('Seudun aarteena tunnettiin hiili.');
    expect(all).toContain('Lähimpänä naapurina oli Kuusela.');
    expect(refs(story)).toEqual(expect.arrayContaining([
      { ref: 'city', tile: 500, name: 'Aamuranta' },
      { ref: 'city', tile: 777, name: 'Kuusela' },
      { ref: 'resource', name: 'hiili', page: 'resource/coal' },
      expect.objectContaining({ ref: 'person' }),
    ]));
  });

  it('gives the same text for the same log, and only the seed changes the telling', () => {
    const log: HistoryEvent[] = [founded, { kind: 'built', day: 4, building: 'lumberjack' }, { kind: 'grew', day: 30, size: 3 },
      { kind: 'raid', day: 63, held: true, defender: { id: 5, name: 'Soturi Kalervo' }, nomads: false }];
    expect(text(narrate(town(log), 42, 'early', 'forest'))).toBe(text(narrate(town(structuredClone(log)), 42, 'early', 'forest')));
    const tellings = new Set(Array.from({ length: 12 }, (_, seed) => text(narrate(town(log), seed, 'early', 'forest'))));
    expect(tellings.size).toBeGreaterThan(1);
  });

  it('tells each event in its era\'s voice, a paragraph an era, and names the building, the defender and the wonder', () => {
    const log: HistoryEvent[] = [founded, { kind: 'built', day: 4, building: 'lumberjack' },
      { kind: 'era', day: 50, era: 'iron' },
      { kind: 'built', day: 60, building: 'colossus' },
      { kind: 'raid', day: 63, held: true, defender: { id: 5, name: 'Soturi Kalervo' }, nomads: false },
      { kind: 'raid', day: 90, held: false, defender: null, nomads: true },
      { kind: 'grew', day: 99, size: 5 }];
    const story = narrate(town(log), 42, 'iron', 'forest');
    expect(story.length).toBe(2);
    expect(plain(story[1])).toMatch(/^(Sitten tuli rauta-aika|Rauta-ajan myötä)/);
    expect(refs(story)).toEqual(expect.arrayContaining([
      { ref: 'building', name: 'metsuri', page: 'building/lumberjack' },
      { ref: 'building', name: 'Kolossi', page: 'building/colossus' },
      { ref: 'unit', id: 5, name: 'soturi Kalervo' },
      { ref: 'era', name: 'rauta-aikaa', page: 'era/iron' },
    ]));
    expect(plain(story[1])).toContain('paimentolaiset');
    expect(plain(story[1])).toContain('99');
  });

  it('tells a taken city and its former lord', () => {
    expect(text(narrate(town([{ kind: 'taken', day: 200, from: 'Pohjola' }]), 1, 'iron', 'hills'))).toContain('Ennen sitä sen herra oli Pohjola.');
    expect(text(narrate(town([{ kind: 'taken', day: 200, from: null }]), 1, 'iron', 'hills'))).toContain('itsenäinen kaupunkivaltio');
  });

  it('tells a border reaching further in its era\'s voice, in days of walking (STORY-093)', () => {
    const early = text(narrate(town([founded, { kind: 'border', day: 140, rings: 3 }]), 1, 'early', 'forest'));
    expect(early).toMatch(/päivänä 140|Päivänä 140/);
    expect(early).toContain('kolmen päivämatkan');
    const iron = text(narrate(town([founded, { kind: 'era', day: 100, era: 'iron' }, { kind: 'border', day: 150, rings: 4 }]), 1, 'iron', 'forest'));
    expect(iron).toContain('neljän päivämatkan');
  });

  it('tells an old city what is known: its name, land and buildings', () => {
    const story = narrate(town(), 42, 'early', 'hills');
    expect(text(story)).toContain('Aamuranta on vanha kaupunki kukkuloilla. Kaupungin alkuvuosista ei ole kirjoitettu.');
    expect(text(story)).toContain('Sen kaduilla seisovat metsuri ja temppeli.');
    // Events after the load follow, and a building told by them is not listed twice
    const later = narrate(town([{ kind: 'built', day: 9, building: 'temple' }]), 42, 'early', 'hills');
    expect(text(later)).toContain('Sen kaduilla seisovat metsuri.');
    expect(text(later)).toContain('temppeli');
  });
});
