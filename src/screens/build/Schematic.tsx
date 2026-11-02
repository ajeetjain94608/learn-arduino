import { useEffect, useMemo, useRef, useState } from 'react';
import { UNO_PINS } from '../../circuit/board';
import { PART_DEFS } from '../../circuit/parts';
import { jumperPoint, schematicNets } from '../../circuit/schematic';
import type { PartInstance, PinRef } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { useBuild, useBuildApi } from '../../state/buildContext';
import { layoutSchematic, type Pt } from './schematicLayout';
import { boxOf, defaultPlaces, GRID, sheetWires, snap, terminals, type Placed, type Pos, type Terminal } from './schematicSheet';
import { designators, symbolOf, unoSymbol, valueOf } from './schematicSymbols';

// The schematic editor, the way an EDA tool draws a circuit before its PCB: a sheet of paper with a dot grid; the UNO as its
// full symbol (every pin); each part as its standard symbol with a designator (R1, LED1…) and a value (220Ω…). Drag a symbol to
// place it, R (or the button) turns it, Delete removes it. Wires: press a pin, press the sheet for each corner, press the other
// pin — the wire is a real jumper in the 3D build too. Connections that no drawn wire shows are routed automatically; power pins
// get a ground or supply flag; a dot marks where wires join. Wheel or pinch to zoom, drag the sheet to pan.

const C = { paper: '#FFFFFF', dot: '#C3C9D1', sym: '#A0161A', pinText: '#5A1010', des: '#1F3BA8', val: '#4B5563', wire: '#1F3BA8', hot: '#00A3FF', dot2: '#C81E1E', title: '#1F2937' };
type Pick = { ref: PinRef; part?: PartInstance; pin: string; label: string };
const TWO_SIDED = new Set(['resistor', 'ldr', 'fsr', 'led', 'diode', 'buzzer', 'motor', 'button', 'pot', 'npn']); // a chain of parts goes on past these (not past a module)
type Wiring = { from: Pick; pts: Pt[] };
const partName = (p: PartInstance) => `${t(`build.part.${p.type}` as StringKey)} ${p.id.slice(p.type.length)}`.trim();

// a ground symbol or a supply flag at the end of a power pin, pointing the way the pin does
function PowerFlag({ x, y, dx, dy, kind, label }: { x: number; y: number; dx: number; dy: number; kind: 'gnd' | 'supply'; label: string }) {
  const e: Pt = [x + dx * 12, y + dy * 12], px = -dy, py = dx; // along the pin, and across it
  if (kind === 'gnd') {
    const bar = (k: number, half: number) => `M${e[0] + dx * k - px * half} ${e[1] + dy * k - py * half}L${e[0] + dx * k + px * half} ${e[1] + dy * k + py * half}`;
    return <path d={`M${x} ${y}L${e[0]} ${e[1]}${bar(0, 9)}${bar(4, 6)}${bar(8, 3)}`} stroke={C.sym} strokeWidth={1.4} fill="none" />;
  }
  const tx = e[0] + dx * 6, ty = e[1] + dy * 6;
  return (
    <g>
      <path d={`M${x} ${y}L${e[0]} ${e[1]}M${e[0] - px * 7} ${e[1] - py * 7}L${e[0] + px * 7} ${e[1] + py * 7}`} stroke={C.sym} strokeWidth={1.4} fill="none" />
      <text x={tx} y={ty + (dy ? (dy > 0 ? 10 : -2) : 4)} textAnchor={dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle'} fill={C.sym} stroke="none" fontSize={11} fontWeight={800}>{label}</text>
    </g>
  );
}

export function Schematic() {
  const parts = useBuild((s) => s.parts);
  const wires = useBuild((s) => s.wires);
  const schem = useBuild((s) => s.schem);
  const selected = useBuild((s) => s.selected);
  const canUndo = useBuild((s) => s.past.length > 0), canRedo = useBuild((s) => s.future.length > 0);
  const api = useBuildApi();
  const [wiring, setWiring] = useState<Wiring | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [unoSelected, setUnoSelected] = useState(false);
  const [full, setFull] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 520 });
  const [view, setView] = useState<{ x: number; y: number; w: number } | null>(null); // null: fit the drawing
  const gesture = useRef(0);

  // ── what is on the sheet ──
  const shown = useMemo(() => parts.filter((p) => p.type !== 'breadboard'), [parts]);
  const des = useMemo(() => designators(shown), [shown]);
  const refs = useMemo(() => [...UNO_PINS.map((p) => `uno.${p}`), ...shown.flatMap((p) => PART_DEFS[p.type].pins.map((pin) => `${p.id}.${pin}`))], [shown]);
  const nets = useMemo(() => schematicNets({ parts, wires }, refs), [parts, wires, refs]);
  const unoSym = useMemo(unoSymbol, []);
  const syms = useMemo(() => new Map(shown.map((p) => [p.id, symbolOf(p.type)])), [shown]);
  const uno: Placed = { id: 'uno', pos: schem.pos.uno ?? { x: 40, y: 40, rot: 0 }, sym: unoSym };
  // symbols nobody has placed yet: beside the UNO, in chain order, level with the pin they are wired to
  const defaults = useMemo(() => {
    const missing = shown.filter((p) => !schem.pos[p.id]);
    if (!missing.length) return new Map<string, Pos>();
    // (the old automatic layout only says which column each part is in: its order along the chain from the UNO)
    const lay = layoutSchematic(shown.map((p) => ({ id: p.id, type: p.type, pins: PART_DEFS[p.type].pins })), (type) => ({ ...symbolOf(type as PartInstance['type']), flippable: true, through: TWO_SIDED.has(type) }), nets);
    const cols = [...new Set(lay.parts.map((p) => p.x))].sort((a, b) => a - b);
    const unoTerms = terminals(uno);
    const placedOnes: Placed[] = [uno, ...shown.filter((p) => schem.pos[p.id]).map((p) => ({ id: p.id, pos: schem.pos[p.id], sym: syms.get(p.id)! }))];
    const items = missing.map((p) => {
      const sym = syms.get(p.id)!, lp = lay.parts.find((x) => x.id === p.id);
      const enter = sym.terms.find((tm) => unoTerms.some((u) => nets.nameOf(u.ref) && !['GND', '5V', '3V3', 'VIN'].includes(nets.nameOf(u.ref)!) && nets.netOf(u.ref) === nets.netOf(`${p.id}.${tm.pin}`)));
      const pin = enter && unoTerms.find((u) => nets.netOf(u.ref) === nets.netOf(`${p.id}.${enter.pin}`));
      return { id: p.id, sym, order: lp ? cols.indexOf(lp.x) : 0, unoPin: pin ? { y: pin.y } : undefined, enter };
    });
    return defaultPlaces(items, uno, placedOnes);
  }, [shown, schem.pos, syms, nets]); // eslint-disable-line react-hooks/exhaustive-deps
  const placed: Placed[] = shown.map((p) => ({ id: p.id, pos: schem.pos[p.id] ?? defaults.get(p.id) ?? { x: 300, y: 40, rot: 0 }, sym: syms.get(p.id)! }));
  const all = [uno, ...placed];
  const terms: Terminal[] = all.flatMap(terminals).filter((tm) => !(tm.id === 'uno' && tm.pin.startsWith('GND_P')));
  const byRef = new Map(terms.map((tm) => [tm.ref, tm]));
  const live = new Set(wires.map((w) => w.id));
  const sheet = useMemo(() => sheetWires(terms, nets, schem.wires.filter((w) => live.has(w.wire))), [terms.map((x) => `${x.ref}:${x.x}:${x.y}`).join('|'), nets, schem.wires, wires]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(shown.map((p) => [p.id, p]));

  // the drawing's extent (everything plus the title block), to fit the view to it
  const extent = (() => {
    const bs = all.map(boxOf);
    const x0 = Math.min(...bs.map((b) => b.x0)) - 40, y0 = Math.min(...bs.map((b) => b.y0)) - 40;
    const x1 = Math.max(...bs.map((b) => b.x1), ...sheet.wires.flatMap((w) => w.path.map((q) => q[0]))) + 40;
    const y1 = Math.max(...bs.map((b) => b.y1), ...sheet.wires.flatMap((w) => w.path.map((q) => q[1]))) + 40;
    return { x0, y0, x1: Math.max(x1, x0 + 520), y1: y1 + 90 };
  })();
  const title = { x: extent.x1 - 280, y: extent.y1 - 80 };
  const fitView = () => {
    const w = extent.x1 - extent.x0, h = extent.y1 - extent.y0, aspect = size.h / size.w;
    const vw = Math.max(w, h / aspect);
    return { x: extent.x0 - (vw - w) / 2, y: extent.y0 - (vw * aspect - h) / 2, w: vw };
  };
  const v = view ?? fitView();
  const vh = v.w * (size.h / size.w);

  useEffect(() => { // the sheet's size on screen
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(200, el.clientWidth), h: Math.max(200, el.clientHeight) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);
  useEffect(() => { setView(null); }, [full]);

  // ── pointer: drag symbols, pan, pinch, draw wires ──
  const toSheet = (cx: number, cy: number): Pt => {
    const svg = svgRef.current, m = svg?.getScreenCTM();
    if (!svg || !m) return [0, 0];
    const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
    const q = p.matrixTransform(m.inverse());
    return [q.x, q.y];
  };
  const act = useRef<{ kind: 'part' | 'pan' | 'pin' | 'paper' | 'pinch'; id?: string; from?: Pos; p0: Pt; c0: Pt; view0: { x: number; y: number; w: number }; moved: boolean; g: number } | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const zoomAt = (f: number, at?: Pt) => {
    const c = at ?? [v.x + v.w / 2, v.y + vh / 2];
    const w = Math.min(4000, Math.max(120, v.w / f));
    const k = w / v.w;
    setView({ x: c[0] - (c[0] - v.x) * k, y: c[1] - (c[1] - v.y) * k, w });
  };
  useEffect(() => { // the wheel zooms where the pointer is (not the page)
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, toSheet(e.clientX, e.clientY)); };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  const posOf = (id: string) => (id === 'uno' ? uno.pos : placed.find((p) => p.id === id)!.pos);
  const pickOf = (ref: string): Pick => {
    const part = ref.startsWith('uno.') ? undefined : byId.get(ref.slice(0, ref.indexOf('.')));
    const pin = ref.slice(ref.indexOf('.') + 1);
    return { ref, part, pin, label: part ? `${partName(part)} ${pin}` : `UNO ${pin}` };
  };
  const finish = (to: Pick) => {
    if (!wiring) return;
    const used = api.getState().usedPins();
    const point = (x: Pick) => (x.part ? jumperPoint(x.part, x.pin, used) : x.ref);
    const a = point(wiring.from), b = point(to);
    if (!a || !b) { api.setState({ message: t('build.msg.noRoom') }); return; }
    const id = api.getState().addWire(a, b);
    if (!id) return;
    api.getState().addSchemWire({ id: `s${id}`, wire: id, from: wiring.from.ref, to: to.ref, pts: wiring.pts });
    setWiring(null);
  };
  const choosePin = (ref: string) => {
    const pick = pickOf(ref);
    if (!wiring) { setWiring({ from: pick, pts: [] }); return; }
    if (wiring.from.ref === ref) { setWiring(null); return; }
    finish(pick);
  };
  const corner = (c: Pt) => {
    if (!wiring) return;
    const start = byRef.get(wiring.from.ref)!, last = wiring.pts[wiring.pts.length - 1] ?? [start.x, start.y];
    const s: Pt = [snap(c[0]), snap(c[1])], elbow: Pt = [s[0], last[1]];
    const pts = [...wiring.pts];
    if (elbow[0] !== last[0] || elbow[1] !== last[1]) pts.push(elbow);
    if (s[0] !== elbow[0] || s[1] !== elbow[1]) pts.push(s);
    setWiring({ ...wiring, pts });
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const p0 = toSheet(e.clientX, e.clientY);
    if (pointers.current.size === 2) { act.current = { kind: 'pinch', p0, c0: [e.clientX, e.clientY], view0: v, moved: true, g: 0 }; return; }
    const el = (e.target as Element).closest('[data-kind]') as HTMLElement | null;
    const kind = el?.dataset.kind;
    if (kind === 'pin') { act.current = { kind: 'pin', id: el!.dataset.ref, p0, c0: [e.clientX, e.clientY], view0: v, moved: false, g: 0 }; return; }
    if (kind === 'part' && !wiring) {
      const id = el!.dataset.id!;
      if (id === 'uno') { setUnoSelected(true); api.getState().select(null); } else { setUnoSelected(false); api.getState().select(id); }
      act.current = { kind: 'part', id, from: posOf(id), p0, c0: [e.clientX, e.clientY], view0: v, moved: false, g: ++gesture.current };
      return;
    }
    if (kind === 'wire' && !wiring) { setUnoSelected(false); api.getState().select(el!.dataset.wire!); act.current = null; return; }
    act.current = { kind: wiring ? 'paper' : 'pan', p0, c0: [e.clientX, e.clientY], view0: v, moved: false, g: 0 };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const here = toSheet(e.clientX, e.clientY);
    if (wiring) setCursor([snap(here[0]), snap(here[1])]);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const a = act.current;
    if (!a) return;
    const dist = Math.hypot(e.clientX - a.c0[0], e.clientY - a.c0[1]);
    if (dist > 4) a.moved = true;
    if (a.kind === 'pinch' && pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      const start = (a as unknown as { d0?: number }).d0 ?? ((a as unknown as { d0?: number }).d0 = d);
      const w = Math.min(4000, Math.max(120, a.view0.w * (start / d)));
      setView({ x: a.view0.x + (a.view0.w - w) / 2, y: a.view0.y + ((a.view0.w - w) * (size.h / size.w)) / 2, w });
      return;
    }
    if (a.kind === 'part' && a.moved && a.id && a.from) {
      const pos = { x: snap(a.from.x + here[0] - a.p0[0]), y: snap(a.from.y + here[1] - a.p0[1]), rot: a.from.rot };
      api.getState().setSchemPos(a.id, pos, a.g);
    }
    if ((a.kind === 'pan' || a.kind === 'paper') && a.moved) {
      const k = a.view0.w / size.w;
      setView({ x: a.view0.x - (e.clientX - a.c0[0]) * k, y: a.view0.y - (e.clientY - a.c0[1]) * k, w: a.view0.w });
    }
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    const a = act.current;
    act.current = null;
    if (!a || a.moved) return;
    if (a.kind === 'pin' && a.id) choosePin(a.id);
    else if (a.kind === 'paper') corner(toSheet(e.clientX, e.clientY));
    else if (a.kind === 'pan') { api.getState().select(null); setUnoSelected(false); }
  };

  // ── keys: R turns, Delete removes, Escape cancels ──
  const selId = unoSelected ? 'uno' : selected && (byId.has(selected) ? selected : null);
  const selWire = selected && schem.wires.find((w) => w.wire === selected) ? selected : null;
  const rotate = () => { if (selId) { const p = posOf(selId); api.getState().setSchemPos(selId, { ...p, rot: (p.rot + 90) % 360 }); } };
  const remove = () => { if (selId && selId !== 'uno') api.getState().removePart(selId); else if (selWire) api.getState().removeWire(selWire); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rotate(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
    else if (e.key === 'Escape') { if (wiring) setWiring(null); else if (full) setFull(false); else { api.getState().select(null); setUnoSelected(false); } }
  };

  // ── download the drawing as an SVG file ──
  const download = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    const w = extent.x1 - extent.x0, h = extent.y1 - extent.y0;
    copy.setAttribute('viewBox', `${extent.x0} ${extent.y0} ${w} ${h}`);
    copy.setAttribute('width', String(Math.round(w * 2))); copy.setAttribute('height', String(Math.round(h * 2)));
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.querySelectorAll('.schem__hit, .schem__ui').forEach((n) => n.remove());
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'schematic.svg'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const hotNet = hover ? nets.netOf(hover) : null;
  const isHot = (ref: string) => hotNet !== null && nets.nameOf(ref) !== null && nets.netOf(ref) === hotNet;
  const preview: Pt[] | null = wiring && cursor ? (() => {
    const s = byRef.get(wiring.from.ref)!, last = wiring.pts[wiring.pts.length - 1] ?? [s.x, s.y];
    return [[s.x, s.y], ...wiring.pts, [cursor[0], last[1]], cursor];
  })() : null;
  const today = new Date().toISOString().slice(0, 10);
  const hint = wiring ? t('build.schem.corner').replace('{pin}', wiring.from.label) : t('build.schem.first');
  const tool = (label: StringKey, onClick: () => void, path: string, disabled = false) => (
    <button type="button" aria-label={t(label)} title={t(label)} onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>
    </button>
  );

  return (
    <div className={`schem${full ? ' schem--full' : ''}`} data-testid="schematic">
      <div className="schem__bar">
        <p className="build-note" aria-live="polite">{wiring ? t('build.schem.second').replace('{pin}', wiring.from.label) + ' ' : ''}{hint}</p>
        <div className="schem__tools" role="toolbar" aria-label={t('build.schem.tools')}>
          {tool('build.undo.key', () => api.getState().undo(), 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11', !canUndo)}
          {tool('build.redo.key', () => api.getState().redo(), 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13', !canRedo)}
          {tool('build.schem.rotate', rotate, 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', !selId)}
          {tool('build.schem.delete', remove, 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', !(selId && selId !== 'uno') && !selWire)}
          {tool('viewer.zoomOut', () => zoomAt(1 / 1.25), 'M5 12h14')}
          {tool('viewer.zoomIn', () => zoomAt(1.25), 'M12 5v14M5 12h14')}
          {tool('build.schem.fit', () => setView(null), 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}
          {tool(full ? 'build.schem.exitFull' : 'build.schem.full', () => setFull(!full), full ? 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' : 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7')}
          {tool('build.schem.download', download, 'M12 4v11M7 10l5 5 5-5M5 20h14')}
        </div>
      </div>
      {shown.length === 0 && <p className="build-note">{t('build.schem.empty')}</p>}
      <div className="schem__sheet" ref={boxRef} tabIndex={0} onKeyDown={onKey} aria-label={t('build.schem.title')}>
        <svg ref={svgRef} viewBox={`${v.x} ${v.y} ${v.w} ${vh}`} width={size.w} height={size.h} role="group" aria-label={t('build.schem.title')}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => { e.preventDefault(); setWiring(null); }}
          style={{ touchAction: 'none', cursor: wiring ? 'crosshair' : 'default' }} fontFamily="Arial, Helvetica, sans-serif">
          <defs>
            <pattern id="schem-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={0.7} fill={C.dot} /></pattern>
          </defs>
          <rect x={v.x - 10} y={v.y - 10} width={v.w + 20} height={vh + 20} fill={C.paper} className="schem__ui" />
          <rect x={v.x - 10} y={v.y - 10} width={v.w + 20} height={vh + 20} fill="url(#schem-grid)" className="schem__ui" />

          {/* the wires (drawn and automatic), junction dots, power flags */}
          {sheet.wires.map((w, i) => {
            const hot = !!w.drawn && selWire === w.drawn.wire, net = w.path.length && hotNet !== null && w.net !== null && terms.some((tm) => isHot(tm.ref) && nets.nameOf(tm.ref) === w.net);
            return (
              <g key={i}>
                <polyline points={w.path.map((q) => q.join(',')).join(' ')} className="schem__wire" fill="none" stroke={hot || net ? C.hot : C.wire} strokeWidth={hot ? 2.6 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
                {w.drawn && <polyline points={w.path.map((q) => q.join(',')).join(' ')} className="schem__hit" data-kind="wire" data-wire={w.drawn.wire} fill="none" stroke="transparent" strokeWidth={10} />}
              </g>
            );
          })}
          {sheet.dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={C.dot2} />)}
          {sheet.flags.map((f) => <PowerFlag key={f.ref} {...f} />)}

          {/* the symbols */}
          {all.map((p) => {
            const b = boxOf(p), body = p.id === 'uno' ? unoSym.body : syms.get(p.id)!.body;
            const cx = (b.x0 + b.x1) / 2, upright = p.pos.rot % 180 === 0, isSel = p.id === selId;
            const part = byId.get(p.id);
            return (
              <g key={p.id}>
                {part && <title>{partName(part)}</title>}
                <g transform={`translate(${p.pos.x} ${p.pos.y}) rotate(${p.pos.rot} ${p.sym.w / 2} ${p.sym.h / 2})`} stroke={C.sym} fill="none" strokeWidth={1.4} strokeLinecap="round" color={C.pinText}>{body}</g>
                {p.id === 'uno'
                  ? <><text x={cx} y={b.y0 + 4} textAnchor="middle" fill={C.des} stroke="none" fontSize={12} fontWeight={700}>U1</text><text x={cx} y={b.y1 + 14} textAnchor="middle" fill={C.val} stroke="none" fontSize={11}>Arduino UNO R3</text></>
                  : upright
                    ? <><text x={cx} y={b.y0 + 6} textAnchor="middle" fill={C.des} stroke="none" fontSize={12} fontWeight={700}>{des.get(p.id)}</text><text x={cx} y={b.y1 - 8} textAnchor="middle" fill={C.val} stroke="none" fontSize={11}>{part && valueOf(part)}</text></>
                    : <><text x={b.x1 - 30} y={(b.y0 + b.y1) / 2 - 4} fill={C.des} stroke="none" fontSize={12} fontWeight={700}>{des.get(p.id)}</text><text x={b.x1 - 30} y={(b.y0 + b.y1) / 2 + 12} fill={C.val} stroke="none" fontSize={11}>{part && valueOf(part)}</text></>}
                <rect x={b.x0 + 8} y={b.y0 + 8} width={b.x1 - b.x0 - 16} height={b.y1 - b.y0 - 16} fill="transparent" stroke={isSel ? C.hot : 'none'} strokeDasharray="5 4" strokeWidth={1.4}
                  className="schem__hit" data-kind="part" data-id={p.id} style={{ cursor: wiring ? 'crosshair' : 'move' }} />
              </g>
            );
          })}

          {/* the pins: press one to start a wire, another to finish it */}
          {terms.map((tm) => {
            const net = nets.nameOf(tm.ref), pick = pickOf(tm.ref), from = wiring?.from.ref === tm.ref;
            return (
              <g key={tm.ref} className={`schem__term${from ? ' is-from' : isHot(tm.ref) ? ' is-net' : ''}`}>
                <circle cx={tm.x} cy={tm.y} r={from ? 4.5 : 3} className="schem__ui" fill={from || isHot(tm.ref) ? C.hot : 'transparent'} stroke={from || isHot(tm.ref) ? C.hot : 'none'} />
                <circle cx={tm.x} cy={tm.y} r={tm.id === 'uno' ? 9 : 12} className="schem__hit" data-kind="pin" data-ref={tm.ref} role="button" tabIndex={0}
                  aria-label={`${pick.label}${net ? ` — ${net}` : ''}`} aria-pressed={from} fill="transparent" style={{ cursor: 'crosshair' }}
                  onPointerEnter={() => setHover(tm.ref)} onPointerLeave={() => setHover((h) => (h === tm.ref ? null : h))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePin(tm.ref); } }} />
              </g>
            );
          })}
          {preview && <polyline points={preview.map((q) => q.join(',')).join(' ')} className="schem__ui" fill="none" stroke={C.hot} strokeWidth={1.6} strokeDasharray="6 4" />}

          {/* the title block */}
          <g transform={`translate(${title.x} ${title.y})`} stroke={C.title} strokeWidth={1} fill="none">
            <rect width={260} height={60} />
            <line x1={0} y1={22} x2={260} y2={22} /><line x1={0} y1={41} x2={260} y2={41} /><line x1={160} y1={22} x2={160} y2={60} />
            <text x={8} y={16} fill={C.title} stroke="none" fontSize={12} fontWeight={800}>{t('build.schem.sheetTitle')}</text>
            <text x={8} y={36} fill={C.val} stroke="none" fontSize={10}>learnarduino.tech</text>
            <text x={168} y={36} fill={C.val} stroke="none" fontSize={10}>{t('build.schem.sheetNo')}</text>
            <text x={8} y={55} fill={C.val} stroke="none" fontSize={10}>{today}</text>
            <text x={168} y={55} fill={C.val} stroke="none" fontSize={10}>Rev 1.0</text>
          </g>
        </svg>
      </div>
      <p className="build-note schem__keys">{t('build.schem.keys')}</p>
    </div>
  );
}

