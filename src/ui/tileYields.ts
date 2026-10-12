/**
 * tileYields.ts — what a city's citizens bring in (STORY-039): over each tile the open
 * city works, a chip with its food, shields and trade, so the player sees where the
 * city's yield comes from. The centre is marked; zero yields are left out.
 */
import { YIELD_ICONS } from './cityCard';

export interface TileYield {
  /** Screen position in CSS pixels, or null when not in view. */
  x: number | null;
  y: number | null;
  food: number;
  shield: number;
  trade: number;
  centre: boolean;
}

export function createTileYields(root: HTMLElement): { update(items: TileYield[]): void } {
  const layer = document.createElement('div');
  layer.className = 'tile-yields';
  layer.setAttribute('aria-hidden', 'true');
  root.appendChild(layer);
  const pool: HTMLElement[] = [];
  let last = '';
  return {
    update(items) {
      while (pool.length < items.length) {
        const chip = document.createElement('span');
        chip.className = 'tile-yield';
        layer.appendChild(chip);
        pool.push(chip);
      }
      pool.forEach((chip, i) => {
        const t = items[i];
        chip.hidden = !t || t.x === null || t.y === null;
        if (chip.hidden) return;
        chip.style.transform = `translate(${t.x}px, ${t.y}px) translate(-50%, -50%)`;
        chip.classList.toggle('tile-yield-centre', t.centre);
      });
      // The contents change once a day at most
      const key = JSON.stringify(items.map(t => [t.food, t.shield, t.trade]));
      if (key === last) return;
      last = key;
      items.forEach((t, i) => {
        pool[i].innerHTML = ([t.food, t.shield, t.trade] as const)
          .map((n, k) => (n ? `<span class="tile-yield-n">${YIELD_ICONS[k]}${n}</span>` : ''))
          .join('') || '<span class="tile-yield-n">0</span>';
      });
    },
  };
}
