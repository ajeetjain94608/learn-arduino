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

type Card = { cx: number; cy: number; w: number; h: number };
const GAP = 6;
const hit = (a: Card, b: Card) => Math.abs(a.cx - b.cx) * 2 < a.w + b.w && Math.abs(a.cy - b.cy) * 2 < a.h + b.h + GAP * 2;

// Places cards in order; a card that would overlap an earlier one moves to the nearest free spot
// directly above or below an obstacle, staying within [top, bottom]. Cards with no free spot keep their place.
export function separateCards(cards: Card[], bounds: { top: number; bottom: number }): Card[] {
  const placed: Card[] = [];
  for (const c of cards) {
    const fits = (cy: number) => cy - c.h / 2 >= bounds.top && cy + c.h / 2 <= bounds.bottom && placed.every((p) => !hit({ ...c, cy }, p));
    let best = c.cy;
    if (!fits(c.cy)) {
      const candidates = placed.flatMap((p) => [p.cy + (p.h + c.h) / 2 + GAP, p.cy - (p.h + c.h) / 2 - GAP])
        .filter(fits)
        .sort((a, b) => Math.abs(a - c.cy) - Math.abs(b - c.cy));
      if (candidates.length) best = candidates[0];
    }
    placed.push({ ...c, cy: best });
  }
  return placed;
}
