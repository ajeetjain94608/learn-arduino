---
title: TMP36 temperature sensor explained — pinout, formula and Arduino code
description: How the TMP36 turns temperature into a voltage, which leg is which, the formula from analogRead() to °C, and why it burns if wired backwards. Try it in 3D.$
lead: The TMP36 looks just like a transistor, but it is a tiny thermometer: three legs, no calibration, and a voltage that rises by exactly 10 millivolts for every degree. One line of maths turns it into °C — and one wrong turn of the part makes it scorching hot.
kind: component
level: Beginner
order: 108
image: tmp36-3d.jpg
imageAlt: A TMP36 temperature sensor in 3D, a small black half-round body with a flat face and three legs
og: tmp36-part-og.jpg
date: 2026-10-29
parts: [tmp36, uno, breadboard, jumpers]
related: [arduino-thermostat-tmp36-fan, digital-vs-analog-arduino, short-circuits-how-not-to-burn-your-arduino, ldr-light-sensor-explained]
---
# The TMP36 temperature sensor

## What it is

The **TMP36** is a small temperature sensor in a black plastic body with one **flat face** and three legs. Give it power and its middle leg puts out a **voltage that follows the temperature**. Read that voltage on an analog pin, and one line of code turns it into degrees Celsius. [See it in 3D](/#/components/tmp36).

## How it works inside

Inside is a tiny chip. It uses a property of silicon junctions — the voltage across them changes in a very regular way with temperature — and amplifies it into a neat, simple output:

- **0.5 V at 0 °C**,
- plus **10 mV (0.01 V) for every degree** warmer.

The 0.5 V start is there so that temperatures below zero still give a positive voltage: −40 °C is 0.1 V.

| Temperature | Output voltage | `analogRead()` on 5 V |
|---|---|---|
| 0 °C | 0.50 V | about 102 |
| 22 °C (room) | 0.72 V | about 147 |
| 25 °C | 0.75 V | about 153 |
| 30 °C | 0.80 V | about 164 |
| 60 °C | 1.10 V | about 225 |

## The formula

Two steps, both in the code below:

1. Reading to volts: **volts = reading × 5.0 ÷ 1023**
2. Volts to degrees: **°C = (volts − 0.5) × 100**

Example: a reading of 153 → 153 × 5 ÷ 1023 = 0.748 V → (0.748 − 0.5) × 100 ≈ **24.8 °C**.

> **Did you know?** One step of `analogRead()` is 5 V ÷ 1023 ≈ 4.9 mV, and the TMP36 changes 10 mV per degree — so the UNO sees the temperature in steps of about **0.5 °C**.

## The pins

Hold it with the **flat face towards you** and the legs down. From left to right:

| Pin | What it does |
|---|---|
| VS (+Vs) | 5V |
| OUT (Vout) | To an analog pin, e.g. A0 |
| GND | Ground |

| Spec | Value |
|---|---|
| Range | −40 … 125 °C |
| Output | 10 mV/°C, 750 mV at 25 °C |
| Supply | 2.7 V or more (5V is fine) |

> **Warning:** Turned round, the TMP36 gets 5 V on its GND leg and 0 V on its supply leg. A real one gets hot enough to burn your finger and is ruined — and in our 3D lab a TMP36 wired backwards burns the moment the board is powered. Check the flat face before you plug in the USB cable.

## How to wire it to an Arduino

This is the sensor's side of the [thermostat project](/learn/arduino-thermostat-tmp36-fan/):

1. Push the TMP36 into the breadboard, flat face towards you, each leg in its own row.
2. **5V** → the left leg (VS).
3. The middle leg (OUT) → **A0**.
4. The right leg → **GND**.

No resistor is needed: the TMP36 makes its own voltage.

## Example code

The exact code of the thermostat. The fan sits on pin 6 behind a transistor; the sensor part is just the first two lines of `loop()`:

```cpp
const int SENSOR = A0;
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
```

- **`float`** holds numbers with decimals; `int` would cut 0.748 V to 0.
- **`5.0 / 1023.0`** — the `.0` matters: it makes the division keep its decimals.
- **`(volts - 0.5) * 100.0`** is the TMP36 formula.
- **Two limits, 30 °C and 28 °C** (hysteresis): the fan switches on above 30 and off only below 28, so it does not flick on and off at 29.9.
- **`Serial.print(celsius, 1)`** prints one decimal place.

::: 3d thermostat "Drag the hairdryer close to the TMP36: above 30 °C the fan starts"

## Common mistakes

- **Sensor in backwards.** Very hot and ruined. Flat face towards you: 5V, A0, GND.
- **Readings around −50 °C.** The OUT leg is not reaching A0, so the pin reads close to 0. Check that wire.
- **Integer maths.** `analogRead(A0) * 5 / 1023` drops the decimals — use `5.0 / 1023.0`.
- **It reads too warm.** The sensor sits next to something hot, like a busy regulator or a lamp. Move it away.

## Check yourself

::: quiz
? What voltage does a TMP36 give at 20 °C?
- 0.20 V
- 0.70 V *
- 2.0 V
= 0.5 V + 20 × 0.01 V = 0.70 V.
? Holding the flat face towards you, which leg goes to A0?
- The left one
- The middle one *
- The right one
= Left to right: VS (5V), OUT (A0), GND.
? Why does the thermostat use two limits, 30 °C and 28 °C?
- To save power
- So the fan does not flick on and off around one value *
- Because the sensor has two outputs
= With a gap between on and off (hysteresis), small wobbles do not switch the fan.
:::

## Questions people ask

### How do I convert TMP36 readings to Celsius on Arduino?
Turn the reading into volts with `reading * 5.0 / 1023.0`, then use `(volts - 0.5) * 100.0`. For Fahrenheit, multiply the Celsius value by 9 ÷ 5 and add 32.

### Why is my TMP36 getting hot?
It is almost certainly in backwards, with 5V on its GND leg. Unplug the USB at once, let it cool, and turn it round — flat face towards you: 5V, OUT, GND.

### How accurate is the TMP36?
Within about 1–2 °C, and the UNO reads it in steps of about 0.5 °C. That is plenty for a thermostat or a weather display, not for a fever thermometer.

### Can I use a TMP36 with 3.3 V?
Yes, it works from 2.7 V up, and its output is the same: 0.5 V at 0 °C, 10 mV per degree. Keep 5.0 in the formula — that number is the UNO's analog reference, not the sensor's supply.

## Where it is used

Build the [Arduino thermostat](/learn/arduino-thermostat-tmp36-fan/), where the TMP36 switches a fan through a transistor.
