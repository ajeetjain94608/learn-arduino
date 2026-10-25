type Size = { w: number; h: number };
const MARGIN = 10, OFFSET = 14;

// Where the part card goes inside the 3D view (top-left corner, px).
// Tapped / clicked parts: centred along the bottom, just above the toolbar.
// Mouse hover: beside the pointer, kept fully inside the view.
export function placeTooltip(i: { mode: 'hover' | 'selected'; at: { x: number; y: number } | null; card: Size; viewport: Size; reserveBottom: number }): { x: number; y: number } {
  const maxX = Math.max(MARGIN, i.viewport.w - i.card.w - MARGIN);
  const maxY = Math.max(MARGIN, i.viewport.h - i.reserveBottom - MARGIN - i.card.h);
  if (i.mode === 'selected' || !i.at) return { x: Math.max(MARGIN, (i.viewport.w - i.card.w) / 2), y: maxY };
  return {
    x: Math.min(Math.max(i.at.x + OFFSET, MARGIN), maxX),
    y: Math.min(Math.max(i.at.y + OFFSET, MARGIN), maxY),
  };
}
