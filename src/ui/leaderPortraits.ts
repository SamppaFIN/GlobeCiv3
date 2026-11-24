/**
 * leaderPortraits.ts — the nuclear war's leaders' faces (STORY-126): own SVG caricatures in a
 * 64 px box, a big head with a big nose, the leader's headwear and trimmings, and five moods
 * (calm, smug, angry, scared, fallen) in the brows, the eyes and the mouth. None is drawn after
 * a real person. The strings are built only from the constants of leaders.ts, never from text
 * a player gave.
 */
import type { Look, Mood, Persona } from '../game/leaders';

const INK = '#2a2620';

/** The coat by temper: the soldier's olive, the propagandist's red, the others' dark. */
const COAT = ['#2f3a52', '#4a5236', '#7a2f2f', '#4a3a5c', '#5c4a2a'];

function head(look: Look): string {
  const s = `fill="${look.skin}" stroke="${INK}" stroke-width="1"`;
  const ears = `<ellipse cx="16.5" cy="32" rx="3" ry="4.2" ${s}/><ellipse cx="47.5" cy="32" rx="3" ry="4.2" ${s}/>`;
  if (look.head === 'long') return `${ears}<ellipse cx="32" cy="30" rx="14" ry="19" ${s}/>`;
  if (look.head === 'square') return `${ears}<rect x="17" y="12" width="30" height="35" rx="10" ${s}/>`;
  return `${ears}<ellipse cx="32" cy="31" rx="16" ry="17" ${s}/>`;
}

function top(look: Look): string {
  const h = `fill="${look.hair}" stroke="${INK}" stroke-width="0.8"`;
  switch (look.top) {
    case 'bald': return `<path d="M17.5 30 Q17 22 20 19" stroke="${look.hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M46.5 30 Q47 22 44 19" stroke="${look.hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M26 15.5 Q30 13.5 34 14.5" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    case 'tuft': return `<path d="M16 26 L18 14 L22 19 L24 8 L28 16 L32 6 L35 15 L40 8 L41 17 L46 12 L48 26 Q40 17 32 17 Q24 17 16 26 Z" ${h}/>`;
    case 'bun': return `<path d="M16 28 Q15 12 32 12 Q49 12 48 28 Q44 18 32 18 Q20 18 16 28 Z" ${h}/><circle cx="32" cy="8.5" r="5.5" ${h}/>`;
    case 'curls': return [20, 26, 32, 38, 44, 17, 47].map((x, i) => `<circle cx="${x}" cy="${i < 5 ? 13 + (i % 2) * 2 : 21}" r="${i < 5 ? 5 : 4.5}" ${h}/>`).join('');
    case 'cap': return `<path d="M15 21 Q15 9 32 8 Q49 9 49 21 Z" fill="#3e4a34" stroke="${INK}" stroke-width="0.8"/><path d="M12 22 Q32 17 52 22 L50 25 Q32 21 14 25 Z" fill="#2a3324" stroke="${INK}" stroke-width="0.8"/><circle cx="32" cy="15" r="2.6" fill="#c9a94a" stroke="${INK}" stroke-width="0.5"/>`;
    case 'helmet': return `<path d="M14 24 Q14 7 32 7 Q50 7 50 24 Z" fill="#6f7a5a" stroke="${INK}" stroke-width="0.9"/><path d="M11 24.5 H53" stroke="#5a6448" stroke-width="3" stroke-linecap="round"/>`;
    case 'crown': return `<path d="M16 22 Q15 14 20 13 Q32 15 44 13 Q49 14 48 22 Z" ${h}/><path d="M19 15 L21 4 L26.5 11 L32 2 L37.5 11 L43 4 L45 15 Z" fill="#e2c04a" stroke="${INK}" stroke-width="0.8"/><circle cx="32" cy="10" r="1.6" fill="#d8737f"/><circle cx="24.5" cy="12" r="1.1" fill="#7fb7be"/><circle cx="39.5" cy="12" r="1.1" fill="#7fb7be"/>`;
    case 'bowler': return `<path d="M18 19 Q18 6 32 6 Q46 6 46 19 Z" fill="#2a2620" stroke="${INK}" stroke-width="0.8"/><ellipse cx="32" cy="19.5" rx="19" ry="3.2" fill="#2a2620"/><path d="M18 16.5 H46" stroke="#8a2f2f" stroke-width="2"/>`;
    case 'plume': return `<ellipse cx="32" cy="16" rx="21" ry="5" fill="#4a2f5c" stroke="${INK}" stroke-width="0.8"/><path d="M21 15 Q21 5 32 5 Q43 5 43 15 Z" fill="#4a2f5c" stroke="${INK}" stroke-width="0.8"/><path d="M40 9 Q50 -1 56 4 Q48 4 44 12" fill="#efe9d8" stroke="${INK}" stroke-width="0.6"/>`;
    case 'topHat': return `<rect x="22" y="1" width="20" height="16" rx="1.5" fill="#2a2620"/><ellipse cx="32" cy="17.5" rx="16" ry="3" fill="#2a2620"/><path d="M22 13 H42" stroke="#b5abfc" stroke-width="2"/>`;
  }
}

/** The brows, the eyes and the mouth of a mood. */
function mood(m: Mood, look: Look): string {
  const eye = (x: number) => {
    if (m === 'fallen') return `<path d="M${x - 2.5} 28.5 l5 5 M${x + 2.5} 28.5 l-5 5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
    if (m === 'scared') return `<circle cx="${x}" cy="31" r="3.8" fill="#fff" stroke="${INK}" stroke-width="0.8"/><circle cx="${x}" cy="31" r="1.1" fill="${INK}"/>`;
    if (m === 'smug') return `<path d="M${x - 3} 31 Q${x} 29.4 ${x + 3} 31" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    return `<circle cx="${x}" cy="31" r="1.9" fill="${INK}"/>`;
  };
  const brows: Record<Mood, string> = {
    calm: '<path d="M21.5 25.5 H28.5 M35.5 25.5 H42.5"/>',
    smug: '<path d="M21.5 24 Q25 22 28.5 24.5 M35.5 26 H42.5"/>',
    angry: '<path d="M21 23.5 L28.5 27 M43 23.5 L35.5 27"/>',
    scared: '<path d="M21.5 24 Q25 20.5 28.5 23.5 M35.5 23.5 Q39 20.5 42.5 24"/>',
    fallen: '',
  };
  const mouths: Record<Mood, string> = {
    calm: `<path d="M27 42 Q32 44 37 42" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    smug: `<path d="M26 41.5 Q32 44.5 38.5 39.5" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    angry: `<rect x="25.5" y="40" width="13" height="5.5" rx="1.5" fill="#fff" stroke="${INK}" stroke-width="1"/><path d="M25.5 42.7 H38.5 M29.5 40 V45.5 M34.5 40 V45.5" stroke="${INK}" stroke-width="0.6"/>`,
    scared: `<ellipse cx="32" cy="43" rx="3" ry="3.8" fill="#5a2a2a" stroke="${INK}" stroke-width="1"/>`,
    fallen: `<path d="M26 43 Q28.5 41 31 43 Q33.5 45 36 43 Q37.5 42 38.5 43" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  };
  const blush = m === 'angry' ? '<ellipse cx="22" cy="37" rx="3" ry="2" fill="#d8737f" opacity="0.7"/><ellipse cx="42" cy="37" rx="3" ry="2" fill="#d8737f" opacity="0.7"/>' : '';
  const sweat = m === 'scared' ? '<path d="M46 22 Q48 26 46 28 Q44 26 46 22 Z" fill="#7fb7be" stroke="#3d6a70" stroke-width="0.5"/>' : '';
  const patch = look.face.includes('eyepatch');
  return `${blush}<g stroke="${INK}" stroke-width="1.8" stroke-linecap="round" fill="none">${brows[m]}</g>${eye(25)}${patch ? '' : eye(39)}`
    + `<ellipse cx="32" cy="36" rx="3.6" ry="4.4" fill="${look.skin}" stroke="${INK}" stroke-width="0.9"/><path d="M30 38.5 Q32 40 34 38.5" stroke="${INK}" stroke-width="0.6" fill="none"/>`
    + `${mouths[m]}${sweat}`;
}

function trimmings(look: Look): { under: string; over: string } {
  let under = '';
  let over = '';
  for (const f of look.face) {
    if (f === 'beard') under += `<path d="M18 36 Q19 53 32 54 Q45 53 46 36 Q42 46 32 46 Q22 46 18 36 Z" fill="${look.hair}" stroke="${INK}" stroke-width="0.8"/>`;
    if (f === 'moustache') over += `<path d="M24 39 Q28 36 32 38.5 Q36 36 40 39 Q42 41 44 39.5 Q41 43.5 36.5 41 Q34 40.5 32 41 Q30 40.5 27.5 41 Q23 43.5 20 39.5 Q22 41 24 39 Z" fill="${look.hair}" stroke="${INK}" stroke-width="0.7"/>`;
    if (f === 'glasses') over += `<g fill="none" stroke="${INK}" stroke-width="1.2"><circle cx="25" cy="31" r="5"/><circle cx="39" cy="31" r="5"/><path d="M30 31 H34 M20 30 L17 29 M44 30 L47 29"/></g>`;
    if (f === 'monocle') over += `<circle cx="39" cy="31" r="5" fill="#fff" fill-opacity="0.15" stroke="#c9a94a" stroke-width="1.2"/><path d="M43.5 33 Q46 42 42 48" stroke="#c9a94a" stroke-width="0.7" fill="none"/>`;
    if (f === 'eyepatch') over += `<path d="M18 24 L46 34" stroke="${INK}" stroke-width="1"/><ellipse cx="39" cy="31" rx="4.5" ry="3.8" fill="${INK}"/>`;
  }
  return { under, over };
}

function chest(look: Look, profile: number): string {
  const coat = `<path d="M6 64 Q8 50 22 47 L32 53 L42 47 Q56 50 58 64 Z" fill="${COAT[profile]}" stroke="${INK}" stroke-width="0.9"/><path d="M27 48.5 L32 53 L37 48.5 L35 64 H29 Z" fill="#efe9d8" stroke="${INK}" stroke-width="0.6"/>`;
  let extra = '';
  if (look.face.includes('medals')) extra += `<circle cx="16" cy="56" r="2.4" fill="#e2c04a" stroke="${INK}" stroke-width="0.5"/><circle cx="21.5" cy="57" r="2.4" fill="#c9cdd2" stroke="${INK}" stroke-width="0.5"/><circle cx="44" cy="57" r="2.4" fill="#b0532c" stroke="${INK}" stroke-width="0.5"/>`;
  if (look.face.includes('pearls')) extra += [24, 27.5, 32, 36.5, 40].map((x, i) => `<circle cx="${x}" cy="${49.5 + (i === 2 ? 2 : i === 1 || i === 3 ? 1.2 : 0)}" r="1.5" fill="#f4f1ea" stroke="${INK}" stroke-width="0.4"/>`).join('');
  if (look.face.includes('scarf')) extra += `<path d="M20 46 Q32 52 44 46 L45 50 Q32 56 19 50 Z" fill="#c9a94a" stroke="${INK}" stroke-width="0.7"/><path d="M40 51 L44 61 L40 60 Z" fill="#c9a94a" stroke="${INK}" stroke-width="0.6"/>`;
  return coat + extra;
}

/**
 * A leader's face as an SVG string, `px` wide. The fallen are drawn grey and the name is told
 * beside the face, so the colour is never the only sign of who it is.
 */
export function leaderFace(p: Persona, m: Mood, px = 64): string {
  const look = p.look;
  const t = trimmings(look);
  const grey = m === 'fallen' ? ' style="filter:grayscale(1)" opacity="0.75"' : '';
  return `<svg class="leader-face" width="${px}" height="${px}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g${grey}>`
    + `<circle cx="32" cy="32" r="31" fill="${p.color}" fill-opacity="0.28" stroke="${p.color}" stroke-width="1.5"/>`
    + chest(look, p.profile) + t.under + head(look) + top(look) + mood(m, look) + t.over
    + '</g></svg>';
}
