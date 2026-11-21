/**
 * advisorCard.ts — the advisor of the level in view (STORY-049): three to choose from, what
 * each one does, and what the chosen one did lately. Ohjaan itse below them leaves the level
 * to the player and brings out every menu (STORY-096). A bottom sheet like the
 * city card; the game goes on.
 */

import type { Person } from '../game/persons';
import { describeBonus } from '../game/bonuses';
import { portraitSvg } from './portraits';
import { renderRich, type Rich, type RichLinks } from './richText';

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

export interface AdvisorView {
  /** The level the advisor runs and the era: "Kaupunkialue · Varhaisaika". */
  level: string;
  /** The role, what it does, and the era's person in it (STORY-105). */
  options: { id: string; name: string; does: string; selected: boolean; person?: Person | null }[];
  /** What the advisor did lately, the newest first: coloured, its cities and units linked (STORY-103). */
  log: Rich[];
}

export interface AdvisorCard {
  show(view: AdvisorView): void;
  update(view: AdvisorView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createAdvisorCard(root: HTMLElement, on: { close(): void; choose(id: string): void; links: RichLinks }): AdvisorCard {
  const el = document.createElement('section');
  el.className = 'city-card advisor-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'advisor-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker advisor-level"></span><h2 id="advisor-title" class="city-name">Neuvonantaja</h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <div class="city-builds advisor-options" role="radiogroup" aria-labelledby="advisor-options-label">
      <span id="advisor-options-label" class="city-build-label">Kuka hoitaa tason puolestasi</span>
    </div>
    <button class="btn btn-secondary advisor-own" type="button" aria-pressed="false">Ohjaan itse: kaikki valikot esiin</button>
    <span class="city-build-label">Viimeksi</span>
    <ul class="city-area advisor-log"></ul>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  q('.advisor-own').addEventListener('click', () => on.choose('none'));
  const options = q('.advisor-options');
  let last = '';
  const update = (v: AdvisorView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('.advisor-level').textContent = v.level;
    options.querySelectorAll('.city-build').forEach(o => o.remove());
    q('.advisor-own').setAttribute('aria-pressed', String(v.options.some(o => o.id === 'none' && o.selected)));
    for (const o of v.options.filter(x => x.id !== 'none')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'city-build';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(o.selected));
      // The face is our own drawing from constants (portraits.ts); every text goes in as text
      b.innerHTML = `${o.person ? `<span class="advisor-face">${portraitSvg(o.person, 40)}</span>` : ''}<span class="advisor-option-text"><span class="city-build-top"><span class="city-build-name"></span><span class="city-build-cost advisor-person"></span></span><span class="city-build-info"></span><span class="advisor-bonus"></span></span>`;
      b.classList.add('advisor-option');
      b.querySelector('.city-build-name')!.textContent = o.name;
      b.querySelector('.advisor-person')!.textContent = o.person ? `${o.person.name} ${o.person.title}` : '';
      b.querySelector('.city-build-info')!.textContent = o.does;
      // What the person adds while chosen (STORY-107)
      b.querySelector('.advisor-bonus')!.textContent = o.person ? `Bonus: ${describeBonus(o.person.level, o.person.bonus)}` : '';
      b.addEventListener('click', () => on.choose(o.id));
      options.appendChild(b);
    }
    const log = q('.advisor-log');
    log.replaceChildren();
    for (const line of v.log.length ? v.log : ['Ei vielä toimia.']) {
      const li = document.createElement('li');
      renderRich(li, line, on.links);
      log.appendChild(li);
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
