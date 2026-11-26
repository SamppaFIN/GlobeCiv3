/**
 * advanceArt.ts — a picture for each advance (STORY-109; Sami 2026-11-22: the sciences get an
 * image). Own drawing in the Kartografi look: an ink-lined object on a round plate of the night
 * blue, with the colour of its stuff (clay, bronze, iron, gold, stone). The strings are built
 * only from the constants below, never from text a save or a player gave.
 */
import type { Advance } from '../game/science';

const INK = '#d8cbab';
const DARK = '#2a2620';
const PLATE = '#232532';
const CLAY = '#b8693f';
const SAND = '#c99a6a';
const PARCH = '#efe9d8';
const BRONZE = '#c08a4a';
const IRON = '#9aa3ad';
const GOLD = '#e2c27a';
const STONE = '#a59a86';
const GRASS = '#6f9a5a';
const SEA = '#4a7fa6';
const FIRE = '#e0873a';
const WOOD = '#8c5a32';
const ACCENT = '#b5abfc';

/** Each advance's object, drawn in a 64 × 64 box over the plate. */
const ART: Record<Advance, string> = {
  // A clay tablet with rows of invented signs
  alphabet: `<rect x="18" y="13" width="28" height="38" rx="4" fill="${SAND}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M23 20 L26 25 L29 20 M33 20 V25 M31 22.5 H35 M39 20 A2.5 2.5 0 1 0 39.01 20" stroke="${DARK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M23 31 L25 34 L27 31 L29 34 M33 31 H38 M35.5 31 V36 M41 31 L41 36 L39 36" stroke="${DARK}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M23 42 H28 M25.5 42 V46 M32 41 A2.2 2.2 0 1 1 32.01 41 M37 46 L39 42 L41 46 Z" stroke="${DARK}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // A scroll with lines and a reed pen
  writing: `<path d="M14 20 H44 V46 H14 Z" fill="${PARCH}" stroke="${INK}" stroke-width="1.1"/>
    <rect x="12" y="17" width="4" height="32" rx="2" fill="${WOOD}"/><rect x="42" y="17" width="4" height="32" rx="2" fill="${WOOD}"/>
    <path d="M19 26 H38 M19 31 H36 M19 36 H38 M19 41 H30" stroke="${DARK}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M52 12 L34 40" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/><path d="M34 40 L33 43.5 L35.6 41.2 Z" fill="${DARK}"/>`,
  // An ingot of the bronze age's oxhide shape and a hammer
  bronze: `<path d="M16 34 Q22 36 22 30 Q32 33 42 30 Q42 36 48 34 L46 46 Q40 44 40 49 Q32 46 24 49 Q24 44 18 46 Z" fill="${BRONZE}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M22 38 Q32 40 42 38" stroke="${GOLD}" stroke-width="1" fill="none" opacity="0.8"/>
    <path d="M24 26 L44 12" stroke="${WOOD}" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="38" y="7" width="12" height="7" rx="1.2" transform="rotate(-35 44 10.5)" fill="${IRON}" stroke="${INK}" stroke-width="0.8"/>`,
  // A sword over the bloom's fire
  iron: `<path d="M20 50 Q18 40 25 34 Q24 42 29 44 Q28 36 33 30 Q34 38 38 40 Q40 35 44 34 Q46 42 44 50 Z" fill="${FIRE}" opacity="0.9"/>
    <path d="M32 9 L35 13 V40 H29 V13 Z" fill="${IRON}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M32 13 V39" stroke="${PARCH}" stroke-width="0.8" opacity="0.7"/>
    <rect x="23" y="40" width="18" height="3.4" rx="1.2" fill="${GOLD}"/><rect x="30.4" y="43.4" width="3.2" height="8" fill="${WOOD}"/><circle cx="32" cy="53.2" r="2" fill="${GOLD}"/>`,
  // A burial mound, a standing stone and a flame under the stars
  ceremonial: `<path d="M8 48 Q32 22 56 48 Z" fill="${GRASS}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M28 48 V36 Q32 32 36 36 V48" fill="${DARK}" stroke="${INK}" stroke-width="1"/>
    <path d="M45 48 L46 30 L50 29 L51 48 Z" fill="${STONE}" stroke="${INK}" stroke-width="0.9"/>
    <path d="M17 48 V43 M17 43 Q15 40 17 37 Q19 40 17 43" stroke="${FIRE}" stroke-width="1.2" fill="${FIRE}"/>
    <circle cx="20" cy="16" r="1.2" fill="${INK}"/><circle cx="31" cy="12" r="1" fill="${INK}"/><circle cx="43" cy="17" r="1.3" fill="${INK}"/>`,
  // An amphora with a painted band
  pottery: `<path d="M27 12 H37 V16 Q37 19 40 21 Q48 27 46 38 Q44 48 35 52 H29 Q20 48 18 38 Q16 27 24 21 Q27 19 27 16 Z" fill="${CLAY}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M24 21 Q16 22 19 30 M40 21 Q48 22 45 30" stroke="${INK}" stroke-width="1.4" fill="none"/>
    <path d="M18.6 32 H45.4 M18.4 38 H45.6" stroke="${DARK}" stroke-width="1.2"/>
    <path d="M21 35 L23 33 L25 35 L27 33 L29 35 L31 33 L33 35 L35 33 L37 35 L39 33 L41 35 L43 33" stroke="${DARK}" stroke-width="0.9" fill="none"/>`,
  // A wall of stones laid in courses and a trowel
  masonry: `<g fill="${STONE}" stroke="${INK}" stroke-width="0.9">
      <rect x="12" y="38" width="12" height="7"/><rect x="24" y="38" width="12" height="7"/><rect x="36" y="38" width="12" height="7"/>
      <rect x="18" y="31" width="12" height="7"/><rect x="30" y="31" width="12" height="7"/><rect x="12" y="31" width="6" height="7"/><rect x="42" y="31" width="6" height="7"/>
      <rect x="12" y="24" width="12" height="7"/><rect x="24" y="24" width="12" height="7"/><rect x="36" y="24" width="12" height="7"/></g>
    <path d="M12 45 H52" stroke="${INK}" stroke-width="1.2"/>
    <path d="M40 18 L54 10 L50 22 Z" fill="${IRON}" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/><path d="M40 18 L35 21" stroke="${WOOD}" stroke-width="2.4" stroke-linecap="round"/>`,
  // A stack of coins and a coin with a stamped star
  currency: `<g fill="${GOLD}" stroke="${DARK}" stroke-width="0.9">
      <ellipse cx="24" cy="46" rx="10" ry="3.4"/><ellipse cx="24" cy="42" rx="10" ry="3.4"/><ellipse cx="24" cy="38" rx="10" ry="3.4"/><ellipse cx="24" cy="34" rx="10" ry="3.4"/></g>
    <circle cx="41" cy="26" r="11" fill="${GOLD}" stroke="${INK}" stroke-width="1.1"/><circle cx="41" cy="26" r="8.4" fill="none" stroke="${DARK}" stroke-width="0.8" stroke-dasharray="1.2 1.2"/>
    <path d="M41 20 L42.6 24.6 L47 24.8 L43.5 27.6 L44.8 32 L41 29.4 L37.2 32 L38.5 27.6 L35 24.8 L39.4 24.6 Z" fill="${DARK}"/>`,
  // A stone of laws with a sun disc and lines of text
  law: `<path d="M20 52 V18 Q20 9 32 9 Q44 9 44 18 V52 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.1"/>
    <circle cx="32" cy="18" r="4.4" fill="${GOLD}" stroke="${DARK}" stroke-width="0.8"/>
    <path d="M32 11.8 V13 M32 23 V24.2 M25.8 18 H27 M37 18 H38.2" stroke="${DARK}" stroke-width="0.8"/>
    <path d="M24 28 H40 M24 32 H40 M24 36 H38 M24 40 H40 M24 44 H36" stroke="${DARK}" stroke-width="1" stroke-linecap="round"/>
    <path d="M16 52 H48" stroke="${INK}" stroke-width="1.4"/>`,
  // A crown on a cushion
  monarchy: `<path d="M12 46 Q32 54 52 46 L50 40 Q32 46 14 40 Z" fill="${ACCENT}" opacity="0.85" stroke="${INK}" stroke-width="0.9"/>
    <path d="M17 38 L14 20 L23 28 L32 14 L41 28 L50 20 L47 38 Q32 42 17 38 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <circle cx="14" cy="20" r="2" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/><circle cx="32" cy="14" r="2.2" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/><circle cx="50" cy="20" r="2" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/>
    <circle cx="32" cy="32" r="2.4" fill="#b0532c"/><circle cx="23" cy="34" r="1.6" fill="${SEA}"/><circle cx="41" cy="34" r="1.6" fill="${SEA}"/>`,
  // An aqueduct of two tiers of arches with its water
  construction: `<path d="M8 20 H56" stroke="${SEA}" stroke-width="2.6"/>
    <path d="M8 22 H56 V30 H52 Q52 26 48 26 Q44 26 44 30 H40 Q40 26 36 26 Q32 26 32 30 H28 Q28 26 24 26 Q20 26 20 30 H16 Q16 26 12 26 Q8 26 8 30 Z" fill="${STONE}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M8 30 H56 V52 H50 V42 Q50 36 44 36 Q38 36 38 42 V52 H26 V42 Q26 36 20 36 Q14 36 14 42 V52 H8 Z" fill="${STONE}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M6 52 H58" stroke="${INK}" stroke-width="1.3"/>`,
  // A map with a coast, a sea and a wind rose
  mapmaking: `<path d="M10 16 L22 12 L34 16 L46 12 L54 15 V50 L42 54 L30 50 L18 54 L10 51 Z" fill="${PARCH}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M22 12 V50 M34 16 V54" stroke="${SAND}" stroke-width="0.7"/>
    <path d="M10 34 Q16 30 20 34 Q24 40 30 36 Q34 32 32 26 Q30 20 36 18 L46 14 L54 15 V50 L42 54 L30 50 L18 54 L10 51 Z" fill="${SEA}" opacity="0.75"/>
    <path d="M20 26 L20.9 28.6 L23.6 29.5 L20.9 30.4 L20 33 L19.1 30.4 L16.4 29.5 L19.1 28.6 Z" fill="${DARK}"/>
    <path d="M38 34 Q42 30 46 34 Q48 38 44 42" stroke="${PARCH}" stroke-width="0.9" fill="none" stroke-dasharray="1.6 1.6"/>`,
  // A horse's head
  horseback: `<path d="M22 52 Q20 40 24 32 Q26 26 24 20 L28 14 L30 18 Q36 14 42 20 Q48 26 50 34 Q51 38 47 39 Q43 39 40 35 Q37 33 36 36 Q36 44 40 52 Z" fill="${SAND}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M28 14 Q22 22 22 30 Q20 38 22 46" stroke="${WOOD}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="24" r="1.4" fill="${DARK}"/><path d="M46 34 Q47.6 35 47 36.6" stroke="${DARK}" stroke-width="0.9" fill="none"/>
    <path d="M36 30 L44 36 M40 26 L46 32" stroke="${DARK}" stroke-width="0.9" opacity="0.7"/>`,
  // A spoked wheel
  wheel: `<circle cx="32" cy="32" r="19" fill="none" stroke="${WOOD}" stroke-width="4.4"/><circle cx="32" cy="32" r="21.2" fill="none" stroke="${INK}" stroke-width="0.9"/>
    <circle cx="32" cy="32" r="16.8" fill="none" stroke="${INK}" stroke-width="0.7"/>
    <path d="M32 15 V49 M17.3 23.5 L46.7 40.5 M17.3 40.5 L46.7 23.5" stroke="${WOOD}" stroke-width="2.2"/>
    <circle cx="32" cy="32" r="4.6" fill="${IRON}" stroke="${INK}" stroke-width="0.9"/><circle cx="32" cy="32" r="1.4" fill="${DARK}"/>`,
  // A pair of compasses over a triangle and a circle
  mathematics: `<path d="M12 50 H50 L12 20 Z" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 45 H17 V50" fill="none" stroke="${INK}" stroke-width="0.9"/>
    <circle cx="28" cy="40" r="7" fill="none" stroke="${ACCENT}" stroke-width="1" stroke-dasharray="2 1.6"/>
    <path d="M40 10 L30 40 M40 10 L50 40" stroke="${IRON}" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="10" r="2.4" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/>
    <path d="M34 28 Q40 31 46 28" stroke="${IRON}" stroke-width="1" fill="none"/>`,
  // An eye in a triangle of rays over a smoking bowl (STORY-121)
  mysticism: `<path d="M32 10 L52 44 H12 Z" fill="none" stroke="${GOLD}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M20 32 Q32 22 44 32 Q32 42 20 32 Z" fill="${PARCH}" stroke="${INK}" stroke-width="1.1"/>
    <circle cx="32" cy="32" r="4.4" fill="${ACCENT}" stroke="${DARK}" stroke-width="0.8"/><circle cx="32" cy="32" r="1.6" fill="${DARK}"/>
    <path d="M24 48 H40 L37 54 H27 Z" fill="${BRONZE}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M29 47 Q27 44 29 41 M35 47 Q37 44 35 41" stroke="${STONE}" stroke-width="1" fill="none" opacity="0.8"/>`,
  // An open book with lines on both pages and a bookmark
  literacy: `<path d="M8 20 Q20 16 32 21 Q44 16 56 20 V48 Q44 44 32 49 Q20 44 8 48 Z" fill="${PARCH}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M32 21 V49" stroke="${INK}" stroke-width="1"/>
    <path d="M13 26 Q20 24 28 27 M13 31 Q20 29 28 32 M13 36 Q20 34 28 37 M13 41 Q20 39 26 41.5" stroke="${DARK}" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M36 27 Q44 24 51 26 M36 32 Q44 29 51 31 M36 37 Q44 34 51 36" stroke="${DARK}" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M44 18 V30 L46.5 27.5 L49 30 V17.2" fill="#b0532c" stroke="${INK}" stroke-width="0.6"/>`,
  // A pack animal with two bales and its rope
  trade: `<path d="M14 40 Q14 30 26 30 H40 Q46 30 48 24 L52 20 L55 22 L52 30 Q50 36 46 38 V40 Z" fill="${SAND}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M18 40 V52 M24 40 V52 M38 40 V52 M44 40 V52" stroke="${SAND}" stroke-width="3" stroke-linecap="round"/>
    <rect x="18" y="20" width="10" height="12" rx="1.6" fill="${CLAY}" stroke="${INK}" stroke-width="0.9"/><rect x="29" y="18" width="10" height="14" rx="1.6" fill="${WOOD}" stroke="${INK}" stroke-width="0.9"/>
    <path d="M18 26 H39" stroke="${DARK}" stroke-width="0.9"/><path d="M53 22 Q60 30 58 40" stroke="${INK}" stroke-width="0.9" fill="none"/>
    <circle cx="51" cy="23" r="0.9" fill="${DARK}"/>`,
  // A column, a scroll at its foot and a lamp of thought
  philosophy: `<path d="M22 14 H42 V18 H22 Z M24 18 H40 V48 H24 Z M20 48 H44 V52 H20 Z" fill="${STONE}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M28 20 V46 M32 20 V46 M36 20 V46" stroke="${DARK}" stroke-width="0.8" opacity="0.6"/>
    <path d="M46 40 Q48 36 52 38 Q56 40 54 44 Q50 46 46 44 Z" fill="${BRONZE}" stroke="${INK}" stroke-width="0.9"/>
    <path d="M54 38 Q56 33 53 30 Q51 34 54 38" fill="${FIRE}"/>
    <path d="M8 50 H20 V54 H8 Z" fill="${PARCH}" stroke="${INK}" stroke-width="0.8"/>`,
  // An armillary of rings round a sun, and a star
  astronomy: `<circle cx="32" cy="32" r="18" fill="none" stroke="${BRONZE}" stroke-width="2"/>
    <ellipse cx="32" cy="32" rx="18" ry="6.4" fill="none" stroke="${GOLD}" stroke-width="1.4" transform="rotate(-24 32 32)"/>
    <ellipse cx="32" cy="32" rx="6.4" ry="18" fill="none" stroke="${INK}" stroke-width="0.9" transform="rotate(-24 32 32)"/>
    <circle cx="32" cy="32" r="4.4" fill="${GOLD}" stroke="${DARK}" stroke-width="0.8"/>
    <path d="M32 50 V56 M24 56 H40" stroke="${BRONZE}" stroke-width="2" stroke-linecap="round"/>
    <path d="M50 10 L51 13 L54 14 L51 15 L50 18 L49 15 L46 14 L49 13 Z" fill="${PARCH}"/>`,
  // A stone arch over a river with a road on it
  bridges: `<path d="M6 44 Q20 40 32 46 Q44 52 58 46 V56 H6 Z" fill="${SEA}" opacity="0.8"/>
    <path d="M6 28 H58 V34 H50 Q50 46 40 46 Q32 46 32 36 Q32 46 24 46 Q14 46 14 34 H6 Z" fill="${STONE}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M6 28 H58" stroke="${SAND}" stroke-width="2.4"/>
    <path d="M10 31 H14 M22 31 H26 M38 31 H42 M50 31 H54" stroke="${DARK}" stroke-width="0.8" opacity="0.7"/>`,
  // A ballot urn with a tablet dropping in, under a columned roof
  republic: `<path d="M14 22 L32 12 L50 22 Z" fill="${STONE}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M16 22 H48 V25 H16 Z" fill="${STONE}" stroke="${INK}" stroke-width="0.8"/>
    <path d="M18 25 V50 M46 25 V50" stroke="${STONE}" stroke-width="3.2"/>
    <path d="M24 34 Q24 30 32 30 Q40 30 40 34 L38 50 H26 Z" fill="${CLAY}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M28 33 H36" stroke="${DARK}" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="30" y="24" width="4" height="7" rx="0.6" fill="${PARCH}" stroke="${INK}" stroke-width="0.6"/>
    <path d="M14 50 H50 V53 H14 Z" fill="${STONE}" stroke="${INK}" stroke-width="0.8"/>`,
};

/** The advance's picture as an SVG of `size` pixels: its object on the round plate. */
export function advanceSvg(a: Advance, size: number): string {
  return `<svg class="advance-art" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="31" fill="${PLATE}" stroke="${INK}" stroke-width="1" opacity="0.95"/>
    <g>${ART[a]}</g></svg>`;
}
