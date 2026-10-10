/**
 * levelBar.ts — breadcrumb of the view level and a back button (STORY-029).
 */
import { LEVEL_NAMES, regionLabel, type RegionRef, type ViewLevel } from '../globe/levels';

export interface LevelBarState {
  level: ViewLevel;
  /** Regions containing the view, state first. */
  path: RegionRef[];
  selection: RegionRef | null;
  /** False while zooming out is locked at this level (STORY-021, STORY-026). */
  canGoBack: boolean;
}

// Phosphor "arrow-left" (MIT)
const ARROW = '<svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>';
const TAP_HINT = ['Napauta valtiota', 'Napauta lääniä', 'Napauta aluetta', ''];

export function createLevelBar(root: HTMLElement, onBack: () => void): { update(state: LevelBarState): void; setVisible(visible: boolean): void } {
  const bar = document.createElement('nav');
  bar.className = 'level-bar';
  bar.setAttribute('aria-label', 'Karttataso');
  bar.innerHTML = `<button class="btn btn-secondary level-back" type="button" aria-label="Taso ylös">${ARROW}</button>
    <div class="level-text"><div class="level-kicker"></div><div class="level-title"></div><div class="level-hint" aria-live="polite"></div></div>`;
  root.appendChild(bar);
  const back = bar.querySelector<HTMLButtonElement>('.level-back')!;
  const kicker = bar.querySelector<HTMLElement>('.level-kicker')!;
  const title = bar.querySelector<HTMLElement>('.level-title')!;
  const hint = bar.querySelector<HTMLElement>('.level-hint')!;
  back.addEventListener('click', onBack);

  let last = '';
  return {
    setVisible(visible) {
      bar.hidden = !visible;
    },
    update(state) {
      const key = JSON.stringify(state);
      if (key === last) return;
      last = key;
      back.hidden = state.level === 0 || !state.canGoBack;
      kicker.textContent = LEVEL_NAMES[state.level];
      title.textContent = state.path.length ? state.path.map(regionLabel).join(' › ') : 'Koko maailma';
      hint.textContent = state.selection ? `${regionLabel(state.selection)} valittu · napauta uudelleen` : TAP_HINT[state.level];
    },
  };
}
