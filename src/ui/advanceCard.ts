/**
 * advanceCard.ts — an advance gained (STORY-118; Sami 2026-11-23: "kun uusi tiede keksitään,
 * tulee ikkuna, joka kertoo vaikutukset, peli pysähtyy siihen kunnes käyttäjä on valinnut uuden
 * tieteen"). The game stands still while the card is open: it tells what the advance does with
 * its numbers (codex.ts advanceEffects, as the science tree and the Tietokirja), and asks for the
 * next study. The advisor's choice waits ready on it; in the player's own hand none is chosen.
 * A building the advance opened can be put first in every city or in the capital, or left to
 * the advisors.
 *
 * Names come in as parameters and go out as text, never as markup (security rule 5).
 */
import type { Building } from '../game/cities';
import type { FirstScope } from '../game/commands';
import type { Advance, Study } from '../game/science';
import { advanceSvg } from './advanceArt';
import { renderRich, type RichLinks } from './richText';
import type { Rich } from '../game/rich';

export interface AdvanceView {
  advance: Advance;
  /** "Uusi keksintö · Päivä 120" */
  kicker: string;
  name: string;
  /** What the advance does, a fact each (advanceEffects). */
  facts: { label: string; value: Rich }[];
  /** The studies open next, with their price and what they open. */
  options: { study: Study; name: string; cost: string; opens: string }[];
  /** The study chosen ready: the one under way or the advisor's; null in the player's own hand. */
  chosen: Study | null;
  /** Who chose it ready, under the studies; null when none did. */
  suggestion: string | null;
  /** The buildings the advance opened that a city may build: the choices to put one first. */
  firsts: { build: Building; name: string; wonder: boolean }[];
  /** Cards waiting after this one. */
  more: number;
}

export interface AdvanceCard {
  /** Show the card, or update it: a card of the same advance keeps the player's choices. */
  show(view: AdvanceView): void;
  hide(): void;
  readonly visible: boolean;
}

type First = { build: Building; scope: FirstScope } | null;

export function createAdvanceCard(root: HTMLElement, on: { answer(study: Study | null, first: First): void; links?: RichLinks }): AdvanceCard {
  const el = document.createElement('section');
  el.className = 'city-card advance-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'advance-kicker advance-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="advance-head">
      <div class="advance-card-art" aria-hidden="true"></div>
      <div class="city-titles"><span id="advance-kicker" class="city-kicker"></span><h2 id="advance-title" class="city-name"></h2></div>
    </div>
    <dl class="codex-facts advance-facts"></dl>
    <div class="city-builds advance-studies" role="radiogroup" aria-labelledby="advance-studies-label">
      <span id="advance-studies-label" class="city-build-label">Tutki seuraavaksi</span>
    </div>
    <span class="city-hint advance-suggestion"></span>
    <div class="city-builds advance-firsts" role="radiogroup" aria-labelledby="advance-firsts-label">
      <span id="advance-firsts-label" class="city-build-label">Uusi rakennus</span>
    </div>
    <button class="btn btn-primary advance-go" type="button">Jatka</button>
    <span class="city-hint advance-more"></span>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const go = q<HTMLButtonElement>('.advance-go');
  let view: AdvanceView | null = null;
  let study: Study | null = null;
  let first: First = null;
  // The choices are drawn anew only when they change: a button kept under the pointer stays tappable
  let drawn = '';

  const radio = (parent: HTMLElement, name: string, info: string, checked: boolean, pick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'city-build';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    b.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span><span class="city-build-eta"></span></span><span class="city-build-info"></span>';
    b.querySelector('.city-build-name')!.textContent = name;
    b.querySelector('.city-build-info')!.textContent = info;
    b.addEventListener('click', () => { pick(); render(); });
    parent.appendChild(b);
    return b;
  };

  // The choices drawn anew from the view and what is picked
  const render = () => {
    if (!view) return;
    const v = view;
    const key = JSON.stringify([v.options, v.suggestion, v.firsts, v.more, study, first]);
    if (key === drawn) return;
    drawn = key;
    const studies = q('.advance-studies');
    studies.querySelectorAll('.city-build').forEach(b => b.remove());
    for (const o of v.options) {
      const b = radio(studies, o.name, o.opens, o.study === study, () => { study = o.study; });
      b.querySelector('.city-build-eta')!.textContent = o.cost;
    }
    studies.hidden = !v.options.length;
    const hint = q('.advance-suggestion');
    hint.textContent = v.options.length ? (v.suggestion ?? 'Valitse tutkimus: peli jatkuu, kun olet valinnut.') : 'Kaikki tunnetut keksinnöt on tutkittu.';
    const firsts = q('.advance-firsts');
    firsts.querySelectorAll('.city-build').forEach(b => b.remove());
    for (const f of v.firsts) {
      if (!f.wonder) radio(firsts, `${f.name}: kaikki kaupungit ensin`, 'Jokainen kaupunki rakentaa sen ennen muuta', first?.build === f.build && first.scope === 'all', () => { first = { build: f.build, scope: 'all' }; });
      radio(firsts, `${f.name}: pääkaupunki ensin`, 'Pääkaupunki rakentaa sen ennen muuta', first?.build === f.build && first.scope === 'capital', () => { first = { build: f.build, scope: 'capital' }; });
    }
    if (v.firsts.length) radio(firsts, 'Neuvonantaja päättää', 'Kaupungit rakentavat kuten ennen', first === null, () => { first = null; });
    firsts.hidden = !v.firsts.length;
    // The game goes on once a study is chosen, or when none is open
    go.disabled = v.options.length > 0 && study === null;
    q('.advance-more').textContent = v.more ? `${v.more} keksintö${v.more === 1 ? '' : 'ä'} odottaa vielä` : '';
    q('.advance-more').hidden = !v.more;
  };

  go.addEventListener('click', () => {
    if (!view || go.disabled) return;
    on.answer(view.options.length ? study : null, first);
  });

  return {
    show(v) {
      const fresh = !view || view.advance !== v.advance || el.hidden;
      view = v;
      if (fresh) {
        study = v.chosen;
        first = null;
        q('#advance-kicker').textContent = v.kicker;
        q('#advance-title').textContent = v.name;
        // Our own drawing from constants (advanceArt.ts)
        q('.advance-card-art').innerHTML = advanceSvg(v.advance, 64);
        const facts = q('.advance-facts');
        facts.replaceChildren();
        for (const f of v.facts) {
          const dt = document.createElement('dt');
          dt.textContent = f.label;
          const dd = document.createElement('dd');
          renderRich(dd, f.value, on.links);
          facts.append(dt, dd);
        }
      }
      // A study no longer open is no longer chosen
      if (study !== null && !v.options.some(o => o.study === study)) study = null;
      render();
      if (el.hidden) {
        el.hidden = false;
        root.classList.add('advance-open');
        (go.disabled ? el.querySelector<HTMLButtonElement>('.advance-studies .city-build') ?? go : go).focus();
      }
    },
    hide() {
      el.hidden = true;
      view = null;
      drawn = '';
      root.classList.remove('advance-open');
    },
    get visible() { return !el.hidden; },
  };
}
