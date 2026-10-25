import { describe, expect, it } from 'vitest';
import { shownSpeed } from './simSpeed';

describe('the slow-board notice', () => {
  it('stays hidden (1) during a short stutter', () => {
    let slowFor = 0;
    for (let i = 0; i < 60; i++) ({ slowFor } = shownSpeed(slowFor, 0.5, 1 / 60, false)); // 1 s slow
    expect(shownSpeed(slowFor, 0.5, 1 / 60, false).shown).toBe(1);
  });

  it('appears after 2 s of running below 0.9× real time, rounded to 0.05', () => {
    let r = { slowFor: 0, shown: 1 };
    for (let i = 0; i < 130; i++) r = shownSpeed(r.slowFor, 0.712, 1 / 60, false);
    expect(r.shown).toBe(0.7);
  });

  it('resets once the board keeps up again, and never counts a deliberate hold', () => {
    expect(shownSpeed(5, 0.95, 1 / 60, false)).toEqual({ slowFor: 0, shown: 1 });
    expect(shownSpeed(5, 0.2, 1 / 60, true)).toEqual({ slowFor: 0, shown: 1 });
  });
});
