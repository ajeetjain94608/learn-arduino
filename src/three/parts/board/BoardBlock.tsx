import { PART_DEFS } from '../../../circuit/parts';
import type { PartType } from '../../../circuit/types';
import { BB, colX, holeLocal } from '../../breadboard/breadboardGeometry';
import type { PartView } from '../partView';

// A plain block over a breadboard part's holes (used until its own model exists).
export function BoardBlock({ id, at, params }: PartView) {
  const type = id.replace(/[0-9]+$/, '') as PartType;
  const holes = PART_DEFS[type].covers(at, params);
  const cols = holes.map((h) => Number(h.match(/^[0-9]+/)![0]));
  const x0 = colX(Math.min(...cols)), x1 = colX(Math.max(...cols));
  const [, , z] = 'col' in at ? holeLocal(at.col, at.row) : [0, 0, 0];
  return <mesh position={[(x0 + x1) / 2, BB.H + 3, z]}><boxGeometry args={[x1 - x0 + 2.4, 6, 3]} /><meshStandardMaterial color="#5A6372" /></mesh>;
}
