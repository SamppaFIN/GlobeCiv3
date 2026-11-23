import { describe, expect, it } from 'vitest';
import { groupMarks, MARKER_TARGET, placeGroups, type UnitMark } from './unitMarkers';

const mark = (index: number, x: number | null, y: number | null, selected = false): UnitMark => ({ index, label: `Yksikkö ${index}`, x, y, selected });

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
    expect(placeGroups(groups, [])).toEqual([{ x: 100, y: 100, over: false }, { x: 300, y: 100, over: false }]);
  });

  it('step aside from a chip or a label, to the nearest free ring', () => {
    const [g] = groupMarks([mark(0, 100, 100)]);
    // A chip right on the unit: the first free place is 24 px up, just above the chip
    const placed = placeGroups([g], [{ x: 100, y: 120, w: 120, h: 52 }]);
    expect(placed[0].over).toBe(false);
    expect(Math.hypot(placed[0].x - 100, placed[0].y - 100)).toBeLessThanOrEqual(40);
    // Not on the chip any more: what shows is clear of it
    expect(Math.abs(placed[0].y - 120) * 2).toBeGreaterThanOrEqual(52 + 18);
  });

  it('stand over the rest when nothing near is free', () => {
    const [g] = groupMarks([mark(0, 100, 100)]);
    expect(placeGroups([g], [{ x: 100, y: 100, w: 200, h: 200 }])).toEqual([{ x: 100, y: 100, over: true }]);
  });

  it('keep their touch targets apart once placed', () => {
    const groups = groupMarks([mark(0, 100, 100), mark(1, 160, 100)]);
    const chip = { x: 130, y: 60, w: 30, h: 20 };
    const placed = placeGroups(groups, [chip]);
    expect(Math.abs(placed[0].x - placed[1].x) >= MARKER_TARGET || Math.abs(placed[0].y - placed[1].y) >= MARKER_TARGET).toBe(true);
  });
});
