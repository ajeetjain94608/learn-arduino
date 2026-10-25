// Project explanations shown in the info card (English). Structured content lives here, one file per
// language; short UI strings live in src/i18n/en.ts.
import type { View } from '../../three/workbench/cameraViews';

export type Rich = (string | { code: string })[];
export type Icon = 'chip' | 'community' | 'bolt' | 'output' | 'resistor' | 'serial';
export type ProjectInfo = {
  title: string;
  overview: { text: string; points: { icon: Icon; text: Rich }[] };
  pinout: { subtitle: string; rows: { pin: string; color: string; to: string; does: string }[] };
  example: Rich[];
  specs: { label: string; value: string }[];
};

export const PROJECT_INFO: Record<Exclude<View, 'bench'>, ProjectInfo> = {
  board: {
    title: 'UNO R3 board',
    overview: {
      text: 'A microcontroller board you can program to read sensors and control lights, motors and sounds. It is the most popular board for learning electronics and building first robots.',
      points: [
        { icon: 'chip', text: ['Open-source hardware — anyone can study and build it'] },
        { icon: 'community', text: ['A huge community with examples for almost anything'] },
        { icon: 'bolt', text: ['Runs from USB or a 7–12 V battery'] },
      ],
    },
    pinout: {
      subtitle: 'What each group of pins does.',
      rows: [
        { pin: 'D0–D13', color: '#2563EB', to: 'Digital header', does: 'ON/OFF outputs and inputs; ~3, 5, 6, 9, 10, 11 can also dim with PWM.' },
        { pin: 'A0–A5', color: '#10B981', to: 'Analog header', does: 'Measure 0–5 V as a number from 0 to 1023.' },
        { pin: '5V · 3.3V', color: '#E2483D', to: 'Power header', does: 'Supply power to your parts.' },
        { pin: 'GND', color: '#2B2F38', to: 'Power and digital headers', does: 'Ground: every circuit returns current here.' },
        { pin: 'VIN', color: '#F28C16', to: 'Power header', does: 'The 7–12 V coming in from the jack.' },
        { pin: 'SDA · SCL', color: '#8B5CF6', to: 'Next to AREF (same as A4 · A5)', does: 'I²C bus for displays and smart sensors.' },
      ],
    },
    example: [
      ['In ', { code: 'setup()' }, ', ', { code: 'pinMode(13, OUTPUT);' }, ' makes pin 13 an output.'],
      [{ code: 'Serial.begin(9600);' }, ' opens the serial monitor at 9600 baud.'],
      [{ code: 'loop()' }, ' turns pin 13 HIGH, prints, waits, turns it LOW, prints, waits — forever.'],
      ['Pin 13 also drives the board’s built-in L LED, so it blinks with no wiring at all.'],
    ],
    specs: [
      { label: 'Microcontroller', value: 'ATmega328P' },
      { label: 'Clock speed', value: '16 MHz' },
      { label: 'Operating voltage', value: '5 V' },
      { label: 'Input voltage (jack)', value: '7–12 V' },
      { label: 'Digital I/O pins', value: '14 (6 with PWM)' },
      { label: 'Analog inputs', value: '6' },
      { label: 'Flash memory', value: '32 KB' },
      { label: 'SRAM', value: '2 KB' },
      { label: 'EEPROM', value: '1 KB' },
      { label: 'Current per I/O pin', value: '20 mA' },
    ],
  },
  circuit: {
    title: 'Blink an LED',
    overview: {
      text: 'Your first circuit: pin 13 drives a red LED through a 220 Ω resistor on a breadboard. Switching the pin on and off with a pause in between makes it blink.',
      points: [
        { icon: 'output', text: ['Digital output with ', { code: 'digitalWrite()' }] },
        { icon: 'resistor', text: ['The resistor keeps the current safe for the LED'] },
        { icon: 'serial', text: ['Each change is printed with ', { code: 'Serial.println()' }] },
      ],
    },
    pinout: {
      subtitle: 'How this circuit is wired.',
      rows: [
        { pin: 'D13', color: '#F28C16', to: 'LED (+), breadboard column 8', does: 'The sketch switches this pin HIGH and LOW.' },
        { pin: 'GND', color: '#2B2F38', to: 'Resistor → LED (−), column 14', does: 'Current flows back to the board here.' },
      ],
    },
    example: [
      [{ code: 'pinMode(13, OUTPUT);' }, ' lets pin 13 drive current.'],
      [{ code: 'digitalWrite(13, HIGH);' }, ' puts 5 V on the pin: current flows and the LED lights.'],
      [{ code: 'delay(1000);' }, ' waits one second; then ', { code: 'LOW' }, ' turns it off for another second.'],
      [{ code: 'Serial.println("LED on");' }, ' reports each change in the serial monitor.'],
    ],
    specs: [
      { label: 'LED', value: '5 mm red, ≈ 2.0 V forward' },
      { label: 'Resistor', value: '220 Ω (red-red-brown-gold)' },
      { label: 'LED current', value: '≈ (5 − 2) ÷ 220 ≈ 14 mA' },
      { label: 'Pin 13 limit', value: '20 mA recommended, 40 mA max' },
      { label: 'Blink rate', value: '1 s on, 1 s off' },
    ],
  },
};
