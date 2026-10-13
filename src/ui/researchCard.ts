/**
 * researchCard.ts — science (STORY-040): what is researched and how far, the advances to
 * choose from with their cost and what they open, how trade is split between gold and
 * science, and the advances known. A bottom sheet like the city card; the game goes on.
 */
import { LUX_RATES, TAX_RATES, type Advance } from '../game/science';

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

export interface ResearchView {
  /** "Tiedettä +3/pv · kultaa +2/pv" */
  rates: string;
  /** "Tutkitaan: Keramiikka · 6/10 · valmis 2 pv", or what to do when nothing is chosen. */
  current: string;
  /** Share of 0–1 of the current advance. */
  progress: number;
  /** Where science comes from, when none does. */
  hint: string | null;
  options: { advance: Advance; name: string; cost: string; opens: string; selected: boolean }[];
  tax: number;
  lux: number;
  known: string;
}

export interface ResearchCard {
  show(view: ResearchView): void;
  update(view: ResearchView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createResearchCard(root: HTMLElement, on: { close(): void; choose(advance: Advance): void; setTax(tax: number): void; setLux(lux: number): void }): ResearchCard {
  const el = document.createElement('section');
  el.className = 'city-card research-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'research-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker">Tiede</span><h2 id="research-title" class="city-name">Tutkimus</h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <span class="city-food research-rates"></span>
    <div class="city-growth">
      <span class="research-current"></span>
    </div>
    <span class="city-hint research-hint"></span>
    <div class="city-bar" role="meter" aria-label="Tutkimuksen eteneminen" aria-valuemin="0" aria-valuemax="100"><div class="city-bar-fill research-fill"></div></div>
    <div class="city-builds" role="radiogroup" aria-labelledby="research-options-label">
      <span id="research-options-label" class="city-build-label">Tutki seuraavaksi</span>
    </div>
    <div class="city-focus-row">
      <span id="research-tax-label" class="city-build-label">Kaupasta kultaa, loput tieteeseen</span>
      <div class="seg city-focus" role="radiogroup" aria-labelledby="research-tax-label">
        ${TAX_RATES.map(t => `<label class="seg-opt"><input type="radio" name="research-tax" value="${t}">${t} %</label>`).join('')}
      </div>
    </div>
    <div class="city-focus-row">
      <span id="research-lux-label" class="city-build-label">Kaupasta ylellisyyteen: tekee asukkaista onnellisia</span>
      <div class="seg city-focus" role="radiogroup" aria-labelledby="research-lux-label">
        ${LUX_RATES.map(t => `<label class="seg-opt"><input type="radio" name="research-lux" value="${t}">${t} %</label>`).join('')}
      </div>
    </div>
    <span class="city-area research-known"></span>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  el.querySelectorAll<HTMLInputElement>('input[name="research-tax"]').forEach(i => i.addEventListener('change', () => on.setTax(Number(i.value))));
  el.querySelectorAll<HTMLInputElement>('input[name="research-lux"]').forEach(i => i.addEventListener('change', () => on.setLux(Number(i.value))));
  const options = q('.city-builds');
  let last = '';
  const update = (v: ResearchView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('.research-rates').textContent = v.rates;
    q('.research-current').textContent = v.current;
    const pct = Math.round(Math.max(0, Math.min(1, v.progress)) * 100);
    q('.research-fill').style.width = `${pct}%`;
    q('.city-bar').setAttribute('aria-valuenow', String(pct));
    q('.research-known').textContent = v.known;
    q('.research-hint').hidden = !v.hint;
    q('.research-hint').textContent = v.hint ?? '';
    el.querySelectorAll<HTMLInputElement>('input[name="research-tax"]').forEach(i => { i.checked = Number(i.value) === v.tax; });
    el.querySelectorAll<HTMLInputElement>('input[name="research-lux"]').forEach(i => { i.checked = Number(i.value) === v.lux; });
    // One button per advance; the list shrinks as advances are learned
    options.querySelectorAll<HTMLButtonElement>('.city-build').forEach((opt, i) => { if (i >= v.options.length) opt.remove(); });
    v.options.forEach((o, i) => {
      let opt = options.querySelectorAll<HTMLButtonElement>('.city-build')[i];
      if (!opt) {
        opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'city-build';
        opt.setAttribute('role', 'radio');
        opt.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span><span class="city-build-eta"></span></span><span class="city-build-info"></span>';
        opt.addEventListener('click', () => on.choose(opt!.dataset.advance as Advance));
        options.appendChild(opt);
      }
      opt.dataset.advance = o.advance;
      opt.setAttribute('aria-checked', String(o.selected));
      opt.querySelector('.city-build-name')!.textContent = o.name;
      opt.querySelector('.city-build-eta')!.textContent = o.cost;
      opt.querySelector('.city-build-info')!.textContent = o.opens;
    });
    options.hidden = !v.options.length;
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
