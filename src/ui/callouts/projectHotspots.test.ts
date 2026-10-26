// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../../content/projects';
import { projectHotspots } from './projectHotspots';

describe('the labels on a project in the 3D view', () => {
  it('one label for each kind of part in the project, plus the board and the breadboard', () => {
    const p = PROJECTS.find((x) => x.id === 'night-light')!;
    const hs = projectHotspots(p, 'circuit');
    const names = hs.map((h) => h.name);
    expect(names).toEqual(expect.arrayContaining(['Light sensor', 'LED', 'Resistor', 'Breadboard', 'UNO R3 board']));
    expect(names.filter((n) => n === 'Resistor')).toHaveLength(1);   // two resistors, one label
  });
  it('a project with modules labels the module', () => {
    const hs = projectHotspots(PROJECTS.find((x) => x.id === 'distance')!, 'bench');
    expect(hs.map((h) => h.name)).toContain('Distance sensor');
  });
  it('every label has its own id, a short second line, a text for the info card, and sits above the bench', () => {
    for (const p of PROJECTS) {
      const hs = projectHotspots(p, 'circuit');
      expect(new Set(hs.map((h) => h.id)).size, p.id).toBe(hs.length);
      for (const h of hs) {
        expect(h.sub!.length, `${p.id} ${h.id}`).toBeGreaterThan(0);
        expect(h.sub!.length, `${p.id} ${h.id}`).toBeLessThanOrEqual(24);
        expect(h.text!.length).toBeGreaterThan(20);
        expect(h.anchor().y).toBeGreaterThan(0);
        expect(h.view).toBe('circuit');
      }
    }
  });
  it('the cards are spread around, so they do not start on top of each other', () => {
    for (const p of PROJECTS) {
      const offs = projectHotspots(p, 'circuit').map((h) => h.offset.join(','));
      expect(new Set(offs).size, p.id).toBe(offs.length);
    }
  });
});
