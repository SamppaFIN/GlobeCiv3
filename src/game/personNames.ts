/**
 * personNames.ts — the given names of a new game's characters (STORY-102).
 *
 * Own list: given names from Finnish folk poetry (the Kalevala's people, public domain) and old
 * Finnish given names. A unit's name is its kind and a given name, worked out from the game's
 * seed and the unit's id (rule 3), so the same seed and the same commands give the same names.
 */

export const GIVEN_NAMES: readonly string[] = [
  'Aino', 'Ilmari', 'Kalervo', 'Kullervo', 'Väinö', 'Tuulikki', 'Kyllikki', 'Annikki', 'Marjatta', 'Untamo',
  'Joukahainen', 'Ahti', 'Tellervo', 'Mielikki', 'Nyyrikki', 'Kauko', 'Osmo', 'Kaleva', 'Sampsa', 'Tiera',
  'Kimmo', 'Vellamo', 'Suvetar', 'Tapio', 'Lalli', 'Kerttu', 'Elina', 'Helka', 'Iivo', 'Jalo',
  'Kari', 'Lahja', 'Lempi', 'Martta', 'Oiva', 'Pirkko', 'Rauha', 'Saimi', 'Taimi', 'Toivo',
  'Tyyne', 'Urho', 'Vappu', 'Veikko', 'Viena', 'Aarni', 'Aaro', 'Eero', 'Hilja', 'Ilona',
  'Kaino', 'Lauri', 'Niilo', 'Onni', 'Orvokki', 'Paavo', 'Rauni', 'Senja', 'Sulo', 'Terho',
  'Unto', 'Valto', 'Vieno', 'Aili', 'Inkeri', 'Kirsti', 'Lyyli', 'Martti', 'Olli', 'Salme',
  'Tahvo', 'Tuomas', 'Hellä', 'Siiri', 'Ensio', 'Impi', 'Arvo', 'Kielo', 'Esko', 'Hanna',
];

/** An integer hash of the seed and an id (own, a multiply-xorshift mix). */
function mix(seed: number, id: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(id + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/**
 * The given name for a character: from the seed and its id, the next free one when the name is
 * taken by a living character. Past the list's end a name repeats with "II", "III".
 */
export function givenName(seed: number, id: number, taken: ReadonlySet<string>): string {
  const start = mix(seed, id) % GIVEN_NAMES.length;
  for (let round = 1; ; round++) {
    for (let k = 0; k < GIVEN_NAMES.length; k++) {
      const name = GIVEN_NAMES[(start + k) % GIVEN_NAMES.length] + (round === 1 ? '' : ` ${'I'.repeat(round)}`);
      if (!taken.has(name)) return name;
    }
  }
}
