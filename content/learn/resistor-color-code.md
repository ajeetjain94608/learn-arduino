---
title: Resistor color code — how to read the bands (220 Ω, 1 kΩ, 10 kΩ)
description: Read any resistor's color bands in seconds: the full color code table, 4-band and 5-band resistors, and worked examples for 220 Ω, 1 kΩ and 10 kΩ.
lead: Resistors are too small to print numbers on, so they wear colored stripes instead. Learn one table and a three-step trick, and you will never mix up a 220 Ω and a 10 kΩ again.
kind: guide
level: Beginner
order: 9
og: resistor-color-code-og.jpg
date: 2026-10-29
related: [what-is-a-resistor, voltage-current-resistance-ohms-law, blink-an-led, pull-up-pull-down-resistors]
---
# Resistor color code

## The short answer

On a common **4-band** resistor:

1. **Band 1** = first digit
2. **Band 2** = second digit
3. **Band 3** = multiplier (how many zeros to add)
4. **Band 4** = tolerance (how exact it is) — usually **gold** (±5 %)

So **red, red, brown, gold** = 2, 2, one zero = **220 Ω**, ±5 %.

<svg viewBox="0 0 640 230" role="img" aria-label="Diagram: a 220 ohm resistor with red, red, brown and gold bands, each band labelled" style="width:100%;height:auto;max-width:640px;display:block;margin:1rem auto;font-family:inherit">
  <rect x="10" y="10" width="620" height="210" rx="14" fill="#F8F4EB" stroke="#D8CFBC"/>
  <line x1="40" y1="110" x2="190" y2="110" stroke="#9AA3AD" stroke-width="5"/>
  <line x1="450" y1="110" x2="600" y2="110" stroke="#9AA3AD" stroke-width="5"/>
  <rect x="180" y="72" width="280" height="76" rx="30" fill="#E9D3A8" stroke="#B89B68" stroke-width="2"/>
  <rect x="222" y="74" width="22" height="72" fill="#D7261E"/>
  <rect x="262" y="74" width="22" height="72" fill="#D7261E"/>
  <rect x="302" y="74" width="22" height="72" fill="#7B4A21"/>
  <rect x="392" y="74" width="22" height="72" fill="#C9A227"/>
  <g font-size="13" text-anchor="middle" font-weight="800" fill="#14202E">
    <text x="233" y="58">2</text><text x="273" y="58">2</text><text x="313" y="58">× 10</text><text x="403" y="58">±5 %</text>
  </g>
  <g font-size="12" text-anchor="middle" fill="#4A5A6E">
    <text x="233" y="172">red</text><text x="273" y="172">red</text><text x="313" y="172">brown</text><text x="403" y="172">gold</text>
    <text x="233" y="190">digit</text><text x="273" y="190">digit</text><text x="313" y="190">multiplier</text><text x="403" y="190">tolerance</text>
  </g>
  <text x="320" y="210" font-size="15" text-anchor="middle" fill="#0E7C86" font-weight="800">22 × 10 = 220 Ω</text>
</svg>

## The color code table

| Color | Digit | Multiplier | Tolerance |
|---|---|---|---|
| Black | 0 | × 1 | — |
| Brown | 1 | × 10 | ±1 % |
| Red | 2 | × 100 | ±2 % |
| Orange | 3 | × 1 000 (1 k) | — |
| Yellow | 4 | × 10 000 (10 k) | — |
| Green | 5 | × 100 000 (100 k) | ±0.5 % |
| Blue | 6 | × 1 000 000 (1 M) | ±0.25 % |
| Violet | 7 | — | ±0.1 % |
| Grey | 8 | — | — |
| White | 9 | — | — |
| Gold | — | × 0.1 | ±5 % |
| Silver | — | × 0.01 | ±10 % |

The digits follow the rainbow, with black and brown in front and grey and white behind. A popular memory line for 0 to 9: "**B**etter **B**e **R**ight **O**r **Y**our **G**reat **B**ig **V**enture **G**oes **W**rong" — black, brown, red, orange, yellow, green, blue, violet, grey, white.

> **Tip:** Think of the multiplier band as "**how many zeros**". Black = no zeros, brown = 1 zero, red = 2 zeros, orange = 3 zeros, yellow = 4 zeros.

## Which end do I start from?

Hold the resistor so that the **gold or silver band is on the right**. That band is the tolerance, so you read from the other end. The tolerance band also usually has a slightly bigger gap before it. If there is no gold or silver band, start from the end where the bands sit closest to the edge.

## Worked example 1: 220 Ω (for LEDs)

| Band | Color | Means |
|---|---|---|
| 1 | Red | 2 |
| 2 | Red | 2 |
| 3 | Brown | × 10 (one zero) |
| 4 | Gold | ±5 % |

2, 2, add one zero → **220 Ω**. This is the resistor in front of almost every LED on this site, from [Blink](/learn/blink-an-led/) to the [RGB LED](/learn/rgb-led-arduino/). With ±5 %, the real value can be anywhere from 209 Ω to 231 Ω — no problem at all.

## Worked example 2: 1 kΩ

| Band | Color | Means |
|---|---|---|
| 1 | Brown | 1 |
| 2 | Black | 0 |
| 3 | Red | × 100 (two zeros) |
| 4 | Gold | ±5 % |

1, 0, add two zeros → 1 000 Ω = **1 kΩ**. Our [DC motor project](/learn/dc-motor-transistor-arduino/) uses a 1 kΩ resistor between pin 6 and the transistor's base.

## Worked example 3: 10 kΩ

| Band | Color | Means |
|---|---|---|
| 1 | Brown | 1 |
| 2 | Black | 0 |
| 3 | Orange | × 1 000 (three zeros) |
| 4 | Gold | ±5 % |

1, 0, add three zeros → 10 000 Ω = **10 kΩ**. This is the pull-down in the [push button project](/learn/push-button-arduino/) and the partner of the light sensor in the [night light](/learn/night-light-ldr-arduino/).

> **Warning:** 1 kΩ (brown black **red**) and 10 kΩ (brown black **orange**) look alike in dim light. Red and orange are the most common mix-up — check twice, or measure.

::: 3d button "This project uses both: a 10 kΩ pull-down (brown black orange) and a 220 Ω for the LED (red red brown)"

## 5-band resistors

Precision resistors (often with a blue body) have **three digit bands**, then the multiplier, then the tolerance — usually **brown (±1 %)**.

| Resistor | 4-band | 5-band |
|---|---|---|
| 220 Ω | red red brown gold | red red black black brown |
| 1 kΩ | brown black red gold | brown black black brown brown |
| 10 kΩ | brown black orange gold | brown black black red brown |

For 220 Ω on a 5-band resistor: 2, 2, 0, then black (no more zeros) → 220 Ω.

## Quick ways to check

- **A multimeter** on the Ω setting gives the real value in a second. Don't hold both legs with your fingers — your body adds resistance.
- **Keep them sorted.** Tape a strip of each value to a card and write the value on it.
- **In our 3D lab** you can set each resistor's resistance on [the Build bench](/#/build) — handy for seeing how 220 Ω, 1 kΩ and 10 kΩ change an LED's brightness.

## Check yourself

::: quiz
? What value is brown, black, orange, gold?
- 10 kΩ *
- 1 kΩ
- 103 Ω
= 1, 0, then orange = three zeros: 10 000 Ω.
? What colors are on a 220 Ω 4-band resistor?
- Red, red, brown, gold *
- Red, red, red, gold
- Brown, red, red, gold
= 2, 2, and brown adds one zero: 220.
? What does a gold fourth band mean?
- The value is within ±5 % *
- The resistor is made of gold
- Multiply by 1 000
= In the fourth position, gold is the tolerance: ±5 %.
:::

## Questions people ask

### How do you read a resistor color code?
Put the gold or silver band on the right. The first two bands are digits, the third tells you how many zeros to add, and the last is the tolerance. Red-red-brown is 2, 2 and one zero: 220 Ω.

### What is the color code for a 220 ohm resistor?
On a 4-band resistor: red, red, brown, gold. On a 5-band resistor: red, red, black, black, brown.

### What color is a 10k resistor?
Brown, black, orange, gold on a 4-band resistor; brown, black, black, red, brown on a 5-band one.

### Does it matter which way round a resistor goes?
No. A resistor works the same in both directions, so you can push it into the breadboard either way. The direction only matters for reading its bands.
