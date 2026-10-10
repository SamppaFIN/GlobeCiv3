/**
 * discoveryCard.ts — a scout's discovery (design 4a).
 *
 * While the card is open the game stands still: a chip says "Peli pysähtyi · Päivä N",
 * an accent ring marks the tile, and the bottom sheet offers two finds. After the choice
 * a notice (role=status) tells what changed.
 */
import type { FindKind } from '../game/discoveries';
import { PAUSE } from './gameHud';

// Find icons on a 24 px grid in ink (fish and ruins as in design 4a)
const ICONS: Record<FindKind, string> = {
  fish: '<path d="M3 12 Q11 5 17 12 Q11 19 3 12 Z M17 12 L21 8 V16 Z" stroke-linejoin="round"/>',
  ruins: '<path d="M4 20 H20 M6 20 V9 M10 20 V12 M14 20 V7 M18 20 V11 M5 9 H8 M13 7 H16" stroke-linecap="round"/>',
  ore: '<path d="M4 19 L8 9 L13 5 L19 9 L20 19 Z M8 15 L12 12 L16 14" stroke-linejoin="round" stroke-linecap="round"/>',
  trail: '<path d="M4 20 C8 15 10 17 12 12 C14 7 17 8 20 4" stroke-linecap="round" stroke-dasharray="2.5 2.5"/>',
  lookout: '<path d="M2 12 Q12 4 22 12 Q12 20 2 12 Z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/>',
};

export interface DiscoveryView {
  day: number;
  /** "Löytö · Tiedustelija 1" */
  kicker: string;
  /** The city area's name. */
  title: string;
  body: string;
  options: { kind: FindKind; title: string; effect: string }[];
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
