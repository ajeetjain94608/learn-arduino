---
title: TIP120 transistor explained: switch a motor with an Arduino pin
description: How a TIP120 Darlington transistor lets a 20 mA Arduino pin switch a 0.5 A motor: pins B, C, E, the 1 kΩ base resistor and the maths. Try it live in 3D.
lead: An Arduino pin is a whisper; a motor needs a shout. The TIP120 is the translator — a few milliamps into one leg let hundreds of milliamps flow through the other two.
kind: component
level: Beginner
order: 111
image: npn-3d.jpg
imageAlt: A black TIP120 transistor in a TO-220 package with a metal tab and three legs, shown in the 3D lab
og: npn-part-og.jpg
date: 2026-10-29
parts: [uno, usb, breadboard, jumpers, npn, resistor-1k, diode, motor]
related: [what-is-a-diode, dc-motor-explained, dc-motor-transistor-arduino, voltage-current-resistance-ohms-law]
---
# The TIP120 transistor

## What it is

A transistor is a **switch worked by a small current**. The TIP120 is a strong one: a black block with a metal tab (the TO-220 package) and three legs. A few milliamps into its **base** let up to **5 A** flow from its **collector** to its **emitter** — enough for motors, fans and strips of lights.

Why bother? An Arduino UNO pin can give about **20 mA** (40 mA is the absolute limit). A small hobby motor wants about **500 mA**. That is 25 times too much. The pin controls the transistor; the transistor carries the motor's current straight from the 5 V supply. [See it in 3D](/#/components/npn).

## How it works

The TIP120 is an **NPN Darlington**: two transistors inside one case, the first one driving the second. Each multiplies current, so together a tiny base current controls a big collector current — the data sheet promises a gain of at least 1000.

It switches on once the base is about **1.4 V** above the emitter (two transistors, about 0.7 V each). Below that, the collector–emitter path is closed: no current, the motor stops.

### The maths in the motor project

| Step | Numbers |
|---|---|
| Pin 6 HIGH | 5 V |
| Across the 1 kΩ base resistor | 5 V − 1.4 V = 3.6 V |
| Base current | 3.6 V ÷ 1000 Ω = **3.6 mA** — easy for a pin |
| Motor current | 5 V ÷ (8 Ω motor + about 2 Ω transistor) = **0.5 A** |

So **3.6 mA controls 500 mA**. In our 3D lab the TIP120 behaves like about 2 Ω when fully on, so it eats roughly 1 V and warms up a little — real TIP120s do the same.

> **Did you know?** The 1 kΩ resistor is not optional. Without it the base would pull as much current as the pin can give, and the pin would burn.

## Pins

Hold it with the printed face towards you and the legs down. From left to right:

| Pin | Goes to | What it does |
|---|---|---|
| B (base) | A PWM pin, through 1 kΩ | The control input |
| C (collector) | The motor's − wire | The big current comes in here |
| E (emitter) | GND | The big current leaves here |

The metal tab is joined to the collector — don't let it touch other wires.

## How to wire it to an Arduino

This is the motor project's wiring, all on one breadboard:

1. Push the TIP120 into three strips: **B, C, E**.
2. A **1 kΩ resistor** joins pin **6**'s strip to the **base**.
3. The motor's **+** goes to **5V**; its **−** goes to the **collector**.
4. The **emitter** goes to **GND**.
5. A **1N4001 diode** goes across the motor: anode on the collector, band on 5 V. It catches the spike when the motor stops — see [what a diode does](/learn/what-is-a-diode/).

::: 3d motor "Pin 6 → 1 kΩ → base: a few milliamps switch the fan's half an amp"

## Example code

The transistor follows pin 6. `analogWrite()` switches it on and off very fast, and the motor feels the average:

```cpp
const int MOTOR = 6;   // a ~ pin, through the transistor

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
```

- **`const int MOTOR = 6;`** — pin 6 has a **~**, so it can do PWM. A pin without ~ could only switch the motor fully on or off.
- **`analogWrite(MOTOR, speed)`** — 0 keeps the transistor off, 255 keeps it on, 128 has it on half the time: about half speed. Learn more in [PWM explained](/learn/pwm-explained-analogwrite/).

## Common mistakes

- **Motor straight on the pin.** 5 V across the pin's own resistance and the 8 Ω motor is about 150 mA — far over the 40 mA limit. In the 3D lab the pin burns. Always go through the transistor.
- **No base resistor.** The pin pushes too much current into the base. Use 1 kΩ.
- **Collector and emitter swapped.** The TIP120 does not switch properly. Check the B-C-E order with the printed face towards you.
- **No diode.** It works — until a spike kills the transistor.

## Check yourself

::: quiz
? Which TIP120 leg goes to GND?
- The emitter (E) *
- The base (B)
- The collector (C)
= In an NPN low-side switch the emitter goes to GND and the load sits between 5 V and the collector.
? Why is there a 1 kΩ resistor before the base?
- To keep the base current small and safe for the pin *
- To slow the motor down
- To make the motor spin backwards
= (5 − 1.4) V ÷ 1000 Ω ≈ 3.6 mA, well inside what a pin can give.
? About how much current does the fan motor draw at full speed?
- 0.5 A *
- 20 mA
- 5 A
= 5 V ÷ (8 Ω + 2 Ω) = 0.5 A, much more than a pin's 20 mA.
:::

## Questions people ask

### Can I use a 2N2222 instead of a TIP120?
For a small motor under about 500 mA, a 2N2222 can work, but it runs close to its limit and gets hot. The TIP120 has plenty of margin, which is why beginner kits use it.

### Why does my TIP120 get hot?
When fully on it still drops about 1 V or more, and that times the current is heat: 1 V × 0.5 A is half a watt. That is fine; for several amps, add a heatsink to the tab.

### Is the TIP120 a MOSFET?
No. It is a bipolar Darlington transistor, controlled by current. A logic-level MOSFET is controlled by voltage and wastes less power, but the TIP120 is simple and hard to break.

## Where it is used

The TIP120 drives the fan in the [motor project](/learn/dc-motor-transistor-arduino/) and switches it on in the [thermostat](/learn/arduino-thermostat-tmp36-fan/). Next, look inside the part it drives: [the DC motor](/learn/dc-motor-explained/).
