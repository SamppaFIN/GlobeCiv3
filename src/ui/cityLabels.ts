/**
 * cityLabels.ts — cities' names on the map (STORY-032).
 *
 * A label with the name and size floats over each city at the city-area, province and
 * state levels, so a city is easy to find; tapping it opens the city's card.
 */

export interface CityLabel {
  id: number;
  name: string;
  size: number;
  /** Screen position in CSS pixels, or null when not in view. */
  x: number | null;
  y: number | null;
  /** A city-state, not the player's (STORY-063). */
  native?: boolean;
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
        b.innerHTML = '<span class="city-label-name"></span><span class="city-label-size"></span>';
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
        const key = `${l.id}|${l.name}|${l.size}|${l.native ? 1 : 0}`;
        if (b.dataset.key !== key) {
          b.dataset.key = key;
          b.dataset.id = String(l.id);
          b.classList.toggle('city-label-native', !!l.native);
          b.setAttribute('aria-label', `${l.native ? 'Kaupunkivaltio' : 'Kaupunki'} ${l.name}, koko ${l.size}`);
          b.querySelector('.city-label-name')!.textContent = l.name;
          b.querySelector('.city-label-size')!.textContent = String(l.size);
        }
        b.style.transform = `translate(${l.x!.toFixed(1)}px, ${l.y!.toFixed(1)}px) translate(-50%, -50%)`;
      });
    },
  };
}
