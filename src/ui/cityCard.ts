/**
 * cityCard.ts — the city card (design 8a).
 *
 * Kicker (capital or city, and the area), the name and a close button; the size with
 * the food box as a bar and the days to grow; food, shields and trade a day; and the
 * builds to choose from, each with its cost, what it does and when it would be ready
 * (STORY-037: "Vaihda" did not tell what the city can build); the treasury, buying the
 * build and the buildings in the city (STORY-038).
 */
import { FOCUS_NAMES, type Build, type Focus } from '../game/cities';

// Icons from design 8a: close, food (grain), production (hammer), trade (coin)
const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';
export const YIELD_ICONS = [
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.80 0.10 95)" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 21 V5 M12 9 C9 9 8 7 8 4 C11 4 12 6 12 9 M12 9 C15 9 16 7 16 4 C13 4 12 6 12 9 M12 15 C9 15 8 13 8 10 C11 10 12 12 12 15 M12 15 C15 15 16 13 16 10 C13 10 12 12 12 15"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.78 0.08 50)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 L13 11 M10 5 H16 L19 8 L15 12 L10 7 Z"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.82 0.10 85)" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7 V17 M9.5 9.5 H14 M9.5 14.5 H14"/></svg>',
];
const LABELS = ['Ruoka', 'Tuotanto', 'Kauppa'];

export interface CityView {
  /** "Pääkaupunki · Kotialue" */
  kicker: string;
  name: string;
  size: number;
  /** Food in store over the food box, 0–1. */
  growth: number;
  /** "kasvaa 6 pv", "ei kasva" or "nälkää" */
  growText: string;
  /** Where the food goes: "Ruokaa 4 · asukkaat syövät 2 · varastossa 3/20" (STORY-039). */
  foodText: string;
  /** What the citizens work for, the city area ("Alue 1 rengas · laajenee koossa 2"), and how to grow faster when growth is slow. */
  focus: Focus;
  areaText: string;
  hint: string | null;
  /** Food left over (may be negative), shields and trade a day. */
  yields: [number, number, number];
  /** Every build: "Soturi", "10 tuotantoa", what it does, "valmis 5 pv", and the one chosen. */
  builds: { kind: Build; name: string; cost: string; purpose: string; eta: string; selected: boolean; locked: boolean }[];
  /** "Tutkimus: Keramiikka 6/10" (STORY-040). */
  research: string;
  /** The treasury, and what this city adds to it a day (its gold less its upkeep). */
  gold: number;
  income: number;
  /** The rest of the build for gold, or null when nothing is missing. */
  buy: { name: string; price: number; can: boolean } | null;
  /** Names of the buildings in the city. */
  buildings: string[];
}

export interface CityCard {
  /** Top edge of the card in CSS pixels, to keep the city in view above it. */
  top(): number;
  show(view: CityView): void;
  update(view: CityView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createCityCard(root: HTMLElement, on: { close(): void; setBuild(build: Build): void; buy(): void; setFocus(focus: Focus): void; openResearch(): void }): CityCard {
  const el = document.createElement('section');
  el.className = 'city-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'city-name');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker"></span><h2 id="city-name" class="city-name"></h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <div class="city-growth">
      <span class="city-size"></span>
      <div class="city-bar" role="meter" aria-label="Ruokavarasto" aria-valuemin="0" aria-valuemax="100"><div class="city-bar-fill"></div></div>
      <span class="city-grow"></span>
    </div>
    <span class="city-food"></span>
    <div class="city-focus-row">
      <span id="city-focus-label" class="city-build-label">Kansalaiset työstävät</span>
      <div class="seg city-focus" role="radiogroup" aria-labelledby="city-focus-label">
        ${(Object.keys(FOCUS_NAMES) as Focus[]).map(f => `<label class="seg-opt"><input type="radio" name="city-focus" value="${f}">${FOCUS_NAMES[f]}</label>`).join('')}
      </div>
    </div>
    <span class="city-area"></span>
    <span class="city-hint"></span>
    <div class="city-yields">
      ${LABELS.map((label, i) => `<div class="city-yield">${YIELD_ICONS[i]}<span class="city-yield-n"></span><span class="city-yield-label">${label}</span></div>`).join('')}
    </div>
    <span class="city-buildings"></span>
    <div class="city-builds" role="radiogroup" aria-labelledby="city-builds-label">
      <span class="city-builds-head"><span id="city-builds-label" class="city-build-label">Rakenna</span><span class="city-gold"></span></span>
    </div>
    <button class="btn btn-secondary city-buy" type="button"></button>
    <button class="btn btn-secondary city-research" type="button"></button>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  const builds = q('.city-builds');
  const buyButton = q<HTMLButtonElement>('.city-buy');
  buyButton.addEventListener('click', on.buy);
  q('.city-research').addEventListener('click', on.openResearch);
  el.querySelectorAll<HTMLInputElement>('input[name="city-focus"]').forEach(i => i.addEventListener('change', () => on.setFocus(i.value as Focus)));
  let last = '';
  const update = (v: CityView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('.city-kicker').textContent = v.kicker;
    q('.city-name').textContent = v.name;
    q('.city-size').textContent = `Koko ${v.size}`;
    const pct = Math.round(Math.max(0, Math.min(1, v.growth)) * 100);
    q('.city-bar-fill').style.width = `${pct}%`;
    q('.city-bar').setAttribute('aria-valuenow', String(pct));
    q('.city-grow').textContent = v.growText;
    q('.city-food').textContent = v.foodText;
    q('.city-area').textContent = v.areaText;
    const hint = q('.city-hint');
    hint.hidden = !v.hint;
    hint.textContent = v.hint ?? '';
    el.querySelectorAll<HTMLInputElement>('input[name="city-focus"]').forEach(i => { i.checked = i.value === v.focus; });
    el.querySelectorAll<HTMLElement>('.city-yield-n').forEach((n, i) => {
      const y = v.yields[i];
      n.textContent = y < 0 ? `−${-y}` : `+${y}`;
    });
    q('.city-research').textContent = v.research;
    q('.city-gold').textContent = `Kassa ${v.gold} kultaa · ${v.income < 0 ? '−' : '+'}${Math.abs(v.income)}/pv`;
    const buildings = q('.city-buildings');
    buildings.hidden = !v.buildings.length;
    buildings.textContent = `Rakennukset: ${v.buildings.join(', ')}`;
    buyButton.hidden = !v.buy;
    if (v.buy) {
      buyButton.textContent = v.buy.can ? `Osta ${v.buy.name.toLowerCase()} · ${v.buy.price} kultaa` : `Osta ${v.buy.name.toLowerCase()} · ${v.buy.price} kultaa (kassassa ${v.gold})`;
      buyButton.disabled = !v.buy.can;
    }
    // One button per build, made once; a tap chooses it. A building once built leaves the list
    builds.querySelectorAll<HTMLButtonElement>('.city-build').forEach((opt, i) => { if (i >= v.builds.length) opt.remove(); });
    v.builds.forEach((b, i) => {
      let opt = builds.querySelectorAll<HTMLButtonElement>('.city-build')[i];
      if (!opt) {
        opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'city-build';
        opt.setAttribute('role', 'radio');
        opt.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span><span class="city-build-eta"></span></span><span class="city-build-info"></span>';
        opt.addEventListener('click', () => on.setBuild(opt!.dataset.kind as Build));
        builds.appendChild(opt);
      }
      opt.dataset.kind = b.kind;
      opt.setAttribute('aria-checked', String(b.selected));
      // A building waits for its advance (STORY-040)
      opt.disabled = b.locked;
      opt.querySelector('.city-build-name')!.textContent = b.name;
      opt.querySelector('.city-build-eta')!.textContent = b.eta;
      opt.querySelector('.city-build-info')!.textContent = `${b.cost} · ${b.purpose}`;
    });
  };
  return {
    top: () => el.getBoundingClientRect().top,
    show(v) {
      update(v);
      el.hidden = false;
      root.classList.add('city-open');
    },
    update,
    hide() {
      el.hidden = true;
      root.classList.remove('city-open');
    },
    get visible() { return !el.hidden; },
  };
}
