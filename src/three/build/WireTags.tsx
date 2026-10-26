import { Html } from '@react-three/drei';
import { wireLabel } from '../../circuit/wireLabel';
import type { Wire } from '../../circuit/types';
import type { Route } from './wireRoute';

// Small tags on the wires while the board runs: GND, 5 V, HIGH / LOW, A0 = 512 … (the "Simulator" view).
// Each sits on the top of its wire; they never take a tap.
export function WireTags({ wires, routes, volts }: { wires: Wire[]; routes: Map<string, Route>; volts: Record<string, number> }) {
  return (
    <>
      {wires.map((w) => {
        const v = volts[w.id];
        const route = routes.get(w.id);
        if (v === undefined || !route) return null;
        const apex = route.points.reduce((m, p) => (p.y > m.y ? p : m));
        return (
          <Html key={w.id} position={[apex.x, apex.y + 2, apex.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <span className="wire-tag" style={{ borderColor: w.color }}>{wireLabel(w.from, w.to, v)}</span>
          </Html>
        );
      })}
    </>
  );
}
