import { useMemo } from 'react';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { holeLocal } from '../breadboard/breadboardGeometry';
import { Breadboard } from '../breadboard/Breadboard';
import { CurrentFlow } from '../current/CurrentFlow';
import { Jumper } from '../parts/Jumper';
import { Led5mm } from '../parts/Led5mm';
import { Resistor } from '../parts/Resistor';
import { BLINK, blinkWires } from './blinkLayout';

type Props = {
  pinHigh: boolean;       // pin 13 output level
  showCircuit: boolean;   // breadboard, parts and wires (hidden in the board-only view)
  showCurrent: boolean;   // current animation on the wires
};

// Lesson 2 circuit: pin 13 → 5 mm LED → 220 Ω → GND, on a half breadboard.
export function BlinkCircuit({ pinHigh, showCircuit, showCurrent }: Props) {
  const wires = useMemo(() => blinkWires(), []);
  const [ax, , az] = holeLocal(...BLINK.ledAnode), [kx] = holeLocal(...BLINK.ledCathode);
  const lit = pinHigh ? 1 : 0;
  return (
    <>
      <UnoBoard position={BLINK.board} pin13={pinHigh} />
      <group visible={showCircuit}>
        <Breadboard position={BLINK.breadboard}>
          <Led5mm position={[(ax + kx) / 2, 0, az]} lit={lit} />
          <Resistor from={BLINK.resistorFrom} to={BLINK.resistorTo} />
        </Breadboard>
        <Jumper a={wires.signal.a} b={wires.signal.b} color={wires.signal.color} lift={wires.signal.lift} />
        <Jumper a={wires.ground.a} b={wires.ground.b} color={wires.ground.color} lift={wires.ground.lift} />
      </group>
      <CurrentFlow wires={[wires.signal, wires.ground]} active={showCircuit && showCurrent && pinHigh} />
    </>
  );
}
