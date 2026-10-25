import type { PartType } from '../circuit/types';

// The component library: every part a learner can use, explained (our own words; values from typical data sheets).
export type ComponentInfo = {
  name: string;
  category: 'board' | 'basic' | 'output' | 'sensor';
  overview: string;
  points: string[];
  pins: { pin: string; does: string }[];
  specs: { label: string; value: string }[];
  example: string; // a short sketch that uses it
};
export type ComponentId = PartType | 'uno' | 'breadboard';

export const COMPONENTS: Record<ComponentId, ComponentInfo> = {
  uno: {
    name: 'UNO R3 board', category: 'board',
    overview: 'The brain of every project: an ATmega328P microcontroller on a board with pins you can plug wires into. You write a sketch, upload it, and the board runs it on its own.',
    points: ['14 digital pins (6 can dim with PWM, marked ~)', '6 analog inputs, A0–A5, read 0–5 V as 0–1023', 'Powered from USB or a 7–12 V jack'],
    pins: [
      { pin: 'D0–D13', does: 'Digital inputs and outputs (D0, D1 also carry the serial monitor)' },
      { pin: '~3 ~5 ~6 ~9 ~10 ~11', does: 'PWM: analogWrite() 0–255' },
      { pin: 'A0–A5', does: 'Analog inputs; A4 = SDA and A5 = SCL for I²C' },
      { pin: '5V · 3.3V', does: 'Power for your parts' },
      { pin: 'GND', does: 'Ground — every circuit returns here' },
    ],
    specs: [
      { label: 'Microcontroller', value: 'ATmega328P, 16 MHz' }, { label: 'Flash / RAM', value: '32 KB / 2 KB' },
      { label: 'Pin current', value: '20 mA (40 mA absolute max)' }, { label: 'Operating voltage', value: '5 V' },
    ],
    example: 'void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}\n',
  },
  breadboard: {
    name: 'Breadboard', category: 'board',
    overview: 'A board full of holes for building circuits without soldering. Under each short row of five holes (a–e, f–j) is a metal strip that joins them; the long rails along the edges carry power.',
    points: ['Holes in the same column, a–e, are connected', 'The gap in the middle separates a–e from f–j', 'The + and − rails run the whole length'],
    pins: [{ pin: 'a–e, f–j', does: 'Five holes joined in each column' }, { pin: '+ / − rails', does: 'Power and ground along the edges' }],
    specs: [{ label: 'Size', value: 'Half size, 30 columns' }, { label: 'Hole spacing', value: '2.54 mm (0.1")' }],
    example: '// No code: the breadboard just connects things.\nvoid setup() {}\nvoid loop() {}\n',
  },
  led: {
    name: 'LED', category: 'basic',
    overview: 'A light-emitting diode lights when current flows from its long leg (+, anode) to its short leg (−, cathode). It always needs a resistor, or too much current burns it.',
    points: ['Long leg to the pin, short leg towards GND', 'About 10–20 mA is plenty', 'Colours need different voltages (red ≈ 2 V, blue ≈ 3 V)'],
    pins: [{ pin: 'Anode (+)', does: 'The long leg: current goes in here' }, { pin: 'Cathode (−)', does: 'The short leg, flat side: current comes out' }],
    specs: [{ label: 'Size', value: '5 mm' }, { label: 'Forward voltage', value: '1.9 V red … 3.0 V blue/white' }, { label: 'Current', value: '20 mA typical, 50 mA burns it here' }],
    example: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n',
  },
  resistor: {
    name: 'Resistor', category: 'basic',
    overview: 'A resistor limits current. The coloured bands tell its value: 220 Ω protects an LED, 10 kΩ makes a pull-down or a divider, 1 kΩ feeds a transistor’s base.',
    points: ['Works either way round', 'Current = voltage ÷ resistance (Ohm’s law)', 'Bands: digit, digit, multiplier, tolerance'],
    pins: [{ pin: 'Leg 1, leg 2', does: 'Either way round' }],
    specs: [{ label: 'Values here', value: '220 Ω, 1 kΩ, 10 kΩ' }, { label: 'Power', value: '¼ W' }, { label: 'Tolerance', value: '±5 % (gold band)' }],
    example: '// An LED with a 220 Ω resistor: (5 V − 2 V) ÷ 220 Ω ≈ 14 mA\nvoid setup() {\n  pinMode(9, OUTPUT);\n  digitalWrite(9, HIGH);\n}\nvoid loop() {}\n',
  },
  button: {
    name: 'Push button', category: 'basic',
    overview: 'A tactile switch: pressing it joins its two sides. It sits across the breadboard’s middle gap; the legs facing each other across the gap are always joined.',
    points: ['Read it with digitalRead()', 'Needs a pull-down resistor, or INPUT_PULLUP', 'With INPUT_PULLUP, pressed reads LOW'],
    pins: [{ pin: 'Legs 1 · 3', does: 'Always joined (across the gap)' }, { pin: 'Legs 2 · 4', does: 'Always joined' }, { pin: '1 ↔ 2', does: 'Joined while pressed' }],
    specs: [{ label: 'Size', value: '6 × 6 mm' }, { label: 'Bounce', value: 'A few ms of flicker when pressed' }],
    example: 'void setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, digitalRead(2) == LOW);\n}\n',
  },
  pot: {
    name: 'Potentiometer', category: 'basic',
    overview: 'A resistor with a sliding contact. Put 5 V and GND on the outer legs and the middle leg (the wiper) gives anything in between as you turn the knob.',
    points: ['Turn it in 3D, or set it in its window', 'analogRead() gives 0–1023', 'Great for setting speed, brightness, angle'],
    pins: [{ pin: 'Outer legs', does: '5 V and GND' }, { pin: 'Middle (wiper)', does: 'The voltage you set — to an analog pin' }],
    specs: [{ label: 'Resistance', value: '10 kΩ' }, { label: 'Turn', value: '270°' }],
    example: 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(analogRead(A0));\n  delay(100);\n}\n',
  },
  diode: {
    name: 'Diode', category: 'basic',
    overview: 'A one-way valve for current: it flows from the anode to the cathode (the end with the band) and is blocked the other way. Across a motor it catches the voltage spike when the motor stops.',
    points: ['The band marks the cathode', 'About 0.7 V is lost across it', 'Protects transistors from motor spikes'],
    pins: [{ pin: 'Anode (A)', does: 'Current goes in' }, { pin: 'Cathode (K, band)', does: 'Current comes out' }],
    specs: [{ label: 'Type', value: '1N4001' }, { label: 'Forward voltage', value: '≈ 0.7 V' }, { label: 'Current', value: '1 A' }],
    example: '// No code: the diode protects the circuit by itself.\nvoid setup() {}\nvoid loop() {}\n',
  },
  npn: {
    name: 'Transistor (TIP120)', category: 'basic',
    overview: 'A switch worked by a small current. A few milliamps into the base (through a 1 kΩ resistor) let up to amps flow from the collector to the emitter — enough for motors and fans.',
    points: ['Base through 1 kΩ to a pin', 'Load between 5 V and the collector', 'Emitter to GND'],
    pins: [{ pin: 'B (base)', does: 'The control input (through 1 kΩ)' }, { pin: 'C (collector)', does: 'To the motor’s minus side' }, { pin: 'E (emitter)', does: 'To GND' }],
    specs: [{ label: 'Type', value: 'NPN Darlington, TO-220' }, { label: 'Turns on at', value: 'about 1.4 V base–emitter' }, { label: 'Current', value: 'up to 5 A' }],
    example: 'void setup() {\n  pinMode(6, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(6, 180);   // motor speed through the transistor\n}\n',
  },
  rgb: {
    name: 'RGB LED', category: 'output',
    overview: 'Three LEDs — red, green and blue — under one milky lens, sharing the minus leg (common cathode). Give each colour its own resistor and PWM pin, and mix any colour.',
    points: ['The longest leg is the shared cathode (−)', 'One 220 Ω resistor per colour', 'Red + green = yellow, all three = white'],
    pins: [{ pin: 'R', does: 'Red (+)' }, { pin: 'K (longest)', does: 'Shared minus, to GND' }, { pin: 'G', does: 'Green (+)' }, { pin: 'B', does: 'Blue (+)' }],
    specs: [{ label: 'Type', value: '5 mm, common cathode' }, { label: 'Forward voltage', value: 'R ≈ 2 V, G and B ≈ 3 V' }],
    example: 'void setup() {}\n\nvoid loop() {\n  analogWrite(9, 255);  // red\n  analogWrite(10, 120); // a little green\n  analogWrite(11, 0);   // no blue: orange\n}\n',
  },
  buzzer: {
    name: 'Buzzer', category: 'output',
    overview: 'A passive piezo buzzer: a disc that clicks each time its pin changes. Change it fast and you hear a note — tone() does that for you at any frequency.',
    points: ['tone(pin, Hz) and noTone(pin)', 'A4 = 440 Hz; double it for an octave up', 'Passive: it needs a changing signal'],
    pins: [{ pin: '+', does: 'To a pin' }, { pin: '−', does: 'To GND' }],
    specs: [{ label: 'Type', value: '12 mm passive piezo' }, { label: 'Range', value: 'about 100 Hz – 10 kHz' }],
    example: 'void setup() {}\n\nvoid loop() {\n  tone(8, 440, 200);\n  delay(400);\n  tone(8, 660, 200);\n  delay(400);\n}\n',
  },
  traffic: {
    name: 'Traffic light', category: 'output',
    overview: 'A little module with a red, a yellow and a green LED, each already with its own resistor. Wire each colour to a pin and GND to GND — no extra parts.',
    points: ['One pin per colour', 'Resistors are built in', 'Good for traffic lights, signals, warnings'],
    pins: [{ pin: 'R', does: 'Red' }, { pin: 'Y', does: 'Yellow' }, { pin: 'G', does: 'Green' }, { pin: 'GND', does: 'Ground' }],
    specs: [{ label: 'LEDs', value: '3 × 5 mm with 220 Ω' }],
    example: 'void setup() {\n  for (int p = 2; p <= 4; p++) pinMode(p, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(2, HIGH); delay(2000); digitalWrite(2, LOW);\n  digitalWrite(3, HIGH); delay(800);  digitalWrite(3, LOW);\n  digitalWrite(4, HIGH); delay(2000); digitalWrite(4, LOW);\n}\n',
  },
  motor: {
    name: 'DC motor', category: 'output',
    overview: 'A small motor that spins when current flows. It needs far more current than a pin can give, so it is switched by a transistor, with a diode across it for protection. PWM sets its speed.',
    points: ['Never straight on a pin: use a TIP120', 'analogWrite() sets the speed', 'Swap its wires to spin the other way'],
    pins: [{ pin: '+', does: 'To 5 V' }, { pin: '−', does: 'To the transistor’s collector' }],
    specs: [{ label: 'Type', value: '130-size hobby motor, 3–6 V' }, { label: 'Current', value: '≈ 0.5 A at full speed' }],
    example: 'void setup() {\n  pinMode(6, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(6, 255); delay(2000);\n  analogWrite(6, 0);   delay(2000);\n}\n',
  },
  servo: {
    name: 'Servo', category: 'output',
    overview: 'A motor with gears and a position sensor inside: tell it an angle from 0° to 180° and it turns there and holds. Its signal wire takes a pulse every 20 ms — the Servo library makes them.',
    points: ['#include <Servo.h>', 'servo.attach(pin), servo.write(angle)', 'Brown GND, red 5 V, orange signal'],
    pins: [{ pin: 'GND (brown)', does: 'Ground' }, { pin: 'V+ (red)', does: '5 V' }, { pin: 'SIG (orange)', does: 'Pulses from a pin' }],
    specs: [{ label: 'Type', value: '9 g micro servo' }, { label: 'Range', value: '0–180°' }, { label: 'Pulse', value: '0.5–2.4 ms every 20 ms' }],
    example: '#include <Servo.h>\nServo arm;\n\nvoid setup() {\n  arm.attach(9);\n}\n\nvoid loop() {\n  arm.write(0);   delay(1000);\n  arm.write(180); delay(1000);\n}\n',
  },
  stepper: {
    name: 'Stepper motor', category: 'output',
    overview: 'A motor that turns in exact steps — 2048 for a full turn — on its driver board. Four pins switch its four coils in order; the Stepper library does the switching for you.',
    points: ['#include <Stepper.h>', 'Stepper m(2048, 8, 10, 9, 11)', 'm.step(n) turns exactly n steps'],
    pins: [{ pin: 'IN1–IN4', does: 'To four pins' }, { pin: '+ · −', does: '5 V and GND' }],
    specs: [{ label: 'Motor', value: '28BYJ-48, 5 V' }, { label: 'Driver', value: 'ULN2003 board with LEDs A–D' }, { label: 'Steps', value: '2048 a turn' }],
    example: '#include <Stepper.h>\nStepper m(2048, 8, 10, 9, 11);\n\nvoid setup() {\n  m.setSpeed(10);\n}\n\nvoid loop() {\n  m.step(512);   // a quarter turn\n  delay(500);\n}\n',
  },
  oled: {
    name: 'OLED screen', category: 'output',
    overview: 'A tiny 128 × 64 pixel screen. It talks over I²C on just two wires — SDA to A4, SCL to A5 — and the OLED library draws text, lines and boxes into a picture that display() sends to it.',
    points: ['#include <OLED.h>', 'print() text, drawRect(), fillRect()', 'Nothing shows until display()'],
    pins: [{ pin: 'GND · VCC', does: 'Ground and 5 V' }, { pin: 'SCL', does: 'To A5' }, { pin: 'SDA', does: 'To A4' }],
    specs: [{ label: 'Size', value: '0.96", 128 × 64 pixels' }, { label: 'Address', value: '0x3C (I²C)' }],
    example: '#include <OLED.h>\nOLED screen;\n\nvoid setup() {\n  screen.begin();\n  screen.setTextSize(2);\n  screen.print("Hello!");\n  screen.display();\n}\n\nvoid loop() {}\n',
  },
  ldr: {
    name: 'Light sensor', category: 'sensor',
    overview: 'A light-dependent resistor: bright light lowers its resistance, darkness raises it. With a 10 kΩ resistor it makes a divider, and an analog pin reads how bright it is.',
    points: ['LDR from 5 V to A0, 10 kΩ from A0 to GND', 'Brighter = higher reading', 'Move the desk lamp, or set lux in its window'],
    pins: [{ pin: 'Leg 1, leg 2', does: 'Either way round' }],
    specs: [{ label: 'Resistance', value: '≈ 10 kΩ at 10 lux, 1 MΩ in the dark' }],
    example: 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(analogRead(A0)); // brighter = higher\n  delay(200);\n}\n',
  },
  tmp36: {
    name: 'Temperature sensor', category: 'sensor',
    overview: 'The TMP36 gives a voltage that follows the temperature: 0.5 V at 0 °C, and 10 mV more for every degree. Read it on an analog pin and turn it into degrees with one line.',
    points: ['Flat face towards you: +Vs, Vout, GND', '°C = (volts − 0.5) × 100', 'Point the hairdryer at it, or set °C in its window'],
    pins: [{ pin: 'VS', does: '5 V' }, { pin: 'OUT', does: 'To an analog pin' }, { pin: 'GND', does: 'Ground' }],
    specs: [{ label: 'Range', value: '−40 … 125 °C' }, { label: 'Output', value: '10 mV/°C, 750 mV at 25 °C' }],
    example: 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  float volts = analogRead(A0) * 5.0 / 1023.0;\n  Serial.println((volts - 0.5) * 100.0);\n  delay(500);\n}\n',
  },
  fsr: {
    name: 'Force sensor', category: 'sensor',
    overview: 'A force-sensing resistor: a thin pad whose resistance falls from millions of ohms to a few hundred as you press it. With a 10 kΩ resistor, an analog pin measures how hard.',
    points: ['FSR from 5 V to A0, 10 kΩ from A0 to GND', 'Press the pad in 3D and drag down to push harder', 'Not a precise scale — great for “how hard”'],
    pins: [{ pin: 'Leg 1, leg 2', does: 'Either way round' }],
    specs: [{ label: 'Pad', value: '18 mm round' }, { label: 'Resistance', value: '≈ 10 kΩ at 100 g, 1 kΩ at 1 kg' }],
    example: 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(analogRead(A0)); // harder = higher\n  delay(100);\n}\n',
  },
  hcsr04: {
    name: 'Distance sensor', category: 'sensor',
    overview: 'The HC-SR04 measures distance with ultrasound, like a bat: a pulse on TRIG sends a burst, and ECHO stays high until the echo returns. Every 58 µs is about 1 cm.',
    points: ['10 µs pulse on TRIG', 'pulseIn(ECHO, HIGH) ÷ 58 = cm', 'Works from 2 cm to 4 m'],
    pins: [{ pin: 'VCC · GND', does: '5 V and ground' }, { pin: 'TRIG', does: 'From a pin: start a measurement' }, { pin: 'ECHO', does: 'To a pin: the echo’s length' }],
    specs: [{ label: 'Range', value: '2 cm – 4 m' }, { label: 'Frequency', value: '40 kHz' }],
    example: 'void setup() {\n  pinMode(9, OUTPUT);\n  pinMode(10, INPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(9, HIGH); delayMicroseconds(10); digitalWrite(9, LOW);\n  Serial.println(pulseIn(10, HIGH) / 58);\n  delay(200);\n}\n',
  },
  soil: {
    name: 'Soil sensor', category: 'sensor',
    overview: 'A capacitive soil-moisture probe: pushed into the pot, it gives about 2.5 V in dry soil and about 1.3 V in water. Nothing metal touches the soil, so it doesn’t rust.',
    points: ['Wetter = lower reading', 'map(reading, 520, 260, 0, 100) gives %', 'Water the plant with the watering can'],
    pins: [{ pin: 'GND · VCC', does: 'Ground and 5 V' }, { pin: 'AOUT', does: 'To an analog pin' }],
    specs: [{ label: 'Type', value: 'Capacitive, analog' }, { label: 'Readings', value: '≈ 520 dry, ≈ 260 in water' }],
    example: 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int percent = map(analogRead(A0), 520, 260, 0, 100);\n  Serial.println(constrain(percent, 0, 100));\n  delay(500);\n}\n',
  },
};

export const COMPONENT_ORDER: { key: 'board' | 'basic' | 'output' | 'sensor'; ids: ComponentId[] }[] = [
  { key: 'board', ids: ['uno', 'breadboard'] },
  { key: 'basic', ids: ['led', 'resistor', 'button', 'pot', 'diode', 'npn'] },
  { key: 'output', ids: ['rgb', 'buzzer', 'traffic', 'motor', 'servo', 'stepper', 'oled'] },
  { key: 'sensor', ids: ['ldr', 'tmp36', 'fsr', 'hcsr04', 'soil'] },
];
