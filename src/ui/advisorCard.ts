/**
 * advisorCard.ts — the advisor of the level in view (STORY-049): three to choose from or
 * none, what each one does, and what the chosen one did lately. A bottom sheet like the
 * city card; the game goes on.
 */

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

export interface AdvisorView {
  /** The level the advisor runs: "Kaupunkialue". */
  level: string;
  options: { id: string; name: string; does: string; selected: boolean }[];
  /** What the advisor did lately, the newest first. */
  log: string[];
}

export interface AdvisorCard {
  show(view: AdvisorView): void;
  update(view: AdvisorView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createAdvisorCard(root: HTMLElement, on: { close(): void; choose(id: string): void }): AdvisorCard {
  const el = document.createElement('section');
  el.className = 'city-card advisor-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'advisor-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker advisor-level"></span><h2 id="advisor-title" class="city-name">Neuvonantaja</h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje">${CLOSE}</button>
    </div>
    <div class="city-builds advisor-options" role="radiogroup" aria-labelledby="advisor-options-label">
      <span id="advisor-options-label" class="city-build-label">Kuka hoitaa tason puolestasi</span>
    </div>
    <span class="city-build-label">Viimeksi</span>
    <span class="city-area advisor-log"></span>`;
  root.appendChild(el);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  const options = q('.advisor-options');
  let last = '';
  const update = (v: AdvisorView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    q('.advisor-level').textContent = v.level;
    options.querySelectorAll('.city-build').forEach(o => o.remove());
    for (const o of v.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'city-build';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(o.selected));
      b.innerHTML = '<span class="city-build-top"><span class="city-build-name"></span></span><span class="city-build-info"></span>';
      b.querySelector('.city-build-name')!.textContent = o.name;
      b.querySelector('.city-build-info')!.textContent = o.does;
      b.addEventListener('click', () => on.choose(o.id));
      options.appendChild(b);
    }
    q('.advisor-log').textContent = v.log.length ? v.log.join(' · ') : 'Ei vielä toimia.';
  };
  return {
    show(v) {
      update(v);
      el.hidden = false;
      root.classList.add('research-open');
    },
    update,
    hide() {
      el.hidden = true;
      root.classList.remove('research-open');
    },
    get visible() { return !el.hidden; },
  };
}
