---
title: What is a diode? The 1N4001 flyback diode for Arduino motors
description: What a diode does, how to find its band, and why a 1N4001 sits across every Arduino motor to catch the spike when it stops. Try it live in 3D.
lead: A diode is a one-way street for current. It looks like a boring little black cylinder, but across a motor it quietly saves your transistor every single time the motor switches off.
kind: component
level: Beginner
order: 110
image: diode-3d.jpg
imageAlt: A black 1N4001 diode with a silver band at one end, shown alone in the 3D lab
og: diode-part-og.jpg
date: 2026-10-29
parts: [uno, usb, breadboard, jumpers, diode, npn, motor]
related: [tip120-transistor-explained, dc-motor-explained, dc-motor-transistor-arduino, how-an-led-works]
---
# What is a diode?

## What it is

A diode is a **one-way valve for current**. Current flows easily from its **anode** to its **cathode**, and is blocked the other way round. The one in our kits is the **1N4001**: a small black cylinder with a **silver band** at one end. The band marks the cathode.

You already know one diode: an LED is a *light-emitting* diode. A plain diode does the same one-way job, but makes no light. Its most common Arduino job is to sit across a motor and protect the transistor that switches it — the **flyback diode**. You can [see it in 3D](/#/components/diode) and turn it around.

## How it works

Inside is a tiny slice of silicon made of two layers. Push current the right way and the diode opens once the voltage across it reaches about **0.7 V**; after that it lets almost anything through (up to **1 A** for a 1N4001). Push the other way and it stays shut.

| | Right way round (anode +) | Wrong way round (cathode +) |
|---|---|---|
| Current | Flows | Blocked |
| Voltage lost across it | ≈ 0.7 V | the whole supply |
| Like… | an open door | a locked door |

### Why a motor needs one

A motor is a coil of wire, and a coil hates sudden changes. While the motor runs, current flows through it. When the transistor switches off, that current wants to keep going — and with nowhere to go, the coil pushes the voltage on the transistor's collector way **above 5 V** for a moment. That spike can kill a transistor.

The diode is placed **backwards** across the motor: band towards **5 V**, the other end on the motor's minus side. While the motor runs normally, the diode is blocked and does nothing. The instant the transistor turns off, the spike makes the diode conduct, and the coil's current simply loops round through the motor and the diode until it fades. No spike reaches the transistor.

> **Did you know?** This is also called a *snubber*, *freewheeling* or *catch* diode. Relays, solenoids and fans need one for exactly the same reason.

## Pins

| Pin | Where it is | What it does |
|---|---|---|
| Anode (A) | The plain end | Current goes in |
| Cathode (K) | The end with the band | Current comes out |

## How to wire it to an Arduino

In the [motor project](/learn/dc-motor-transistor-arduino/) the diode lies flat on the breadboard, like a resistor:

1. The **anode** goes in the same strip as the TIP120's **collector** — that is also where the motor's **−** wire arrives.
2. The **cathode** (band) goes in a strip that a wire joins to **5V** — the same 5 V that feeds the motor's **+**.
3. So the diode sits *across* the motor, pointing back towards 5 V.

::: 3d motor "The 1N4001 lies across the motor's two wires, band towards 5 V"

> **Warning:** Turn the diode round and it no longer waits for a spike: the moment the transistor switches on, current rushes from 5 V straight through the diode and the transistor to GND. That is a short circuit. Try it in the 3D lab, where nothing real gets hurt.

## Example code

A diode needs no code — it protects the circuit by itself. Here is the sketch from the motor project it protects:

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

- **`analogWrite(MOTOR, speed)`** switches the transistor on and off about a thousand times a second. Every single "off" makes a small spike — so the diode works hundreds of times a second, not just at the final stop.
- **`analogWrite(MOTOR, 0)`** is the big stop: the last spike, caught by the diode.

## Common mistakes

- **Diode the wrong way round.** Band towards GND or the collector instead of 5 V gives a short as soon as the motor turns on. The band always points to **+**.
- **Both legs in the same strip.** The diode is shorted out and protects nothing. Its legs must be in two different strips.
- **Leaving it out "because it works without".** It does — until the transistor dies weeks later. Always fit it with a motor, relay or solenoid.
## Check yourself

::: quiz
? Which end of a 1N4001 is the cathode?
- The end with the silver band *
- The plain end
- Either end, it does not matter
= The band marks the cathode, where current comes out.
? In the motor circuit, where does the diode's band go?
- To 5 V *
- To GND
- To pin 6
= The band goes to 5 V and the anode to the motor's minus side, so the diode is blocked while the motor runs normally.
? About how much voltage is lost across a silicon diode that is conducting?
- 0.7 V *
- 5 V
- 0 V
= A silicon diode drops about 0.7 V once it conducts.
:::

## Questions people ask

### What does a diode do in an Arduino circuit?
It lets current flow only one way. With motors it catches the voltage spike when the motor switches off; elsewhere it can stop a battery wired backwards from damaging the circuit.

### Can I use a 1N4007 instead of a 1N4001?
Yes. They are the same 1 A diode; the 1N4007 just blocks a higher reverse voltage. Either is fine for a small 5 V motor.

### Why is it called a flyback diode?
Because when the motor switches off, the voltage "flies back" — it jumps up suddenly. The diode gives that energy a safe path.

## Where it is used

The diode protects the transistor in the [motor project](/learn/dc-motor-transistor-arduino/) and in the [thermostat](/learn/arduino-thermostat-tmp36-fan/), which drives the same fan. Next, meet the part it protects: [the TIP120 transistor](/learn/tip120-transistor-explained/).
