/**
 * cityLabels.ts — cities' names on the map (STORY-032).
 *
 * A label with the name and size floats over each city at the city-area, province and
 * state levels, so a city is easy to find. Close up a small line under the name tells
 * what the city builds and how it grows, and a tap opens its quick panel (STORY-098).
 *
 * Above the city areas a label does not stand on a chip or on another label (STORY-114): the
 * labels are placed in their order, each over its city or else just above, below or beside it,
 * and one that finds no free place is left out, unless its quick panel is open.
 */
import { overlaps, type ScreenRect } from './levelUi';

export interface CityLabel {
  id: number;
  name: string;
  size: number;
  /** Screen position in CSS pixels, or null when not in view. */
  x: number | null;
  y: number | null;
  /** A city-state (STORY-063), a tribe of nomads (STORY-066) or a rival's city (STORY-068), not the player's. */
  foe?: 'native' | 'tribe' | 'rival';
  /** A rival's colour (CSS) for the border and the size. */
  color?: string;
  /** A rival's name, for the screen reader. */
  owner?: string;
  /** A short line under the name, e.g. "Temppeli 3 pv · ruokaa +2" (STORY-098). */
  info?: string;
  /** Its quick panel is open (STORY-098). */
  open?: boolean;
}

/** A label's height: the touch target (tokens.css). */
const LABEL_HEIGHT = 44;

/**
 * Where a label of width w may stand instead of over its city (own): a label's height and a
 * little more above, then below, then half its width to the left or right, its edge at the city.
 */
const shiftsOf = (w: number): [number, number][] => [[0, 0], [0, -(LABEL_HEIGHT + 4)], [0, LABEL_HEIGHT + 4], [-w / 2, 0], [w / 2, 0]];

/** A label's width before it is measured: its padding, gap and size badge, and the name at about 8 px a letter. */
const guessWidth = (l: CityLabel) => 24 + 8 + 22 + 8 * Math.max(l.name.length, (l.info?.length ?? 0) * 0.8);

/** What a label shows: its width is measured once for each (STORY-114). */
const keyOf = (l: CityLabel) => `${l.id}|${l.name}|${l.size}|${l.foe ?? ''}|${l.color ?? ''}|${l.info ?? ''}|${l.open ? 1 : 0}`;

/**
 * Where each label stands (STORY-114): in order, over its city or else beside it (shiftsOf),
 * clear of `avoid` and of the labels placed before it. Returns the shift in pixels, or null for
 * a label left out or not in view. A label whose quick panel is open stays over its city with
 * the panel, whatever it covers.
 */
export function placeLabels(labels: readonly { x: number | null; y: number | null; w: number; open?: boolean }[], avoid: readonly ScreenRect[]): ([number, number] | null)[] {
  const placed: ScreenRect[] = [...avoid];
  return labels.map(l => {
    if (l.x === null || l.y === null) return null;
    const free: [number, number] | undefined = l.open ? [0, 0] : shiftsOf(l.w).find(([dx, dy]) => !placed.some(r => overlaps(r, { x: l.x! + dx, y: l.y! + dy, w: l.w, h: LABEL_HEIGHT })));
    if (!free) return null;
    placed.push({ x: l.x + free[0], y: l.y + free[1], w: l.w, h: LABEL_HEIGHT });
    return free;
  });
}

export function createCityLabels(root: HTMLElement, onTap: (id: number) => void): { update(labels: CityLabel[], avoid?: readonly ScreenRect[] | null): ScreenRect[] } {
  const layer = document.createElement('div');
  layer.className = 'city-labels';
  root.appendChild(layer);
  const pool: HTMLButtonElement[] = [];
  /** Label widths by what they show, measured once it shows (STORY-062: read only then). */
  const widths = new Map<string, number>();
  return {
    /**
     * `avoid`: the chips' places; labels in order, each left out when it would cover one or a label
     * placed before it (STORY-114). Returns where the labels stand when `avoid` is given.
     */
    update(labels, avoid = null) {
      while (pool.length < labels.length) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'city-label';
        b.innerHTML = '<span class="city-label-text"><span class="city-label-name"></span><span class="city-label-info"></span></span><span class="city-label-size"></span>';
        b.addEventListener('click', () => onTap(Number(b.dataset.id)));
        layer.appendChild(b);
        pool.push(b);
      }
      const keys = labels.map(keyOf);
      const sized = labels.map((l, i) => ({ x: l.x, y: l.y, w: widths.get(keys[i]) ?? guessWidth(l), open: l.open }));
      const shifts = avoid ? placeLabels(sized, avoid) : labels.map(l => (l.x === null || l.y === null ? null : [0, 0] as [number, number]));
      const unmeasured: [HTMLButtonElement, string][] = [];
      pool.forEach((b, i) => {
        const l = labels[i];
        const hidden = !l || shifts[i] === null;
        if (b.hidden !== hidden) b.hidden = hidden;
        if (!l || hidden) return;
        const [dx, dy] = shifts[i]!;
        // Only what changed is written: a text written in every frame costs a layout (STORY-062)
        const key = keys[i];
        if (b.dataset.key !== key) {
          b.dataset.key = key;
          b.dataset.id = String(l.id);
          b.classList.toggle('city-label-native', l.foe === 'native' || l.foe === 'tribe');
          b.classList.toggle('city-label-rival', l.foe === 'rival');
          b.style.setProperty('--rival', l.color ?? '');
          b.setAttribute('aria-label', l.foe === 'tribe' ? `Paimentolaisheimo ${l.name}, ${l.size} soturia` : l.foe === 'rival' ? `${l.owner} · kaupunki ${l.name}, koko ${l.size}` : `${l.foe ? 'Kaupunkivaltio' : 'Kaupunki'} ${l.name}, koko ${l.size}${l.info ? `, ${l.info}` : ''}`);
          if (l.foe) b.removeAttribute('aria-expanded');
          else b.setAttribute('aria-expanded', String(!!l.open));
          b.querySelector('.city-label-name')!.textContent = l.name;
          b.querySelector('.city-label-size')!.textContent = String(l.size);
          b.querySelector('.city-label-info')!.textContent = l.info ?? '';
        }
        if (avoid && !widths.has(key)) unmeasured.push([b, key]);
        b.style.transform = `translate(${(l.x! + dx).toFixed(1)}px, ${(l.y! + dy).toFixed(1)}px) translate(-50%, -50%)`;
      });
      // A new text's width read after all the writes: one layout, and only then
      for (const [b, key] of unmeasured) {
        const w = b.offsetWidth;
        if (w > 0) widths.set(key, w);
      }
      // Widths of texts no longer shown are let go, so the map stays small
      if (widths.size > 4 * Math.max(16, labels.length)) for (const k of [...widths.keys()]) if (!keys.includes(k)) widths.delete(k);
      return avoid ? labels.flatMap((l, i) => (shifts[i] === null ? [] : [{ x: l.x! + shifts[i]![0], y: l.y! + shifts[i]![1], w: sized[i].w, h: LABEL_HEIGHT }])) : [];
    },
  };
}
