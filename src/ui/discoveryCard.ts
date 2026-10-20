/**
 * discoveryCard.ts — the card that stops the game (design 4a): it suggests a good city site
 * (STORY-032) and warns of bandits (STORY-034). Scouts' finds no longer use it (STORY-052).
 *
 * While the card is open the game stands still: a chip says "Peli pysähtyi · Päivä N",
 * an accent ring marks the tile, and the bottom sheet offers the choices. After a choice
 * a notice (role=status) tells what changed; the game's other notices use it too.
 */
import { PAUSE } from './gameHud';

/** What a choice on the card is: building a city at a suggested site, a soldier against bandits, or later. */
export type ChoiceKind = 'site' | 'defend' | 'later' | 'treaty';

// Icons on a 24 px grid in ink (own)
const ICONS: Record<ChoiceKind, string> = {
  site: '<path d="M3 20 H21 M5 20 V12 L9 9 L13 12 V20 M13 20 V8 L17 5 L21 8 V20 M8 15 H10 M16 12 H18" stroke-linejoin="round" stroke-linecap="round"/>',
  defend: '<path d="M12 3 L19 6 V11 C19 16 16 19 12 21 C8 19 5 16 5 11 V6 Z" stroke-linejoin="round"/>',
  later: '<circle cx="12" cy="12" r="8"/><path d="M12 7 V12 L15.5 14" stroke-linecap="round"/>',
  // Two hands meeting (STORY-076, own)
  treaty: '<path d="M3 11 L7 7 L11 9 L14 7 L21 12 M7 7 V13 L11 17 L15 13 M11 13 L13 15 M9 11 L11 13" stroke-linejoin="round" stroke-linecap="round"/>',
};

export interface DiscoveryView {
  day: number;
  /** "Löytö · Tiedustelija 1" */
  kicker: string;
  /** The city area's name. */
  title: string;
  body: string;
  options: { kind: ChoiceKind; title: string; effect: string }[];
  /** Under the choices; a discovery's by default. */
  note?: string;
}

export interface DiscoveryCard {
  show(view: DiscoveryView): void;
  hide(): void;
  /** Screen position (CSS px) of the discovery tile, or null when out of view. */
  setRing(x: number | null, y: number | null): void;
  /** A notice under the top panel for a few seconds. */
  notice(text: string): void;
  readonly visible: boolean;
}

const NOTICE_MS = 4000;

export function createDiscoveryCard(root: HTMLElement, onChoose: (index: number) => void): DiscoveryCard {
  const layer = document.createElement('div');
  layer.className = 'discovery';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="discovery-shade"></div>
    <div class="discovery-ring"></div>
    <div class="discovery-pause">${PAUSE}<span class="discovery-day"></span></div>
    <section class="discovery-card" role="dialog" aria-labelledby="discovery-title" aria-describedby="discovery-body">
      <div class="discovery-head">
        <span class="discovery-kicker"></span>
        <h2 id="discovery-title" class="discovery-title"></h2>
        <span id="discovery-body" class="discovery-body"></span>
      </div>
      <div class="discovery-options"></div>
      <span class="discovery-note">Valitsematta jäänyt löytö katoaa.</span>
    </section>`;
  root.appendChild(layer);
  const notice = document.createElement('div');
  notice.className = 'hud-notice';
  notice.setAttribute('role', 'status');
  root.appendChild(notice);
  const q = <T extends HTMLElement>(sel: string) => layer.querySelector<T>(sel)!;
  const ring = q<HTMLElement>('.discovery-ring');
  let noticeTimer = 0;

  return {
    show(view) {
      q<HTMLElement>('.discovery-day').textContent = `Peli pysähtyi · Päivä ${view.day}`;
      q<HTMLElement>('.discovery-kicker').textContent = view.kicker;
      q<HTMLElement>('.discovery-title').textContent = view.title;
      q<HTMLElement>('.discovery-body').textContent = view.body;
      q<HTMLElement>('.discovery-note').textContent = view.note ?? 'Valitsematta jäänyt löytö katoaa.';
      const options = q<HTMLElement>('.discovery-options');
      options.replaceChildren(...view.options.map((o, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-secondary discovery-option';
        b.innerHTML = `<span class="discovery-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${ICONS[o.kind]}</svg></span>
          <span class="discovery-option-text"><span class="discovery-option-title"></span><span class="discovery-option-effect"></span></span>`;
        b.querySelector('.discovery-option-title')!.textContent = o.title;
        b.querySelector('.discovery-option-effect')!.textContent = o.effect;
        b.addEventListener('click', () => onChoose(i));
        return b;
      }));
      layer.hidden = false;
      root.classList.add('discovering');
      options.querySelector('button')!.focus();
    },
    hide() {
      layer.hidden = true;
      root.classList.remove('discovering');
    },
    setRing(x, y) {
      ring.hidden = x === null || y === null;
      if (x !== null && y !== null) ring.style.transform = `translate(${x}px, ${y}px)`;
    },
    notice(text) {
      notice.textContent = text;
      notice.classList.add('hud-notice-on');
      clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => notice.classList.remove('hud-notice-on'), NOTICE_MS);
    },
    get visible() { return !layer.hidden; },
  };
}
