---
title: What is a potentiometer? How a knob talks to your Arduino
description: How a potentiometer works inside, what its three legs do, and how analogRead() turns the knob into 0–1023 to dim an LED. Try it live in 3D.$
lead: Volume knobs, light dimmers, the throttle of a toy car — they are all potentiometers. It is the easiest way to give your Arduino a number you choose with your hand, and it teaches the idea behind half the sensors you will ever use.
kind: component
level: Beginner
order: 104
image: pot-3d.jpg
imageAlt: A 10 kilohm rotary potentiometer in 3D with its knob and three legs in a row
og: pot-part-og.jpg
date: 2026-10-29
parts: [pot, uno, breadboard, led, resistor-220, jumpers]
related: [potentiometer-arduino, digital-vs-analog-arduino, pwm-explained-analogwrite, voltage-current-resistance-ohms-law]
---
# What is a potentiometer?

## What it is

A **potentiometer** ("pot" for short) is a resistor with a **sliding contact** you move by turning a knob. It has three legs. Put **5 V and GND on the two outer legs**, and the **middle leg** — the *wiper* — gives any voltage in between, depending on where the knob is. Read that voltage on an analog pin and your Arduino knows the knob's position. [See it in 3D](/#/components/pot).

## How it works inside

Inside is a curved track of resistive material, **10 kΩ** from one end to the other, joined to the two outer legs. A small metal brush, joined to the middle leg, slides along the track as you turn the knob (through about **270°**).

The brush splits the track into two parts, and together they form a **voltage divider**: the wiper gets a share of the 5 V that matches how far along the track it is.

| Knob position | Wiper voltage | `analogRead()` | LED brightness (`map` to 0–255) |
|---|---|---|---|
| All the way to the GND side | 0 V | 0 | 0 (off) |
| A quarter | 1.25 V | about 256 | about 63 |
| Halfway | 2.5 V | about 512 | about 127 |
| All the way to the 5V side | 5 V | 1023 | 255 (full) |

The whole track is always between 5V and GND, so a small current flows through it all the time: 5 V ÷ 10,000 Ω = **0.5 mA**. That is tiny — safe even if you turn the knob all the way.

## The pins

| Pin | What it does |
|---|---|
| Outer leg 1 | 5V |
| Middle leg (wiper) | The voltage you set — to an analog pin, e.g. A0 |
| Outer leg 2 | GND |

Which outer leg gets 5V and which gets GND only decides the direction: swap them and turning right makes the number go down instead of up.

| Spec | Value |
|---|---|
| Resistance | 10 kΩ |
| Turn | 270° |

## How to wire it to an Arduino

This is the wiring of the [potentiometer project](/learn/potentiometer-arduino/):

1. Push the pot into the breadboard, each leg in its own row.
2. **5V** → the first outer leg.
3. The **middle leg** → **A0**.
4. The other outer leg → **GND**.
5. To see the result: **pin 9** (a ~ PWM pin) → a yellow LED's long leg, its short leg → a 220 Ω resistor → GND.

## Example code

The exact code of the knob project:

```cpp
const int KNOB = A0;
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
```

- **`analogRead(KNOB)`** measures the wiper's voltage and gives 0 (0 V) to 1023 (5 V).
- **`map(reading, 0, 1023, 0, 255)`** scales that range to the one `analogWrite()` wants.
- **`analogWrite(LED, brightness)`** dims the LED with PWM — read [PWM explained](/learn/pwm-explained-analogwrite/).

::: 3d knob "Drag around the knob in 3D: the reading on A0 and the LED's brightness follow"

> **Try it:** In the 3D lab, type 512 in the knob's number box and check that the LED lands at about half brightness.

## Common mistakes

- **The middle leg on 5V or GND.** The reading is stuck at 1023 or 0. The wiper must go to the analog pin.
- **Reading a digital pin.** `analogRead()` only works on A0–A5.
- **Dimming on a pin without ~.** `analogWrite()` on pin 7 or 13 is only fully on or off. Use 3, 5, 6, 9, 10 or 11.
- **Numbers jump by one or two.** Normal — tiny noise. Ignore small changes, or average a few readings.

## Check yourself

::: quiz
? Which leg of a potentiometer goes to the analog pin?
- An outer leg
- The middle leg (the wiper) *
- Any leg
= The outer legs take 5V and GND; the wiper gives the voltage in between.
? The wiper is at 2.5 V. What does analogRead() give, about?
- 255
- 512 *
- 2500
= 0–5 V becomes 0–1023, so half of 5 V is about half of 1023.
? Why does the knob code use map()?
- analogRead() gives 0–1023 but analogWrite() wants 0–255 *
- To make the LED blink
- To turn volts into ohms
= map() scales one range of numbers to another.
:::

## Questions people ask

### What does a potentiometer do in an Arduino project?
It turns a knob position into a voltage between 0 and 5 V. `analogRead()` turns that into 0–1023, which you can use to set brightness, speed, an angle or a threshold.

### What value potentiometer should I use with Arduino?
10 kΩ is the standard choice. Anything from about 1 kΩ to 100 kΩ works; very small values waste current and very large ones give noisier readings.

### Why does my potentiometer only work in half the turn, or jump?
Usually a loose leg on the breadboard, or the wiper wired to an outer pin. Push all three legs in firmly and check that the middle one goes to A0.

### Is a potentiometer the same as a variable resistor?
Almost. A potentiometer has three legs and gives a voltage; if you use only the wiper and one outer leg, it becomes a variable resistor (sometimes called a rheostat).

## Where it is used

Turn it in the [potentiometer project](/learn/potentiometer-arduino/), then see the same divider idea at work with light in [the night light](/learn/night-light-ldr-arduino/).
