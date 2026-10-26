// @vitest-environment node
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../components';
import { PROJECTS } from '.';
import { MAIN_COMPONENT } from './thumbs';

describe('every project and component has its picture', () => {
  it('each project names a main component that exists and has a baked picture', () => {
    for (const p of PROJECTS) {
      const main = MAIN_COMPONENT[p.id];
      expect(main, `${p.id} has a main component`).toBeDefined();
      expect(main in COMPONENTS, `${p.id}: ${main} is a component`).toBe(true);
      expect(existsSync(`src/assets/components/${main}.png`), `${main}.png is baked`).toBe(true);
    }
  });
  it('every component has a baked picture', () => {
    for (const id of Object.keys(COMPONENTS)) expect(existsSync(`src/assets/components/${id}.png`), id).toBe(true);
  });
  it("a project's main component is one of its own parts (or the board)", () => {
    for (const p of PROJECTS) {
      const main = MAIN_COMPONENT[p.id];
      expect(main === 'uno' || p.build.parts.some((x) => x.type === main), `${p.id}: ${main}`).toBe(true);
    }
  });
});
