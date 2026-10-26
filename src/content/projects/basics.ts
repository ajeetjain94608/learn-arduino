import { wire, type Project } from './types';

// Projects 1–8: the board, lights, a button, a knob, colours, light, distance, sound.
export const BASICS: Project[] = [
  {
    id: 'board',
    title: 'Meet the board',
    summary: 'The board on its own: its built-in LED and the serial monitor.',
    about: 'Before any wiring, the UNO can already do something: pin 13 is joined to a tiny LED marked L on the board. This sketch blinks it and writes a line to the serial monitor every time, so you can see the program running.',
    learn: ['setup() runs once, loop() runs again and again', 'LED_BUILTIN is the board’s own LED on pin 13', 'Serial.println() sends text to your computer'],
    tryIt: ['Press Run and watch the L LED next to pin 13', 'Change both delays to 200 and run again', 'Print the number of blinks: add a counter'],
    build: {
      parts: [],
      wires: [],
      code: `// The board's own LED (marked L) is on pin 13.
int blinks = 0;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Hello from the UNO!");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
  blinks = blinks + 1;
  Serial.print("Blinks: ");
  Serial.println(blinks);
}
`,
    },
  },
  {
    id: 'blink',
    title: 'Blink an LED',
    summary: 'Your first circuit: an LED and a resistor on pin 13.',
    about: 'Pin 13 sends current through a red LED and a 220 Ω resistor back to GND. The resistor keeps the current small enough for the LED and the pin. Switching the pin on and off makes the LED blink.',
    learn: ['digitalWrite() switches a pin between 5 V and 0 V', 'An LED only lights one way round: long leg (+) toward the pin', 'Why every LED needs a resistor'],
    tryIt: ['Run it, then remove the resistor in the Parts tab and run again — what happens?', 'Make it blink faster', 'Move the LED to pin 12 (change the wire and the code)'],
    build: {
      parts: [
        { id: 'led1', type: 'led', params: { color: 'red' }, at: { col: 8, row: 'd' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 220 }, at: { col: 9, row: 'b' } },
      ],
      wires: [wire('uno.D13', 'bb.8a'), wire('bb.13a', 'uno.GND', 'ground')],
      code: `const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED, HIGH);   // 5 V on the pin: current flows, the LED lights
  Serial.println("on");
  delay(1000);
  digitalWrite(LED, LOW);    // 0 V: no current, the LED goes dark
  Serial.println("off");
  delay(1000);
}
`,
    },
  },
  {
    id: 'button',
    title: 'Push a button',
    summary: 'A button switches the LED: your first input.',
    about: 'The button joins 5 V to pin 2 while you hold it. When you let go, a 10 kΩ “pull-down” resistor holds pin 2 at 0 V, so the pin never floats. The sketch copies what pin 2 reads to the LED on pin 13.',
    learn: ['digitalRead() tells you if a pin is HIGH or LOW', 'A pull-down resistor gives a pin a clear LOW', 'Reacting only when something changes'],
    tryIt: ['Hold the button in 3D (or in its window) and watch the LED', 'Use “Keep it pressed” and read the serial monitor', 'Make the LED stay on after one press (toggle)'],
    build: {
      parts: [
        { id: 'button1', type: 'button', params: {}, at: { col: 10, row: 'e' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 10000 }, at: { col: 12, row: 'c' } },
        { id: 'led1', type: 'led', params: { color: 'green' }, at: { col: 20, row: 'd' } },
        { id: 'resistor2', type: 'resistor', params: { ohms: 220 }, at: { col: 21, row: 'b' } },
      ],
      wires: [
        wire('uno.5V', 'bb.10a', 'power'), wire('uno.D2', 'bb.12a', 'data'), wire('bb.16a', 'uno.GND', 'ground'),
        wire('uno.D13', 'bb.20a'), wire('bb.25a', 'uno.GND', 'ground'),
      ],
      code: `const int BUTTON = 2;
const int LED = 13;
int was = LOW;

void setup() {
  pinMode(BUTTON, INPUT);   // the 10 kΩ resistor pulls it down to LOW
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int now = digitalRead(BUTTON);
  digitalWrite(LED, now);
  if (now != was) {         // only report a change
    Serial.println(now == HIGH ? "pressed" : "released");
    was = now;
  }
}
`,
    },
  },
  {
    id: 'knob',
    title: 'Turn a knob',
    summary: 'A potentiometer sets the LED’s brightness.',
    about: 'A potentiometer is a resistor with a sliding contact. Its outer legs go to 5 V and GND, so the middle leg gives any voltage in between. analogRead() turns that voltage into 0–1023, and analogWrite() dims the LED with PWM.',
    learn: ['analogRead() on A0 gives 0–1023', 'analogWrite() on a ~ pin gives 0–255', 'map() scales one range to another'],
    tryIt: ['Turn the knob in 3D — drag around it', 'Type 512 in the knob’s number box', 'Make the LED blink faster as you turn the knob up'],
    build: {
      parts: [
        { id: 'pot1', type: 'pot', params: {}, at: { col: 5, row: 'a' } },
        { id: 'led1', type: 'led', params: { color: 'yellow' }, at: { col: 15, row: 'd' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 220 }, at: { col: 16, row: 'b' } },
      ],
      wires: [
        wire('uno.5V', 'bb.5d', 'power'), wire('bb.7d', 'uno.A0', 'data'), wire('bb.9d', 'uno.GND', 'ground'),
        wire('uno.D9', 'bb.15a'), wire('bb.20a', 'uno.GND', 'ground'),
      ],
      code: `const int KNOB = A0;
const int LED = 9;   // a ~ pin: it can dim

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(KNOB);                // 0 … 1023
  int brightness = map(reading, 0, 1023, 0, 255); // 0 … 255
  analogWrite(LED, brightness);
  Serial.print("knob ");
  Serial.print(reading);
  Serial.print("  ->  LED ");
  Serial.println(brightness);
  delay(100);
}
`,
    },
  },
  {
    id: 'rgb',
    title: 'Mix colours',
    summary: 'One RGB LED, three pins, every colour.',
    about: 'An RGB LED holds a red, a green and a blue LED under one lens, sharing the minus leg. Each colour has its own resistor and its own PWM pin; mixing their brightness makes new colours — red and green make yellow.',
    learn: ['Three PWM outputs at once', 'Light adds up: red + green = yellow', 'Using a function to keep code tidy'],
    tryIt: ['Run it and watch the colours change', 'Write your favourite colour with setColor()', 'Make it fade slowly through the rainbow'],
    build: {
      parts: [
        { id: 'rgb1', type: 'rgb', params: {}, at: { col: 10, row: 'e' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 220 }, at: { col: 10, row: 'a' } },
        { id: 'resistor2', type: 'resistor', params: { ohms: 220 }, at: { col: 12, row: 'b' } },
        { id: 'resistor3', type: 'resistor', params: { ohms: 220 }, at: { col: 13, row: 'c' } },
      ],
      wires: [
        wire('uno.D9', 'bb.14d'), wire('uno.D10', 'bb.16a', 'extra'), wire('uno.D11', 'bb.17a', 'data'), wire('bb.11d', 'uno.GND', 'ground'),
      ],
      code: `const int RED = 9, GREEN = 10, BLUE = 11;

void setColor(int r, int g, int b) {
  analogWrite(RED, r);
  analogWrite(GREEN, g);
  analogWrite(BLUE, b);
}

void setup() {
  Serial.begin(9600);
}

void loop() {
  setColor(255, 0, 0);   Serial.println("red");    delay(800);
  setColor(255, 160, 0); Serial.println("orange"); delay(800);
  setColor(255, 255, 0); Serial.println("yellow"); delay(800);
  setColor(0, 255, 0);   Serial.println("green");  delay(800);
  setColor(0, 120, 255); Serial.println("sky");    delay(800);
  setColor(140, 0, 255); Serial.println("purple"); delay(800);
}
`,
    },
  },
  {
    id: 'night-light',
    title: 'Night light',
    summary: 'A light sensor switches an LED on when it gets dark.',
    about: 'A light-dependent resistor (LDR) conducts better in bright light. With a 10 kΩ resistor it forms a divider: more light gives a higher voltage on A0. When the reading drops, it is getting dark, and the LED comes on — the darker, the brighter.',
    learn: ['A voltage divider turns resistance into a voltage', 'if / else decides what to do', 'Thresholds: choosing the number where it switches'],
    tryIt: ['Drag the desk lamp away from the sensor', 'Set the light in lux in the sensor’s window', 'Change 400 to a different threshold'],
    build: {
      parts: [
        { id: 'ldr1', type: 'ldr', params: {}, at: { col: 5, row: 'a' } },
        { id: 'resistor1', type: 'resistor', params: { ohms: 10000 }, at: { col: 7, row: 'c' } },
        { id: 'led1', type: 'led', params: { color: 'white' }, at: { col: 18, row: 'd' } },
        { id: 'resistor2', type: 'resistor', params: { ohms: 220 }, at: { col: 19, row: 'b' } },
      ],
      wires: [
        wire('uno.5V', 'bb.5c', 'power'), wire('bb.7d', 'uno.A0', 'data'), wire('bb.11d', 'uno.GND', 'ground'),
        wire('uno.D9', 'bb.18a'), wire('bb.23a', 'uno.GND', 'ground'),
      ],
      inputs: { ldr1: { lux: 300 } },
      code: `const int SENSOR = A0;
const int LED = 9;
const int DARK = 400;   // below this it counts as dark

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(SENSOR);   // brighter = higher
  Serial.print("light ");
  Serial.println(light);
  if (light < DARK) {
    // the darker it is, the brighter the night light
    analogWrite(LED, map(light, 0, DARK, 255, 30));
  } else {
    analogWrite(LED, 0);
  }
  delay(200);
}
`,
    },
  },
  {
    id: 'distance',
    title: 'Measure distance',
    summary: 'Ultrasound echoes tell you how far away things are.',
    about: 'The distance sensor sends a short burst of ultrasound when TRIG gets a 10 µs pulse, then holds ECHO high until the echo comes back. Sound needs about 58 µs to travel 1 cm and back, so pulseIn() ÷ 58 is the distance in centimetres.',
    learn: ['Making a precise pulse with delayMicroseconds()', 'Timing a pulse with pulseIn()', 'Turning time into distance'],
    tryIt: ['Drag the obstacle closer and farther', 'Type a distance in the sensor’s window', 'Print “Too close!” under 10 cm'],
    build: {
      parts: [{ id: 'hcsr041', type: 'hcsr04', params: {}, at: { x: 30, z: -72 } }],
      wires: [
        wire('uno.5V', 'hcsr041.VCC', 'power'), wire('uno.D9', 'hcsr041.TRIG'), wire('hcsr041.ECHO', 'uno.D10', 'data'), wire('hcsr041.GND', 'uno.GND', 'ground'),
      ],
      inputs: { hcsr041: { cm: 30 } },
      code: `const int TRIG = 9;
const int ECHO = 10;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, HIGH);       // a 10 µs pulse starts a measurement
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long echo = pulseIn(ECHO, HIGH); // how long the echo took, in µs
  long cm = echo / 58;
  Serial.print(cm);
  Serial.println(" cm");
  delay(150);
}
`,
    },
  },
  {
    id: 'tune',
    title: 'Play a tune',
    summary: 'A buzzer plays notes stored in an array.',
    about: 'A passive buzzer clicks every time its pin changes. tone() flips the pin hundreds of times a second — the faster, the higher the note. The tune is two arrays: the notes’ frequencies and how long each one lasts.',
    learn: ['tone(pin, frequency, duration)', 'Arrays and for loops', 'Notes are just frequencies: A = 440 Hz'],
    tryIt: ['Run it and listen (turn sound on in the toolbar)', 'Change the tempo', 'Write your own tune'],
    build: {
      parts: [{ id: 'buzzer1', type: 'buzzer', params: {}, at: { col: 15, row: 'a' } }],
      wires: [wire('uno.D8', 'bb.15e'), wire('bb.18e', 'uno.GND', 'ground')],
      code: `const int BUZZER = 8;
// "Ode to Joy" (Beethoven): E E F G G F E D C C D E E D D
const int NOTES[] = { 330, 330, 349, 392, 392, 349, 330, 294, 262, 262, 294, 330, 330, 294, 294 };
const int BEATS[] = { 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2 };
const int COUNT = 15;
const int BEAT = 300; // ms

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < COUNT; i++) {
    int ms = BEATS[i] * BEAT;
    tone(BUZZER, NOTES[i], ms - 30);
    Serial.println(NOTES[i]);
    delay(ms);
  }
  delay(1500);
}
`,
    },
  },
];
