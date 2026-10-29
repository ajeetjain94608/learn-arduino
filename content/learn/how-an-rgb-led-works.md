---
title: How an RGB LED works — common cathode, wiring and colour mixing
description: How an RGB LED mixes red, green and blue into any colour, which leg is which, why each colour needs its own resistor, and the Arduino code. Try it in 3D.$
lead: One little LED, four legs, and suddenly your project can glow orange, sky blue or purple. An RGB LED is three LEDs in one, and once you see how light adds up, mixing any colour takes three numbers.
kind: component
level: Beginner
order: 105
image: rgb-3d.jpg
imageAlt: A 5 mm common-cathode RGB LED in 3D with a milky lens and four legs, the longest one second from the left
og: rgb-part-og.jpg
date: 2026-10-29
parts: [rgb, resistor-220, uno, breadboard, jumpers]
related: [rgb-led-arduino, how-an-led-works, pwm-explained-analogwrite, what-is-a-resistor]
---
# How an RGB LED works

## What it is

An **RGB LED** is **three LEDs — red, green and blue — under one milky lens**. Each colour has its own leg, and they share the fourth leg. Light each colour a little or a lot, and your eye sees the mix as one new colour. [See it in 3D](/#/components/rgb).

The one in our 3D lab is **common cathode**: the shared leg is the **minus** (cathode), and it goes to GND. (Common-anode RGB LEDs also exist; there the shared leg goes to 5 V and everything works the other way round.)

## How it works inside

Each of the three tiny LED chips works exactly like a normal LED (see [how an LED works](/learn/how-an-led-works/)): current flows in at its own leg (+) and out at the shared cathode (−). And like a normal LED, each needs a resistor.

The colours do not need the same voltage. These are the forward voltages the 3D lab uses:

| Colour | Forward voltage | Current with 220 Ω on 5 V |
|---|---|---|
| Red | 2.0 V | (5 − 2.0) ÷ 220 ≈ 14 mA |
| Green | 3.0 V | (5 − 3.0) ÷ 220 ≈ 9 mA |
| Blue | 3.0 V | (5 − 3.0) ÷ 220 ≈ 9 mA |

## Mixing colours

Light **adds up**. Screens work the same way: every pixel is a red, a green and a blue dot.

| Red | Green | Blue | You see |
|---|---|---|---|
| 255 | 0 | 0 | Red |
| 255 | 255 | 0 | Yellow |
| 255 | 160 | 0 | Orange |
| 0 | 120 | 255 | Sky blue |
| 140 | 0 | 255 | Purple |
| 255 | 255 | 255 | White |

The numbers are `analogWrite()` values, 0–255. They do not change the voltage — they switch each pin on and off very fast (PWM), and the share of "on" time sets the brightness. That is why each colour needs a **~ PWM pin**. More in [PWM explained](/learn/pwm-explained-analogwrite/).

## The pins

Hold it with the legs down. From left to right:

| Pin | What it does |
|---|---|
| R | Red (+) |
| K (the longest leg) | Shared minus, to GND |
| G | Green (+) |
| B | Blue (+) |

| Spec | Value |
|---|---|
| Type | 5 mm, common cathode |
| Forward voltage | R ≈ 2 V, G and B ≈ 3 V |

## How to wire it to an Arduino

This is the wiring of the [RGB LED project](/learn/rgb-led-arduino/):

1. Push the RGB LED into the breadboard, each leg in its own row.
2. Each colour leg gets **its own 220 Ω resistor**.
3. **Pin 9** → red's resistor, **pin 10** → green's, **pin 11** → blue's.
4. The longest leg (K) → **GND**.

| Part pin | Goes to | What it does |
|---|---|---|
| R | 220 Ω → pin 9 | Red brightness |
| G | 220 Ω → pin 10 | Green brightness |
| B | 220 Ω → pin 11 | Blue brightness |
| K | GND | The shared way back |

## Example code

The exact code of the colour-mixing project:

```cpp
const int RED = 9, GREEN = 10, BLUE = 11;

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
```

- **`setColor(r, g, b)`** is our own function: one line sets all three colours.
- **`analogWrite(RED, r)`** sets red's brightness, 0 (off) to 255 (full).
- Pins 9, 10 and 11 are all **~ pins**, so all three can dim.

::: 3d rgb "Press Run and watch one LED walk through red, orange, yellow, green, sky blue and purple"

## Common mistakes

- **One resistor on the shared leg instead of three.** The red chip needs less voltage, so it grabs most of the current and the mixes come out wrong. Give every colour its own resistor.
- **The longest leg on a pin instead of GND.** With a common-cathode LED nothing lights. K goes to GND.
- **A common-anode LED with this code.** It lights backwards: 255 means off. Wire its shared leg to 5V and use `255 - value`.
- **A colour on a pin without ~.** That colour is only fully on or off, so mixes jump.

## Check yourself

::: quiz
? On a common-cathode RGB LED, where does the longest leg go?
- To pin 9
- To GND *
- To 5V
= The longest leg is the shared cathode (−): the way back to GND.
? Which mix makes yellow?
- Red + blue
- Red + green *
- Green + blue
= Light adds up: full red and full green look yellow.
? Why do pins 9, 10 and 11 drive the colours?
- They are the only outputs
- They are ~ PWM pins, so analogWrite() can dim them *
- They give more current
= Only ~ pins (3, 5, 6, 9, 10, 11) can dim with analogWrite().
:::

## Questions people ask

### How do I know if my RGB LED is common cathode or common anode?
Connect the longest leg to GND and one other leg through a 220 Ω resistor to 5V. If it lights, it is common cathode. If not, try the longest leg on 5V and the other leg through the resistor to GND — then it is common anode.

### Why does my RGB LED show the wrong colour?
Usually the colour legs are on the wrong pins: swap wires until `setColor(255, 0, 0)` shows red. A shared resistor instead of three, or a non-~ pin, also spoils mixes.

### Can I make white with an RGB LED?
Yes: all three at 255. It may look slightly tinted, because the three chips are not exactly equally bright; lower the strongest one a little.

### How many colours can an RGB LED make?
With 256 levels for each of three colours, 256 × 256 × 256 — about 16.7 million combinations.

## Where it is used

Mix your own colours in the [RGB LED project](/learn/rgb-led-arduino/), and use [the potentiometer](/learn/what-is-a-potentiometer/) to pick a colour with a knob as a next step.
