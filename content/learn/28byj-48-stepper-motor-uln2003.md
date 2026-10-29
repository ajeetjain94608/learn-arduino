---
title: 28BYJ-48 stepper motor and ULN2003 driver with Arduino, explained
description: How the 28BYJ-48 stepper and its ULN2003 driver turn in exact steps: 2048 a turn, the four coils, the IN1–IN4 wiring and the Stepper library. Try it live in 3D.
lead: A normal motor just spins. A stepper moves in exact little clicks — 2048 of them make one turn — so your Arduino always knows precisely where it is. Here's how the cheapest stepper in the world does it.
kind: component
level: Intermediate
order: 116
image: stepper-3d.jpg
imageAlt: A 28BYJ-48 stepper motor connected to its ULN2003 driver board with four LEDs, shown in the 3D lab
og: stepper-part-og.jpg
date: 2026-10-29
parts: [uno, usb, breadboard, jumpers, stepper, button, resistor-10k]
related: [stepper-motor-arduino, how-a-servo-works, tip120-transistor-explained, dc-motor-explained]
---
# The 28BYJ-48 stepper motor

## What it is

The **28BYJ-48** is a small 5 V stepper motor with a gearbox, almost always sold with a **ULN2003 driver board**. Instead of spinning freely, it turns in **exact steps**: **2048 steps make one full turn** of its shaft. Tell it "512 steps" and it turns exactly a quarter turn — every time, with no sensor needed.

Perfect for a prize wheel, a clock hand or a pet feeder. [See it in 3D](/#/components/stepper).

## How it works

Inside the motor are **four coils** (called A, B, C and D) around a magnet. Switch on coils in the right order and the magnet is pulled from one to the next, a little click at a time. Switch them in the opposite order and it turns backwards. Stop switching and it holds still.

Each click inside the motor is tiny, and a gearbox of about 1 : 64 makes it even finer. The result: **2048 full steps per turn**, or 360° ÷ 2048 ≈ **0.18° per step**.

### The full-step sequence

The Arduino Stepper library switches **two coils at a time**, moving round like this:

| Step | Coils on | Driver LEDs lit |
|---|---|---|
| 0 | A + B | A, B |
| 1 | B + C | B, C |
| 2 | C + D | C, D |
| 3 | D + A | D, A |

Then back to step 0 — four steps, over and over. Our 3D lab watches the IN pins and moves the shaft exactly the same way, and the driver board's **LEDs A–D** light to show which coils are on.

### Why a driver board?

Each coil wants far more current than an Arduino pin can give. The ULN2003 chip on the driver board holds **seven Darlington transistors** — little cousins of the [TIP120](/learn/tip120-transistor-explained/) — plus protection diodes. The Arduino's pins only tell it which coils to switch; the power comes from the board's **+** and **−** pins.

## Pins

| Driver pin | Goes to | What it does |
|---|---|---|
| IN1 | Pin 8 | Switches coil A |
| IN2 | Pin 9 | Switches coil B |
| IN3 | Pin 10 | Switches coil C |
| IN4 | Pin 11 | Switches coil D |
| + | 5V | Power for the coils |
| − | GND | Ground |

The motor itself plugs into the white five-pin socket on the driver board — it only fits one way.

## How to wire it to an Arduino

1. **IN1 → 8, IN2 → 9, IN3 → 10, IN4 → 11.**
2. Driver **+ → 5V**, driver **− → GND**.
3. For the prize-wheel project, a push button on the breadboard: one side to **5V**, the other to **pin 2**, with a **10 kΩ** resistor from pin 2's side to **GND** (a pull-down, so the pin reads LOW until pressed).

> **Warning:** The driver needs at least about 4.5 V, and **+** and **−** must not be swapped — a module wired backwards burns in our 3D lab, and can on your desk too.

::: 3d wheel "Press the button: the wheel spins a full turn and lands right on a prize"

## Example code

The [spin-the-wheel project](/learn/stepper-motor-arduino/):

```cpp
#include <Stepper.h>
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
```

- **`Stepper wheel(TURN, 8, 10, 9, 11);`** — the odd order **IN1, IN3, IN2, IN4** is not a typo. It makes the library's pattern switch the coils A+B, B+C, C+D, D+A, as in the table above. With 8, 9, 10, 11 the motor only buzzes.
- **`wheel.setSpeed(12);`** — 12 turns a minute, so one turn takes 5 seconds.
- **`TURN / SEGMENTS`** — 2048 ÷ 8 = 256 steps per prize segment.
- **`wheel.step(...)`** — one full turn for the show, plus however many segments it takes to reach the prize. It stops exactly there.

## Common mistakes

- **It buzzes but does not turn.** The pins are in the wrong order in the code — use 8, 10, 9, 11 for IN1–IN4 on 8–11.
- **It skips or stalls.** The speed is too high. The 28BYJ-48 is slow; stay around 10–15 turns a minute.
- **The rest of the program freezes.** `step()` does not return until all the steps are done. Move in small pieces if you need to do other things meanwhile.
## Check yourself

::: quiz
? How many steps make one full turn of a 28BYJ-48 here?
- 2048 *
- 360
- 64
= The Stepper library counts 2048 full steps for one turn of the output shaft.
? Why is there a ULN2003 driver board?
- The coils need more current than a pin can give *
- It makes the motor quieter
- It converts the code into steps
= Its Darlington transistors switch the coils; the pins only signal which ones.
? How many steps is a quarter turn?
- 512 *
- 90
- 256
= 2048 ÷ 4 = 512.
:::

## Questions people ask

### What is the difference between a stepper and a servo?
A servo goes to an angle from 0° to 180° and holds it with a sensor inside. A stepper can turn forever in either direction, counting exact steps, but has no sensor — it trusts that no step was missed.

### Is it 2048 or 4096 steps per revolution?
Both are right. The Stepper library uses full steps (2048 a turn). Switching one and two coils in turn makes half steps — 4096 a turn — which is smoother but needs a different library.

### Can I power the 28BYJ-48 from the Arduino?
One motor on USB is fine for learning. For several motors, give the driver its own 5 V supply and join its GND to the Arduino's GND.

## Where it is used

It spins the prize wheel in [spin the wheel](/learn/stepper-motor-arduino/). For a motor that just needs a quick angle, see [how a servo works](/learn/how-a-servo-works/).
