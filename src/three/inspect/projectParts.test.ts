import { describe, expect, it } from 'vitest';
import { cardOf } from './projectParts';

describe('the name card of a part in a project', () => {
  it('a part in a project is found by its id, and says what it is in one line', () => {
    const led = cardOf('led2')!;
    expect(led.name).toBe('LED');
    expect(led.line.length).toBeGreaterThan(10);
    expect(led.line.length).toBeLessThan(110);
    expect(led.text).toContain('long leg');
    expect(cardOf('hcsr041')!.name).toBe('Distance sensor');
    expect(cardOf('servo1')!.name).toBe('Servo');
  });
  it('a wire has a card too', () => {
    expect(cardOf('wire-w12')!.name).toBe('Jumper wire');
  });
  it('the board and the breadboard', () => {
    expect(cardOf('breadboard')!.name).toBe('Breadboard');
  });
  it('anything else has no card', () => {
    expect(cardOf('nope1')).toBeNull();
    expect(cardOf('')).toBeNull();
  });
});
