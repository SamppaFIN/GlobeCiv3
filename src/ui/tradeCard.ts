/**
 * tradeCard.ts — a trade with a rival (STORY-078): what the player gives and what it gets,
 * each chosen from a list, with what the rival thinks of it before it is offered. A bottom
 * sheet like the city card; its options are radio buttons in the city card's style, and the
 * verdict and the offer stay at its foot while the lists scroll.
 */

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

export interface TradeOption { id: string; name: string; worth: string; selected: boolean }

export interface TradeView {
  /** The rival's name. */
  title: string;
  give: TradeOption[];
  get: TradeOption[];
  /** "Pohjola hyväksyy" or why not. */
  verdict: string;
  canOffer: boolean;
}

export interface TradeCard {
  show(view: TradeView): void;
  update(view: TradeView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createTradeCard(root: HTMLElement, on: { close(): void; give(id: string): void; get(id: string): void; offer(): void }): TradeCard {
  const el = document.createElement('section');
  el.className = 'city-card tile-card trade-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'trade-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker">Vaihto</span><h2 id="trade-title" class="city-name"></h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <div class="city-builds trade-give" role="radiogroup" aria-labelledby="trade-give-label"><span id="trade-give-label" class="city-build-label">Annat</span></div>
    <div class="city-builds trade-get" role="radiogroup" aria-labelledby="trade-get-label"><span id="trade-get-label" class="city-build-label">Saat</span></div>
    <div class="trade-foot">
      <p class="tile-verdict" aria-live="polite"></p>
      <div class="tile-actions"><button class="btn btn-primary trade-offer" type="button">Tarjoa vaihto</button></div>
    </div>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  q('.trade-offer').addEventListener('click', on.offer);
  /** One radio button per option, made once and reused. */
  const fill = (group: HTMLElement, options: TradeOption[], pick: (id: string) => void) => {
    group.querySelectorAll<HTMLButtonElement>('.city-build').forEach((opt, i) => { if (i >= options.length) opt.remove(); });
    options.forEach((o, i) => {
      let opt = group.querySelectorAll<HTMLButtonElement>('.city-build')[i];
      if (!opt) {
        opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'city-build';
        opt.setAttribute('role', 'radio');
        opt.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span><span class="city-build-eta"></span></span>';
        opt.addEventListener('click', () => pick(opt!.dataset.id!));
        group.appendChild(opt);
      }
      opt.dataset.id = o.id;
      opt.setAttribute('aria-checked', String(o.selected));
      opt.querySelector('.city-build-name')!.textContent = o.name;
      opt.querySelector('.city-build-eta')!.textContent = o.worth;
    });
  };
  let last = '';
  const update = (v: TradeView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('#trade-title').textContent = v.title;
    fill(q('.trade-give'), v.give, on.give);
    fill(q('.trade-get'), v.get, on.get);
    q('.tile-verdict').textContent = v.verdict;
    q<HTMLButtonElement>('.trade-offer').disabled = !v.canOffer;
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
      if (!root.querySelector('.research-card:not([hidden]), .list-card:not([hidden]), .advisor-card:not([hidden])')) root.classList.remove('research-open');
    },
    get visible() { return !el.hidden; },
  };
}
