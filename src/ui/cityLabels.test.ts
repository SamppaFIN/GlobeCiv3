import { describe, expect, it } from 'vitest';
import { placeLabels } from './cityLabels';

const label = (x: number, y: number, w = 100, open = false) => ({ x, y, w, open });

describe('city labels above the city areas (STORY-114)', () => {
  it('stand over their cities when nothing is there', () => {
    expect(placeLabels([label(100, 300), label(300, 300)], [])).toEqual([[0, 0], [0, 0]]);
  });

  it('step a label height above a chip, then below it, then half their width aside, else are left out', () => {
    const chip = { x: 100, y: 300, w: 120, h: 52 };
    const above = { x: 100, y: 252, w: 120, h: 52 };
    const below = { x: 100, y: 348, w: 120, h: 52 };
    // Free above
    expect(placeLabels([label(100, 300)], [chip])).toEqual([[0, -48]]);
    // Above is taken too: below
    expect(placeLabels([label(100, 300)], [chip, above])).toEqual([[0, 48]]);
    // A chip off to the right: half the width to the left clears it
    expect(placeLabels([label(100, 300)], [{ ...chip, x: 170 }, above, below])).toEqual([[-50, 0]]);
    // Nowhere free
    expect(placeLabels([label(100, 300)], [{ ...chip, w: 400 }, above, below])).toEqual([null]);
  });

  it('keep off the labels placed before them, in their order', () => {
    // The second stands on the first, and a step up still meets it: it steps down
    expect(placeLabels([label(100, 300), label(120, 310)], [])).toEqual([[0, 0], [0, 48]]);
    // Higher up, a step up clears it
    expect(placeLabels([label(100, 300), label(120, 270)], [])).toEqual([[0, 0], [0, -48]]);
  });

  it('keep an open quick panel\'s label over its city, whatever it covers', () => {
    expect(placeLabels([label(100, 300, 100, true)], [{ x: 100, y: 300, w: 120, h: 52 }])).toEqual([[0, 0]]);
  });

  it('leave out a city not in view', () => {
    expect(placeLabels([{ x: null, y: null, w: 100 }, label(100, 300)], [])).toEqual([null, [0, 0]]);
  });
});
