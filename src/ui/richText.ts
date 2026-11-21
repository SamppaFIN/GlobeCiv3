/**
 * richText.ts — coloured and linked text (STORY-103; Sami 2026-11-21: colourful texts with links
 * to other texts, the wiki or a unit's place). A text is a list of segments: plain text, or a
 * reference to a city, a unit, a person, a building, an advance, a resource or an era. Each kind
 * has its colour; a city and a unit are buttons that take the view there.
 *
 * Names come in as parameters and go out as text (textContent), never as markup, so a name from a
 * save such as "{unit:1}" or "<b>" stays text (security rule 5). Links are buttons, not anchors, so
 * there is no address to follow. Colour is not the only cue: a link is underlined, and its
 * accessible name tells its kind.
 */

export type RefKind = 'city' | 'unit' | 'person' | 'building' | 'advance' | 'resource' | 'era';

export type Ref =
  | { ref: 'city'; tile: number; name: string }
  | { ref: 'unit'; id: number; name: string }
  | { ref: 'person' | 'building' | 'advance' | 'resource' | 'era'; name: string };

export type Segment = string | Ref;
export type Rich = readonly Segment[];

/** The kinds in words, for a link's accessible name. */
const KIND_WORDS: Record<RefKind, string> = { city: 'kaupunki', unit: 'yksikkö', person: 'henkilö', building: 'rakennus', advance: 'keksintö', resource: 'resurssi', era: 'aikakausi' };

export interface RichLinks {
  /** Take the view to a city. */
  city(tile: number): void;
  /** Take the view to a unit and select it; false when it is gone. */
  unit(id: number): boolean;
  /** Whether a unit is still there, to draw its name as a link. */
  unitAlive(id: number): boolean;
}

/** The text without its colours: for the notice log, the tests and the tab title. */
export const plain = (r: Rich | string): string => (typeof r === 'string' ? r : r.map(s => (typeof s === 'string' ? s : s.name)).join(''));

/** Shorthands for writing texts. */
export const city = (tile: number, name: string): Ref => ({ ref: 'city', tile, name });
export const unit = (id: number, name: string): Ref => ({ ref: 'unit', id, name });
export const term = (ref: 'person' | 'building' | 'advance' | 'resource' | 'era', name: string): Ref => ({ ref, name });

/**
 * Draw a text into an element, in place of what it held. With `links` a city is a button and a
 * living unit too; without (a notice that fades) every reference is only coloured.
 */
export function renderRich(el: HTMLElement, r: Rich | string, links?: RichLinks): void {
  el.replaceChildren();
  for (const s of typeof r === 'string' ? [r] : r) {
    if (typeof s === 'string') {
      el.append(s);
      continue;
    }
    const linked = links && (s.ref === 'city' || (s.ref === 'unit' && links.unitAlive(s.id)));
    const node = document.createElement(linked ? 'button' : 'span');
    node.className = `rich rich-${s.ref}${linked ? ' rich-link' : ''}`;
    node.textContent = s.name;
    if (linked && links) {
      const b = node as HTMLButtonElement;
      b.type = 'button';
      b.setAttribute('aria-label', `${s.name}, ${KIND_WORDS[s.ref]}`);
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (s.ref === 'city') links.city(s.tile);
        // The unit may have fallen while the card stood open: then the name is only text
        else if (s.ref === 'unit' && !links.unit(s.id)) b.replaceWith(Object.assign(document.createElement('span'), { className: 'rich rich-unit', textContent: s.name }));
      });
    }
    el.append(node);
  }
}
