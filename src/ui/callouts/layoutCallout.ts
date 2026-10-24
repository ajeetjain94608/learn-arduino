type In = {
  anchor: { x: number; y: number };
  offset: [number, number];
  card: { w: number; h: number };
  viewport: { w: number; h: number };
  top: number;    // reserved for the top bar
  bottom: number; // reserved for the dock
};

const EDGE = 8, HIDE_BAND = 70, REF_SIZE = 620;

// Where a label card goes: anchor + offset (scaled down on small screens), clamped inside the free area.
export function layoutCallout({ anchor, offset, card, viewport, top, bottom }: In): { visible: boolean; cx: number; cy: number } {
  const { w: vw, h: vh } = viewport;
  const visible = anchor.x > 0 && anchor.x < vw && anchor.y > HIDE_BAND && anchor.y < vh - HIDE_BAND;
  const s = Math.min(1, Math.min(vw, vh) / REF_SIZE);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return {
    visible,
    cx: clamp(anchor.x + offset[0] * s, card.w / 2 + EDGE, vw - card.w / 2 - EDGE),
    cy: clamp(anchor.y + offset[1] * s, top + card.h / 2 + EDGE, vh - bottom - card.h / 2 - EDGE),
  };
}
