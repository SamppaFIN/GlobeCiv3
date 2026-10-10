/**
 * levelUi.ts — the province and state levels of the game (design 5a, 6a, 7a).
 *
 * The unlock card tells that a level opened and how to zoom out. Region chips sit on
 * the map over the child regions (96 × 44, the selected one with an accent ring), and
 * the bottom panel holds the selected region's actions.
 */
import { AREA_PLAN_NAMES, STATE_LINE_NAMES, type AreaPlan, type StateLine } from '../game/units';

export interface UnlockCard {
  show(title: string): void;
  hide(): void;
  readonly visible: boolean;
}

/** Design 5a: "Uusi taso avautui", a pinch hint, the desktop hint and two choices. */
export function createUnlockCard(root: HTMLElement, onZoomOut: () => void): UnlockCard {
  const el = document.createElement('section');
  el.className = 'unlock-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'unlock-title');
  el.hidden = true;
  el.innerHTML = `
    <span class="unlock-kicker">Uusi taso avautui</span>
    <h2 id="unlock-title" class="unlock-title"></h2>
    <div class="unlock-pinch" aria-hidden="true"><span></span><span></span></div>
    <span class="unlock-hint">Nipistä kahdella sormella</span>
    <span class="unlock-desktop">Työpöydällä: hiiren rulla taaksepäin tai −</span>
    <div class="unlock-actions">
      <button class="btn btn-primary unlock-go" type="button">Zoomaa ulos</button>
      <button class="btn btn-secondary unlock-later" type="button">Myöhemmin</button>
    </div>`;
  root.appendChild(el);
  const hide = () => { el.hidden = true; };
  el.querySelector('.unlock-go')!.addEventListener('click', () => { hide(); onZoomOut(); });
  el.querySelector('.unlock-later')!.addEventListener('click', hide);
  return {
    show(title) {
      el.querySelector('.unlock-title')!.textContent = title;
      el.hidden = false;
      el.querySelector<HTMLButtonElement>('.unlock-go')!.focus();
    },
    hide,
    get visible() { return !el.hidden; },
  };
}

export interface Chip {
  id: number;
  name: string;
  sub: string;
  /** Screen position in CSS pixels, or null when not in view. */
  x: number | null;
  y: number | null;
  selected: boolean;
}

/** Half a chip's height (44 px, design 96 × 44) and a 4 px margin. */
const CHIP_HALF = 26;

/** Region chips over the map (design 6a, 7a). Tapping one selects it; tapping it again dives in. */
export function createChips(root: HTMLElement, onTap: (id: number) => void): { update(chips: Chip[], free: { top: number; bottom: number }): void } {
  const layer = document.createElement('div');
  layer.className = 'chips';
  root.appendChild(layer);
  const pool: HTMLButtonElement[] = [];
  return {
    /** `free`: the screen band between the HUD panels; chips are kept inside it so they can be tapped. */
    update(chips, free) {
      while (pool.length < chips.length) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.innerHTML = '<span class="chip-name"></span><span class="chip-sub"></span>';
        b.addEventListener('click', () => onTap(Number(b.dataset.id)));
        layer.appendChild(b);
        pool.push(b);
      }
      pool.forEach((b, i) => {
        const c = chips[i];
        b.hidden = !c || c.x === null || c.y === null;
        if (!c || b.hidden) return;
        b.dataset.id = String(c.id);
        // Centred on the region, whatever the chip's width, but not under a panel
        const y = Math.min(Math.max(c.y!, free.top + CHIP_HALF), free.bottom - CHIP_HALF);
        b.style.transform = `translate(${c.x!.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        b.classList.toggle('chip-selected', c.selected);
        b.setAttribute('aria-pressed', String(c.selected));
        b.querySelector('.chip-name')!.textContent = c.name;
        b.querySelector('.chip-sub')!.textContent = c.sub;
      });
    },
  };
}

export interface AreaPanelState {
  name: string;
  /** "Kartoitettu 18 % · rannikkoa ja kukkuloita" */
  detail: string;
  plan: AreaPlan;
  /** "Itärantaan": the expedition's destination in the illative, or null for home. */
  expedition: string | null;
}

export interface StatePanelState {
  line: StateLine;
  /** The selected province: name and its mapped share. */
  name: string;
  detail: string;
  isTarget: boolean;
}

export interface LevelPanels {
  update(level: number, area: AreaPanelState | null, state: StatePanelState | null): void;
}

/** Bottom panels of the province level (design 6a) and the state level (7a). */
export function createLevelPanels(root: HTMLElement, on: {
  setPlan(plan: AreaPlan): void;
  expedition(): void;
  setLine(line: StateLine): void;
  setTarget(): void;
}): LevelPanels {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="hud-panel level-bottom level-panel area-panel" aria-label="Kaupunkialue" hidden>
      <div class="panel-title"><span class="panel-name area-name"></span><span class="panel-detail area-detail"></span></div>
      <div class="seg level-seg" role="radiogroup" aria-label="Painotus">
        ${(Object.keys(AREA_PLAN_NAMES) as AreaPlan[]).map(p => `<label class="seg-opt"><input type="radio" name="area-plan" value="${p}">${AREA_PLAN_NAMES[p]}</label>`).join('')}
      </div>
      <button class="btn btn-secondary area-expedition" type="button"></button>
    </section>
    <section class="hud-panel level-bottom level-panel state-panel" aria-label="Valtio" hidden>
      <span class="level-kicker">Valtion linja</span>
      <div class="seg level-seg" role="radiogroup" aria-label="Valtion linja">
        ${(Object.keys(STATE_LINE_NAMES) as StateLine[]).map(l => `<label class="seg-opt"><input type="radio" name="state-line" value="${l}">${STATE_LINE_NAMES[l]}</label>`).join('')}
      </div>
      <div class="hud-row">
        <div class="panel-title state-target"><span class="panel-name province-name"></span><span class="panel-detail province-detail"></span></div>
        <button class="btn btn-secondary state-set-target" type="button">Tavoitteeksi</button>
      </div>
    </section>`;
  root.appendChild(el);
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  el.querySelectorAll<HTMLInputElement>('input[name="area-plan"]').forEach(i => i.addEventListener('change', () => on.setPlan(i.value as AreaPlan)));
  el.querySelectorAll<HTMLInputElement>('input[name="state-line"]').forEach(i => i.addEventListener('change', () => on.setLine(i.value as StateLine)));
  q('.area-expedition').addEventListener('click', on.expedition);
  q('.state-set-target').addEventListener('click', on.setTarget);
  let last = '';
  return {
    update(level, area, state) {
      const key = JSON.stringify([level, area, state]);
      if (key === last) return;
      last = key;
      q<HTMLElement>('.area-panel').hidden = level !== 2 || !area;
      q<HTMLElement>('.state-panel').hidden = level !== 1 || !state;
      if (area) {
        q('.area-name').textContent = area.name;
        q('.area-detail').textContent = area.detail;
        el.querySelectorAll<HTMLInputElement>('input[name="area-plan"]').forEach(i => { i.checked = i.value === area.plan; });
        const exp = q<HTMLButtonElement>('.area-expedition');
        exp.hidden = area.expedition === null;
        exp.textContent = area.expedition ? `Lähetä retkikunta ${area.expedition}` : '';
      }
      if (state) {
        el.querySelectorAll<HTMLInputElement>('input[name="state-line"]').forEach(i => { i.checked = i.value === state.line; });
        q('.province-name').textContent = state.name;
        q('.province-detail').textContent = state.detail;
        const t = q<HTMLButtonElement>('.state-set-target');
        t.disabled = state.isTarget;
        t.textContent = state.isTarget ? 'Tavoite' : 'Tavoitteeksi';
      }
    },
  };
}
