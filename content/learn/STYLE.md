# How to write a Learn Arduino tutorial

The tutorials live at learnarduino.tech/learn/<slug>/ and are built from the `.md` files in this folder by
`tools/learn/build.mjs` (files starting with a capital letter, like this one, are not built). Read the three finished
samples first: `blink-an-led.md` (a project), `measure-distance-hc-sr04.md` (a project), `what-is-a-breadboard.md` (a guide).

## Who reads it

Beginners — school and college students, hobbyists, teachers — many reading in English as a second language, many on a phone.
They arrive from Google with a question ("how does a servo work", "arduino potentiometer code"). Answer it fast, then keep
them reading and get them to press **Play in 3D**.

## Voice

- Short sentences, plain words, active voice. Explain every term the first time (one short clause is enough).
- Friendly and confident, never childish. A little fun is welcome (one emoji at most per article).
- Concrete numbers: volts, milliamps, ohms, microseconds — and the arithmetic, in a small table.
- Never invent: pins, code, values and part names must match this project exactly (see "Facts" below).
- US spelling is fine either way, but be consistent within an article. "Arduino UNO", "breadboard", "jumper wire".

## Front matter (between the two --- lines)

```
---
title: <What it is> with Arduino — <the hook>          (55–70 characters; the main search words first)
description: <one sentence, 120–160 characters: what you learn + "Try it live in 3D">
lead: <2–3 sentences shown under the title: the promise, why it is fun>
kind: project | component | guide
project: <app project id>          (projects only — the 3D lab's id, e.g. knob)
number: <project number 1–16>      (projects only)
level: Beginner | Intermediate
build: 15 minutes                   (projects only)
order: <number>                     (projects: their number; components 100+; guides 1–30)
image: <hero picture>               (see Pictures)
imageAlt: <what the picture shows, for blind readers and Google>
og: <share card>                    (see Pictures)
date: 2026-10-29
parts: [uno, usb, breadboard, ...]  (ids from PARTS in tools/learn/build.mjs — only those)
related: [slug, slug, slug]         (2–4 other tutorials; only slugs that exist in this folder)
---
```

## Shape of a project article (in this order; `##` headings exactly like the samples)

1. `## What you will build` — 2 short paragraphs: what it does, where this idea is used in real life.
2. `## How it works` — the physics/electronics in plain words; a small table of numbers where it helps; one picture.
3. `## The wiring` — a numbered list of steps, then a table *Part pin → goes to → what it does*, then the schematic picture.
4. `## The code, line by line` — the project's exact code in a ```cpp block, then a bullet per important line.
5. `## Common mistakes` — 3–5 bullets, each "**symptom.** cause and fix".
6. `## Try these challenges` — 3–4 numbered challenges, from easy to harder. One should use the 3D lab ("in the 3D lab, …").
7. `## Check yourself` — a quiz (syntax below), 3 questions.
8. `## Questions people ask` — 3–4 `###` questions real people search for, each answered in 2–4 sentences. (These become a
   Google FAQ result: write them as complete questions.)
9. `## What's next` — 1–2 sentences linking the next project with a normal link: `[the knob project](/learn/potentiometer-arduino/)`.

Components follow the same idea: What it is / How it works (inside) / Pins (table) / How to wire it to an Arduino / Example
code (from the project that uses it) / Common mistakes / Check yourself / Questions people ask / Where it is used (link the
projects). Guides are freer, but keep: a fast answer first, pictures or a diagram, Check yourself, Questions people ask.

Length: projects 900–1400 words, components 600–1000, guides 700–1300.

## Special lines

- A callout box: `> **Tip:** …` · `> **Warning:** …` · `> **Did you know?** …` · `> **Try it:** …` (one paragraph each).
- A table: `| A | B |` then `|---|---|` then rows.
- A picture: `![alt text](img/<file> "caption")` on its own line.
- The project live in 3D: `::: 3d <project-id> "caption"` on its own line. A project's own hero is already live 3D — use
  this line only to show a *different* project (e.g. a component article showing the project that uses it).
- A quiz:

```
::: quiz
? What does delay(1000) do?
- It waits one second *
- It turns the LED off
- It sets pin 13 to 1000
= delay() pauses the program for that many milliseconds; 1000 ms is one second.
? Next question…
- …
:::
```

  `?` starts a question, `-` an answer (put ` *` at the end of the right one), `=` an optional explanation shown after answering.
- Links to other tutorials: `[text](/learn/<slug>/)`. Links into the 3D lab: `[open it in 3D](/#/projects/<id>)`,
  `[the Build bench](/#/build)`, a component page `[the LED in 3D](/#/components/led)`.
- Diagrams: a raw `<svg>` block (see the breadboard guide) — keep it simple, readable on a phone, colours that work on light and dark.

## Pictures (all taken from our own 3D lab by `npm run learn:shots`)

- Project `<id>`: `<id>-hero.jpg` (the whole circuit, labels on), `<id>-close.jpg` (a close-up of the main part),
  `<id>-schematic.png` (the Wiring tab's schematic), `<id>-og.jpg` (share card). Use all four: hero in `image`, og in `og`,
  close-up in "How it works", schematic in "The wiring".
- Component `<type>`: `<type>-3d.jpg` (the part alone in 3D) and `<type>-og.jpg`. Hero: `image: <type>-3d.jpg`.
- Guide `<slug>`: `og: <slug>-og.jpg`; for `image` reuse a project hero that fits (e.g. `knob-hero.jpg`) or draw an SVG.

## Facts — where to read them (never guess)

- Projects (id, title, code, parts and their holes, wires, inputs): `src/content/projects/basics.ts`, `more.ts`.
- Components (overview, pins, specs, example): `src/content/components.ts`.
- Electrical values the 3D lab uses (LED forward voltages, sensor curves, motor and module ratings): `src/circuit/parts.ts`
  and `src/circuit/evaluate.ts`. What the lab does when something is wired wrong (LEDs and pins burn, shorts, a module wired
  backwards burns): `src/circuit/evaluate.ts`.
- What the 3D lab can do: run real compiled code on a simulated ATmega328P, serial monitor, labels, current dots, sound,
  breadboards as parts, parts standing on the table without a breadboard, schematic wiring view, burn effects.
