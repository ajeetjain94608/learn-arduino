import { useEffect, useMemo, useRef } from 'react';
import { mapItems } from '../../circuit/parts';
import type { PartInstance } from '../../circuit/types';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { viewQuad } from '../../three/workbench/viewQuad';

const W = 112, H = 84;        // the map's size on screen (px)
const MIN_W = 200;            // it never shows less of the table than this (mm)
const FOCUS_ZOOM = 2.4;       // a tap on the map zooms in to this

// The area the map shows: everything on the table with some room round it, in the map's proportions.
function areaOf(items: ReturnType<typeof mapItems>) {
  const x0 = Math.min(...items.map((m) => m.x - m.w / 2)) - 30, x1 = Math.max(...items.map((m) => m.x + m.w / 2)) + 30;
  const z0 = Math.min(...items.map((m) => m.z - m.d / 2)) - 30, z1 = Math.max(...items.map((m) => m.z + m.d / 2)) + 30;
  let w = Math.max(MIN_W, x1 - x0, ((z1 - z0) * W) / H), h = (w * H) / W;
  if (h < z1 - z0) { h = z1 - z0; w = (h * W) / H; }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, h };
}

// A small map of the table from above, in the corner of the 3D view, with the part of the table you are looking at outlined.
// Tap a spot and the camera goes there and zooms in; press and drag to slide the view over the table.
export function Minimap({ parts }: { parts?: readonly PartInstance[] }) {
  const focusCamera = useWorkbenchStore((s) => s.focusCamera);
  const items = useMemo(() => mapItems(parts), [parts]);
  const a = useMemo(() => areaOf(items), [items]);
  const sx = (x: number) => ((x - (a.x - a.w / 2)) / a.w) * W, sz = (z: number) => ((z - (a.z - a.h / 2)) / a.h) * H;
  const view = useRef<SVGPolygonElement>(null);
  const last = useRef(0);

  // the outline of what the camera sees follows it (drawn straight into the SVG: no React render per frame)
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const q = viewQuad.pts;
      if (q && view.current) view.current.setAttribute('points', q.map(([x, z]) => `${sx(x).toFixed(1)},${sz(z).toFixed(1)}`).join(' '));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [a]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [a.x - a.w / 2 + ((e.clientX - r.left) / r.width) * a.w, a.z - a.h / 2 + ((e.clientY - r.top) / r.height) * a.h] as const;
  };
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, z] = at(e);
    focusCamera([x, 0, z], FOCUS_ZOOM);
    last.current = performance.now();
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || performance.now() - last.current < 90) return; // while pressed: the view follows
    last.current = performance.now();
    const [x, z] = at(e);
    focusCamera([x, 0, z], FOCUS_ZOOM);
  };
  const key = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') focusCamera([a.x, 0, a.z], FOCUS_ZOOM); };

  return (
    <button type="button" className="minimap" id="minimap" aria-label={t('viewer.map')} title={t('viewer.map')} data-testid="minimap"
      onPointerDown={down} onPointerMove={move} onKeyDown={key} style={{ touchAction: 'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
        <rect width={W} height={H} className="minimap__table" />
        {items.map((m, i) => <rect key={i} x={sx(m.x - m.w / 2)} y={sz(m.z - m.d / 2)} width={(m.w / a.w) * W} height={(m.d / a.h) * H} rx="1.5" className={`minimap__${m.kind}`} />)}
        <polygon ref={view} points="" className="minimap__view" />
      </svg>
    </button>
  );
}
