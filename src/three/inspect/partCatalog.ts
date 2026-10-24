import { topElements } from '../boards/uno/layout';

// What each physical part is, for hover cards and explanations. Keys of KINDS have strings in en.ts
// under part.<kind>.name / .line / .text.
export const KINDS = {
  atmega328: 1, 'usb-chip': 1, 'regulator-5v': 1, 'regulator-3v3': 1, opamp: 1, mosfet: 1,
  crystal: 1, resonator: 1, 'electrolytic-cap': 1, 'usb-port': 1, 'power-jack': 1, reset: 1,
  'header-digital': 1, 'header-power': 1, 'header-analog': 1, icsp: 1,
  'led-l': 1, 'led-tx': 1, 'led-rx': 1, 'led-on': 1,
  'resistor-array': 1, 'smd-cap': 1, 'smd-res': 1, 'diode': 1, 'diode-glass': 1, fuse: 1, varistor: 1, ferrite: 1, inductor: 1,
  led: 1, resistor: 1, breadboard: 1, 'wire-signal': 1, 'wire-ground': 1,
} as const;
export type Kind = keyof typeof KINDS;

// Packages that have no 3D body (test points, fiducials, solder jumpers, the unpopulated JP2, the drawing frame).
export const NO_BODY_PACKAGES = new Set(['TP-SP', 'FIDUCIA-MOUNT', 'SJ', '2X02', 'FRAME']);

const fixed: Record<string, Kind> = {
  ZU4: 'atmega328', U3: 'usb-chip', U1: 'regulator-5v', U2: 'regulator-3v3', U5: 'opamp', T1: 'mosfet',
  Y1: 'crystal', Y2: 'resonator', PC1: 'electrolytic-cap', PC2: 'electrolytic-cap', X2: 'usb-port', X1: 'power-jack', RESET: 'reset',
  IOH: 'header-digital', IOL: 'header-digital', POWER: 'header-power', AD: 'header-analog', ICSP: 'icsp', ICSP1: 'icsp',
  L: 'led-l', TX: 'led-tx', RX: 'led-rx', ON: 'led-on',
  RN1: 'resistor-array', RN2: 'resistor-array', RN3: 'resistor-array', RN4: 'resistor-array',
  D1: 'diode', D2: 'diode-glass', D3: 'diode-glass', F1: 'fuse', Z1: 'varistor', Z2: 'varistor', L1: 'ferrite', L2: 'inductor',
  R1: 'smd-res', R2: 'smd-res',
};

// Element name → kind. The small ceramic capacitors (C1…C11) share one description.
export const PART_OF: Record<string, Kind> = { ...fixed };
for (const e of topElements()) if (/^C\d+$/.test(e.name)) PART_OF[e.name] = 'smd-cap';

// Part id → kind: board parts are keyed by element name, circuit parts use their kind as id.
export const kindOf = (id: string): Kind | null => PART_OF[id] ?? (id in KINDS ? (id as Kind) : null);
