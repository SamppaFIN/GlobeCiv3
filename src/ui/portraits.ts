/**
 * portraits.ts — the advisors' faces (STORY-105; Sami 2026-11-21: own SVG portraits). Own
 * drawing, put together from parts in the Kartografi look: the face, hair and beard come from
 * the person, the era gives the clothes and the headwear (HEADWEAR, seven eras), and the role an
 * object in a badge.
 * Nothing is stored: the same person always gets the same face. The strings are built only from
 * the constants below, never from text a save or a player gave.
 */
import type { Person } from '../game/persons';

const SKIN = ['#e8c4a0', '#d6a77e', '#b9825c', '#8d5a3b'];
const HAIR = ['#e2c27a', '#9a6a3c', '#4a3324', '#2a211c', '#b0532c', '#b8b4ac'];
/** The era's cloth and its trim. */
const CLOTH: Record<Person['era'], [string, string]> = {
  early: ['#6f6a4a', '#a59869'], iron: ['#3e5672', '#b8c2cf'], medieval: ['#6a3b3b', '#c9a94a'], renaissance: ['#2f4a3a', '#e8dcc0'],
  industrial: ['#2a2f45', '#b0532c'], modern: ['#5a5a3c', '#9a9a7a'], atomic: ['#3d4a5c', '#7fd0e0'],
};
const INK = '#2a2620';

/** An integer hash of the person's id (own, FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** The role's object, drawn in a 14 px badge at the bottom right. */
const PROPS: Record<string, string> = {
  // A hammer
  build: '<path d="M38 36 L44 42" stroke="#e9e9ed" stroke-width="1.6"/><rect x="34.5" y="33" width="6" height="3.2" rx="0.6" transform="rotate(45 37.5 34.6)" fill="#e9e9ed"/>',
  // A loaf
  feed: '<ellipse cx="40" cy="40" rx="4.6" ry="3" fill="#e2b46a"/><path d="M37.6 38.6 L38.6 41.4 M40 38.2 L41 41 M42.3 38.6 L43 40.8" stroke="#8a5a2a" stroke-width="0.8"/>',
  // A path with footsteps
  roam: '<path d="M36 44 Q40 39 44 36" stroke="#e9e9ed" stroke-width="1.2" fill="none" stroke-dasharray="1.6 1.4"/>',
  // An ear of grain
  growth: '<path d="M40 45 L40 35" stroke="#e2c27a" stroke-width="1"/><path d="M40 37 l-2 -1.5 M40 37 l2 -1.5 M40 39.5 l-2 -1.5 M40 39.5 l2 -1.5 M40 42 l-2 -1.5 M40 42 l2 -1.5" stroke="#e2c27a" stroke-width="1"/>',
  // A folded map
  explore: '<path d="M35.5 37 L38.5 35.8 L41.5 37 L44.5 35.8 L44.5 43 L41.5 44.2 L38.5 43 L35.5 44.2 Z" fill="#d9cfa8" stroke="#8a7a4a" stroke-width="0.6"/><path d="M38.5 35.8 V43 M41.5 37 V44.2" stroke="#8a7a4a" stroke-width="0.6"/>',
  // A round shield
  defend: '<circle cx="40" cy="40" r="4.4" fill="#8c5a32" stroke="#e9e9ed" stroke-width="0.9"/><circle cx="40" cy="40" r="1.2" fill="#e9e9ed"/>',
  // A house
  settle: '<path d="M36 41 L40 37 L44 41 V44.5 H36 Z" fill="#d9c38a" stroke="#6a5a3a" stroke-width="0.6"/>',
  // A banner
  expand: '<path d="M37 45 V35" stroke="#e9e9ed" stroke-width="1"/><path d="M37 35.5 H44 L42.4 37.8 L44 40 H37" fill="#b5abfc"/>',
  // An open book
  science: '<path d="M35.5 37 Q38 36 40 37.4 Q42 36 44.5 37 V43.4 Q42 42.4 40 43.8 Q38 42.4 35.5 43.4 Z" fill="#efe9d8" stroke="#8a7a4a" stroke-width="0.6"/><path d="M40 37.4 V43.8" stroke="#8a7a4a" stroke-width="0.6"/>',
  // A spear
  war: '<path d="M36 44 L43.5 36.5" stroke="#c9a27a" stroke-width="1.1"/><path d="M43.5 36.5 L45 35 L44.6 37.4 Z" fill="#e9e9ed" stroke="#e9e9ed" stroke-width="0.6"/>',
  // A sword
  conquer: '<path d="M36.5 43.5 L43.5 36.5" stroke="#e9e9ed" stroke-width="1.3"/><path d="M37 40.5 L39.5 43" stroke="#c9a27a" stroke-width="1.2"/>',
  // A wall
  fortify: '<path d="M35.5 38 H44.5 V44.5 H35.5 Z" fill="#a59869"/><path d="M35.5 38 V36.4 H37.3 V38 M38.9 38 V36.4 H41 V38 M42.7 38 V36.4 H44.5 V38" fill="#a59869" stroke="#6a5a3a" stroke-width="0.5"/>',
};
/** Explore of the planet sails, of the city area and the province walks with a map. */
const SHIP = '<path d="M35.5 41.5 H44.5 L43 44 H37 Z" fill="#8c5a32"/><path d="M40 41 V35.5 L44 40.5 Z" fill="#efe9d8"/>';

/**
 * Each era's headwear, [a soldier's, the others'], drawn over the hair (own drawing): the early
 * age a hood or a woollen band, the iron age a helmet or a circlet, the middle ages a kettle hat
 * or a hood, the new age a crested helmet or a feathered beret, the industrial age a peaked cap
 * or a top hat, the modern age a steel helmet or a flat cap, the atomic age a visored helmet or
 * a headset (STORY-120).
 */
const HEADWEAR: Record<Person['era'], [(cloth: string, trim: string) => string, (cloth: string, trim: string) => string]> = {
  early: [
    cloth => `<path d="M14.5 21 Q14 7.5 24 7.5 Q34 7.5 33.5 21 Q31 12.5 24 12.5 Q17 12.5 14.5 21 Z" fill="${cloth}" stroke="${INK}" stroke-width="0.6"/>`,
    (_, trim) => `<path d="M15.2 15.6 Q24 12.4 32.8 15.6" stroke="${trim}" stroke-width="1.6" fill="none"/>`,
  ],
  iron: [
    () => `<path d="M14.6 18.5 Q14.6 7.2 24 7.2 Q33.4 7.2 33.4 18.5 Z" fill="#9aa3ad" stroke="${INK}" stroke-width="0.6"/><path d="M24 18.5 V23" stroke="#9aa3ad" stroke-width="1.6"/>`,
    () => `<path d="M15.2 15.2 Q24 12.2 32.8 15.2" stroke="#c9a94a" stroke-width="1.3" fill="none"/><circle cx="24" cy="13.3" r="1" fill="#b5abfc"/>`,
  ],
  medieval: [
    () => `<path d="M15 18 Q15 8.2 24 8.2 Q33 8.2 33 18 Z" fill="#8a929c" stroke="${INK}" stroke-width="0.6"/><path d="M11.5 18.3 H36.5" stroke="#8a929c" stroke-width="2.2" stroke-linecap="round"/>`,
    cloth => `<path d="M13.5 31 Q12 7 24 7 Q36 7 34.5 31 L32 31 Q33 13 24 12.5 Q15 13 16 31 Z" fill="${cloth}" stroke="${INK}" stroke-width="0.6"/>`,
  ],
  renaissance: [
    () => `<path d="M14.5 17 Q16 8 24 7.5 Q32 8 33.5 17 Z" fill="#a0a8b2" stroke="${INK}" stroke-width="0.6"/><path d="M11.5 17.6 Q24 14 36.5 17.6" stroke="#a0a8b2" stroke-width="1.8" fill="none"/><path d="M20 8.5 Q24 3.8 28 8.5" stroke="#a0a8b2" stroke-width="2.2" fill="none"/>`,
    cloth => `<ellipse cx="22.5" cy="12" rx="10.5" ry="3.8" fill="${cloth}" stroke="${INK}" stroke-width="0.6"/><path d="M29 10.6 Q34.5 4.5 38 6.2" stroke="#efe9d8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  ],
  industrial: [
    (cloth, trim) => `<path d="M16 15.8 L17 7.6 H31 L32 15.8 Z" fill="${cloth}" stroke="${INK}" stroke-width="0.6"/><path d="M16.6 13 H31.4" stroke="${trim}" stroke-width="1.2"/><path d="M15 16 H33" stroke="#1a1c24" stroke-width="1.8" stroke-linecap="round"/>`,
    (_, trim) => `<rect x="17" y="3.6" width="14" height="10" fill="#1d1d22"/><rect x="17" y="10.6" width="14" height="1.6" fill="${trim}"/><path d="M13 13.8 H35" stroke="#1d1d22" stroke-width="2" stroke-linecap="round"/>`,
  ],
  modern: [
    () => `<path d="M14.5 17 Q15 8.5 24 8.5 Q33 8.5 33.5 17 Z" fill="#5f6b4a" stroke="${INK}" stroke-width="0.6"/><path d="M11.5 17.2 Q24 19.6 36.5 17.2" stroke="#5f6b4a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    () => `<path d="M15 15.5 Q16 9 24 9 Q32 9 33 15.5 Z" fill="#6b5a44" stroke="${INK}" stroke-width="0.6"/><path d="M14 15.6 Q20 18.2 27 16.2" stroke="#6b5a44" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  ],
  atomic: [
    (_, trim) => `<path d="M14.5 19 Q14.5 7.5 24 7.5 Q33.5 7.5 33.5 19 Z" fill="#4a5462" stroke="${INK}" stroke-width="0.6"/><path d="M16.5 15.6 H31.5 V18.6 H16.5 Z" fill="${trim}" opacity="0.6"/>`,
    () => `<path d="M15 20 Q15 9 24 9 Q33 9 33 20" stroke="#cfd6de" stroke-width="1.4" fill="none"/><rect x="13.2" y="18.5" width="3" height="5" rx="1.2" fill="#cfd6de"/><rect x="31.8" y="18.5" width="3" height="5" rx="1.2" fill="#cfd6de"/><path d="M15 23 Q16.5 28 21 27.6" stroke="#cfd6de" stroke-width="0.9" fill="none"/>`,
  ],
};

/** A person's portrait as an SVG string, `size` pixels wide; decorative (aria-hidden). */
export function portraitSvg(p: Person, size = 44): string {
  const h = hash(p.id);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const style = (h >>> 7) % 4;
  const beard = ((h >>> 10) & 3) === 0;
  const [cloth, trim] = CLOTH[p.era];
  const soldier = p.role === 'war' || p.role === 'conquer' || p.role === 'defend' || p.role === 'fortify';
  const hairPath = [
    // Short
    `<path d="M15 20 Q15 9.5 24 9.5 Q33 9.5 33 20 Q31 14 24 14 Q17 14 15 20 Z" fill="${hair}"/>`,
    // Long at the sides
    `<path d="M14.5 27 Q13.5 9.5 24 9.5 Q34.5 9.5 33.5 27 L31.5 27 Q32 15 24 14.5 Q16 15 16.5 27 Z" fill="${hair}"/>`,
    // A bun
    `<circle cx="24" cy="8.6" r="3.4" fill="${hair}"/><path d="M15 19 Q15 10 24 10 Q33 10 33 19 Q30 14 24 14 Q18 14 15 19 Z" fill="${hair}"/>`,
    // A braid
    `<path d="M15 20 Q15 9.5 24 9.5 Q33 9.5 33 20 Q31 14 24 14 Q17 14 15 20 Z" fill="${hair}"/><path d="M31 19 Q34 26 31.5 32" stroke="${hair}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  ][style];
  const headwear = HEADWEAR[p.era][soldier ? 0 : 1](cloth, trim);
  const prop = p.level === 'planet' && p.role === 'explore' ? SHIP : PROPS[p.role] ?? '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
    + `<circle cx="24" cy="24" r="23" fill="#2b2d3d"/>`
    + `<clipPath id="pc-${h}"><circle cx="24" cy="24" r="23"/></clipPath><g clip-path="url(#pc-${h})">`
    // Shoulders, a collar of the era's trim
    + `<path d="M6 48 Q7 33.5 24 32 Q41 33.5 42 48 Z" fill="${cloth}" stroke="${INK}" stroke-width="0.7"/>`
    + `<path d="M18 33 Q24 37.5 30 33" stroke="${trim}" stroke-width="1.4" fill="none"/>`
    + `<rect x="21" y="27" width="6" height="6" fill="${skin}"/>`
    + `<ellipse cx="24" cy="20.5" rx="8.6" ry="10" fill="${skin}" stroke="${INK}" stroke-width="0.6"/>`
    + hairPath
    + (beard ? `<path d="M16.2 22.5 Q17 31.5 24 32 Q31 31.5 31.8 22.5 Q29 27 24 27.4 Q19 27 16.2 22.5 Z" fill="${hair}"/>` : '')
    + `<circle cx="20.6" cy="20.6" r="0.95" fill="${INK}"/><circle cx="27.4" cy="20.6" r="0.95" fill="${INK}"/>`
    + `<path d="M21.6 ${beard ? 26 : 25.4} Q24 ${beard ? 27 : 26.6} 26.4 ${beard ? 26 : 25.4}" stroke="${INK}" stroke-width="0.8" fill="none" stroke-linecap="round"/>`
    + headwear
    + `</g>`
    // The role's badge
    + `<circle cx="40" cy="40" r="7" fill="#161826" stroke="#b5abfc" stroke-width="0.8"/>`
    + prop
    + `</svg>`;
}

/** The player's own hand: a hand instead of a face. */
export function ownHandSvg(size = 44): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
    + `<circle cx="24" cy="24" r="23" fill="#2b2d3d"/>`
    + `<path d="M17 34 V22 Q17 20 19 20 Q21 20 21 22 V18 Q21 16 23 16 Q25 16 25 18 V17 Q25 15 27 15 Q29 15 29 17 V19 Q29 17.5 31 17.5 Q33 17.5 33 19.5 V30 Q33 37 26 37 H22 Q17 37 17 34 Z" fill="none" stroke="#e9e9ed" stroke-width="1.6" stroke-linejoin="round"/>`
    + `</svg>`;
}
