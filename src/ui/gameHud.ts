/**
 * gameHud.ts — the city-area HUD (Claude Design handoff, view 2b).
 *
 * Top: pause / play, speed 1× / 2× / 4×, "Päivä N" with the speed, and the province's
 * mapping meter with a tick at the unlock share. Bottom: the selected unit's name and
 * status; a scout's mode and the flag tool, or the settler's city site actions.
 */
import { SPEEDS, type Speed } from '../game/clock';
import { MODE_NAMES, type Mode } from '../game/units';

// Phosphor icons (MIT): play, pause, flag
const PLAY = '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';
const PAUSE = '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"/></svg>';
const FLAG = '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M34.76,42A8,8,0,0,0,32,48V216a8,8,0,0,0,16,0V171.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V48A8,8,0,0,0,210.76,42c-28,24.22-51.72,12.48-79.21-1.13C103.07,26.76,70.78,10.79,34.76,42ZM208,164.25c-26.79,21.16-49.87,9.74-76.45-3.41-25-12.38-52.35-25.92-83.55-5.34V51.79c26.79-21.16,49.87-9.75,76.45,3.4,25,12.38,52.35,25.91,83.55,5.35Z"/></svg>';

export interface GameHudState {
  day: number;
  speed: Speed;
  paused: boolean;
  /** Mapped share of the region the meter shows (0–1), its name and the share that unlocks it. */
  mapped: number;
  meterName: string;
  unlockAt: number;
  /** View level: the unit panel shows at the city-area level (3) only. */
  level: number;
  unit: { name: string; status: string; kind: 'scout' | 'settler'; mode: Mode } | null;
  /** The flag tool is waiting for a tap on the map. */
  flagTool: boolean;
}

export interface GameHudHandlers {
  togglePause(): void;
  setSpeed(speed: Speed): void;
  setMode(mode: Mode): void;
  toggleFlagTool(): void;
  found(): void;
  nextSite(): void;
  /** Select the next unit and bring it into view. */
  nextUnit(): void;
}

export function createGameHud(root: HTMLElement, on: GameHudHandlers): { update(state: GameHudState): void; element: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'game-hud';
  el.innerHTML = `
    <section class="hud-panel hud-top" aria-label="Aika ja kartoitus">
      <div class="hud-row">
        <button class="btn btn-secondary hud-icon hud-pause" type="button"></button>
        <div class="seg hud-speed" role="radiogroup" aria-label="Nopeus">
          ${SPEEDS.map(s => `<label class="seg-opt"><input type="radio" name="hud-speed" value="${s}">${s}×</label>`).join('')}
        </div>
        <div class="hud-spacer"></div>
        <div class="hud-day"><span class="hud-day-n"></span><span class="hud-day-label"></span></div>
      </div>
      <div class="hud-row hud-meter-row">
        <span class="hud-meter-name">Lääni</span>
        <div class="hud-meter" role="meter" aria-label="Läänistä kartoitettu" aria-valuemin="0" aria-valuemax="100"><div class="hud-meter-fill"></div><div class="hud-meter-tick"></div></div>
        <span class="hud-meter-value"></span>
      </div>
    </section>
    <section class="hud-panel hud-bottom" aria-label="Valittu yksikkö">
      <button class="hud-unit" type="button" aria-label="Seuraava yksikkö"><span class="hud-unit-name"></span><span class="hud-unit-status"></span></button>
      <div class="hud-row hud-scout">
        <div class="seg hud-modes" role="radiogroup" aria-label="Moodi">
          ${(Object.keys(MODE_NAMES) as Mode[]).map(m => `<label class="seg-opt"><input type="radio" name="hud-mode" value="${m}">${MODE_NAMES[m]}</label>`).join('')}
        </div>
        <button class="btn btn-primary hud-icon hud-flag" type="button" aria-label="Lippu: aseta tutkimuskohde">${FLAG}</button>
      </div>
      <div class="hud-row hud-settler">
        <button class="btn btn-primary hud-found" type="button">Perusta kaupunki tähän</button>
        <button class="btn btn-secondary hud-next-site" type="button">Vaihda paikka</button>
      </div>
    </section>`;
  root.appendChild(el);
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const pause = q<HTMLButtonElement>('.hud-pause');
  pause.addEventListener('click', on.togglePause);
  el.querySelectorAll<HTMLInputElement>('input[name="hud-speed"]').forEach(i => i.addEventListener('change', () => on.setSpeed(Number(i.value) as Speed)));
  el.querySelectorAll<HTMLInputElement>('input[name="hud-mode"]').forEach(i => i.addEventListener('change', () => on.setMode(i.value as Mode)));
  q<HTMLButtonElement>('.hud-flag').addEventListener('click', on.toggleFlagTool);
  q<HTMLButtonElement>('.hud-found').addEventListener('click', on.found);
  q<HTMLButtonElement>('.hud-next-site').addEventListener('click', on.nextSite);
  q<HTMLButtonElement>('.hud-unit').addEventListener('click', on.nextUnit);

  let last = '';
  return {
    element: el,
    update(s) {
      const key = JSON.stringify(s);
      if (key === last) return;
      last = key;
      pause.innerHTML = s.paused ? PLAY : PAUSE;
      pause.setAttribute('aria-label', s.paused ? 'Jatka' : 'Tauko');
      el.querySelectorAll<HTMLInputElement>('input[name="hud-speed"]').forEach(i => { i.checked = Number(i.value) === s.speed; });
      q<HTMLElement>('.hud-day-n').textContent = `Päivä ${s.day}`;
      q<HTMLElement>('.hud-day-label').textContent = s.paused ? 'Tauolla' : `${s.speed}× nopeus`;
      const pct = Math.round(s.mapped * 100);
      q<HTMLElement>('.hud-meter-fill').style.width = `${Math.min(100, pct)}%`;
      q<HTMLElement>('.hud-meter-tick').style.left = `${s.unlockAt * 100}%`;
      q<HTMLElement>('.hud-meter').setAttribute('aria-valuenow', String(pct));
      q<HTMLElement>('.hud-meter-value').textContent = `${pct} / ${Math.round(s.unlockAt * 100)} %`;
      q<HTMLElement>('.hud-meter-name').textContent = s.meterName;
      const bottom = q<HTMLElement>('.hud-bottom');
      bottom.hidden = !s.unit || s.level !== 3;
      if (!s.unit) return;
      q<HTMLElement>('.hud-unit-name').textContent = s.unit.name;
      q<HTMLElement>('.hud-unit-status').textContent = s.unit.status;
      q<HTMLElement>('.hud-scout').hidden = s.unit.kind !== 'scout';
      q<HTMLElement>('.hud-settler').hidden = s.unit.kind !== 'settler';
      el.querySelectorAll<HTMLInputElement>('input[name="hud-mode"]').forEach(i => { i.checked = i.value === s.unit!.mode; });
      q<HTMLElement>('.hud-flag').classList.toggle('hud-active', s.flagTool);
      q<HTMLElement>('.hud-flag').setAttribute('aria-pressed', String(s.flagTool));
    },
  };
}
