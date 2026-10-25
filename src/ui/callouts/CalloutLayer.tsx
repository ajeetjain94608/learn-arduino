import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import type { Hotspot } from './hotspots';
import { layoutCallout, separateCards } from './layoutCallout';
import './callouts.css';

const TOP_BAR = 56, DOCK = 66; // room for the status pill and the toolbar inside the 3D card

// The DOM labels (outside the Canvas) and the projector (inside it) share element refs through this bridge.
export type CalloutBridge = { cards: (HTMLButtonElement | null)[]; dots: (HTMLDivElement | null)[]; lines: (SVGLineElement | null)[] };
export const createCalloutBridge = (): CalloutBridge => ({ cards: [], dots: [], lines: [] });

// Inside the Canvas: projects each 3D anchor every frame and moves the DOM by writing transforms directly.
export function CalloutProjector({ hotspots, bridge }: { hotspots: Hotspot[]; bridge: CalloutBridge }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const anchors = useMemo(() => hotspots.map((h) => h.anchor()), [hotspots]);
  const p = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const { view, assembled } = useWorkbenchStore.getState();
    let entering = 0; // labels that appear this frame fade in one after another
    // 1) preferred spot for each visible label, 2) push overlapping cards apart, 3) move the DOM.
    const shown: { i: number; x: number; y: number; w: number; h: number; cx: number; cy: number }[] = [];
    hotspots.forEach((h, i) => {
      const card = bridge.cards[i], dot = bridge.dots[i], line = bridge.lines[i];
      if (!card || !dot || !line) return;
      p.copy(anchors[i]).project(camera);
      const x = (p.x * 0.5 + 0.5) * size.width, y = (-p.y * 0.5 + 0.5) * size.height;
      const w = card.offsetWidth, hgt = card.offsetHeight;
      const r = layoutCallout({ anchor: { x, y }, offset: h.offset, card: { w, h: hgt }, viewport: { w: size.width, h: size.height }, top: TOP_BAR, bottom: DOCK });
      const show = r.visible && (!h.view || h.view === view) && (h.view !== 'circuit' || assembled);
      if (show && card.style.display === 'none') {
        for (const el of [card, dot, line]) el.style.setProperty('--i', String(entering));
        entering++;
      }
      card.style.display = dot.style.display = line.style.display = show ? '' : 'none';
      if (show) shown.push({ i, x, y, w, h: hgt, cx: r.cx, cy: r.cy });
    });
    const placed = separateCards(shown.map(({ cx, cy, w, h }) => ({ cx, cy, w, h })), { top: TOP_BAR, bottom: size.height - DOCK });
    shown.forEach((s, k) => {
      const { cx, cy } = placed[k];
      const card = bridge.cards[s.i]!, dot = bridge.dots[s.i]!, line = bridge.lines[s.i]!;
      dot.style.transform = `translate(${s.x}px, ${s.y}px)`;
      card.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      line.setAttribute('x1', String(s.x)); line.setAttribute('y1', String(s.y));
      line.setAttribute('x2', String(cx)); line.setAttribute('y2', String(cy));
    });
  });
  return null;
}

// Outside the Canvas: label cards with dotted leader lines.
export function CalloutLayer({ hotspots, bridge, selected, onSelect }: { hotspots: Hotspot[]; bridge: CalloutBridge; selected: string | null; onSelect(id: string): void }) {
  const labels = useWorkbenchStore((s) => s.labels);
  return (
    <div className={`callouts${labels ? '' : ' callouts--hidden'}`}>
      <svg className="callouts__leaders">
        {hotspots.map((h, i) => <line key={h.id} style={{ display: 'none' }} ref={(el) => { bridge.lines[i] = el; }} />)}
      </svg>
      {hotspots.map((h, i) => <div key={h.id} className="callouts__anchor" style={{ display: 'none' }} ref={(el) => { bridge.dots[i] = el; }} />)}
      {hotspots.map((h, i) => (
        <button
          key={h.id}
          type="button"
          data-hotspot={h.id}
          style={{ display: 'none' }}
          className={`callouts__card${selected === h.id ? ' is-active' : ''}`}
          ref={(el) => { bridge.cards[i] = el; }}
          onClick={(e) => { e.stopPropagation(); onSelect(h.id); }}
        >
          <b>{t(h.nameKey)}</b>
          <small>{t(h.subKey)}</small>
        </button>
      ))}
    </div>
  );
}
