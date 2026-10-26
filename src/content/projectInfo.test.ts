// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PROJECTS } from './projects';
import { buildProjectInfo, wireMeaning } from './projectInfo';

describe('the info card of a project (Overview · Pinout · Example · Specifications)', () => {
  it('has all four tabs filled, for every project', () => {
    for (const p of PROJECTS) {
      const info = buildProjectInfo(p);
      expect(info.title, p.id).toBe(p.title);
      expect(info.overview.text, p.id).toBe(p.about);
      expect(info.overview.points.length, p.id).toBe(p.learn.length);
      expect(info.example.length, p.id).toBe(p.tryIt.length);
      expect(info.pinout.rows.length, p.id).toBe(p.build.wires.length);
      expect(info.specs.length, p.id).toBeGreaterThan(0);
      for (const s of info.specs) { expect(s.label.length).toBeGreaterThan(0); expect(s.value.length).toBeGreaterThan(0); }
    }
  });
  it('the pinout names the UNO pin, what it connects to, and what the wire is for', () => {
    const rows = buildProjectInfo(PROJECTS.find((p) => p.id === 'knob')!).pinout.rows;
    const a0 = rows.find((r) => r.pin.includes('A0'))!;
    expect(a0.does).toMatch(/analog/i);
    const gnd = rows.find((r) => r.pin.includes('GND'))!;
    expect(gnd.does).toMatch(/ground/i);
    expect(rows.every((r) => /^#[0-9A-Fa-f]{6}$/.test(r.color))).toBe(true);
  });
  it('what a wire is for', () => {
    expect(wireMeaning('uno.5V', 'bb.4a')).toMatch(/5 V/);
    expect(wireMeaning('uno.3V3', 'bb.4a')).toMatch(/3.3 V/);
    expect(wireMeaning('bb.4a', 'uno.GND')).toMatch(/ground/i);
    expect(wireMeaning('uno.D9', 'bb.4a')).toMatch(/PWM/);
    expect(wireMeaning('uno.D13', 'bb.4a')).toMatch(/digital/i);
    expect(wireMeaning('uno.A4', 'oled1.SDA')).toMatch(/I²C/);
    expect(wireMeaning('bb.5a', 'bb.9a')).toMatch(/connects/i);
  });
});
