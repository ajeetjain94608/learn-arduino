import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import type { Hotspot } from './hotspots';
import { layoutCallout } from './layoutCallout';
import './callouts.css';

const TOP_BAR = 100, DOCK = 84;

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
    const view = useWorkbenchStore.getState().view;
    hotspots.forEach((h, i) => {
      const card = bridge.cards[i], dot = bridge.dots[i], line = bridge.lines[i];
      if (!card || !dot || !line) return;
      p.copy(anchors[i]).project(camera);
      const x = (p.x * 0.5 + 0.5) * size.width, y = (-p.y * 0.5 + 0.5) * size.height;
      const r = layoutCallout({ anchor: { x, y }, offset: h.offset, card: { w: card.offsetWidth, h: card.offsetHeight }, viewport: { w: size.width, h: size.height }, top: TOP_BAR, bottom: DOCK });
      const show = r.visible && (!h.view || h.view === view);
      card.style.display = dot.style.display = line.style.display = show ? '' : 'none';
      if (!show) return;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      card.style.transform = `translate(${r.cx}px, ${r.cy}px) translate(-50%, -50%)`;
      line.setAttribute('x1', String(x)); line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(r.cx)); line.setAttribute('y2', String(r.cy));
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
