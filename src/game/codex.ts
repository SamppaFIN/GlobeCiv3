/**
 * codex.ts — the Tietokirja (STORY-104; Sami 2026-11-21: "tekstit on värikkäitä ja niissä on
 * linkkejä muihin teksteihin, wikiin"). The game's own wiki: a page for each building, unit kind,
 * advance, resource, good, advisor and era. The pages are made from the rule tables, so a page
 * says what the rules do; nothing here is a rule of its own.
 *
 * The pages show no sources (Sami 2026-11-21): the sources stay in the comments of the tables
 * and in the tickets (rule 4). References between pages are terms with a page (richText.ts), and
 * every one of them leads to a page that exists (codex.test.ts).
 *
 * A kind of resource the people do not know yet keeps its secret here too (STORY-072): its page
 * names it by its terrain, as the map does.
 */
import { ADVISOR_LEVEL_NAMES, CITY_ADVISORS, PLANET_ADVISORS, PROVINCE_ADVISORS, STATE_ADVISORS, TOWN_ADVISORS, type AdvisorLevel } from './advisors';
import { describeBonus } from './bonuses';
import { CHAIN_BUILDINGS, CHAIN_RULES, GOOD_NAMES, GOODS, MEAL_FOOD, isChainBuilding, type ChainBuilding, type Good } from './chains';
import { BUILDINGS, BUILDS, isBuilding, isResourceBuilding, isSoldier, isWonder, RESOURCE_BUILDING_LIST, RESOURCE_BUILDINGS, TERRAIN_BUILDINGS, UPKEEP, type Build, type Building, type ResourceBuilding, type TerrainBuilding } from './cities';
import { ALL_PERSONS, ERA_NAMES, ERAS, ROLES, type Era, type Person } from './persons';
import { ADVANCE_ERA, ERA_KEYS, eraOpenedBy } from './eras';
import { defenseOf } from './raids';
import { ADVANCE_LIST, ADVANCES, KIND_TERRAIN, NEEDS, opensFrom, RESOURCE_KINDS, STUDY_COST, studyName, type Advance } from './science';
import { RESOURCES, TERRAIN_RULES, type ResourceKind } from './terrainTypes';
import { SIGHT } from './units';
import { ATTACK, ATTACKERS, isAttacker } from './war';
import { term, type Ref, type Rich, type Segment } from './rich';

/** A resource building's purpose for the city card: its kind, bonus and reward. */
const resourcePurpose = (b: ResourceBuilding, kindName = RESOURCES[RESOURCE_BUILDINGS[b].kind].name) => {
  const r = RESOURCE_BUILDINGS[b];
  const daily = [r.food && `+${r.food} ruoka`, r.shield && `+${r.shield} tuotanto`, r.content && `+${r.content} tyytyväinen`, r.gold && `+${r.gold} kultaa`].filter(Boolean).join(', ');
  const reward = r.reward === null ? '' : `; valmistuessa ${r.reward in ADVANCES ? `keksintö ${ADVANCES[r.reward as Advance].name}` : BUILDS[r.reward as Build].name.toLowerCase()}`;
  return `${kindName} alueella: ${daily} päivässä${reward}`;
};

/** What each build does, for the city card (STORY-037, buildings STORY-038) and the Tietokirja. */
export const BUILD_PURPOSE: Record<Build, string> = {
  warrior: 'Puolustaa kaupunkia rosvoilta', settler: 'Perustaa uuden kaupungin tai kehittää maata',
  coinage: 'Kaupunki kasvaa rauhassa, ja kassa karttuu',
  phalanx: 'Puolustaa kaupunkia, kaksi kertaa soturia vahvempi',
  scout: 'Kartoittaa maata, ja ensimmäinen avaa seuraavan kartan',
  worker: 'Rakentaa tien strategiselle resurssille, jotta se hyödyttää koko lääniä, ja kehittää maata',
  fishery: 'Rannalle: +1 ruoka päivässä',
  sawmill: 'Metsän reunaan: +1 tuotanto päivässä',
  quarry: 'Kukkulalle tai vuorelle: +1 tuotanto päivässä, vuorella +2',
  field: 'Tasaiselle maalle: +1 ruoka päivässä, alhaalla +2',
  horseman: 'Hyökkäys 2: Kenraali vie sen sotaretkelle kaupunkivaltiota vastaan',
  swordsman: 'Hyökkäys 3: Kenraali vie sen sotaretkelle kaupunkivaltiota vastaan',
  chariot: 'Hyökkäys 4: Kenraali vie sen sotaretkelle kaupunkivaltiota vastaan',
  catapult: 'Hyökkäys 6, muureja vastaan: Kenraali vie sen sotaretkelle',
  library: 'Tieteeseen 50 % lisää, ylhäällä +1 päivässä',
  temple: 'Rauhoittaa yhden tyytymättömän asukkaan, ylhäällä kaksi',
  aqueduct: 'Kaupunki voi kasvaa yli koon 10',
  colosseum: 'Rauhoittaa kolme tyytymätöntä asukasta',
  colossus: 'Ihme: +1 kauppa jokaiseen kaupungin ruutuun, jossa on kauppaa',
  gardens: 'Ihme: yksi onnellinen asukas joka kaupunkiin',
  greatwall: 'Ihme: muurin suoja kaikkiin kaupunkeihin',
  ...(Object.fromEntries(RESOURCE_BUILDING_LIST.map(b => [b, resourcePurpose(b)])) as Record<ResourceBuilding, string>),
  granary: 'Säilyttää puolet ruoasta, kun kaupunki kasvaa; alhaalla +1 ruoka päivässä', walls: 'Soturit kolminkertaisesti vahvempia rosvoja vastaan', market: 'Kaupasta 50 % enemmän kultaa; alhaalla +1 kauppa päivässä',
  lumberjack: 'Kaataa tukin kahdessa päivässä, metsässä joka päivä', mill: 'Jauhaa viljan jauhoiksi, ylhäällä joka päivä', bakery: 'Leipoo jauhoista leipää: leipä ruokkii asukkaan',
};
/** What each chain building does in a city of chains (STORY-088): a good in two days, on its best ground in one. */
export const CHAIN_PURPOSE: Record<ChainBuilding, string> = {
  lumberjack: BUILD_PURPOSE.lumberjack,
  sawmill: 'Sahaa tukin lankuksi: lankut ovat rakennusten tarvike',
  quarry: 'Louhii kiveä kahdessa päivässä, kukkulalla tai vuorella joka päivä',
  field: 'Kasvattaa viljaa kahdessa päivässä, alhaalla joka päivä',
  mill: BUILD_PURPOSE.mill,
  bakery: BUILD_PURPOSE.bakery,
  fishery: 'Rannalle: kala kahdessa päivässä, ja kala ruokkii asukkaan',
};

export type PageKind = 'building' | 'unit' | 'advance' | 'resource' | 'good' | 'advisor' | 'era';

export interface Page {
  /** "building/granary", "advisor/town/build", or "index". */
  key: string;
  kicker: string;
  title: string;
  text: Rich;
  facts: { label: string; value: Rich }[];
}

/** Whether the people know a kind of resource. */
export type KnownKind = (k: ResourceKind) => boolean;
const ALL_KNOWN: KnownKind = () => true;

/** The unit kinds a city builds. */
export const UNIT_KINDS: readonly Build[] = ['warrior', 'phalanx', 'scout', 'settler', 'worker', ...ATTACKERS];

const ROLE_NAMES: Record<AdvisorLevel, Record<string, { name: string; does: string }>> = { town: TOWN_ADVISORS, city: CITY_ADVISORS, province: PROVINCE_ADVISORS, state: STATE_ADVISORS, planet: PLANET_ADVISORS };

/* The references to pages, for any text of the game. */

/** A build: a building's page, a unit kind's page, or no page (Kultaa). */
export const buildRef = (b: Build, text = BUILDS[b].name): Ref =>
  b === 'coinage' ? term('building', text) : isBuilding(b) ? term('building', text, `building/${b}`) : term('unittype', text, `unit/${b}`);
export const advanceRef = (a: Advance, text = ADVANCES[a].name): Ref => term('advance', text, `advance/${a}`);
/** A kind of resource, by its name when known and by its terrain when not. */
export const resourceRef = (k: ResourceKind, known = true, lower = false): Ref => {
  const name = studyName(k, known);
  return term('resource', lower ? name.toLowerCase() : name, `resource/${k}`);
};
export const goodRef = (g: Good, text = GOOD_NAMES[g]): Ref => term('good', text, `good/${g}`);
export const eraRef = (e: Era, text = ERA_NAMES[e]): Ref => term('era', text, `era/${e}`);
/** A person: "Kustaa Kirvesmies", to the page of the role. */
export const personRef = (p: Person): Ref => term('person', `${p.name} ${p.title}`, `advisor/${p.level}/${p.role}`);

/** "A, B ja C" */
const list = (items: readonly Segment[]): Segment[] => items.flatMap((x, i) => (i === 0 ? [x] : [i === items.length - 1 ? ' ja ' : ', ', x]));
/** "3 lankkua ja 2 kiveä", the goods linked. */
function materials(planks: number, stones: number): Segment[] {
  const parts: Segment[][] = [];
  if (planks) parts.push([`${planks} `, goodRef('plank', planks === 1 ? 'lankku' : 'lankkua')]);
  if (stones) parts.push([`${stones} `, goodRef('stone', stones === 1 ? 'kivi' : 'kiveä')]);
  return parts.flatMap((p, i) => (i ? [' ja ', ...p] : p));
}
const yieldText = (y: { food: number; shield: number; trade: number }) => [y.food && `+${y.food} ruoka`, y.shield && `+${y.shield} tuotanto`, y.trade && `+${y.trade} kauppa`].filter(Boolean).join(', ');

/** Every page's key, the index first. */
export function codexKeys(): string[] {
  return [
    'index',
    ...BUILDINGS.map(b => `building/${b}`),
    ...UNIT_KINDS.map(u => `unit/${u}`),
    ...ADVANCE_LIST.map(a => `advance/${a}`),
    ...RESOURCE_KINDS.map(k => `resource/${k}`),
    ...GOODS.map(g => `good/${g}`),
    ...(Object.keys(ROLES) as AdvisorLevel[]).flatMap(level => ROLES[level].map(role => `advisor/${level}/${role}`)),
    ...ERAS.map(e => `era/${e}`),
  ];
}

/** A page by its key, or null when there is none. */
export function codexPage(key: string, known: KnownKind = ALL_KNOWN): Page | null {
  const [kind, id, role] = key.split('/');
  if (key === 'index') return indexPage(known);
  if (kind === 'building' && (BUILDINGS as readonly string[]).includes(id)) return buildingPage(id as Building, known);
  if (kind === 'unit' && UNIT_KINDS.includes(id as Build)) return unitPage(id as Build);
  if (kind === 'advance' && id in ADVANCES) return advancePage(id as Advance, known);
  if (kind === 'resource' && id in RESOURCES) return resourcePage(id as ResourceKind, known);
  if (kind === 'good' && (GOODS as readonly string[]).includes(id)) return goodPage(id as Good);
  if (kind === 'advisor' && id in ROLES && ROLES[id as AdvisorLevel].includes(role)) return advisorPage(id as AdvisorLevel, role);
  if (kind === 'era' && (ERAS as readonly string[]).includes(id)) return eraPage(id as Era);
  return null;
}

function indexPage(known: KnownKind): Page {
  return {
    key: 'index', kicker: 'Tietokirja', title: 'Tietokirja',
    text: ['Pelin säännöt sivuina. Napauta nimeä, niin sen sivu aukeaa.'],
    facts: [
      { label: 'Rakennukset', value: list(BUILDINGS.map(b => buildRef(b))) },
      { label: 'Yksiköt', value: list(UNIT_KINDS.map(u => buildRef(u))) },
      { label: 'Keksinnöt', value: list(ADVANCE_LIST.map(a => advanceRef(a))) },
      { label: 'Resurssit', value: list(RESOURCE_KINDS.map(k => resourceRef(k, known(k)))) },
      { label: 'Tavarat', value: list(GOODS.map(g => goodRef(g))) },
      { label: 'Neuvonantajat', value: list((Object.keys(ROLES) as AdvisorLevel[]).flatMap(level => ROLES[level].map(role => term('person', `${ROLE_NAMES[level][role].name} (${ADVISOR_LEVEL_NAMES[level].toLowerCase()})`, `advisor/${level}/${role}`)))) },
      { label: 'Aikakaudet', value: list(ERAS.map(e => eraRef(e))) },
    ],
  };
}

function buildingPage(b: Building, known: KnownKind): Page {
  const facts: Page['facts'] = [];
  const chain = isChainBuilding(b) ? CHAIN_RULES[b] : null;
  if (BUILDS[b].cost) facts.push({ label: 'Hinta', value: [`${BUILDS[b].cost} tuotantoa`] });
  if (chain) facts.push({ label: BUILDS[b].cost ? 'Pääkaupungissa' : 'Hinta', value: materials(chain.planks, chain.stones) });
  if (UPKEEP[b]) facts.push({ label: 'Ylläpito', value: [`${UPKEEP[b]} ${UPKEEP[b] === 1 ? 'kulta' : 'kultaa'} päivässä`] });
  if (NEEDS[b]) facts.push({ label: 'Vaatii', value: [advanceRef(NEEDS[b]!)] });
  if (b in TERRAIN_BUILDINGS) facts.push({ label: 'Maasto', value: [TERRAIN_BUILDINGS[b as TerrainBuilding].map(t => TERRAIN_RULES[t].name.toLowerCase()).join(' tai ')] });
  if (isResourceBuilding(b)) {
    const r = RESOURCE_BUILDINGS[b];
    facts.push({ label: 'Resurssi', value: [resourceRef(r.kind, known(r.kind))] });
    if (r.reward) facts.push({ label: 'Valmistuessa', value: [r.reward in ADVANCES ? advanceRef(r.reward as Advance) : buildRef(r.reward as Build)] });
  }
  if (chain) {
    if (chain.input) facts.push({ label: 'Käyttää', value: [goodRef(chain.input)] });
    facts.push({ label: 'Tuottaa', value: [goodRef(chain.output)] });
    facts.push({ label: 'Ketjussa', value: [CHAIN_PURPOSE[b as ChainBuilding]] });
  }
  if (isWonder(b)) facts.push({ label: 'Ihme', value: ['Kerran pelissä, ei ylläpitoa'] });
  // A kind not known yet is told by its terrain here too
  const text = isResourceBuilding(b) ? resourcePurpose(b, studyName(RESOURCE_BUILDINGS[b].kind, known(RESOURCE_BUILDINGS[b].kind))) : BUILD_PURPOSE[b];
  return { key: `building/${b}`, kicker: isWonder(b) ? 'Ihme' : 'Rakennus', title: BUILDS[b].name, text: [text], facts };
}

function unitPage(u: Build): Page {
  const facts: Page['facts'] = [{ label: 'Hinta', value: [`${BUILDS[u].cost} tuotantoa${BUILDS[u].pop ? ` ja ${BUILDS[u].pop} asukas` : ''}`] }];
  if (NEEDS[u]) facts.push({ label: 'Vaatii', value: [advanceRef(NEEDS[u]!)] });
  if (isAttacker(u)) facts.push({ label: 'Hyökkäys', value: [String(ATTACK[u])] });
  if (u === 'warrior' || u === 'phalanx') facts.push({ label: 'Puolustus', value: [String(defenseOf(u))] });
  if (u === 'scout') facts.push({ label: 'Näkee', value: [`${SIGHT} rengasta`] });
  const rewardOf = RESOURCE_BUILDING_LIST.filter(b => RESOURCE_BUILDINGS[b].reward === u);
  if (rewardOf.length) facts.push({ label: 'Saadaan myös', value: list(rewardOf.map(b => buildRef(b))) });
  return { key: `unit/${u}`, kicker: 'Yksikkö', title: BUILDS[u].name, text: [BUILD_PURPOSE[u]], facts };
}

/**
 * What an advance does, a fact each with its numbers (STORY-118, Sami 2026-11-23: "selkeät
 * vaikutukset joka teknologiasta"): each build it opens with its effect, price and upkeep,
 * what else changes, and the advances it leads to. The advance's card, the science tree and
 * the Tietokirja tell the same facts.
 */
export function advanceEffects(a: Advance): Page['facts'] {
  const facts: Page['facts'] = [];
  for (const b of (Object.keys(NEEDS) as Build[]).filter(x => NEEDS[x] === a)) {
    const numbers = [
      BUILDS[b].cost ? `${BUILDS[b].cost} tuotantoa${BUILDS[b].pop ? ` ja ${BUILDS[b].pop} asukas` : ''}` : null,
      isBuilding(b) && UPKEEP[b] ? `ylläpito ${UPKEEP[b]} ${UPKEEP[b] === 1 ? 'kulta' : 'kultaa'} päivässä` : null,
      isSoldier(b) ? `puolustus ${defenseOf(b)}` : null,
      isWonder(b) ? 'kerran pelissä' : null,
    ].filter((x): x is string => x !== null);
    facts.push({ label: isWonder(b) ? 'Ihme' : isBuilding(b) ? 'Rakennus' : 'Yksikkö', value: [buildRef(b), `: ${BUILD_PURPOSE[b]}`, ...numbers.map(x => ` · ${x}`)] });
  }
  if (a === 'mapmaking') facts.push({ label: 'Liike', value: ['Yksiköt kulkevat rannikkovesillä ruudun päivässä'] });
  if (a === 'monarchy') facts.push({ label: 'Hallitus', value: ['Vallankumous Monarkiaan: ruudut tuottavat täysin, ja yksiköt maksavat ylläpitoa alusta asti'] });
  const era = eraOpenedBy(a);
  if (era) facts.push({ label: 'Aikakausi', value: [eraRef(era), ' alkaa, ja neuvonantajiksi tulevat uudet henkilöt omine bonuksineen'] });
  const next = ADVANCE_LIST.filter(n => ADVANCES[n].needs.includes(a));
  if (next.length) facts.push({ label: 'Johtaa', value: list(next.map(n => advanceRef(n))) });
  return facts;
}

function advancePage(a: Advance, known: KnownKind): Page {
  const builds = (Object.keys(NEEDS) as Build[]).filter(b => NEEDS[b] === a);
  const rewardOf = RESOURCE_BUILDING_LIST.filter(b => RESOURCE_BUILDINGS[b].reward === a);
  const more: Segment[] = a === 'mapmaking' ? ['Yksiköt kulkevat rannikkovesillä.']
    : a === 'monarchy' ? ['Kansa voi tehdä vallankumouksen Monarkiaan.']
    : eraOpenedBy(a) ? [eraRef(eraOpenedBy(a)!), ' alkaa.'] : [];
  const facts: Page['facts'] = [
    { label: 'Vaatii', value: ADVANCES[a].needs.length ? list(ADVANCES[a].needs.map(n => advanceRef(n))) : ['ei aiempia keksintöjä'] },
  ];
  if (ADVANCES[a].from) facts.push({ label: 'Resurssista', value: list(ADVANCES[a].from!.map(k => resourceRef(k, known(k)))) });
  facts.push(...advanceEffects(a));
  if (rewardOf.length) facts.push({ label: 'Saadaan myös', value: list(rewardOf.map(b => buildRef(b))) });
  facts.push({ label: 'Hinta', value: ['10 × (tunnetut keksinnöt + 1) tiedettä'] });
  const text: Segment[] = builds.length ? [ADVANCES[a].name, ' avaa ', ...list(builds.map(b => buildRef(b, isWonder(b) ? BUILDS[b].name : BUILDS[b].name.toLowerCase()))), '.', ...(more.length ? [' ', ...more] : [])]
    : more.length ? more : [ADVANCES[a].name, ' on askel kohti seuraavia keksintöjä.'];
  return { key: `advance/${a}`, kicker: 'Keksintö', title: ADVANCES[a].name, text, facts };
}

function resourcePage(k: ResourceKind, known: KnownKind): Page {
  const terrain = TERRAIN_RULES[KIND_TERRAIN[k]].name.toLowerCase();
  const study = { label: 'Tutkimus', value: [`${STUDY_COST} tiedettä`] };
  if (!known(k)) {
    return {
      key: `resource/${k}`, kicker: 'Resurssi', title: studyName(k),
      text: ['Kansa ei vielä tunne tätä lajia. Kartalla se on harmaa ?-merkki, eikä se tuota. Tutkimus paljastaa sen kaikkialla.'],
      facts: [{ label: 'Maasto', value: [terrain] }, study],
    };
  }
  const opens = opensFrom(k);
  const building = RESOURCE_BUILDING_LIST.find(b => RESOURCE_BUILDINGS[b].kind === k);
  const facts: Page['facts'] = [{ label: 'Maasto', value: [terrain] }, { label: 'Tuotto ruudulla', value: [yieldText(RESOURCES[k])] }, study];
  if (opens.length) facts.push({ label: 'Avaa tutkimuksen', value: list(opens.map(a => advanceRef(a))) });
  if (building) facts.push({ label: 'Rakennus', value: [buildRef(building)] });
  return { key: `resource/${k}`, kicker: 'Resurssi', title: RESOURCES[k].name, text: [`Erikoisresurssi, jota löytyy maastosta ${terrain}. Ruutu tuottaa sen ansiosta enemmän.`], facts };
}

function goodPage(g: Good): Page {
  const maker = CHAIN_BUILDINGS.find(b => CHAIN_RULES[b].output === g)!;
  const users = CHAIN_BUILDINGS.filter(b => CHAIN_RULES[b].input === g);
  // The chain from its first good to this one: "Vilja → Jauhot → Leipä"
  const line: Good[] = [g];
  for (let b: ChainBuilding | undefined = maker; b && CHAIN_RULES[b].input; ) {
    const input: Good = CHAIN_RULES[b].input!;
    line.unshift(input);
    b = CHAIN_BUILDINGS.find(x => CHAIN_RULES[x].output === input);
  }
  const facts: Page['facts'] = [{ label: 'Tekijä', value: [buildRef(maker)] }];
  if (CHAIN_RULES[maker].input) facts.push({ label: 'Raaka-aine', value: [goodRef(CHAIN_RULES[maker].input!)] });
  if (users.length) facts.push({ label: 'Jalostaa', value: list(users.map(b => buildRef(b))) });
  if (g === 'plank' || g === 'stone') facts.push({ label: 'Tarvike', value: ['Pääkaupungin rakennukset tehdään lankuista ja kivestä työmaalla'] });
  if (g === 'bread' || g === 'fish') facts.push({ label: 'Ravinto', value: [`Yksi ruokkii asukkaan päiväksi (${MEAL_FOOD} ruokaa)`] });
  const text: Segment[] = line.length > 1 ? ['Ketju: ', ...line.flatMap((x, i): Segment[] => [i ? ' → ' : '', x === g ? GOOD_NAMES[x] : goodRef(x)]), '.'] : [GOOD_NAMES[g], ' tulee suoraan maasta: ', buildRef(maker), ' tekee sen.'];
  return { key: `good/${g}`, kicker: 'Tavara', title: GOOD_NAMES[g], text, facts };
}

function advisorPage(level: AdvisorLevel, role: string): Page {
  const people = ALL_PERSONS.filter(p => p.level === level && p.role === role);
  return {
    key: `advisor/${level}/${role}`, kicker: `Neuvonantaja · ${ADVISOR_LEVEL_NAMES[level]}`, title: ROLE_NAMES[level][role].name,
    text: [ROLE_NAMES[level][role].does],
    facts: people.map(p => ({ label: ERA_NAMES[p.era], value: [personRef(p), `: ${describeBonus(level, p.bonus)}`] })),
  };
}

/** What each era is like, after how it begins (own, STORY-120). */
const ERA_TEXT: Record<Era, string> = {
  early: 'Kaupunkien tarinat kerrotaan nuotioilla lauluina.',
  iron: 'Kirjurit pitävät aikakirjaa, ja kaupunkien vaiheet kirjataan päivältä päivälle.',
  medieval: 'Luostarien kronikoitsijat kirjaavat kaupunkien vaiheet, ja muurit ja linnat suojaavat kansaa.',
  renaissance: 'Kirjapainot levittävät historiaa, ja purjelaivat kulkevat valtamerten yli.',
  industrial: 'Tehtaat ja rautatiet muuttavat kaupungit, ja sanomalehdet kertovat niiden elämästä.',
  modern: 'Radio kertoo uutiset, ja koneet kulkevat maalla ja ilmassa.',
  atomic: 'Atomin voima on kansan käsissä, ja kaupunkien vaiheet tallentuvat arkistoihin.',
};

function eraPage(e: Era): Page {
  const people = ALL_PERSONS.filter(p => p.era === e);
  const key = ERA_KEYS[e];
  const begins: Segment[] = e === 'early' ? ['Pelin alku. ']
    : key ? ['Alkaa, kun kansa keksii ', advanceRef(key), '. ']
    : ['Aikakauden keksinnöt tulevat peliin myöhemmin. '];
  const advances = ADVANCE_LIST.filter(a => ADVANCE_ERA[a] === e);
  const facts: Page['facts'] = [];
  if (advances.length) facts.push({ label: 'Keksinnöt', value: list(advances.map(a => advanceRef(a))) });
  facts.push({ label: 'Neuvonantajat', value: list(people.map(personRef)) });
  return {
    key: `era/${e}`, kicker: 'Aikakausi', title: ERA_NAMES[e],
    text: [...begins, ERA_TEXT[e], ' Neuvonantajina ovat aikakauden henkilöt omine bonuksineen.'],
    facts,
  };
}
