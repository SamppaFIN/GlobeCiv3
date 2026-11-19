/**
 * areaPanel.ts — the level panel at the top of the game HUD (STORY-098).
 *
 * The meter's row tells where the view is: the level and the area's name (state,
 * province, city area or city), in place of the meter's name, so the top panel takes no
 * more of a phone's screen (STORY-025). A tap opens the area's infographic under the
 * goal: four figures (people, production, trade and science of the player's cities
 * there), the era and the area's details, and its quick actions.
 */

export interface AreaStat {
  label: string;
  value: string;
}

export interface AreaView {
  /** The level, e.g. "Kaupunkialue". */
  kicker: string;
  /** The area's name. */
  name: string;
  /** The infographic's four figures. */
  stats: AreaStat[];
  /** The area's details, a line each. */
  rows: AreaStat[];
  /** Quick actions; key is the keyboard shortcut shown beside the label. */
  actions: { id: string; label: string; key?: string }[];
}

export interface AreaPanel {
  /** Draws the view; null hides the panel. */
  update(view: AreaView | null): void;
  readonly open: boolean;
  toggle(): void;
}

// Phosphor "caret-down" (MIT)
const CARET = '<svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80a8,8,0,0,1,11.32-11.32L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>';

/** The button goes first in the meter's row; the infographic last in the panel. */
export function createAreaPanel(row: HTMLElement, panel: HTMLElement, onAction: (id: string) => void): AreaPanel {
  const button = document.createElement('button');
  button.className = 'hud-area';
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'hud-area-info');
  button.setAttribute('aria-keyshortcuts', 'i');
  button.innerHTML = `<span class="hud-area-kicker"></span><span class="hud-area-name"></span>${CARET}`;
  row.prepend(button);
  const info = document.createElement('div');
  info.className = 'hud-area-info';
  info.id = 'hud-area-info';
  info.setAttribute('role', 'region');
  info.setAttribute('aria-label', 'Alueen tiedot');
  info.hidden = true;
  info.innerHTML = '<div class="hud-area-stats"></div><dl class="hud-area-rows"></dl><div class="hud-area-actions"></div>';
  panel.appendChild(info);
  const box = button;
  const kicker = button.querySelector<HTMLElement>('.hud-area-kicker')!;
  const name = button.querySelector<HTMLElement>('.hud-area-name')!;
  const stats = info.querySelector<HTMLElement>('.hud-area-stats')!;
  const rows = info.querySelector<HTMLElement>('.hud-area-rows')!;
  const actions = info.querySelector<HTMLElement>('.hud-area-actions')!;
  actions.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (b) onAction(b.dataset.action!);
  });

  let open = false;
  let lastHead = '';
  let lastBody = '';
  const area: AreaPanel = {
    get open() {
      return open;
    },
    toggle() {
      open = !open;
      // The button's label says what the next tap does
      lastHead = '';
      button.setAttribute('aria-expanded', String(open));
      info.hidden = !open;
    },
    update(view) {
      box.hidden = !view;
      info.hidden = !view || !open;
      if (!view) return;
      // Only what changed is written: text written in every frame costs a layout (STORY-062)
      const head = `${view.kicker}|${view.name}`;
      if (head !== lastHead) {
        lastHead = head;
        kicker.textContent = view.kicker;
        name.textContent = view.name;
        button.setAttribute('aria-label', `${view.kicker} ${view.name}: ${open ? 'piilota' : 'näytä'} tiedot`);
      }
      if (!open) return;
      const body = JSON.stringify([view.stats, view.rows, view.actions]);
      if (body === lastBody) return;
      lastBody = body;
      stats.replaceChildren(...view.stats.map(s => {
        const d = document.createElement('div');
        d.className = 'hud-area-stat';
        d.innerHTML = '<span class="hud-area-stat-value"></span><span class="hud-area-stat-label"></span>';
        d.firstElementChild!.textContent = s.value;
        d.lastElementChild!.textContent = s.label;
        return d;
      }));
      rows.replaceChildren(...view.rows.flatMap(r => {
        const dt = document.createElement('dt');
        dt.textContent = r.label;
        const dd = document.createElement('dd');
        dd.textContent = r.value;
        return [dt, dd];
      }));
      actions.replaceChildren(...view.actions.map(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-secondary hud-area-action';
        b.dataset.action = a.id;
        b.textContent = a.label;
        if (a.key) {
          b.setAttribute('aria-keyshortcuts', a.key);
          const k = document.createElement('kbd');
          k.textContent = a.key;
          b.appendChild(k);
        }
        return b;
      }));
    },
  };
  button.addEventListener('click', () => area.toggle());
  return area;
}
