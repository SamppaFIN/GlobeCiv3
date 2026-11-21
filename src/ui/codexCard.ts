/**
 * codexCard.ts — the Tietokirja's card (STORY-104): one page at a time, its kind, title, text and
 * facts, with the references as links to other pages. Back goes to the page before, and from the
 * first page to the index. A sheet over the other cards; the game goes on.
 */
import type { Page } from '../game/codex';
import { renderRich, type RichLinks } from './richText';

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';
const BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 L8 12 L15 19"/></svg>';

export interface CodexCard {
  /** Show a page; `back` tells whether there is somewhere to go back to. */
  show(page: Page, back: boolean): void;
  hide(): void;
  readonly visible: boolean;
  /** The key of the page on show. */
  readonly key: string | null;
}

export function createCodexCard(root: HTMLElement, on: { close(): void; back(): void; links: RichLinks }): CodexCard {
  const el = document.createElement('section');
  el.className = 'city-card codex-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Tietokirja');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <button class="btn btn-secondary hud-icon codex-back" type="button" aria-label="Takaisin">${BACK}</button>
      <div class="city-titles"><span class="city-kicker codex-kicker"></span><h2 id="codex-title" class="city-name" tabindex="-1"></h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje Tietokirja">${CLOSE}</button>
    </div>
    <p class="codex-text"></p>
    <dl class="codex-facts"></dl>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  q('.codex-back').addEventListener('click', on.back);
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      on.close();
    }
  });
  let key: string | null = null;

  return {
    show(page, back) {
      const turned = key !== page.key;
      key = page.key;
      q('.codex-kicker').textContent = page.kicker;
      q('#codex-title').textContent = page.title;
      q<HTMLButtonElement>('.codex-back').hidden = !back;
      renderRich(q('.codex-text'), page.text, on.links);
      const facts = q('.codex-facts');
      facts.replaceChildren();
      for (const f of page.facts) {
        const dt = document.createElement('dt');
        dt.textContent = f.label;
        const dd = document.createElement('dd');
        renderRich(dd, f.value, on.links);
        facts.append(dt, dd);
      }
      const opened = el.hidden;
      el.hidden = false;
      if (turned) el.scrollTop = 0;
      // Focus to the title, so a reader starts at the new page
      if (opened || turned) q<HTMLElement>('#codex-title').focus({ preventScroll: true });
    },
    hide() {
      el.hidden = true;
      key = null;
    },
    get visible() {
      return !el.hidden;
    },
    get key() {
      return key;
    },
  };
}
