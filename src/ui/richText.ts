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
 *
 * A term with a page (STORY-104) opens that page of the Tietokirja (codex.ts).
 */

import type { RefKind, Rich } from '../game/rich';

export { city, plain, term, unit, type Ref, type RefKind, type Rich, type Segment, type TermKind } from '../game/rich';

/** The kinds in words, for a link's accessible name. */
const KIND_WORDS: Record<RefKind, string> = { city: 'kaupunki', unit: 'yksikkö', person: 'henkilö', building: 'rakennus', unittype: 'yksikkötyyppi', advance: 'keksintö', resource: 'resurssi', good: 'tavara', era: 'aikakausi' };

export interface RichLinks {
  /** Take the view to a city. */
  city(tile: number): void;
  /** Take the view to a unit and select it; false when it is gone. */
  unit(id: number): boolean;
  /** Whether a unit is still there, to draw its name as a link. */
  unitAlive(id: number): boolean;
  /** Open a page of the Tietokirja (STORY-104). */
  page?(key: string): void;
}

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
    const linked = links && (s.ref === 'city' || (s.ref === 'unit' ? links.unitAlive(s.id) : !!s.page && !!links.page));
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
        else if (s.ref === 'unit') {
          if (!links.unit(s.id)) b.replaceWith(Object.assign(document.createElement('span'), { className: 'rich rich-unit', textContent: s.name }));
        } else if (s.page) links.page?.(s.page);
      });
    }
    el.append(node);
  }
}
