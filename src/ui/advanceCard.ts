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
import type { Person } from '../game/persons';
import { advanceSvg } from './advanceArt';
import { portraitSvg } from './portraits';
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
  /** The buildings the advance opened that a city may build, and where each can go first. */
  firsts: { build: Building; name: string; scopes: FirstScope[] }[];
  /** Cards waiting after this one. */
  more: number;
  /** The era the advance opens (STORY-120), and the three persons it brings to the level in view; null for other advances. */
  era: { name: string; persons: { person: Person; bonus: string; page: string }[] } | null;
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
  el.setAttribute('aria-modal', 'true');
  el.hidden = true;
  el.innerHTML = `
    <div class="advance-head">
      <div class="advance-card-art" aria-hidden="true"></div>
      <div class="city-titles"><span id="advance-kicker" class="city-kicker"></span><h2 id="advance-title" class="city-name" tabindex="-1"></h2></div>
    </div>
    <section class="advance-era" aria-labelledby="advance-era-title" hidden>
      <h3 id="advance-era-title" class="advance-era-title"></h3>
      <span class="city-hint">Uudet neuvonantajat:</span>
      <ul class="advance-era-people"></ul>
    </section>
    <dl class="codex-facts advance-facts"></dl>
    <div class="city-builds advance-studies" role="radiogroup" aria-labelledby="advance-studies-label">
      <span id="advance-studies-label" class="city-build-label">Tutki seuraavaksi</span>
    </div>
    <span id="advance-suggestion" class="city-hint advance-suggestion"></span>
    <div class="city-builds advance-firsts" role="radiogroup" aria-labelledby="advance-firsts-label">
      <span id="advance-firsts-label" class="city-build-label">Uusi rakennus</span>
    </div>
    <button class="btn btn-primary advance-go" type="button" aria-describedby="advance-suggestion">Jatka</button>
    <span class="city-hint advance-more"></span>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const go = q<HTMLButtonElement>('.advance-go');
  let view: AdvanceView | null = null;
  /** Where the focus was before the card: it goes back there (Utu's review). */
  let before: HTMLElement | null = null;
  let study: Study | null = null;
  let first: First = null;
  // The choices are drawn anew only when they change: a button kept under the pointer stays tappable
  let drawn = '';

  const radio = (parent: HTMLElement, name: string, info: string, pick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'city-build';
    b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span><span class="city-build-eta"></span></span><span class="city-build-info"></span>';
    b.querySelector('.city-build-name')!.textContent = name;
    b.querySelector('.city-build-info')!.textContent = info;
    // A choice only marks the buttons: they stay, and the focus with them (Utu's review, WCAG 2.4.3)
    b.addEventListener('click', () => { pick(); mark(); });
    parent.appendChild(b);
    return b;
  };
  /** Each button's choice, to mark the chosen. */
  const choices = new Map<HTMLButtonElement, () => boolean>();

  // The choices drawn anew when they change, not when one is picked
  const render = () => {
    if (!view) return;
    const v = view;
    const key = JSON.stringify([v.options, v.suggestion, v.firsts, v.more, v.era?.name ?? null]);
    if (key !== drawn) {
      drawn = key;
      // A new era told in words, its persons a row each that opens their page (STORY-120)
      const era = q('.advance-era');
      era.hidden = !v.era;
      const people = q('.advance-era-people');
      people.replaceChildren();
      if (v.era) {
        q('.advance-era-title').textContent = `Uusi aikakausi: ${v.era.name}`;
        for (const x of v.era.persons) {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'advance-era-person';
          b.innerHTML = `<span class="advisor-face">${portraitSvg(x.person, 40)}</span><span class="advance-era-text"><span class="advance-era-name"></span><span class="advisor-bonus"></span></span>`;
          b.querySelector('.advance-era-name')!.textContent = `${x.person.name} ${x.person.title}`;
          b.querySelector('.advisor-bonus')!.textContent = x.bonus;
          b.addEventListener('click', () => on.links?.page?.(x.page));
          li.appendChild(b);
          people.appendChild(li);
        }
      }
      choices.clear();
      const studies = q('.advance-studies');
      studies.querySelectorAll('.city-build').forEach(b => b.remove());
      for (const o of v.options) {
        const b = radio(studies, o.name, o.opens, () => { study = o.study; });
        b.querySelector('.city-build-eta')!.textContent = o.cost;
        choices.set(b, () => study === o.study);
      }
      studies.hidden = !v.options.length;
      q('.advance-suggestion').textContent = v.options.length ? (v.suggestion ?? 'Valitse tutkimus: peli jatkuu, kun olet valinnut.') : 'Kaikki tunnetut keksinnöt on tutkittu.';
      const firsts = q('.advance-firsts');
      firsts.querySelectorAll('.city-build').forEach(b => b.remove());
      for (const f of v.firsts) {
        for (const scope of f.scopes) {
          const b = scope === 'all'
            ? radio(firsts, `${f.name}: kaikki kaupungit ensin`, 'Jokainen kaupunki rakentaa sen ennen muuta', () => { first = { build: f.build, scope }; })
            : radio(firsts, `${f.name}: pääkaupunki ensin`, 'Pääkaupunki rakentaa sen ennen muuta', () => { first = { build: f.build, scope }; });
          choices.set(b, () => first?.build === f.build && first.scope === scope);
        }
      }
      const shown = v.firsts.some(f => f.scopes.length);
      if (shown) choices.set(radio(firsts, 'Neuvonantaja päättää', 'Kaupungit rakentavat kuten ennen', () => { first = null; }), () => first === null);
      firsts.hidden = !shown;
      q('.advance-more').textContent = v.more ? `${v.more} keksintö${v.more === 1 ? '' : 'ä'} odottaa vielä` : '';
      q('.advance-more').hidden = !v.more;
    }
    mark();
  };
  /** The chosen buttons marked, and the game goes on once a study is chosen or none is open. */
  const mark = () => {
    if (!view) return;
    for (const [b, chosen] of choices) b.setAttribute('aria-checked', String(chosen()));
    go.disabled = view.options.length > 0 && study === null;
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
        before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        el.hidden = false;
        root.classList.add('advance-open');
        // The card read from its top: the focus on its title, as in the Tietokirja, so a new era and
        // its persons are not scrolled away on a phone (STORY-120); Tab goes on to the choices
        el.scrollTop = 0;
        q('#advance-title').focus();
      }
    },
    hide() {
      const had = el.contains(document.activeElement);
      el.hidden = true;
      view = null;
      drawn = '';
      root.classList.remove('advance-open');
      if (had && before?.isConnected) before.focus();
      before = null;
    },
    get visible() { return !el.hidden; },
  };
}
