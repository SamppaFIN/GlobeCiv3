/**
 * cityQuick.ts — a city's quick panel under its label on the map (STORY-098).
 *
 * The first tap on a city's label opens it: the city's figures in small and its quick
 * actions. A second tap on the label, or the card action, opens the city's card.
 */

export interface CityQuickView {
  id: number;
  name: string;
  /** Short lines: size and growth, what it builds, trade, defence and mood. */
  lines: string[];
  actions: { id: string; label: string }[];
  /** Where the city's label is on screen (CSS pixels), or null when out of view. */
  x: number | null;
  y: number | null;
}

export interface CityQuick {
  update(view: CityQuickView | null): void;
  readonly visible: boolean;
}

// Phosphor "x" (MIT)
const CLOSE = '<svg viewBox="0 0 256 256" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>';

/** Gap between the label's centre and the panel's top. */
const BELOW = 28;

export function createCityQuick(root: HTMLElement, on: { action(id: string, city: number): void; close(): void }): CityQuick {
  const el = document.createElement('section');
  el.className = 'city-quick';
  el.setAttribute('role', 'group');
  el.hidden = true;
  el.innerHTML = `<div class="city-quick-head"><h2 class="city-quick-name"></h2><button class="btn btn-secondary city-quick-close" type="button" aria-label="Sulje">${CLOSE}</button></div>
    <ul class="city-quick-lines"></ul><div class="city-quick-actions"></div>`;
  root.appendChild(el);
  const name = el.querySelector<HTMLElement>('.city-quick-name')!;
  const lines = el.querySelector<HTMLElement>('.city-quick-lines')!;
  const actions = el.querySelector<HTMLElement>('.city-quick-actions')!;
  el.querySelector('.city-quick-close')!.addEventListener('click', on.close);
  let city = -1;
  actions.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (b) on.action(b.dataset.action!, city);
  });

  let last = '';
  let width = 0;
  let height = 0;
  return {
    get visible() {
      return !el.hidden;
    },
    update(view) {
      const hidden = !view || view.x === null || view.y === null;
      if (el.hidden !== hidden) el.hidden = hidden;
      if (!view || hidden) return;
      const key = JSON.stringify([view.id, view.name, view.lines, view.actions]);
      if (key !== last) {
        last = key;
        city = view.id;
        name.textContent = view.name;
        el.setAttribute('aria-label', `Kaupunki ${view.name}: pikatoiminnot`);
        lines.replaceChildren(...view.lines.map(t => {
          const li = document.createElement('li');
          li.textContent = t;
          return li;
        }));
        actions.replaceChildren(...view.actions.map(a => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-secondary city-quick-action';
          b.dataset.action = a.id;
          b.textContent = a.label;
          return b;
        }));
        // Measured only when the content changes, not in every frame (STORY-062)
        width = el.offsetWidth;
        height = el.offsetHeight;
      }
      // Under the label, or over it near the bottom, kept inside the screen
      const half = width / 2;
      const x = Math.min(Math.max(view.x!, half + 8), window.innerWidth - half - 8);
      const below = view.y! + BELOW;
      const y = below + height > window.innerHeight - 8 ? view.y! - BELOW - height : below;
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(8, y).toFixed(1)}px) translate(-50%, 0)`;
    },
  };
}
