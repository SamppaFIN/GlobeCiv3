/**
 * leaders.ts — the nuclear war's leaders (STORY-126): ten invented caricatures, two of each
 * of the five tempers of the old game's computer leaders, with their own names, looks and
 * lines. Every name and line is our own (rule 4): none is a real person, people or country,
 * and none is a character of the model game.
 */
import type { Mishap, Profile, StrikeOutcome } from './nuclear';

export type Mood = 'calm' | 'smug' | 'angry' | 'scared' | 'fallen';

/** The look of a leader's portrait (leaderPortraits.ts). */
export interface Look {
  skin: string;
  hair: string;
  head: 'round' | 'long' | 'square';
  top: 'cap' | 'crown' | 'bald' | 'tuft' | 'bun' | 'helmet' | 'curls' | 'bowler' | 'plume' | 'topHat';
  face: ('moustache' | 'beard' | 'glasses' | 'monocle' | 'medals' | 'pearls' | 'eyepatch' | 'scarf')[];
}

export interface Persona {
  id: string;
  name: string;
  /** The leader's five cities, the capital first (own names). */
  cities: string[];
  profile: Profile;
  color: string;
  /** The gallery's line about the leader. */
  motto: string;
  look: Look;
}

/** The tempers: the five profiles of the old game's computer leaders, by our own names. */
export const TEMPERS: Record<Profile, { name: string; text: string }> = {
  0: { name: 'Kunnianhimoinen', text: 'Rakentaa ja iskee harkiten, ja käy viimeisen kaupungin kimppuun.' },
  1: { name: 'Sotilas', text: 'Ei puhu, vaan lataa. Iskee aina suurimpaan kaupunkiin.' },
  2: { name: 'Propagandisti', text: 'Houkuttelee väkeä puheillaan ja nokkii pienimpiä kaupunkeja.' },
  3: { name: 'Arvaamaton', text: 'Vaihtaa mieltään joka kierros. Kukaan ei tiedä, kuka on seuraava.' },
  4: { name: 'Oikukas', text: 'Puhuu ja pommittaa vuorotellen, kohde arvalla.' },
};

export const PERSONAS: Persona[] = [
  { id: 'paukku', name: 'Presidentti Paukku', cities: ['Paukkula', 'Jysäys', 'Kolinamäki', 'Räminä', 'Pamausniemi'], profile: 0, color: '#e0a458', motto: 'Lupaa suuria ja pitää kovaa ääntä.',
    look: { skin: '#f0c9a0', hair: '#9a9a9a', head: 'round', top: 'bowler', face: ['moustache', 'medals'] } },
  { id: 'ukonvaaja', name: 'Puheenjohtaja Ukonvaaja', cities: ['Ukkosvaara', 'Kokouskylä', 'Nuijamäki', 'Esityslista', 'Pöytäkirjala'], profile: 0, color: '#a3c46c', motto: 'Kokous jatkuu, kunnes joku painaa nappia.',
    look: { skin: '#e3b48c', hair: '#8a6a4a', head: 'round', top: 'bald', face: ['glasses', 'medals'] } },
  { id: 'ruutiparta', name: 'Kenraali Ruutiparta', cities: ['Ruutila', 'Kasarmikylä', 'Marssimaa', 'Rivistö', 'Univormula'], profile: 1, color: '#d8737f', motto: 'Parta täynnä ruutia, taskut täynnä ohjuksia.',
    look: { skin: '#d9a07a', hair: '#5b4636', head: 'square', top: 'cap', face: ['beard', 'medals'] } },
  { id: 'rautakoura', name: 'Marsalkka Rautakoura', cities: ['Rautasatama', 'Pihtilä', 'Ruuvivaara', 'Vasaraniemi', 'Alasinkylä'], profile: 1, color: '#b98b6e', motto: 'Puristaa rauhanneuvottelut kasaan.',
    look: { skin: '#c98e68', hair: '#2b2b2b', head: 'long', top: 'helmet', face: ['moustache', 'eyepatch'] } },
  { id: 'megafoni', name: 'Ministeri Megafoni', cities: ['Megahovi', 'Kaikuniemi', 'Torvela', 'Julistusmaa', 'Lentolehtilä'], profile: 2, color: '#7fb7be', motto: 'Puhuu kovemmin kuin räjähdys.',
    look: { skin: '#f2d2b6', hair: '#a8483a', head: 'round', top: 'bun', face: ['glasses', 'pearls'] } },
  { id: 'paasaus', name: 'Puhemies Paasaus', cities: ['Puhela', 'Saarnamäki', 'Jaarittelu', 'Pitkäpuhe', 'Kuulijala'], profile: 2, color: '#8fa8d8', motto: 'Puhe kestää, kunnes kuulijat loikkaavat.',
    look: { skin: '#b97f5a', hair: '#cfcfcf', head: 'long', top: 'bald', face: ['moustache', 'scarf'] } },
  { id: 'arpanen', name: 'Diktaattori Arpanen', cities: ['Arpakylä', 'Noppaniemi', 'Sattumala', 'Kolikkovaara', 'Ehkälä'], profile: 3, color: '#c79bd8', motto: 'Päättää asiat nopalla, joskus kahdella.',
    look: { skin: '#e8bc94', hair: '#c94f2e', head: 'round', top: 'tuft', face: ['glasses', 'medals'] } },
  { id: 'tuuliviiri', name: 'Tohtori Tuuliviiri', cities: ['Tuuliranta', 'Viirimäki', 'Pyörremaa', 'Mielijohde', 'Käänteenkylä'], profile: 3, color: '#9ccfa0', motto: 'Aamulla rauha, illalla raketit.',
    look: { skin: '#f4dcc4', hair: '#f2f2f2', head: 'long', top: 'curls', face: ['monocle'] } },
  { id: 'kuura', name: 'Kuningatar Kuura', cities: ['Kuuralinna', 'Huurrevaara', 'Jääpalatsi', 'Kristallikylä', 'Talvihovi'], profile: 4, color: '#d9d0f5', motto: 'Hymyilee kylmästi ja kruunaa itsensä uudelleen.',
    look: { skin: '#f6e2d2', hair: '#e9e4f7', head: 'long', top: 'crown', face: ['pearls'] } },
  { id: 'poyhkea', name: 'Arkkiherttua Pöyhkeä', cities: ['Mahtimäki', 'Kultasali', 'Pöyhkeälä', 'Komeusniemi', 'Ylväslinna'], profile: 4, color: '#e6c36a', motto: 'Palatsi joka kaupungissa, ja kaksi pääkaupungissa.',
    look: { skin: '#a8714f', hair: '#3b2b20', head: 'square', top: 'plume', face: ['beard', 'medals'] } },
];

/** The player's own leader. */
export const PLAYER_PERSONA: Persona = {
  id: 'sina', name: 'Sinä', cities: ['Kotiniemi', 'Omamaa', 'Tupala', 'Kotoranta', 'Pihapiiri'], profile: 0, color: '#d2cefd', motto: 'Viides johtaja. Päätä itse, kuka olet.',
  look: { skin: '#ecc7a4', hair: '#6b4a32', head: 'round', top: 'topHat', face: [] },
};

export const personaOf = (id: string): Persona => (id === PLAYER_PERSONA.id ? PLAYER_PERSONA : PERSONAS.find(p => p.id === id) ?? PLAYER_PERSONA);

/** What a leader may say: the situation of its own act or of what befell it. */
export type Say = 'build' | 'propaganda' | 'load' | 'strike' | 'hit' | 'struck' | 'defend' | 'fall' | 'win';

/** Lines by temper and situation, three or more each. */
const LINES: Record<Profile, Record<Say, string[]>> = {
  0: {
    build: ['Tehtaat, vauhtia! Historia odottaa.', 'Rakennamme tulevaisuutta. Räjähtävää tulevaisuutta.', 'Uusi tehdas, uusi aikakausi, uusi minä.'],
    propaganda: ['Tulkaa meille, täällä on paremmat juhlat.', 'Kansani rakastaa minua. Pian teidänkin.', 'Lentolehtisiä! Paljon lentolehtisiä!'],
    load: ['Ohjus on vain varmuuden vuoksi. Ehkä.', 'Laitetaan kärki valmiiksi, ihan muodon vuoksi.', 'Ladattu ja kiillotettu.'],
    strike: ['Tämä on historiallinen hetki. Minun hetkeni.', 'Lähetän terveiseni. Isoina.', 'Sanoin, että pidän kovaa ääntä.'],
    hit: ['Kuulitteko? Se olin minä.', 'Juuri kuten suunnittelin. Melkein.', 'Painakaa tämä historiankirjoihin.'],
    struck: ['Tämä ei jää tähän!', 'Kuka uskaltaa?', 'Olin juuri pitämässä puhetta!'],
    defend: ['Kilpi ylös, leuka ylös.', 'Meitä ei yllätetä kahdesti.', 'Puolustus on paras hyökkäys. Tai toisin päin.'],
    fall: ['Muistakaa minut suurena.', 'Tämä oli vasta luonnos!', 'Patsaani jäävät.'],
    win: ['Kuten kerroin: suurin voittaa.', 'Voitto! Kutsukaa kaikki juhliin. Siis kaikki jäljellä olevat.', 'Historia on kirjoitettu. Minä kirjoitin sen.'],
  },
  1: {
    build: ['Lisää rautaa.', 'Tehtaat yötöihin.', 'Varastot täyteen. Sitten toinen varasto.'],
    propaganda: ['Liittykää armeijaan. Tai muuten.', 'Meillä on univormuja kaikille.', 'Marssikaa tänne. Yksi, kaksi.'],
    load: ['Lataa.', 'Kärki paikalleen. Ruuvi kiinni.', 'Valmiina käskystä.'],
    strike: ['Tulta!', 'Kohde lukittu.', 'Ei neuvotteluja.'],
    hit: ['Osuma. Seuraava.', 'Raportti: kaupunki pienempi.', 'Kuten harjoiteltiin.'],
    struck: ['Vastaisku valmisteltu.', 'Tuo oli virhe.', 'Merkitty muistiin. Punaisella.'],
    defend: ['Ilmatorjunta valmiina.', 'Kypärät päähän.', 'Taivas on minun.'],
    fall: ['Peräännytään… ikuisesti.', 'Kunnialla kaaduin.', 'Kuka unohti torjunnan?'],
    win: ['Tehtävä suoritettu.', 'Viimeinen seisoo. Minä.', 'Lepo. Kaksi minuuttia.'],
  },
  2: {
    build: ['Rakennamme myös toivoa. Ja ohjuksia.', 'Tehdas on kaunis kuin julistus.', 'Jokainen tehdas on puhe ilman sanoja.'],
    propaganda: ['Kuunnelkaa minua. Kuunnelkaa vielä.', 'Meillä on parempi musiikki!', 'Totuus on se, jonka sanon kovimmin.'],
    load: ['Ohjus on vain hyvin pitkä argumentti.', 'Valmistelen loppukaneettia.', 'Puheen jälkeen tulee pamaus.'],
    strike: ['Tämä on viestini, kirjaimin ja megatonnein.', 'Kun sanat loppuvat…', 'Kuuluuko nyt?'],
    hit: ['Viesti perillä.', 'Sen he kuulivat.', 'Eikö ollutkin vakuuttavaa?'],
    struck: ['Valheellista uutisointia!', 'Tämä menee lehteen. Minun lehteeni.', 'Vaadin vastinetta!'],
    defend: ['Torjun kaikki väitteet. Ja ohjukset.', 'Ei kommenttia. Ei osumia.', 'Suojaan kuulijani.'],
    fall: ['Puheeni jää kesken…', 'Kuka sammutti mikrofonin?', 'Kirjoittakaa, että olin oikeassa.'],
    win: ['Ja yleisö taputtaa. Kaikki yksi.', 'Viimeinen puheenvuoro on minun.', 'Sanoinhan!'],
  },
  3: {
    build: ['Rakennetaan jotain. En tiedä vielä mitä.', 'Tänään tehtaita, huomenna ehkä lampaita.', 'Arpa sanoi: tehtaat.'],
    propaganda: ['Tulkaa tai älkää, kumpikin käy.', 'Meillä on hassuin hallitus. Tiedän sen.', 'Kuulin, että täällä on mukavaa. Minä sen sanoin.'],
    load: ['Lataan, koska nappi oli punainen.', 'Ohjus, ohjus, kuka on seuraava?', 'Heitin kolikkoa. Se laskeutui reunalleen.'],
    strike: ['Ups. Tai siis: tahallaan!', 'Ilmoitan sodan. Tai juhlat. Molemmat!', 'Arpa valitsi teidät!'],
    hit: ['Hih.', 'Tuliko se perille? Kiva!', 'Seuraavaksi joku muu. Tai sama.'],
    struck: ['Hei, minähän pidin teistä!', 'Muutin mieleni teidän suhteenne.', 'Nyt suutuin. Vähän aikaa.'],
    defend: ['Varjo! Ei kun torjunta.', 'Suojaan itseni. Ja kissani.', 'Vähän aikaa olen varovainen.'],
    fall: ['No niin. Tämäkin kokeiltu.', 'Seuraavaksi kokeilen kuolemattomuutta.', 'Arpa petti.'],
    win: ['Voitin? Mitä pelattiin?', 'Kaikki meni suunnitelmien mukaan, joita ei ollut.', 'Juhlat! Kenellä on kakku?'],
  },
  4: {
    build: ['Rakentakaa minulle jotain kiiltävää.', 'Palatsin viereen tehdas. Kauniin tehdas.', 'Hovi tarvitsee lisää leluja.'],
    propaganda: ['Alamaiset, tulkaa ihailemaan minua.', 'Olen kaunein johtaja. Myönnätte sen kyllä.', 'Kruunun alla on tilaa kaikille.'],
    load: ['Kultainen ohjus, kiitos.', 'Valmistelkaa yllätys. Koristeltu.', 'Ladatkaa ja kiillottakaa.'],
    strike: ['Kuninkaallinen tervehdys!', 'Tämä on lahja. Pitäkää se.', 'Tottele tai tunne.'],
    hit: ['Ihastuttavaa.', 'Hovi taputtaa.', 'Kirjatkaa se aikakirjoihin kultaisin kirjaimin.'],
    struck: ['Miten kehtaatte!', 'Kruununi vinossa!', 'Siitä tulee kuninkaallinen kosto.'],
    defend: ['Vartijat, muuri pystyyn!', 'Kukaan ei koske kruunuun.', 'Kuninkaallinen sateenvarjo.'],
    fall: ['Kruunu putoaa…', 'Hovi, pakatkaa laukut.', 'Sentään kauniisti.'],
    win: ['Luonnollisesti.', 'Valtaistuin on yhä lämmin.', 'Kumartakaa. Kaikki, jotka vielä voitte.'],
  },
};

/** The narrator's words for the oddities of propaganda, two or more each. */
const MISHAPS: Record<Mishap, string[]> = {
  vanish: ['Kaupunki lähti lomalle eikä palannut.', 'Kaupunki katosi kartalta. Kukaan ei tiedä minne.'],
  weight: ['Taivaalta putosi valtava paino suoraan kaupungin päälle.', 'Jättimäinen punnus. Mistä se edes tuli?'],
  ufo: ['Lentävä lautanen toi kaupunkiin yhtä paljon väkeä lisää.', 'Avaruusolennot muuttivat suurimpaan kaupunkiin.'],
  boom: ['Propaganda vetosi lähinnä pariskuntiin: vauvabuumi!', 'Puhe oli niin romanttinen, että syntyvyys nousi.'],
  cow: ['Raivostunut lehmä talloi kaupungin halki.', 'Lehmä. Iso lehmä. Kukaan ei halua puhua siitä.'],
  quake: ['Maa järisi, ja kaupunki vajosi.', 'Maanjäristys nielaisi kokonaisen kaupungin.'],
  fallout: ['Laskeuma levisi joka kaupunkiin.', 'Tuuli kääntyi, ja säteily tuli kotiin.'],
  exodus: ['Väki kyllästyi puheisiin ja muutti muualle.', 'Muuttoaalto vei väkeä naapuriin.'],
  defect: ['Propaganda kääntyi itseään vastaan: väki loikkasi kohteen puolelle.', 'Puhe oli niin huono, että omat loikkasivat vastapuolelle.'],
};

/** The narrator's words for how a strike ended. */
const OUTCOMES: Record<StrikeOutcome, string[]> = {
  hit: ['Osuma.', 'Täysosuma.'],
  dud: ['Ohjus ei räjähtänyt. Se vain makaa kadulla.', 'Suutari: kärki ei lauennut.'],
  crash: ['Pommikone putosi matkalla.', 'Pommikone syöksyi peltoon. Miehistö pelastui, kone ei.'],
  miss: ['Ohi meni.', 'Isku osui tyhjälle pellolle.'],
  stopped: ['Torjunta pysäytti iskun.', 'Isku torjuttiin ilmassa.'],
  ruins: ['Isku osui raunioihin. Siellä ei ollut enää ketään.', 'Kaupunki oli jo tyhjä.'],
};

/** A choice that is the same for the same war, round and event, without touching the war's own random (rule 7). */
export function choose<T>(list: readonly T[], ...keys: (number | string)[]): T {
  let h = 2166136261;
  for (const k of keys.join('|')) h = Math.imul(h ^ k.charCodeAt(0), 16777619);
  return list[(h >>> 0) % list.length];
}

export const lineOf = (profile: Profile, say: Say, ...keys: (number | string)[]) => choose(LINES[profile][say], say, ...keys);
export const mishapText = (m: Mishap, ...keys: (number | string)[]) => choose(MISHAPS[m], m, ...keys);
export const outcomeText = (o: StrikeOutcome, ...keys: (number | string)[]) => choose(OUTCOMES[o], o, ...keys);
export const allLines = () => ({ LINES, MISHAPS, OUTCOMES });
