---
title: How to read a schematic — circuit symbols for Arduino beginners
description: Learn to read circuit diagrams: the symbols for resistor, LED, diode, switch, potentiometer, transistor, GND and VCC, plus net labels. Try it live in 3D.
lead: A schematic is the map of a circuit. It looks scary at first, but it uses only a dozen symbols — learn them here and any Arduino diagram on the internet will make sense.
kind: guide
level: Beginner
order: 10
image: blink-hero.jpg
imageAlt: The Blink circuit in 3D: an Arduino UNO, a red LED and a 220 ohm resistor on a breadboard
og: how-to-read-a-schematic-og.jpg
date: 2026-10-29
related: [blink-an-led, what-is-a-breadboard, voltage-current-resistance-ohms-law, arduino-uno-pinout-explained]
---
# How to read a schematic

## The short answer

A **schematic** (or circuit diagram) shows **what is connected to what** — not where the parts sit on the table. Each part is a small symbol, and **lines are wires**. Two rules cover most of it:

1. **Anything joined by a line is connected.** Where lines cross with a **dot**, they are joined; where they cross with no dot, they are not.
2. **Points with the same label are connected**, even with no line between them. Every **GND** symbol is the same ground; every **5V** is the same supply.

## The symbols you will meet

<svg viewBox="0 0 640 400" role="img" aria-label="Chart of circuit symbols: resistor, LED, diode, push button, potentiometer, NPN transistor, ground and VCC" style="width:100%;height:auto;max-width:640px;display:block;margin:1rem auto;font-family:inherit">
  <rect x="10" y="10" width="620" height="380" rx="14" fill="#F8F4EB" stroke="#D8CFBC"/>
  <g fill="none" stroke="#14202E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <polyline points="40,80 70,80 76,66 88,94 100,66 112,94 124,66 136,94 142,80 170,80"/>
    <line x1="350" y1="80" x2="400" y2="80"/><polygon points="400,62 400,98 432,80"/><line x1="432" y1="62" x2="432" y2="98"/><line x1="432" y1="80" x2="480" y2="80"/>
    <line x1="440" y1="58" x2="456" y2="42"/><line x1="452" y1="64" x2="468" y2="48"/>
    <line x1="40" y1="190" x2="90" y2="190"/><polygon points="90,172 90,208 122,190"/><line x1="122" y1="172" x2="122" y2="208"/><line x1="122" y1="190" x2="170" y2="190"/>
    <line x1="350" y1="200" x2="390" y2="200"/><circle cx="394" cy="200" r="4"/><circle cx="446" cy="200" r="4"/><line x1="450" y1="200" x2="480" y2="200"/><line x1="392" y1="178" x2="448" y2="178"/><line x1="420" y1="178" x2="420" y2="164"/>
    <polyline points="40,300 70,300 76,286 88,314 100,286 112,314 124,286 136,314 142,300 170,300"/><line x1="105" y1="260" x2="105" y2="284"/><polyline points="98,276 105,286 112,276"/>
    <circle cx="420" cy="300" r="28"/><line x1="408" y1="284" x2="408" y2="316"/><line x1="370" y1="300" x2="408" y2="300"/><line x1="408" y1="292" x2="436" y2="276"/><line x1="436" y1="276" x2="436" y2="262"/><line x1="408" y1="308" x2="436" y2="324"/><line x1="436" y1="324" x2="436" y2="338"/><polyline points="424,322 436,324 430,313"/>
  </g>
  <g fill="none" stroke-width="3" stroke-linecap="round">
    <line x1="560" y1="60" x2="560" y2="84" stroke="#2563EB"/><line x1="540" y1="84" x2="580" y2="84" stroke="#2563EB"/><line x1="547" y1="92" x2="573" y2="92" stroke="#2563EB"/><line x1="554" y1="100" x2="566" y2="100" stroke="#2563EB"/>
    <line x1="560" y1="230" x2="560" y2="200" stroke="#E2483D"/><line x1="540" y1="200" x2="580" y2="200" stroke="#E2483D"/>
  </g>
  <g font-size="14" font-weight="800" fill="#14202E">
    <text x="40" y="125">Resistor</text><text x="350" y="125">LED</text><text x="540" y="125">GND</text>
    <text x="40" y="235">Diode</text><text x="350" y="235">Push button</text><text x="540" y="250">VCC / 5V</text>
    <text x="40" y="345">Potentiometer</text><text x="470" y="360">NPN transistor</text>
  </g>
  <g font-size="12" fill="#4A5A6E">
    <text x="40" y="143">a zigzag (or a box)</text><text x="350" y="143">arrows = light out</text><text x="540" y="143">0 V, ground</text>
    <text x="40" y="253">current flows → one way only</text><text x="350" y="253">joins when pressed</text><text x="540" y="268">the supply</text>
    <text x="40" y="363">a resistor + arrow (wiper)</text><text x="470" y="378">base · collector · emitter</text>
  </g>
</svg>

| Symbol | Part | What to look for |
|---|---|---|
| Zigzag (US) or a plain box (Europe) | **Resistor** | Its value is written next to it: 220, 10k, 1k |
| Triangle + bar + two arrows | **LED** | The triangle points the way current flows: from the **anode (+, long leg)** to the **cathode (−, bar)** |
| Triangle + bar | **Diode** | Same as an LED without the light. The bar end is the stripe on the real part |
| Two dots and a bridge | **Push button / switch** | Open until pressed |
| Resistor with an arrow pointing at it | **Potentiometer** | The arrow is the middle leg (the *wiper*) |
| Circle with three legs, an arrow on one | **Transistor (NPN)** | Base (B), collector (C), emitter (E, the leg with the arrow) |
| Three shrinking lines | **GND** | Ground, 0 V — where every current returns |
| A bar or an arrow pointing up | **VCC / 5V** | The positive supply |

> **Did you know?** The letter **k** means "thousand", and it often replaces the decimal point: **4k7** means 4.7 kΩ, **2R2** means 2.2 Ω. Writing it this way stops a tiny dot from getting lost when a diagram is printed.

## Net labels: wires without lines

A **net** is a group of points that are all connected. On a big diagram, drawing every wire would be a mess, so engineers give a net a **name** instead: `D13`, `A0`, `5V`, `GND`. Wherever you see the same name, imagine a wire between them.

This is exactly how our 3D lab draws your circuit. Open the **Wiring** tab on the Build page and choose **Schematic**: the lab draws the UNO's pins and every part you have placed, and pins with the same label are connected. You can even wire from there — pick one pin, then another.

![Schematic of the Blink circuit: UNO pin D13 to the LED, the LED to the resistor, the resistor to GND](img/blink-schematic.png "The Blink circuit as our 3D lab draws it: D13 → LED → 220 Ω → GND.")

## Reading one, step by step

Take the Blink schematic above and follow the current like water:

1. **Find the supply.** Here it is pin **D13** — when the code sets it HIGH, it gives 5 V.
2. **Follow the line.** D13 goes to the LED's **anode** (the flat side of the triangle).
3. **Through the part.** The triangle points right, so current may flow that way. Out of the cathode (the bar)…
4. **…into the resistor**, 220 Ω…
5. **…and back to GND.** The loop is complete.

If you cannot trace a closed path from a supply back to GND, no current can flow — and that is often the bug.

::: 3d blink "Open Build → Wiring → Schematic to see this circuit drawn as a diagram"

## Schematic vs breadboard picture

| | Schematic | Breadboard picture |
|---|---|---|
| Shows | What connects to what | Where every leg and wire really goes |
| Good for | Understanding and checking a circuit | Copying a build hole by hole |
| Used by | Engineers, datasheets, PCB design | Beginner tutorials |

One schematic can be built many ways on a breadboard — the strips are just the lines of the schematic. See [how a breadboard works](/learn/what-is-a-breadboard/).

## Tips for your first diagrams

- **Read left to right, top to bottom.** Supplies are usually at the top, GND at the bottom, inputs on the left, outputs on the right.
- **Look for the dot.** A dot where lines meet means connected. No dot means they only cross.
- **Check the values.** "220" next to a resistor, "1N4001" next to a diode — they tell you exactly which part to buy.
- **Match the pins.** The UNO is drawn as a box with its pin names (D2, D13, A0, 5V, GND) — the [pinout guide](/learn/arduino-uno-pinout-explained/) shows where each one is on the real board.

## Check yourself

::: quiz
? Two lines cross on a schematic with no dot. Are they connected?
- No, they only cross *
- Yes, always
- Only if they are the same colour
= A dot means joined; no dot means the wires just pass over each other.
? Which way does current flow through an LED symbol?
- In the direction the triangle points, toward the bar *
- From the bar to the triangle
- Both ways equally
= Current flows from anode to cathode — the way the triangle points.
? Two points on a diagram both say GND. What does that mean?
- They are connected *
- They are two different grounds that must not touch
- Nothing; labels are just decoration
= Points with the same net label are connected, even without a line.
:::

## Questions people ask

### What is the difference between a schematic and a wiring diagram?
A schematic shows the electrical connections with standard symbols, not where the parts sit. A wiring (or breadboard) diagram is a picture of the real layout. Learn the schematic — it works for any layout.

### What does VCC mean on a circuit diagram?
VCC is the positive supply voltage — on an Arduino UNO usually 5 V. You will also see VDD, V+ or simply 5V; they mean the same kind of thing.

### How do I tell an LED from a diode on a schematic?
Both are a triangle with a bar. The LED has two small arrows pointing **away** from it — the light coming out.

### Can I draw a schematic of my Arduino circuit automatically?
Yes. Build it in our free 3D lab and open the **Wiring** tab on the Build page: it draws the schematic of your circuit for you, with every pin labelled.
