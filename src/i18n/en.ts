// Every user-facing string lives here so the app can be translated later.
export const en = {
  'app.name': 'RoboQuest',
  'credits.boardLayout': 'Board layout based on Arduino UNO Rev3 design files (CC BY-SA 4.0)',

  'hot.usb.name': 'USB port', 'hot.usb.sub': 'Power + upload',
  'hot.usb.text': 'Plug in here to power the board and upload your programs from a computer.',
  'hot.mcu.name': 'Microcontroller', 'hot.mcu.sub': 'Runs your code',
  'hot.mcu.text': 'The ATmega328P chip is the brain. It stores your program and runs it over and over.',
  'hot.digital.name': 'Digital pins', 'hot.digital.sub': '0–13, PWM on ~',
  'hot.digital.text': 'Pins 0–13 can be switched ON (5 V) or OFF (0 V). Pins with ~ can also dim things using PWM.',
  'hot.jack.name': 'Power jack', 'hot.jack.sub': '7–12 V in',
  'hot.jack.text': 'Run the board from a battery or adapter (7–12 V) when it is not connected to a computer.',
  'hot.power.name': 'Power pins', 'hot.power.sub': '5V · 3.3V · GND',
  'hot.power.text': 'Take power from here for your parts: 5 V, 3.3 V and GND (ground, the minus side).',
  'hot.analog.name': 'Analog pins', 'hot.analog.sub': 'A0–A5 read voltage',
  'hot.analog.text': 'A0–A5 measure voltages between 0 and 5 V, like a knob or a light sensor.',
  'hot.reset.name': 'Reset button', 'hot.reset.sub': 'Restart program',
  'hot.reset.text': 'Press to restart your program from the beginning.',
  'hot.led.name': 'LED', 'hot.led.sub': 'Lights up',
  'hot.led.text': 'Light Emitting Diode. Current only flows one way: long leg (+) to pin 13, short leg (−) toward GND.',
  'hot.resistor.name': 'Resistor', 'hot.resistor.sub': '220 Ω',
  'hot.resistor.text': 'Limits the current so the LED doesn’t burn out. Bands: red, red, brown, gold = 220 Ω ±5%.',
  'hot.breadboard.name': 'Breadboard', 'hot.breadboard.sub': 'No soldering',
  'hot.breadboard.text': 'Each numbered column of 5 holes is connected inside, so parts in the same column are wired together.',
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey): string {
  return en[key];
}
