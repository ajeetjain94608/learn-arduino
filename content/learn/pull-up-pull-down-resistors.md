---
title: Pull-up and pull-down resistors on Arduino — and INPUT_PULLUP
description: Why a button input needs a pull-down or pull-up resistor: floating pins, the 10 kΩ pull-down, and Arduino's built-in INPUT_PULLUP, with code. Try it live in 3D.
lead: You wire a button, run the code, and the LED flickers by itself — even when nobody touches anything. The pin is floating. One 10 kΩ resistor (or one word in your code) fixes it for good.
kind: guide
level: Beginner
order: 8
image: button-hero.jpg
imageAlt: An Arduino UNO with a push button, a 10 kilo-ohm pull-down resistor and a green LED on a breadboard
og: pull-up-pull-down-resistors-og.jpg
date: 2026-10-29
related: [push-button-arduino, how-a-push-button-works, digital-vs-analog-arduino, what-is-a-resistor]
---
# Pull-up and pull-down resistors

## The short answer

An input pin that is connected to **nothing** is **floating**: it picks up electrical noise and reads HIGH and LOW at random. A **pull-down resistor** (to GND) or a **pull-up resistor** (to 5 V) gives the pin a clear, default value when the button is not pressed.

- **Pull-down:** a 10 kΩ resistor from the pin to **GND** → the pin reads **LOW** until you press; the button connects it to 5 V → **HIGH**.
- **Pull-up:** a resistor from the pin to **5 V** → the pin reads **HIGH** until you press; the button connects it to GND → **LOW**.

The UNO even has pull-up resistors built in. Turn one on with `pinMode(pin, INPUT_PULLUP)` and you need no extra resistor at all.

## Why a pin floats

An input pin is very "light": it draws almost no current, so it only *listens* to the voltage. Connect it to 5 V and it reads HIGH; connect it to GND and it reads LOW. But a button only connects the pin **while you press it**. When you let go, the pin is joined to nothing — and a wire joined to nothing behaves like a tiny antenna. Your hand nearby, mains wiring in the wall or the pin next door can all push it around.

> **Did you know?** A floating pin can even change when you just wave your hand near the wire. Some people think their board is broken — it is only floating.

## The pull-down: how our button project does it

<svg viewBox="0 0 640 260" role="img" aria-label="Diagram: 5 V goes through a push button to pin 2; a 10 kilo-ohm resistor joins pin 2 to GND" style="width:100%;height:auto;max-width:640px;display:block;margin:1rem auto;font-family:inherit">
  <rect x="10" y="10" width="620" height="240" rx="14" fill="#F8F4EB" stroke="#D8CFBC"/>
  <text x="80" y="50" font-size="15" text-anchor="middle" fill="#E2483D" font-weight="800">5 V</text>
  <line x1="80" y1="60" x2="80" y2="100" stroke="#14202E" stroke-width="3"/>
  <circle cx="80" cy="104" r="4" fill="#14202E"/><circle cx="80" cy="156" r="4" fill="#14202E"/>
  <line x1="80" y1="104" x2="104" y2="150" stroke="#14202E" stroke-width="3"/>
  <text x="112" y="134" font-size="13" fill="#4A5A6E">button</text>
  <line x1="80" y1="156" x2="80" y2="170" stroke="#14202E" stroke-width="3"/>
  <line x1="80" y1="170" x2="420" y2="170" stroke="#14202E" stroke-width="3"/>
  <circle cx="300" cy="170" r="5" fill="#14202E"/>
  <rect x="420" y="155" width="110" height="30" rx="6" fill="#0E7C86"/>
  <text x="475" y="175" font-size="14" text-anchor="middle" fill="#FFFFFF" font-weight="800">pin 2</text>
  <line x1="300" y1="170" x2="300" y2="182" stroke="#14202E" stroke-width="3"/>
  <polyline points="300,182 290,186 310,192 290,198 310,204 290,210 300,214" fill="none" stroke="#14202E" stroke-width="3"/>
  <text x="320" y="204" font-size="13" fill="#4A5A6E">10 kΩ pull-down</text>
  <line x1="300" y1="214" x2="300" y2="224" stroke="#14202E" stroke-width="3"/>
  <line x1="284" y1="224" x2="316" y2="224" stroke="#2563EB" stroke-width="3"/><line x1="290" y1="230" x2="310" y2="230" stroke="#2563EB" stroke-width="3"/><line x1="296" y1="236" x2="304" y2="236" stroke="#2563EB" stroke-width="3"/>
  <text x="330" y="240" font-size="13" fill="#2563EB" font-weight="800">GND</text>
  <text x="200" y="60" font-size="13" fill="#14202E" font-weight="800">released: the resistor pulls pin 2 to 0 V → LOW</text>
  <text x="200" y="82" font-size="13" fill="#14202E" font-weight="800">pressed: the button joins pin 2 to 5 V → HIGH</text>
</svg>

In our Push-a-button project, the button joins **5 V to pin 2** while you hold it, and a **10 kΩ resistor** joins pin 2 to **GND** all the time. The code is plain `INPUT`:

```cpp
const int BUTTON = 2;
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
```

**Released:** no current flows through the resistor, so pin 2 sits at 0 V → **LOW**.
**Pressed:** pin 2 is joined straight to 5 V → **HIGH**. A small current also flows through the resistor to GND:

| | Working | Result |
|---|---|---|
| Current through the pull-down when pressed | 5 V ÷ 10 000 Ω | 0.5 mA |

Half a milliamp — nothing. That is why the value is "big": large enough to waste almost no current, small enough to beat the noise.

::: 3d button "Hold the button: pin 2 goes HIGH and the LED follows; let go and the pull-down brings it back LOW"

> **Warning:** Never replace the pull-down with a plain wire. Pressing the button would then join 5 V straight to GND — a short circuit. The resistor is what keeps that path safe.

## INPUT_PULLUP: no resistor needed

The ATmega328P has a pull-up resistor inside every pin (somewhere between 20 and 50 kΩ — our 3D lab uses 35 kΩ). Switch it on with `INPUT_PULLUP`, then wire the button between the pin and **GND**. Now the logic is upside down: **LOW means pressed**.

```cpp
const int BUTTON = 2;
const int LED = 13;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);   // the built-in resistor holds pin 2 HIGH
  pinMode(LED, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {   // LOW = pressed
    digitalWrite(LED, HIGH);
  } else {
    digitalWrite(LED, LOW);
  }
}
```

| | Pull-down (our button project) | INPUT_PULLUP |
|---|---|---|
| Extra parts | 10 kΩ resistor | none |
| Button goes to | 5 V | GND |
| Not pressed reads | LOW | HIGH |
| Pressed reads | HIGH | LOW |

Many makers prefer INPUT_PULLUP: one fewer part and one fewer wire. The pull-down is easier to understand at first, because pressed = HIGH.

> **Try it:** In the 3D lab, open the button project, delete the 10 kΩ resistor and the 5 V wire, wire the button from pin 2 to GND, and change `INPUT` to `INPUT_PULLUP`. Remember to flip the logic.

## Where else you meet pull resistors

- **Light sensors and FSRs:** the 10 kΩ resistor in the [night light](/learn/night-light-ldr-arduino/) does a similar job — together with the sensor it forms a *voltage divider*.
- **I²C displays and sensors:** the two I²C wires need pull-ups; most modules have them on board.
- **Reset pin:** the UNO's RESET pin has a pull-up, so the board only resets when the button pulls it to GND.

## Check yourself

::: quiz
? What does a floating input pin read?
- Random HIGH and LOW values *
- Always LOW
- Always 1023
= With nothing connected it picks up noise and can read anything.
? With INPUT_PULLUP and a button to GND, what does the pin read when the button is pressed?
- LOW *
- HIGH
- It floats
= The internal resistor holds it HIGH; pressing joins it to GND, so it reads LOW.
? Why is a pull-down usually 10 kΩ and not 10 Ω?
- A big value wastes almost no current when the button is pressed *
- 10 Ω resistors do not exist
- It makes the LED brighter
= 5 V ÷ 10 kΩ is 0.5 mA; 5 V ÷ 10 Ω would be 500 mA — a short.
:::

## Questions people ask

### Do I need a resistor for a button on Arduino?
Yes, either an external pull-down or pull-up (10 kΩ is the usual value) or the built-in one, turned on with `pinMode(pin, INPUT_PULLUP)`. Without one the pin floats and gives random readings.

### What value pull-up resistor should I use?
10 kΩ is the standard choice for buttons. Anything from about 4.7 kΩ to 47 kΩ works; smaller values resist noise better but waste more current.

### Is INPUT_PULLUP better than an external resistor?
For buttons on an Arduino, usually yes: it needs no extra part. Just remember the logic is reversed — pressed reads LOW.

### Why does my button work randomly?
Almost always a floating pin: the resistor is missing, in the wrong strip of the breadboard, or `INPUT_PULLUP` is not set. Check that the pin has a path to GND or 5 V when the button is up.
