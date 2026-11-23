/**
 * unitMarkers.ts — the player's units at the province and state levels (STORY-115).
 *
 * Up there a unit's figure is smaller than a pixel or two, so each unit gets a marker of a
 * fixed size on the screen. Markers whose touch targets would meet merge into one that tells
 * how many units it holds. A marker does not stand under a chip or a city label: it moves a
 * little aside, and only when nothing near is free does it stand over them.
 */
import { overlaps, type ScreenRect } from './levelUi';

export interface UnitMark {
  /** The unit's index in the player's units. */
  index: number;
  /** For the screen reader, e.g. "Tiedustelija 1, tutkii". */
  label: string;
  /** Screen position in CSS pixels, or null when not in view. */
  x: number | null;
  y: number | null;
  selected: boolean;
}

/** A marker's touch target (tokens.css --touch-target). Markers whose targets would meet merge. */
export const MARKER_TARGET = 44;
/** The visible dot: at least 12 px at every level (STORY-115). */
export const MARKER_DOT = 14;
/** The visible part of a merged marker, with its count. */
const MARKER_PILL = 24;

/** Where a marker may stand instead of on its unit: rings of 24 and 40 px in eight directions (own). */
const SHIFTS: readonly [number, number][] = [[0, 0], ...[24, 40].flatMap(r => Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4 - Math.PI / 2;
  return [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))] as [number, number];
}))];

export interface MarkerGroup {
  /** The units' indices, the selected one first. */
  units: number[];
  x: number;
  y: number;
  selected: boolean;
}

/**
 * Units in view grouped by their touch targets: in order, the selected first, a unit joins the
 * first group whose first unit's target its own would meet, else starts a group.
 */
export function groupMarks(marks: readonly UnitMark[]): MarkerGroup[] {
  const shown = marks.filter(m => m.x !== null && m.y !== null);
  shown.sort((a, b) => Number(b.selected) - Number(a.selected) || a.index - b.index);
  const groups: MarkerGroup[] = [];
  for (const m of shown) {
    const g = groups.find(g => Math.abs(g.x - m.x!) < MARKER_TARGET && Math.abs(g.y - m.y!) < MARKER_TARGET);
    if (g) {
      g.units.push(m.index);
      g.selected ||= m.selected;
    } else groups.push({ units: [m.index], x: m.x!, y: m.y!, selected: m.selected });
  }
  return groups;
}

/** A group's visible rectangle at a place. */
const seen = (g: MarkerGroup, x: number, y: number): ScreenRect => {
  const w = g.units.length > 1 ? MARKER_PILL : MARKER_DOT;
  return { x, y, w: w + 4, h: w + 4 };
};

/**
 * Where each group stands: on its units, else the nearest free shift, clear of `avoid` (the chips
 * and the labels) by what shows and of the groups placed before it by their touch targets.
 * `over` marks a group that found no free place and stands over the others.
 */
export function placeGroups(groups: readonly MarkerGroup[], avoid: readonly ScreenRect[]): { x: number; y: number; over: boolean }[] {
  const targets: ScreenRect[] = [];
  return groups.map(g => {
    const free = SHIFTS.find(([dx, dy]) => {
      const x = g.x + dx, y = g.y + dy;
      const target = { x, y, w: MARKER_TARGET, h: MARKER_TARGET };
      return !avoid.some(r => overlaps(r, seen(g, x, y))) && !targets.some(r => overlaps(r, target));
    });
    const [dx, dy] = free ?? [0, 0];
    targets.push({ x: g.x + dx, y: g.y + dy, w: MARKER_TARGET, h: MARKER_TARGET });
    return { x: g.x + dx, y: g.y + dy, over: free === undefined };
  });
}

export function createUnitMarkers(root: HTMLElement, onTap: (units: number[]) => void): { update(marks: UnitMark[] | null, avoid: readonly ScreenRect[]): void } {
  const layer = document.createElement('div');
  layer.className = 'unit-markers';
  root.appendChild(layer);
  /**
   * A group keeps its button while its first unit leads it, so a tap in progress stays on the
   * units it began on when the groups change order between frames.
   */
  const byLead = new Map<number, HTMLButtonElement>();
  const members = new Map<HTMLButtonElement, number[]>();
  return {
    /** `marks`: the player's units, or null where the level draws them itself (the city area). */
    update(marks, avoid) {
      const groups = marks ? groupMarks(marks) : [];
      const places = placeGroups(groups, avoid);
      const used = new Set<HTMLButtonElement>();
      groups.forEach((g, i) => {
        const lead = Math.min(...g.units);
        let b = byLead.get(lead);
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'unit-marker';
          b.innerHTML = '<span class="unit-marker-dot"></span>';
          const self = b;
          b.addEventListener('click', () => onTap(members.get(self) ?? []));
          layer.appendChild(b);
          byLead.set(lead, b);
        }
        used.add(b);
        if (b.hidden) b.hidden = false;
        members.set(b, g.units);
        // Only what changed is written (STORY-062); the names in the units' order, whichever is selected
        const names = [...g.units].sort((x, y) => x - y).map(u => marks!.find(m => m.index === u)!.label);
        const label = g.units.length > 1 ? `${g.units.length} yksikköä: ${names.join('; ')}` : names[0];
        const key = `${g.units.length}|${g.selected ? 1 : 0}|${label}`;
        if (b.dataset.key !== key) {
          b.dataset.key = key;
          b.setAttribute('aria-label', label);
          b.setAttribute('aria-pressed', String(g.selected));
          b.querySelector('.unit-marker-dot')!.textContent = g.units.length > 1 ? String(g.units.length) : '';
          b.classList.toggle('unit-marker-many', g.units.length > 1);
        }
        b.classList.toggle('unit-marker-over', places[i].over);
        b.style.transform = `translate(${places[i].x.toFixed(1)}px, ${places[i].y.toFixed(1)}px) translate(-50%, -50%)`;
      });
      for (const b of byLead.values()) if (!used.has(b) && !b.hidden) b.hidden = true;
    },
  };
}
