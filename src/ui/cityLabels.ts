/**
 * cityLabels.ts — cities' names on the map (STORY-032).
 *
 * A label with the name and size floats over each city at the city-area, province and
 * state levels, so a city is easy to find. Close up a small line under the name tells
 * what the city builds and how it grows, and a tap opens its quick panel (STORY-098).
 */

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

export function createCityLabels(root: HTMLElement, onTap: (id: number) => void): { update(labels: CityLabel[]): void } {
  const layer = document.createElement('div');
  layer.className = 'city-labels';
  root.appendChild(layer);
  const pool: HTMLButtonElement[] = [];
  return {
    update(labels) {
      while (pool.length < labels.length) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'city-label';
        b.innerHTML = '<span class="city-label-text"><span class="city-label-name"></span><span class="city-label-info"></span></span><span class="city-label-size"></span>';
        b.addEventListener('click', () => onTap(Number(b.dataset.id)));
        layer.appendChild(b);
        pool.push(b);
      }
      pool.forEach((b, i) => {
        const l = labels[i];
        const hidden = !l || l.x === null || l.y === null;
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
        }
        b.style.transform = `translate(${l.x!.toFixed(1)}px, ${l.y!.toFixed(1)}px) translate(-50%, -50%)`;
      });
    },
  };
}
