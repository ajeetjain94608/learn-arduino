import { useMemo } from 'react';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { BB, holeLocal } from '../breadboard/breadboardGeometry';
import { Breadboard } from '../breadboard/Breadboard';
import { CurrentFlow } from '../current/CurrentFlow';
import { PartGroup } from '../inspect/Inspectable';
import { Jumper } from '../parts/Jumper';
import { Led5mm } from '../parts/Led5mm';
import { Resistor } from '../parts/Resistor';
import { BLINK, blinkWires } from './blinkLayout';

type Props = {
  pinHigh: boolean;       // pin 13 output level
  bootLed?: boolean;      // the L LED's bootloader flashes after a reset
  rx?: boolean; tx?: boolean; // serial activity LEDs (upload, Serial.println)
  showCircuit: boolean;   // breadboard, parts and wires (hidden in the board-only view)
  showCurrent: boolean;   // current animation on the wires
};

// Lesson 2 circuit: pin 13 → 5 mm LED → 220 Ω → GND, on a half breadboard. Every part is inspectable.
export function BlinkCircuit({ pinHigh, bootLed = false, rx = false, tx = false, showCircuit, showCurrent }: Props) {
  const wires = useMemo(() => blinkWires(), []);
  const [ax, , az] = holeLocal(...BLINK.ledAnode), [kx] = holeLocal(...BLINK.ledCathode);
  const [r1] = holeLocal(...BLINK.resistorFrom), [r2, , rz] = holeLocal(...BLINK.resistorTo);
  const ledX = (ax + kx) / 2;
  const mid = (w: typeof wires.signal) => w.wire.getPoint(0.5).toArray() as [number, number, number];
  return (
    <>
      <UnoBoard position={BLINK.board} pin13={pinHigh || bootLed} rx={rx} tx={tx} />
      <group visible={showCircuit}>
        <PartGroup id="breadboard" kind="breadboard" center={BLINK.breadboard}>
          <Breadboard position={BLINK.breadboard}>
            <PartGroup id="led" kind="led" center={[ledX, BB.H, az]}>
              <Led5mm position={[ledX, 0, az]} lit={pinHigh ? 1 : 0} />
            </PartGroup>
            <PartGroup id="resistor" kind="resistor" center={[(r1 + r2) / 2, BB.H, rz]}>
              <Resistor from={BLINK.resistorFrom} to={BLINK.resistorTo} />
            </PartGroup>
          </Breadboard>
        </PartGroup>
        <PartGroup id="wire-signal" kind="wire-signal" center={mid(wires.signal)}>
          <Jumper a={wires.signal.a} b={wires.signal.b} color={wires.signal.color} lift={wires.signal.lift} />
        </PartGroup>
        <PartGroup id="wire-ground" kind="wire-ground" center={mid(wires.ground)}>
          <Jumper a={wires.ground.a} b={wires.ground.b} color={wires.ground.color} lift={wires.ground.lift} />
        </PartGroup>
      </group>
      <CurrentFlow wires={[wires.signal, wires.ground]} active={showCircuit && showCurrent && pinHigh} />
    </>
  );
}
