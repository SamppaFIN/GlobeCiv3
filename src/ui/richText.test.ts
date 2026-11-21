import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { city, plain, renderRich, term, unit, type RichLinks } from './richText';

/** Just enough of a DOM for the renderer: text and elements, no markup parser (STORY-103). */
class Node {
  parent: Node | null = null;
  children: (Node | string)[] = [];
  className = '';
  type = '';
  attrs: Record<string, string> = {};
  listeners: Record<string, ((e: { stopPropagation(): void }) => void)[]> = {};
  innerHTMLSet = false;
  tag: string;
  constructor(tag: string) { this.tag = tag; }
  set innerHTML(_: string) { this.innerHTMLSet = true; }
  get textContent(): string { return this.children.map(c => (typeof c === 'string' ? c : c.textContent)).join(''); }
  set textContent(t: string) { this.children = [t]; }
  append(...xs: (Node | string)[]) { for (const x of xs) { if (typeof x !== 'string') x.parent = this; this.children.push(x); } }
  appendChild(x: Node) { this.append(x); return x; }
  replaceChildren(...xs: (Node | string)[]) { this.children = []; this.append(...xs); }
  replaceWith(x: Node) { const p = this.parent!; x.parent = p; p.children[p.children.indexOf(this)] = x; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(k: string, f: (e: { stopPropagation(): void }) => void) { (this.listeners[k] ??= []).push(f); }
  click() { for (const f of this.listeners.click ?? []) f({ stopPropagation() {} }); }
  nodes(): Node[] { return this.children.filter((c): c is Node => typeof c !== 'string'); }
}

const globals = globalThis as unknown as { document?: unknown };
let saved: unknown;
beforeEach(() => {
  saved = globals.document;
  globals.document = { createElement: (tag: string) => new Node(tag) };
});
afterEach(() => { globals.document = saved; });

const links = (alive: number[] = []) => {
  const went: string[] = [];
  const l: RichLinks = {
    city: tile => { went.push(`city ${tile}`); },
    unit: id => { went.push(`unit ${id}`); return alive.includes(id); },
    unitAlive: id => alive.includes(id),
  };
  return { l, went };
};

describe('rich text', () => {
  it('reads as plain text without its colours', () => {
    expect(plain(['Päivä 3: ', city(12, 'Aamuranta'), ' rakensi: ', term('building', 'Saha')])).toBe('Päivä 3: Aamuranta rakensi: Saha');
    expect(plain('ennallaan')).toBe('ennallaan');
  });

  it('colours each kind of name and links a city and a living unit', () => {
    const el = new Node('li');
    const { l, went } = links([7]);
    renderRich(el as unknown as HTMLElement, [city(12, 'Aamuranta'), ' · ', unit(7, 'Tiedustelija Väinö'), ' · ', term('advance', 'Aakkoset')], l);
    const [c, u, a] = el.nodes();
    expect([c.tag, c.className, c.attrs['aria-label']]).toEqual(['button', 'rich rich-city rich-link', 'Aamuranta, kaupunki']);
    expect([u.tag, u.className, u.attrs['aria-label']]).toEqual(['button', 'rich rich-unit rich-link', 'Tiedustelija Väinö, yksikkö']);
    expect([a.tag, a.className]).toEqual(['span', 'rich rich-advance']);
    expect(el.textContent).toBe('Aamuranta · Tiedustelija Väinö · Aakkoset');
    c.click();
    u.click();
    expect(went).toEqual(['city 12', 'unit 7']);
  });

  it('draws a fallen unit as text, and a unit that falls while shown loses its link', () => {
    const el = new Node('li');
    const { l } = links([]);
    renderRich(el as unknown as HTMLElement, [unit(7, 'Soturi Aino')], l);
    expect(el.nodes()[0].tag).toBe('span');
    // Alive when drawn, gone when tapped
    let alive = true;
    const l2: RichLinks = { ...l, unitAlive: () => alive, unit: () => false };
    renderRich(el as unknown as HTMLElement, [unit(7, 'Soturi Aino')], l2);
    alive = false;
    el.nodes()[0].click();
    expect([el.nodes()[0].tag, el.textContent]).toEqual(['span', 'Soturi Aino']);
  });

  it('links a term with a page to the Tietokirja, and leaves one without a page as text (STORY-104)', () => {
    const el = new Node('p');
    const opened: string[] = [];
    const { l } = links();
    const withPages: RichLinks = { ...l, page: key => { opened.push(key); } };
    renderRich(el as unknown as HTMLElement, [term('building', 'Viljavarasto', 'building/granary'), ' ja ', term('good', 'lankkua', 'good/plank'), ' · ', term('building', 'Kultaa')], withPages);
    const [g, p, k] = el.nodes();
    expect([g.tag, g.className, g.attrs['aria-label']]).toEqual(['button', 'rich rich-building rich-link', 'Viljavarasto, rakennus']);
    expect([p.tag, p.className, p.attrs['aria-label']]).toEqual(['button', 'rich rich-good rich-link', 'lankkua, tavara']);
    expect(k.tag).toBe('span');
    g.click();
    p.click();
    expect(opened).toEqual(['building/granary', 'good/plank']);
    // Without a Tietokirja to open, a term with a page is only coloured
    renderRich(el as unknown as HTMLElement, [term('building', 'Viljavarasto', 'building/granary')], l);
    expect(el.nodes()[0].tag).toBe('span');
  });

  it('only colours when there are no links (a notice)', () => {
    const el = new Node('div');
    renderRich(el as unknown as HTMLElement, [city(12, 'Aamuranta'), ' kasvoi'], undefined);
    expect(el.nodes().map(n => n.tag)).toEqual(['span']);
  });

  it('keeps a name from a save as text, never as markup (security rule 5)', () => {
    const el = new Node('li');
    const { l } = links([1]);
    const odd = '<img src=x onerror=alert(1)>{yksikkö:1}';
    renderRich(el as unknown as HTMLElement, ['Päivä 1: ', city(3, odd), ' ja ', unit(1, odd)], l);
    expect(el.textContent).toBe(`Päivä 1: ${odd} ja ${odd}`);
    expect(el.nodes().every(n => !n.innerHTMLSet && n.children.length === 1 && n.children[0] === odd)).toBe(true);
    // Plain text with braces stays one text, not a reference
    renderRich(el as unknown as HTMLElement, '{yksikkö:1} {city:3}', l);
    expect(el.children).toEqual(['{yksikkö:1} {city:3}']);
  });
});
