/**
 * startScreen.ts — the start screen (Claude Design handoff, view 1a "Kartografi"):
 * title block, a compass ring around the real 3D planet, "Uusi peli" and the
 * mapped share. The planet itself is the game's globe (rule 1), framed by main.ts.
 */

// Phosphor "arrow-right" (MIT)
const ARROW = '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>';

/** The ring's SVG is drawn for a planet of radius BODY in a box from -20 to 320 (as in the design). */
const BODY = 140;
const BOX = 340;
/** Outermost drawn radius (the P/I/E/L labels) over the planet radius. */
export const RING_EXTENT = 165 / BODY;

/** Compass ring: a faint accent glow, the limb outline, ticks every 5° and the cardinal letters. */
function ringSvg(): string {
  const parts = [
    '<defs><filter id="startGlow"><feGaussianBlur stdDeviation="6"/></filter></defs>',
    '<circle cx="150" cy="150" r="146" fill="none" stroke="#9184d9" stroke-width="6" opacity="0.08" filter="url(#startGlow)"/>',
    '<circle cx="150" cy="150" r="140" fill="none" stroke="var(--ink)" stroke-width="0.6" opacity="0.35"/>',
  ];
  for (let d = 0; d < 360; d += 5) {
    const a = ((d - 90) * Math.PI) / 180;
    const major = d % 90 === 0;
    const r2 = major ? 141 : d % 30 === 0 ? 145 : 147.5;
    const p = (r: number) => `${(150 + r * Math.cos(a)).toFixed(2)} ${(150 + r * Math.sin(a)).toFixed(2)}`;
    parts.push(`<path d="M${p(150)}L${p(r2)}" stroke="${major ? 'var(--ink)' : '#75798c'}" stroke-width="${major ? 1 : 0.6}"/>`);
  }
  // Pohjoinen, Itä, Etelä, Länsi
  for (const [t, d] of [['P', 0], ['I', 90], ['E', 180], ['L', 270]] as const) {
    const a = ((d - 90) * Math.PI) / 180;
    parts.push(`<text x="${(150 + 159 * Math.cos(a)).toFixed(2)}" y="${(150 + 159 * Math.sin(a) + 3.5).toFixed(2)}" text-anchor="middle" font-size="10" font-weight="500" fill="var(--ink)">${t}</text>`);
  }
  return parts.join('');
}

export interface StartScreen {
  readonly element: HTMLElement;
  /** Space left for the planet between the title and the actions, in CSS pixels. */
  freeSpace(): { top: number; bottom: number };
  /** Put the compass ring around the planet: centre and radius in CSS pixels. */
  placeRing(cx: number, cy: number, r: number): void;
  /** Fade out (or hide at once) but keep blocking input until remove(). */
  hide(fade: boolean): void;
  remove(): void;
}

export function createStartScreen(root: HTMLElement, onNewGame: () => void): StartScreen {
  const el = document.createElement('section');
  el.className = 'start';
  el.setAttribute('aria-label', 'Aloitus');
  el.innerHTML = `
    <svg class="start-ring" viewBox="-20 -20 ${BOX} ${BOX}" aria-hidden="true">${ringSvg()}</svg>
    <header class="start-title">
      <span class="start-kicker">Tuntematon maailma</span>
      <h1>GlobeCiv</h1>
      <span class="start-subtitle">Kartta, joka piirtyy</span>
    </header>
    <div class="start-actions">
      <button class="btn btn-primary btn-block start-new" type="button">Uusi peli ${ARROW}</button>
      <div class="start-progress"><div class="start-track"></div><span>Kartoitettu 0 %</span></div>
    </div>`;
  root.appendChild(el);
  const ring = el.querySelector<SVGSVGElement>('.start-ring')!;
  const title = el.querySelector<HTMLElement>('.start-title')!;
  const actions = el.querySelector<HTMLElement>('.start-actions')!;
  el.querySelector<HTMLButtonElement>('.start-new')!.addEventListener('click', onNewGame, { once: true });

  return {
    element: el,
    freeSpace: () => ({ top: title.getBoundingClientRect().bottom, bottom: actions.getBoundingClientRect().top }),
    placeRing(cx, cy, r) {
      const size = (BOX / BODY) * r;
      ring.style.width = ring.style.height = `${size}px`;
      ring.style.left = `${cx - size / 2}px`;
      ring.style.top = `${cy - size / 2}px`;
    },
    hide(fade) {
      if (!fade) el.style.transition = 'none';
      el.classList.add('start-leaving');
    },
    remove() {
      el.remove();
    },
  };
}
