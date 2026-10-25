// One model per breadboard part (the basics — LED, resistor, button, pot — are in build/partModels.tsx).
import { Buzzer } from './Buzzer';
import { Diode } from './Diode';
import { Fsr } from './Fsr';
import { Ldr } from './Ldr';
import { RgbLed } from './RgbLed';
import { Tip120 } from './Tip120';
import { Tmp36 } from './Tmp36';
import { TrafficLight } from './TrafficLight';

export const BoardParts = { rgb: RgbLed, buzzer: Buzzer, ldr: Ldr, tmp36: Tmp36, fsr: Fsr, diode: Diode, npn: Tip120, traffic: TrafficLight };
