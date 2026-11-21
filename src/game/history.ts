/**
 * history.ts — a city's chronicle (STORY-106; Sami 2026-11-21: "joka kaupungille dynaaminen lore
 * teksti, joka kertoo kaupungin historian"). The game writes what happens to a city into its log:
 * its founding and founder, its buildings and wonders, its growth, the raids, the eras and its
 * taking. The chronicler tells the log as prose, each event in the voice of its era.
 *
 * The log keeps names as text, not references to the living state: a unit may have fallen since,
 * and the same log must give the same text. The telling is a pure function of the log, the seed
 * and the city, with no Math.random. All the wording is own (rule 4).
 */

import { BUILDS, isWonder, type Building, type City } from './cities';
import { mix } from './personNames';
import type { Era } from './persons';
import type { Terrain } from './terrainTypes';
import { city as cityRef, term, unit as unitRef, type Rich, type Segment } from '../ui/richText';

export type HistoryEvent =
  | { kind: 'founded'; day: number; founder: string | null; terrain: Terrain; resource: string | null; near: { name: string; tile: number } | null }
  | { kind: 'built'; day: number; building: Building }
  | { kind: 'grew'; day: number; size: number }
  | { kind: 'raid'; day: number; held: boolean; defender: { id: number; name: string } | null; nomads: boolean }
  | { kind: 'era'; day: number; era: Era }
  | { kind: 'taken'; day: number; from: string | null }
  /** The oldest events folded together, when the log is full. */
  | { kind: 'early'; until: number; count: number };

export const HISTORY_KINDS = ['founded', 'built', 'grew', 'raid', 'era', 'taken', 'early'] as const;
/** The most events a city keeps (own); the oldest after the founding are folded into one. */
export const HISTORY_MAX = 40;
/** The sizes worth a line (own). */
export const GROWTH_MARKS = [3, 5, 8] as const;

const dayOf = (e: HistoryEvent) => (e.kind === 'early' ? e.until : e.day);
const countOf = (e: HistoryEvent) => (e.kind === 'early' ? e.count : 1);

/**
 * Add an event. A full log folds its two oldest events after the founding into one "early years"
 * entry; an era stays, as it sets the voice of what follows.
 */
export function record(city: City, event: HistoryEvent): void {
  const log = (city.history ??= []);
  log.push(event);
  if (log.length <= HISTORY_MAX) return;
  let a = log[0].kind === 'founded' || log[0].kind === 'taken' ? 1 : 0;
  while (log[a].kind === 'era') a++;
  let b = a + 1;
  while (log[b].kind === 'era') b++;
  log[a] = { kind: 'early', until: dayOf(log[b]), count: countOf(log[a]) + countOf(log[b]) };
  log.splice(b, 1);
}

/** The size marks a city passed growing from one size to another. */
export const marksPassed = (from: number, to: number): number[] => GROWTH_MARKS.filter(m => from < m && to >= m);

/** Where a city stands, for an old city whose founding was not written. */
const IN: Record<Terrain, string> = {
  ocean: 'rantakallioilla', arctic: 'jään reunalla', desert: 'hiekan keskellä', forest: 'metsien keskellä',
  grassland: 'ruohomaiden keskellä', hills: 'kukkuloilla', jungle: 'viidakon reunalla',
  mountains: 'vuorten juurella', plains: 'tasangolla', swamp: 'suon laidalla', tundra: 'tunturin kupeessa',
};

/** Where a city was founded, as the chronicler says it. */
const AT: Record<Terrain, string> = {
  ocean: 'rantakallioille', arctic: 'jään reunalle', desert: 'hiekan keskelle', forest: 'metsän syliin',
  grassland: 'ruohomaan laidalle', hills: 'kukkuloiden rinteelle', jungle: 'viidakon reunaan',
  mountains: 'vuorten juurelle', plains: 'tasangon laitaan', swamp: 'suon saarekkeelle', tundra: 'tunturin kupeeseen',
};

// Each event in the voice of its era: a myth told at the fire, then a scribe's record.
// "{c}" is the city, "{f}" the founder, "{p}" the place, "{b}" a building, "{d}" a day, "{n}" a number, "{g}" a defender.
const VOICES: Record<Era, Record<string, readonly string[]>> = {
  early: {
    founded: ['{c} syntyi {p}, jonne {f} toi ensimmäiset tulet.', 'Kerrotaan, että {f} löi paalun {p}, ja siitä alkoi {c}.', '{c} sai alkunsa, kun {f} pysähtyi {p} eikä lähtenyt enää.'],
    built: ['Päivänä {d} kaupunkiin nousi {b}.', 'Kun {b} valmistui päivänä {d}, kansa juhli kolme yötä.', 'Päivänä {d} kaupunki sai uuden ylpeyden: {b}.'],
    wonder: ['Päivänä {d} valmistui ihme, {b}, ja sen maine kantoi yli vuorten.', 'Laulut kertovat päivästä {d}, jolloin {b} kohosi kaupunkiin.'],
    grew: ['Päivänä {d} kaupungissa asui jo {n} sukua.', 'Kaupunki kasvoi, ja päivänä {d} sen tulia paloi {n}.'],
    held: ['Kun {r} tulivat päivänä {d}, {g} seisoi portilla eikä kaupunki menettänyt jyvääkään.', 'Päivänä {d} {r} kolkuttivat porttia, mutta {g} ajoi heidät pois.'],
    heldAlone: ['Päivänä {d} {r} tulivat, mutta kaupunki torjui heidät.'],
    plundered: ['Päivänä {d} {r} ryöstivät aitat, ja kaupunki muisti sen pitkään.', 'Päivän {d} ryöstöstä puhuttiin vielä lastenlastenkin aikaan.'],
    taken: ['Päivänä {d} kaupunki valloitettiin, ja sen portit avautuivat uudelle valtakunnalle.'],
    early: ['Alkuvuosilta muistetaan {n} tapahtumaa, joiden yksityiskohdat ovat hämärtyneet.'],
  },
  iron: {
    founded: ['Aikakirjat kertovat, että {f} perusti kaupungin nimeltä {c} {p}.', '{c} perustettiin {p}, ja perustajaksi on kirjattu {f}.'],
    built: ['Kirjurit merkitsivät päivälle {d}: valmistui {b}.', 'Päivänä {d} otettiin käyttöön {b}.', 'Aikakirjan mukaan päivänä {d} valmistui {b}.'],
    wonder: ['Päivänä {d} valmistui ihme, {b}, ja sen nimi kirjattiin jokaisen kaupungin aikakirjaan.'],
    grew: ['Väkiluku nousi kokoon {n} päivänä {d}.', 'Päivän {d} laskennassa kaupungin koko oli {n}.'],
    held: ['Päivänä {d} {r} hyökkäsivät, mutta {g} piti portin.', 'Kirjattu päivälle {d}: {r} torjuttiin, ja portilla seisoi {g}.'],
    heldAlone: ['Päivänä {d} {r} torjuttiin.'],
    plundered: ['Päivänä {d} {r} ryöstivät varastot. Menetykset on kirjattu.'],
    taken: ['Päivänä {d} kaupunki liitettiin valtakuntaan valloituksella.'],
    early: ['Alkuvuosien {n} tapahtumaa on tiivistetty, koska vanhimmat kirjat ovat haalistuneet.'],
  },
};
const ERA_OPENING: Record<Era, readonly string[]> = {
  early: ['Ennen kirjoitusta kaikki muistettiin lauluina.'],
  iron: ['Sitten tuli rauta-aika, ja kirjurit alkoivat pitää aikakirjaa.', 'Rauta-ajan myötä kertomukset vaihtuivat aikakirjoiksi.'],
};
const ERA_NOW: Record<Era, Segment> = { early: term('era', 'varhaisaikaa'), iron: term('era', 'rauta-aikaa') };
/** The songs count in words. */
const IN_WORDS: Record<number, string> = { 3: 'kolme', 5: 'viisi', 8: 'kahdeksan' };

/** A unit's name as told mid-sentence: "Soturi Aino" → "soturi Aino". */
const midName = (name: string) => name.replace(/^(Uudisasukas|Soturi|Falangi|Tiedustelija|Ratsumies|Miekkamies|Sotavaunut|Katapultti) /, (_, k: string) => `${k.toLowerCase()} `);
/** A building as told mid-sentence: a wonder keeps its capital, others go lower case. */
const buildingName = (b: Building) => (isWonder(b) ? BUILDS[b].name : BUILDS[b].name.toLowerCase());

/** Fill a pattern's slots with segments; the text between them stays text. */
function fill(pattern: string, slots: Record<string, Segment>): Segment[] {
  const out: Segment[] = [];
  for (const part of pattern.split(/(\{[a-z]\})/)) {
    if (!part) continue;
    const slot = /^\{([a-z])\}$/.exec(part);
    out.push(slot ? (slots[slot[1]] ?? '') : part);
  }
  // A sentence starting with a name in lower case gets its capital back
  if (typeof out[0] === 'object' && out[0].ref !== 'city') out[0] = { ...out[0], name: out[0].name.charAt(0).toUpperCase() + out[0].name.slice(1) };
  return out;
}

/** The chronicler picks the telling by the seed, the city and the event's day and kind (own), so folding keeps the rest as told. */
const pick = (list: readonly string[], seed: number, city: number, e: HistoryEvent) => list[mix(mix(seed, city), dayOf(e) * 8 + HISTORY_KINDS.indexOf(e.kind)) % list.length];

/**
 * The city's story as paragraphs: one for each era it lived through, each event in that era's
 * voice. A save from before the chronicle tells what is known: the name, the land and the
 * buildings. `era` is the era now, for the last line.
 */
export function narrate(city: Pick<City, 'id' | 'name' | 'tile' | 'buildings' | 'history'>, seed: number, era: Era, terrain: Terrain): Rich[] {
  const log = city.history ?? [];
  const name = cityRef(city.tile, city.name);
  const paragraphs: Segment[][] = [];
  let voice: Era = 'early';
  let para: Segment[] = [];
  const say = (segs: Segment[]) => para.push(...(para.length ? [' '] : []), ...segs);
  if (log[0]?.kind !== 'founded' && log[0]?.kind !== 'taken') {
    say([name, ` on vanha kaupunki ${IN[terrain]}. Kaupungin alkuvuosista ei ole kirjoitettu.`]);
    const known = city.buildings.filter(b => !log.some(e => e.kind === 'built' && e.building === b));
    if (known.length) say(['Sen kaduilla seisovat ', ...known.flatMap((b, i): Segment[] => [i ? (i === known.length - 1 ? ' ja ' : ', ') : '', term('building', buildingName(b))]), '.']);
  }
  log.forEach(e => {
    if (e.kind === 'era') {
      if (e.era === voice) return;
      if (para.length) paragraphs.push(para);
      para = [];
      voice = e.era;
      say(fill(pick(ERA_OPENING[e.era], seed, city.id, e), {}));
      return;
    }
    const v = VOICES[voice];
    switch (e.kind) {
      case 'founded': {
        const founder: Segment = e.founder && e.founder !== 'Uudisasukas' ? term('person', midName(e.founder)) : 'uudisasukkaat';
        say(fill(pick(v.founded, seed, city.id, e), { c: name, f: founder, p: AT[e.terrain] }));
        if (e.resource) say(['Seudun aarteena tunnettiin ', term('resource', e.resource.toLowerCase()), '.']);
        if (e.near) say(['Lähimpänä naapurina oli ', cityRef(e.near.tile, e.near.name), '.']);
        break;
      }
      case 'built':
        say(fill(pick(isWonder(e.building) ? v.wonder : v.built, seed, city.id, e), { b: term('building', buildingName(e.building)), d: String(e.day) }));
        break;
      case 'grew':
        say(fill(pick(v.grew, seed, city.id, e), { d: String(e.day), n: voice === 'early' ? (IN_WORDS[e.size] ?? String(e.size)) : String(e.size) }));
        break;
      case 'raid': {
        const raiders = e.nomads ? 'paimentolaiset' : 'rosvot';
        const list = !e.held ? v.plundered : e.defender ? v.held : v.heldAlone;
        say(fill(pick(list, seed, city.id, e), { d: String(e.day), r: raiders, g: e.defender ? unitRef(e.defender.id, midName(e.defender.name)) : '' }));
        break;
      }
      case 'taken':
        say([...fill(pick(v.taken, seed, city.id, e), { d: String(e.day) }), ...(e.from ? [' Ennen sitä sen herra oli ', e.from, '.'] : [' Ennen sitä se oli itsenäinen kaupunkivaltio.'])]);
        break;
      case 'early':
        say(fill(pick(v.early, seed, city.id, e), { n: String(e.count) }));
        break;
    }
  });
  // The last line: the city now, in the era of today
  say([era === 'early' ? 'Tarinaa kerrotaan yhä nuotioilla, ja nyt eletään ' : 'Aikakirja on yhä auki, ja nyt eletään ', ERA_NOW[era], '.']);
  paragraphs.push(para);
  return paragraphs;
}
