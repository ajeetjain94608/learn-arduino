import type { PartState } from '../../circuit/evaluate';
import type { Placement } from '../../circuit/types';
import type { OnInput } from '../build/controls3d';

// What every part model gets. Breadboard parts draw in breadboard-local millimetres (origin at the board's centre,
// top surface at y = BB.H, `at` = the hole of the first leg). Bench modules draw around their own centre on the bench
// top (y = 0), and their header pins' tips must be exactly at PART_DEFS[type].bench.pins (wires end there).
// `params` has defaults filled in; `inputs` are the learner's input values (lux, cm, …); `onInput(key, value)` sets
// one from a direct 3D control. Live module states (servo angle, OLED picture, buzzer note) are in liveDevices.
export type PartView = {
  id: string;
  at: Placement;
  params: Record<string, string | number>;
  state?: PartState;
  inputs: Record<string, number>;
  onInput: OnInput;
};
