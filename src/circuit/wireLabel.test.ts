import { describe, expect, it } from 'vitest';
import { wireLabel } from './wireLabel';

describe('what a wire says while the board runs', () => {
  it('supply and ground wires say their voltage', () => {
    expect(wireLabel('uno.5V', 'bb.4c', 5)).toBe('5 V');
    expect(wireLabel('bb.9d', 'uno.GND', 0)).toBe('GND');
    expect(wireLabel('uno.3V3', 'bb.4c', 3.3)).toBe('3.3 V');
  });
  it('a digital pin wire says HIGH or LOW', () => {
    expect(wireLabel('uno.D13', 'bb.8a', 4.9)).toBe('HIGH');
    expect(wireLabel('bb.8a', 'uno.D13', 0.02)).toBe('LOW');
  });
  it('an analog pin wire says its reading, like analogRead()', () => {
    expect(wireLabel('bb.7d', 'uno.A0', 2.5)).toBe('A0 = 512');
    expect(wireLabel('uno.A3', 'bb.7d', 5)).toBe('A3 = 1023');
  });
  it('I²C wires say which line they are', () => {
    expect(wireLabel('uno.A4', 'oled1.SDA', 0)).toBe('SDA');
    expect(wireLabel('oled1.SCL', 'uno.A5', 5)).toBe('SCL');
  });
  it('any other wire says its voltage to two decimals', () => {
    expect(wireLabel('bb.5c', 'bb.9c', 1.234)).toBe('1.23 V');
    expect(wireLabel('servo1.SIG', 'uno.D9', 3)).toBe('HIGH'); // a pin on the UNO end still reads as a pin
  });
});
