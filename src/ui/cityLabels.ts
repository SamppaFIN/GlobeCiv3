/**
 * cityLabels.ts — cities' names on the map (STORY-032).
 *
 * A label with the name and size floats over each city at the city-area, province and
 * state levels, so a city is easy to find. Close up a small line under the name tells
 * what the city builds and how it grows, and a tap opens its quick panel (STORY-098).
 *
 * Above the city areas a label does not stand on a chip or on another label (STORY-114): the
 * labels are placed in their order, each over its city or else just above or below it, and one
 * that finds no free place is left out, unless its quick panel is open.
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

/** Where a label may stand instead of over its city: a label's height and a little more above, then below (own). */
const SHIFTS = [0, -(LABEL_HEIGHT + 4), LABEL_HEIGHT + 4];

/** A label's width before it is measured: its padding, gap and size badge, and the name at about 8 px a letter. */
const guessWidth = (l: CityLabel) => 24 + 8 + 22 + 8 * Math.max(l.name.length, (l.info?.length ?? 0) * 0.8);

export function createCityLabels(root: HTMLElement, onTap: (id: number) => void): { update(labels: CityLabel[], avoid?: readonly ScreenRect[] | null): void } {
  const layer = document.createElement('div');
  layer.className = 'city-labels';
  root.appendChild(layer);
  const pool: HTMLButtonElement[] = [];
  /** Label widths as measured after their text last changed (STORY-062: read only then). */
  const widths = new Map<HTMLButtonElement, number>();
  return {
    /** `avoid`: the chips' places; labels in order, each left out when it would cover one or a label placed before it (STORY-114). */
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
      const placed: ScreenRect[] = avoid ? [...avoid] : [];
      pool.forEach((b, i) => {
        const l = labels[i];
        let hidden = !l || l.x === null || l.y === null;
        let dy = 0;
        if (!hidden && avoid) {
          const w = widths.get(b) ?? guessWidth(l);
          // Over the city, else a label's height above or below it
          // An open quick panel's label stays over its city with the panel, whatever it covers
          const free = l.open ? 0 : SHIFTS.find(s => !placed.some(r => overlaps(r, { x: l.x!, y: l.y! + s, w, h: LABEL_HEIGHT })));
          if (free === undefined) hidden = true;
          else {
            dy = free;
            placed.push({ x: l.x!, y: l.y! + dy, w, h: LABEL_HEIGHT });
          }
        }
        if (b.hidden !== hidden) b.hidden = hidden;
        if (!l || hidden) return;
        // Only what changed is written: a text written in every frame costs a layout (STORY-062)
        const key = `${l.id}|${l.name}|${l.size}|${l.foe ?? ''}|${l.color ?? ''}|${l.info ?? ''}|${l.open ? 1 : 0}`;
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
          widths.delete(b);
        }
        // The width measured once it shows with its new text
        if (avoid && !widths.has(b)) {
          const w = b.offsetWidth;
          if (w > 0) widths.set(b, w);
        }
        b.style.transform = `translate(${l.x!.toFixed(1)}px, ${(l.y! + dy).toFixed(1)}px) translate(-50%, -50%)`;
      });
    },
  };
}
