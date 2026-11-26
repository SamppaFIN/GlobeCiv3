/**
 * scienceTree.ts — the science tree (STORY-109; Sami 2026-11-22: a button and a page of the whole
 * tree, each science with a picture, what it does and a historical saying). The advances stand in
 * columns by what they need, with lines from each need; a tap shows the advance above the tree:
 * its picture, what it is, what it does in the game, a saying of its time and, when it can be
 * studied, the button to study it. A sheet like the city card; the game goes on.
 */
import type { Advance } from '../game/science';
import { advanceSvg } from './advanceArt';
import { renderRich, type Rich, type RichLinks } from './richText';

const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';

/** A node's size and the gaps between, in pixels: a two-line name fits, and a phone scrolls the tree sideways. */
const W = 96;
const H = 68;
const GAP_X = 22;
const GAP_Y = 8;

/** A long compound name may break at its seam in a narrow node: "Hautajais-riitit". */
const SEAMS = ['Hautajais', 'Laki', 'Raha', 'Pronssi', 'Rauta', 'Kartan', 'Siltojen'];
const breakable = (name: string) => {
  const seam = SEAMS.find(p => name.startsWith(p) && name.length > p.length + 3);
  return seam ? `${seam}\u00AD${name.slice(seam.length)}` : name;
};

export type NodeState = 'known' | 'target' | 'open' | 'locked';
const STATE_WORD: Record<NodeState, string> = { known: 'Tunnettu', target: 'Tutkitaan', open: 'Voi tutkia', locked: 'Lukossa' };

export interface TreeNode {
  advance: Advance;
  name: string;
  col: number;
  row: number;
  state: NodeState;
  /** Share 0–1 of the advance under study. */
  progress: number | null;
  needs: Advance[];
}

export interface TreeView {
  nodes: TreeNode[];
  /** "Tiedettä +3/pv · tunnetaan 4 / 15" */
  rates: string;
  selected: {
    advance: Advance;
    name: string;
    state: NodeState;
    /** "Tunnettu", "Tutkitaan 6 / 20 · valmis 3 pv", "Voi tutkia · 30 tiedettä" or what it waits for. */
    status: string;
    what: string;
    effect: Rich;
    facts: { label: string; value: Rich }[];
    quote: { text: string; who: string; where: string };
  } | null;
}

export interface ScienceTree {
  show(view: TreeView): void;
  update(view: TreeView): void;
  hide(): void;
  readonly visible: boolean;
}

export function createScienceTree(root: HTMLElement, on: { close(): void; select(a: Advance): void; choose(a: Advance): void; links: RichLinks }): ScienceTree {
  const el = document.createElement('section');
  el.className = 'city-card science-card';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'science-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="city-head">
      <div class="city-titles"><span class="city-kicker">Tiede</span><h2 id="science-title" class="city-name" tabindex="-1">Tiedepuu</h2></div>
      <button class="btn btn-secondary hud-icon city-close" type="button" aria-label="Sulje tiedepuu">${CLOSE}</button>
    </div>
    <span class="city-food science-rates"></span>
    <div class="science-body">
      <article class="science-detail" aria-live="polite">
        <div class="science-detail-head">
          <div class="science-art"></div>
          <div class="science-detail-titles"><span class="city-kicker science-status"></span><h3 class="science-name"></h3></div>
        </div>
        <p class="science-what"></p>
        <p class="science-effect"></p>
        <dl class="codex-facts science-facts"></dl>
        <figure class="science-quote">
          <blockquote class="science-quote-text"></blockquote>
          <figcaption class="science-quote-who"></figcaption>
        </figure>
        <button class="btn btn-primary science-choose" type="button">Tutki tätä</button>
      </article>
      <div class="science-scroll">
        <div class="science-tree" role="group" aria-label="Keksinnöt">
          <svg class="science-lines" aria-hidden="true" focusable="false"></svg>
        </div>
      </div>
    </div>`;
  root.appendChild(el);
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  q('.city-close').addEventListener('click', on.close);
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      on.close();
    }
  });
  const tree = q<HTMLElement>('.science-tree');
  const lines = q<SVGSVGElement>('.science-lines');
  const choose = q<HTMLButtonElement>('.science-choose');
  const nodes = new Map<Advance, HTMLButtonElement>();
  // The button hides once chosen: the focus goes to the advance's node, not out of the card
  choose.addEventListener('click', () => {
    const a = choose.dataset.advance as Advance | undefined;
    if (!a) return;
    on.choose(a);
    nodes.get(a)?.focus({ preventScroll: true });
  });
  let shown: Advance | null = null;
  let last = '';

  /** Where a node stands: columns side by side, each centred on the tallest. */
  const placeOf = (n: TreeNode, rows: number[]) => ({ x: n.col * (W + GAP_X), y: (n.row + (Math.max(...rows) - rows[n.col]) / 2) * (H + GAP_Y) });

  const draw = (v: TreeView) => {
    const rows: number[] = [];
    for (const n of v.nodes) rows[n.col] = Math.max(rows[n.col] ?? 0, n.row + 1);
    const width = rows.length * W + (rows.length - 1) * GAP_X;
    const height = Math.max(...rows) * (H + GAP_Y) - GAP_Y;
    tree.style.width = `${width}px`;
    tree.style.height = `${height}px`;
    lines.setAttribute('width', String(width));
    lines.setAttribute('height', String(height));
    lines.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const at = new Map(v.nodes.map(n => [n.advance, placeOf(n, rows)]));
    const state = new Map(v.nodes.map(n => [n.advance, n.state]));
    // The lines from each need to what needs it: lit once the need is known
    lines.replaceChildren();
    for (const n of v.nodes) {
      const to = at.get(n.advance)!;
      for (const need of n.needs) {
        const from = at.get(need)!;
        const x1 = from.x + W;
        const y1 = from.y + H / 2;
        const x2 = to.x;
        const y2 = to.y + H / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1} ${y1} C${x1 + GAP_X / 2} ${y1} ${x2 - GAP_X / 2} ${y2} ${x2} ${y2}`);
        path.setAttribute('class', `science-line${state.get(need) === 'known' ? ' science-line-known' : ''}${n.state === 'target' ? ' science-line-target' : ''}`);
        lines.appendChild(path);
      }
    }
    for (const n of v.nodes) {
      let b = nodes.get(n.advance);
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'science-node';
        b.dataset.advance = n.advance;
        // Our own drawing from constants (advanceArt.ts); the name goes in as text
        b.innerHTML = `<span class="science-node-top"><span class="science-node-art">${advanceSvg(n.advance, 22)}</span><span class="science-node-state"></span></span><span class="science-node-name"></span><span class="science-node-bar"></span>`;
        b.addEventListener('click', () => on.select(n.advance));
        tree.appendChild(b);
        nodes.set(n.advance, b);
      }
      const p = at.get(n.advance)!;
      b.style.left = `${p.x}px`;
      b.style.top = `${p.y}px`;
      b.style.width = `${W}px`;
      b.style.height = `${H}px`;
      b.dataset.state = n.state;
      b.querySelector('.science-node-name')!.textContent = breakable(n.name);
      const word = n.state === 'target' && n.progress !== null ? `${STATE_WORD.target} ${Math.floor(n.progress * 100)} %` : STATE_WORD[n.state];
      b.querySelector('.science-node-state')!.textContent = word;
      b.querySelector<HTMLElement>('.science-node-bar')!.style.width = n.state === 'target' && n.progress !== null ? `${Math.round(n.progress * 100)}%` : '0';
      b.setAttribute('aria-label', `${n.name}: ${word}`);
      b.setAttribute('aria-pressed', String(v.selected?.advance === n.advance));
    }
  };

  const detail = (v: TreeView) => {
    const s = v.selected;
    q<HTMLElement>('.science-detail').hidden = !s;
    if (!s) return;
    if (shown !== s.advance) {
      // Our own drawing from constants
      q('.science-art').innerHTML = advanceSvg(s.advance, 96);
      shown = s.advance;
    }
    q('.science-status').textContent = s.status;
    q('.science-name').textContent = s.name;
    q('.science-what').textContent = s.what;
    renderRich(q('.science-effect'), s.effect, on.links);
    const facts = q('.science-facts');
    facts.replaceChildren();
    for (const f of s.facts) {
      const dt = document.createElement('dt');
      dt.textContent = f.label;
      const dd = document.createElement('dd');
      renderRich(dd, f.value, on.links);
      facts.append(dt, dd);
    }
    q('.science-quote-text').textContent = `”${s.quote.text}”`;
    q('.science-quote-who').textContent = `— ${s.quote.who}, ${s.quote.where}`;
    choose.hidden = s.state !== 'open';
    choose.dataset.advance = s.advance;
    q<HTMLElement>('.science-detail').dataset.state = s.state;
  };

  // On a phone the tree scrolls sideways (Sami 2026-11-26: the whole tree has 16 columns), and
  // it opens with the chosen advance in the middle
  const scroller = q<HTMLElement>('.science-scroll');
  const bring = (a: Advance | undefined) => {
    const b = a === undefined ? undefined : nodes.get(a);
    if (b) scroller.scrollLeft = Math.max(0, b.offsetLeft + W / 2 - scroller.clientWidth / 2);
  };

  const update = (v: TreeView) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    const turned = v.selected?.advance !== shown;
    last = key;
    q('.science-rates').textContent = v.rates;
    draw(v);
    detail(v);
    // A new advance chosen: the card goes up to it
    if (turned && !el.hidden) el.scrollTop = 0;
  };

  return {
    show(v) {
      update(v);
      const opened = el.hidden;
      el.hidden = false;
      root.classList.add('science-open');
      if (opened) {
        el.scrollTop = 0;
        bring(v.selected?.advance);
        q<HTMLElement>('#science-title').focus({ preventScroll: true });
      }
    },
    update,
    hide() {
      el.hidden = true;
      root.classList.remove('science-open');
    },
    get visible() { return !el.hidden; },
  };
}
