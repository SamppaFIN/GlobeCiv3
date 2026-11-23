/**
 * unitMarkers.ts — the player's units at the province and state levels (STORY-115).
 *
 * Up there a unit's figure is smaller than a pixel or two, so each unit gets a marker of a
 * fixed size on the screen. Markers whose touch targets would meet merge into one that tells
 * how many units it holds. A marker does not stand under a chip or a city label: it moves a
 * little aside, and when nothing near is free it joins the nearest marker.
 */
import { overlaps, type ScreenRect } from './levelUi';

export interface UnitMark {
  /** The unit's index in the player's units. */
  index: number;
  /** For the screen reader: the unit's name, e.g. "Tiedustelija 1" (its doings are in the list). */
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

/** A group where it stands; `over` when it found no free place and stands over the chips and labels. */
export interface PlacedGroup extends MarkerGroup {
  over: boolean;
}

/** The part of the screen a marker may stand in: between the panels, inside the view. */
export interface MarkerArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where each group stands: on its units, else the nearest free shift inside `area`, clear of
 * `avoid` (the chips and the labels) by what shows and of the groups placed before it by their
 * touch targets. A group that finds no free place joins the nearest group placed (own, Utu's
 * review: a marker over a chip took its taps), and only the first stands over the rest.
 */
export function placeGroups(groups: readonly MarkerGroup[], avoid: readonly ScreenRect[], area: MarkerArea): PlacedGroup[] {
  const placed: PlacedGroup[] = [];
  const inside = (r: ScreenRect) => r.x - r.w / 2 >= area.left && r.x + r.w / 2 <= area.right && r.y - r.h / 2 >= area.top && r.y + r.h / 2 <= area.bottom;
  for (const g of groups) {
    const free = SHIFTS.find(([dx, dy]) => {
      const x = g.x + dx, y = g.y + dy;
      const shown = seen(g, x, y);
      const target = { x, y, w: MARKER_TARGET, h: MARKER_TARGET };
      return inside(shown) && !avoid.some(r => overlaps(r, shown)) && !placed.some(p => overlaps({ x: p.x, y: p.y, w: MARKER_TARGET, h: MARKER_TARGET }, target));
    });
    if (free) {
      placed.push({ ...g, units: [...g.units], x: g.x + free[0], y: g.y + free[1], over: false });
      continue;
    }
    const near = placed.reduce<PlacedGroup | null>((a, p) => (!a || Math.hypot(p.x - g.x, p.y - g.y) < Math.hypot(a.x - g.x, a.y - g.y) ? p : a), null);
    if (near) {
      near.units.push(...g.units);
      near.selected ||= g.selected;
    } else placed.push({ ...g, units: [...g.units], over: true });
  }
  return placed;
}

/** The unit a tap on a group selects: the one after the selected in the units' order, else the first (own). */
export function nextUnit(units: readonly number[], selected: number): number {
  const order = [...units].sort((a, b) => a - b);
  const k = order.indexOf(selected);
  return order[k < 0 ? 0 : (k + 1) % order.length];
}

export function createUnitMarkers(root: HTMLElement, onTap: (units: number[]) => void): { update(marks: UnitMark[] | null, avoid: readonly ScreenRect[], area: MarkerArea): void } {
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
    update(marks, avoid, area) {
      const groups = marks ? placeGroups(groupMarks(marks), avoid, area) : [];
      const used = new Set<HTMLButtonElement>();
      groups.forEach(g => {
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
        b.classList.toggle('unit-marker-over', g.over);
        b.style.transform = `translate(${g.x.toFixed(1)}px, ${g.y.toFixed(1)}px) translate(-50%, -50%)`;
      });
      for (const b of byLead.values()) if (!used.has(b) && !b.hidden) b.hidden = true;
    },
  };
}
