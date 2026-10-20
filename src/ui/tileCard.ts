/**
 * tileCard.ts — what a tapped hex holds (STORY-055; Sami 2026-10-13: "jos käyttäjä klikkaa
 * heksaa, niin siitä tulee details ruutu mitä heksa sisältää"): its terrain and special
 * resource, what it yields, its improvements, the city it belongs to, the units on it and how
 * long crossing it takes. A bottom sheet like the city card; the game goes on. At the other
 * levels it tells of the tapped city area, province or state (STORY-067), with a way in.
 */

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

export interface TileView {
  /** The city area: "Kotialue". */
  kicker: string;
  /** "Ruohomaa · Hedelmällinen maa", or "Kartoittamaton". */
  title: string;
  /** Label and value rows: "Tuottaa" — "ruokaa 2 · tuotantoa 1 · kauppaa 0". */
  rows: { label: string; value: string }[];
  /** Buttons under the rows, e.g. "Sukella sisään" (STORY-067) or "Siirrä temppeli" (STORY-071). */
  actions?: string[];
}

export interface TileCard {
  show(view: TileView): void;
  update(view: TileView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createTileCard(root: HTMLElement, on: { close(): void; action?(index: number): void }): TileCard {
  const el = document.createElement('section');
  el.className = 'city-card tile-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'tile-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker tile-kicker"></span><h2 id="tile-title" class="city-name tile-title"></h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <dl class="tile-rows"></dl>
    <div class="tile-actions"></div>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  let last = '';
  const update = (v: TileView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('.tile-kicker').textContent = v.kicker;
    q('.tile-title').textContent = v.title;
    q('.tile-actions').replaceChildren(...(v.actions ?? []).map((label, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-primary tile-action';
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => on.action?.(i));
      return b;
    }));
    q('.tile-rows').replaceChildren(...v.rows.flatMap(r => {
      const dt = document.createElement('dt');
      dt.textContent = r.label;
      const dd = document.createElement('dd');
      dd.textContent = r.value;
      return [dt, dd];
    }));
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
      // Another card that hides the bottom panel may have opened as this one closes
      if (!root.querySelector('.research-card:not([hidden]), .list-card:not([hidden]), .advisor-card:not([hidden])')) root.classList.remove('research-open');
    },
    get visible() { return !el.hidden; },
  };
}
