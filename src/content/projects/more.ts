import type { PartInstance } from '../../circuit/types';
import { wire, type Project } from './types';

// Projects 9–16: a piano, motors, a thermostat, a servo, a stepper wheel, a plant monitor, a strength tester and a
// parking sensor.

// the mini piano's eight keys: buttons across the gap at columns 1, 4, … 22; each key's pin goes to the top of its
// first column, and its other side (two columns on, bottom half) goes to the ground rail
const KEY_COLS = [1, 4, 7, 10, 13, 16, 19, 22];
const keys: PartInstance[] = KEY_COLS.map((col, i) => ({ id: `button${i + 1}`, type: 'button', params: {}, at: { col, row: 'e' } }));
const keyWires = KEY_COLS.flatMap((col, i) => [wire(`uno.D${i + 2}`, `bb.${col}a`, i % 2 ? 'data' : 'signal'), wire(`bb.B-${col + 2}`, `bb.${col + 2}j`, 'ground')]);

// a TIP120 switching a motor from 5 V: base through 1 kΩ from pin 6, the motor between 5 V and the collector,
// a 1N4001 across the motor for the spike when it stops
const motorDriver = (motorId: string): { parts: PartInstance[]; wires: ReturnType<typeof wire>[] } => ({
  parts: [
    { id: 'npn1', type: 'npn', params: {}, at: { col: 20, row: 'a' } },          // B 20a, C 21a, E 22a
    { id: 'resistor1', type: 'resistor', params: { ohms: 1000 }, at: { col: 16, row: 'b' } }, // 16b … 20b
    { id: 'diode1', type: 'diode', params: {}, at: { col: 21, row: 'e' } },      // A 21e (collector), K 25e (5 V)
  ],
  wires: [
    wire('uno.D6', 'bb.16c'), wire('uno.5V', `${motorId}.+`, 'power'), wire(`${motorId}.-`, 'bb.21c', 'other'),
    wire('bb.22c', 'uno.GND', 'ground'), wire('uno.5V', 'bb.25d', 'power'),
  ],
});
const fanDriver = motorDriver('motor1');

export const MORE: Project[] = [
  {
    id: 'piano',
    title: 'Mini piano',
    summary: 'Eight keys and a buzzer: play Do Re Mi.',
    about: 'Each key joins its pin to GND when pressed. The UNO’s own pull-up resistors keep the pins HIGH otherwise, so no resistors are needed. The sketch finds the key that is down and plays its note until you let go.',
    learn: ['INPUT_PULLUP: a pressed key reads LOW', 'Scanning many inputs with a loop', 'noTone() to stop a sound'],
    tryIt: ['Press the keys in 3D (sound on in the toolbar)', 'Play a tune you know', 'Shift every note up an octave (double the numbers)'],
    build: {
      parts: [...keys, { id: 'buzzer1', type: 'buzzer', params: {}, at: { col: 26, row: 'a' } }],
      wires: [...keyWires, wire('uno.GND', 'bb.B-28', 'ground'), wire('uno.D10', 'bb.26e'), wire('bb.29e', 'uno.GND', 'ground')],
      code: `const int BUZZER = 10;
const int KEYS[] = { 2, 3, 4, 5, 6, 7, 8, 9 };
const int NOTES[] = { 262, 294, 330, 349, 392, 440, 494, 523 };   // C D E F G A B C
const char* NAMES[] = { "Do", "Re", "Mi", "Fa", "Sol", "La", "Ti", "Do" };
int playing = -1;

void setup() {
  for (int i = 0; i < 8; i++) pinMode(KEYS[i], INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int down = -1;
  for (int i = 0; i < 8; i++) {
    if (digitalRead(KEYS[i]) == LOW) down = i;   // pressed keys read LOW
  }
  if (down != playing) {
    playing = down;
    if (playing < 0) noTone(BUZZER);
    else {
      tone(BUZZER, NOTES[playing]);
      Serial.println(NAMES[playing]);
    }
  }
}
`,
    },
  },
  {
    id: 'motor',
    title: 'Control a motor',
    summary: 'A transistor lets a pin drive a motor, and PWM sets its speed.',
    about: 'A pin can give about 20 mA, but a motor wants hundreds. A TIP120 transistor does the heavy lifting: a small current into its base lets a big current flow from 5 V through the motor. PWM switches it fast to set the speed. The diode protects against the spike when the motor stops.',
    learn: ['Why a transistor is needed for motors', 'PWM speed control from 0 to 255', 'What a flyback diode is for'],
    tryIt: ['Run it and watch the fan speed up and stop', 'Wire the motor straight to pin 6 instead — what does the board say?', 'Make it hold half speed'],
    build: {
      parts: [{ id: 'motor1', type: 'motor', params: { load: 'fan' }, at: { x: 75, z: -72 } }, ...fanDriver.parts],
      wires: fanDriver.wires,
      code: `const int MOTOR = 6;   // a ~ pin, through the transistor

void setup() {
  pinMode(MOTOR, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  for (int speed = 0; speed <= 255; speed += 15) {
    analogWrite(MOTOR, speed);
    Serial.print("speed ");
    Serial.println(speed);
    delay(150);
  }
  delay(1500);
  analogWrite(MOTOR, 0);
  Serial.println("stop");
  delay(1500);
}
`,
    },
  },
  {
    id: 'thermostat',
    title: 'Thermostat',
    summary: 'A temperature sensor turns a fan on when it gets warm.',
    about: 'The TMP36 gives 0.5 V at 0 °C and 10 mV more for every degree. The sketch turns the reading into degrees, and switches the fan on above 30 °C and off again below 28 °C — the gap stops it flicking on and off.',
    learn: ['Turning a reading into volts, then into °C', 'float numbers with decimals', 'Hysteresis: two thresholds instead of one'],
    tryIt: ['Drag the hairdryer close to the sensor', 'Set the temperature in the sensor’s window', 'Change the limits to 25 °C and 23 °C'],
    build: {
      parts: [
        { id: 'tmp361', type: 'tmp36', params: {}, at: { col: 4, row: 'a' } },
        { id: 'motor1', type: 'motor', params: { load: 'fan' }, at: { x: 75, z: -72 } },
        ...fanDriver.parts,
      ],
      wires: [wire('uno.5V', 'bb.4c', 'power'), wire('bb.5c', 'uno.A0', 'data'), wire('bb.6c', 'uno.GND', 'ground'), ...motorDriver('motor1').wires],
      inputs: { tmp361: { celsius: 24 } },
      code: `const int SENSOR = A0;
const int FAN = 6;
bool fanOn = false;

void setup() {
  pinMode(FAN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  float volts = analogRead(SENSOR) * 5.0 / 1023.0;
  float celsius = (volts - 0.5) * 100.0;
  if (celsius > 30) fanOn = true;
  if (celsius < 28) fanOn = false;
  analogWrite(FAN, fanOn ? 220 : 0);
  Serial.print(celsius, 1);
  Serial.println(fanOn ? " C  fan ON" : " C  fan off");
  delay(300);
}
`,
    },
  },
  {
    id: 'servo',
    title: 'Sweep a servo',
    summary: 'A servo turns to any angle you ask for.',
    about: 'A servo has a motor, gears and a sensor inside, so it knows where it is. Tell it an angle from 0° to 180° and it turns there and holds it. The Servo library makes the pulses it understands: 1.5 ms means the middle.',
    learn: ['#include a library', 'servo.attach() and servo.write(angle)', 'Counting up and down with for loops'],
    tryIt: ['Run it and watch the horn sweep', 'Make it stop at 45°, 90° and 135°', 'Sweep faster or slower'],
    build: {
      parts: [{ id: 'servo1', type: 'servo', params: {}, at: { x: 30, z: -72 } }],
      wires: [wire('uno.D9', 'servo1.SIG'), wire('uno.5V', 'servo1.V+', 'power'), wire('servo1.GND', 'uno.GND', 'ground')],
      code: `#include <Servo.h>
Servo arm;

void setup() {
  arm.attach(9);
  Serial.begin(9600);
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 2) {
    arm.write(angle);
    delay(15);
  }
  Serial.println("180");
  for (int angle = 180; angle >= 0; angle -= 2) {
    arm.write(angle);
    delay(15);
  }
  Serial.println("0");
}
`,
    },
  },
  {
    id: 'wheel',
    title: 'Spin the wheel',
    summary: 'A stepper motor stops exactly on a prize.',
    about: 'A stepper motor turns in exact steps — 2048 make one full turn of this one — so the program always knows where it is. Press the button and the wheel spins a whole turn plus a random number of segments, and lands right in the middle of one.',
    learn: ['Stepper motors move in exact steps', 'random() picks a prize', 'Counting where you are, modulo a full turn'],
    tryIt: ['Press the button to spin', 'Watch the LEDs A–D on the driver board', 'Make it spin two turns before it stops'],
    build: {
      parts: [
        { id: 'stepper1', type: 'stepper', params: { load: 'wheel' }, at: { x: 40, z: -72 } },
        { id: 'button1', type: 'button', params: {}, at: { col: 10, row: 'e' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 10000 }, at: { col: 12, row: 'c' } },
      ],
      wires: [
        wire('uno.D8', 'stepper1.IN1'), wire('uno.D9', 'stepper1.IN2', 'data'), wire('uno.D10', 'stepper1.IN3', 'extra'), wire('uno.D11', 'stepper1.IN4', 'other'),
        wire('uno.5V', 'stepper1.+', 'power'), wire('stepper1.-', 'uno.GND', 'ground'),
        wire('uno.5V', 'bb.10a', 'power'), wire('uno.D2', 'bb.12a', 'data'), wire('bb.16a', 'uno.GND', 'ground'),
      ],
      code: `#include <Stepper.h>
const int TURN = 2048;          // steps in one full turn
const int SEGMENTS = 8;
const int BUTTON = 2;
const char* PRIZES[] = { "50", "100", "200", "AGAIN", "500", "x2", "1000", "JACKPOT" };
Stepper wheel(TURN, 8, 10, 9, 11); // IN1, IN3, IN2, IN4
int at = 0;                     // the segment under the pointer

void setup() {
  pinMode(BUTTON, INPUT);
  wheel.setSpeed(12);           // turns a minute
  randomSeed(analogRead(A0));
  Serial.begin(9600);
  Serial.println("Press the button!");
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) {
    int prize = random(SEGMENTS);
    int ahead = (prize - at + SEGMENTS) % SEGMENTS;
    wheel.step(TURN + ahead * (TURN / SEGMENTS));
    at = prize;
    Serial.print("Landed on ");
    Serial.println(PRIZES[at]);
  }
}
`,
    },
  },
  {
    id: 'plant',
    title: 'Smart plant',
    summary: 'A soil sensor and a little screen tell you when to water.',
    about: 'A capacitive sensor in the soil gives a lower voltage the wetter the soil is. map() turns that into a percentage, and an OLED screen shows it with a bar and a mood. Let the soil dry out, then water the plant.',
    learn: ['map() and constrain()', 'Drawing text and shapes on an OLED screen', 'I²C: two wires (A4, A5) for a whole screen'],
    tryIt: ['Hold the watering can over the pot', 'Set the soil moisture in the sensor’s window', 'Change the “Water me!” limit'],
    build: {
      parts: [
        { id: 'soil1', type: 'soil', params: {}, at: { x: -60, z: -72 } },
        { id: 'oled1', type: 'oled', params: {}, at: { x: 30, z: -72 } },
      ],
      wires: [
        wire('uno.5V', 'soil1.VCC', 'power'), wire('soil1.GND', 'uno.GND', 'ground'), wire('soil1.AOUT', 'uno.A0', 'data'),
        wire('uno.5V', 'oled1.VCC', 'power'), wire('oled1.GND', 'uno.GND', 'ground'), wire('uno.A4', 'oled1.SDA', 'extra'), wire('uno.A5', 'oled1.SCL', 'other'),
      ],
      inputs: { soil1: { moisture: 25 } },
      code: `#include <OLED.h>
OLED screen;
const int SENSOR = A0;
const int DRY = 520, WET = 260;   // readings in dry air and in water

void setup() {
  screen.begin();
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(SENSOR);
  int percent = constrain(map(raw, DRY, WET, 0, 100), 0, 100);
  Serial.println(percent);

  screen.clearDisplay();
  screen.setTextSize(3);
  screen.setCursor(0, 0);
  screen.print(percent);
  screen.print("%");
  screen.drawRect(0, 28, 128, 10, WHITE);
  screen.fillRect(2, 30, percent * 124 / 100, 6, WHITE);
  screen.setTextSize(2);
  screen.setCursor(0, 46);
  if (percent < 30) screen.print("Water me!");
  else if (percent > 85) screen.print("Too wet!");
  else screen.print("Happy :)");
  screen.display();
  delay(500);
}
`,
    },
  },
  {
    id: 'strength',
    title: 'Strength tester',
    summary: 'Press the pad: a servo needle shows how hard, a bell rings at the top.',
    about: 'A force-sensing resistor’s resistance falls as you press harder. With a 10 kΩ resistor to GND, A0 reads higher the harder you push. A servo swings a needle to show it, the needle holds your best for a moment, and a hard enough press rings the bell.',
    learn: ['Another divider: force into voltage', 'millis() to time things without stopping', 'Remembering the best value'],
    tryIt: ['Press the pad and drag down to push harder', 'Put weights on it in the sensor’s window', 'Make the bell easier to ring'],
    build: {
      parts: [
        { id: 'fsr1', type: 'fsr', params: {}, at: { col: 5, row: 'a' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 10000 }, at: { col: 6, row: 'c' } },
        { id: 'buzzer1', type: 'buzzer', params: {}, at: { col: 20, row: 'a' } },
        { id: 'servo1', type: 'servo', params: {}, at: { x: 30, z: -72 } },
      ],
      wires: [
        wire('uno.5V', 'bb.5c', 'power'), wire('bb.6d', 'uno.A0', 'data'), wire('bb.10d', 'uno.GND', 'ground'),
        wire('uno.D8', 'bb.20e'), wire('bb.23e', 'uno.GND', 'ground'),
        wire('uno.D9', 'servo1.SIG', 'extra'), wire('uno.5V', 'servo1.V+', 'power'), wire('servo1.GND', 'uno.GND', 'ground'),
      ],
      code: `#include <Servo.h>
Servo needle;
const int PAD = A0, BELL = 8;
const int RING_AT = 880;
int best = 0;
unsigned long bestAt = 0;
bool rung = false;

void setup() {
  needle.attach(9);
  Serial.begin(9600);
}

void loop() {
  int force = analogRead(PAD);
  if (force >= best || millis() - bestAt > 1500) { best = force; bestAt = millis(); } // hold the best for 1.5 s
  needle.write(map(best, 0, 1023, 0, 180));
  if (best >= RING_AT && !rung) { tone(BELL, 1568, 400); rung = true; Serial.println("DING!"); }
  if (best < RING_AT - 100) rung = false;
  Serial.println(force);
  delay(40);
}
`,
    },
  },
  {
    id: 'parking',
    title: 'Parking sensor',
    summary: 'Distance sensor + traffic light: green, yellow, STOP.',
    about: 'Put it all together: the distance sensor watches the obstacle, and a traffic-light module shows green when there is room, yellow when it gets close, and red when it is time to stop. Comparisons choose which light is on.',
    learn: ['Combining an input and outputs', 'Comparisons: > and <=, joined with &&', 'Reusing code from earlier projects'],
    tryIt: ['Drag the obstacle towards the sensor', 'Make yellow start at 40 cm', 'Add a beeping buzzer for red'],
    build: {
      parts: [
        { id: 'hcsr041', type: 'hcsr04', params: {}, at: { x: 30, z: -72 } },
        { id: 'traffic1', type: 'traffic', params: {}, at: { col: 15, row: 'a' } },
      ],
      wires: [
        wire('uno.5V', 'hcsr041.VCC', 'power'), wire('uno.D9', 'hcsr041.TRIG', 'other'), wire('hcsr041.ECHO', 'uno.D10', 'data'), wire('hcsr041.GND', 'uno.GND', 'ground'),
        wire('uno.D4', 'bb.15c'), wire('uno.D3', 'bb.16c', 'extra'), wire('uno.D2', 'bb.17c', 'data'), wire('bb.18c', 'uno.GND', 'ground'),
      ],
      inputs: { hcsr041: { cm: 50 } },
      code: `const int TRIG = 9, ECHO = 10;
const int RED = 4, YELLOW = 3, GREEN = 2;

long distanceCm() {
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  return pulseIn(ECHO, HIGH) / 58;
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  long cm = distanceCm();
  digitalWrite(GREEN, cm > 30);
  digitalWrite(YELLOW, cm > 15 && cm <= 30);
  digitalWrite(RED, cm <= 15);
  Serial.print(cm);
  Serial.println(" cm");
  delay(80);
}
`,
    },
  },
];
