import { describe, expect, it } from 'vitest';
import { groupMarks, MARKER_TARGET, nextUnit, placeGroups, type UnitMark } from './unitMarkers';

const mark = (index: number, x: number | null, y: number | null, selected = false): UnitMark => ({ index, label: `Yksikkö ${index}`, x, y, selected });
const SCREEN = { left: 0, top: 0, right: 1000, bottom: 1000 };

describe('unit markers above the city areas (STORY-115)', () => {
  it('merge units whose touch targets would meet, and keep apart the rest', () => {
    const groups = groupMarks([mark(0, 100, 100), mark(1, 120, 110), mark(2, 100 + MARKER_TARGET, 100), mark(3, null, null)]);
    expect(groups.map(g => g.units)).toEqual([[0, 1], [2]]);
  });

  it('put the selected unit first, so its group stands where it is', () => {
    const groups = groupMarks([mark(0, 100, 100), mark(1, 110, 100, true)]);
    expect(groups).toEqual([{ units: [1, 0], x: 110, y: 100, selected: true }]);
  });

  it('stand on their units when nothing is there', () => {
    const groups = groupMarks([mark(0, 100, 100), mark(1, 300, 100)]);
    expect(placeGroups(groups, [], SCREEN).map(g => [g.x, g.y, g.over])).toEqual([[100, 100, false], [300, 100, false]]);
  });

  it('step aside from a chip or a label, to the nearest free ring', () => {
    const [g] = groupMarks([mark(0, 100, 100)]);
    // A chip right on the unit: the first free place is 24 px up, just above the chip
    const [placed] = placeGroups([g], [{ x: 100, y: 120, w: 120, h: 52 }], SCREEN);
    expect(placed.over).toBe(false);
    expect(Math.hypot(placed.x - 100, placed.y - 100)).toBeLessThanOrEqual(40);
    // Not on the chip any more: what shows is clear of it
    expect(Math.abs(placed.y - 120) * 2).toBeGreaterThanOrEqual(52 + 18);
  });

  it('stay between the panels and inside the view when they step aside', () => {
    const [g] = groupMarks([mark(0, 100, 210)]);
    // Below the unit a chip; above it the top panel's edge at 200: the step goes sideways or down, not up
    const [placed] = placeGroups([g], [{ x: 100, y: 230, w: 60, h: 40 }], { left: 0, top: 200, right: 1000, bottom: 1000 });
    expect(placed.over).toBe(false);
    expect(placed.y - 9).toBeGreaterThanOrEqual(200);
    // Near the view's left edge, with a chip to its right: not to the left of the edge
    const [edge] = placeGroups(groupMarks([mark(0, 12, 500)]), [{ x: 30, y: 500, w: 40, h: 40 }], SCREEN);
    expect(edge.over).toBe(false);
    expect(edge.x - 9).toBeGreaterThanOrEqual(0);
  });

  it('join the nearest marker when nothing near is free, and only the first stands over the rest', () => {
    const groups = groupMarks([mark(0, 100, 100), mark(1, 400, 100)]);
    // A wide chip over the second unit and all around it
    const placed = placeGroups(groups, [{ x: 400, y: 100, w: 200, h: 200 }], SCREEN);
    expect(placed).toHaveLength(1);
    expect(placed[0].units).toEqual([0, 1]);
    expect(placed[0].over).toBe(false);
    // With no marker placed before it, the blocked one stands over
    const [alone] = placeGroups(groupMarks([mark(0, 100, 100)]), [{ x: 100, y: 100, w: 200, h: 200 }], SCREEN);
    expect(alone.over).toBe(true);
  });

  it('keep their touch targets apart once placed', () => {
    const groups = groupMarks([mark(0, 100, 100), mark(1, 160, 100)]);
    const placed = placeGroups(groups, [{ x: 130, y: 60, w: 30, h: 20 }], SCREEN);
    expect(Math.abs(placed[0].x - placed[1].x) >= MARKER_TARGET || Math.abs(placed[0].y - placed[1].y) >= MARKER_TARGET).toBe(true);
  });

  it('give a merged marker\'s units in turn, each once, whichever is selected (Utu\'s review)', () => {
    // A group lists its selected unit first; the turn goes by the units' order
    let selected = 9;
    const seen: number[] = [];
    for (let tap = 0; tap < 3; tap++) {
      const group = groupMarks([mark(4, 100, 100, selected === 4), mark(7, 102, 100, selected === 7), mark(2, 104, 100, selected === 2)])[0];
      selected = nextUnit(group.units, selected);
      seen.push(selected);
    }
    expect(seen).toEqual([2, 4, 7]);
    expect(nextUnit([2, 4, 7], 7)).toBe(2);
  });
});
