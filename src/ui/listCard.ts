/**
 * listCard.ts — the cities and the units as lists (STORY-042, Sami: "hankala hallinnoida
 * rakennuksia ja ukkeleita, tarvitaan listanäkymä"). Two tabs; a city row opens its card and
 * a unit row selects the unit, both bringing it into view. A bottom sheet like the city card.
 * The third tab, Talous, tells what the realm gets a day (STORY-048).
 */

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

export type ListTab = 'cities' | 'units' | 'economy';

export interface ListView {
  tab: ListTab;
  cities: { id: number; name: string; size: string; line: string }[];
  units: { index: number; name: string; kind: string; line: string }[];
  /** Rows of the economy tab: what comes in and where it goes. */
  economy: { title: string; right: string; line: string }[];
}

export interface ListCard {
  show(view: ListView): void;
  update(view: ListView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createListCard(root: HTMLElement, on: { close(): void; tab(tab: ListTab): void; city(id: number): void; unit(index: number): void }): ListCard {
  const el = document.createElement('section');
  el.className = 'city-card list-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'list-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker">Valtakunta</span><h2 id="list-title" class="city-name">Luettelo</h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <div class="seg city-focus" role="radiogroup" aria-label="Näytä">
      <label class="seg-opt"><input type="radio" name="list-tab" value="cities"><span class="list-tab-cities"></span></label>
      <label class="seg-opt"><input type="radio" name="list-tab" value="units"><span class="list-tab-units"></span></label>
      <label class="seg-opt"><input type="radio" name="list-tab" value="economy">Talous</label>
    </div>
    <div class="list-rows"></div>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  el.querySelectorAll<HTMLInputElement>('input[name="list-tab"]').forEach(i => i.addEventListener('change', () => on.tab(i.value as ListTab)));
  const rows = q('.list-rows');
  let last = '';
  const update = (v: ListView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('.list-tab-cities').textContent = `Kaupungit (${v.cities.length})`;
    q('.list-tab-units').textContent = `Yksiköt (${v.units.length})`;
    el.querySelectorAll<HTMLInputElement>('input[name="list-tab"]').forEach(i => { i.checked = i.value === v.tab; });
    const items: { title: string; right: string; line: string; go?: () => void }[] = v.tab === 'cities'
      ? v.cities.map(c => ({ title: c.name, right: c.size, line: c.line, go: () => on.city(c.id) }))
      : v.tab === 'units' ? v.units.map(u => ({ title: u.name, right: u.kind, line: u.line, go: () => on.unit(u.index) }))
      : v.economy;
    rows.replaceChildren(...items.map(it => {
      // Economy rows only tell; the others are buttons
      const b = document.createElement(it.go ? 'button' : 'div');
      if (b instanceof HTMLButtonElement) b.type = 'button';
      b.className = it.go ? 'city-build list-row' : 'city-build list-row list-info';
      b.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span><span class="city-build-eta"></span></span><span class="city-build-info"></span>';
      b.querySelector('.city-build-name')!.textContent = it.title;
      b.querySelector('.city-build-eta')!.textContent = it.right;
      b.querySelector('.city-build-info')!.textContent = it.line;
      if (it.go) b.addEventListener('click', it.go);
      return b;
    }));
    if (!items.length) {
      const empty = document.createElement('span');
      empty.className = 'city-area';
      empty.textContent = v.tab === 'cities' ? 'Ei vielä kaupunkeja. Uudisasukas perustaa kaupungin.' : 'Ei yksiköitä.';
      rows.appendChild(empty);
    }
  };
  return {
    show(v) {
      update(v);
      el.hidden = false;
      root.classList.add('research-open');
    },
    update,
    hide() {
      el.hidden = true;
      root.classList.remove('research-open');
    },
    get visible() { return !el.hidden; },
  };
}
