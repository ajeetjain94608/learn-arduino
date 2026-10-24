import { expect, test } from 'vitest';
import * as THREE from 'three';
import { led0805, STATUS_LED_RED } from './Passives';

// Owner: TX, RX, ON and the built-in L LED glow red when on, so they don't look like capacitors.
test.each(['L', 'TX', 'RX', 'ON'])('%s status LED glows red when on and is dark when off', (name) => {
  const led = led0805(new THREE.Group(), name);
  led.set(1);
  expect(led.materials.every((m) => m.emissive.getHexString() === new THREE.Color(STATUS_LED_RED).getHexString())).toBe(true);
  expect(led.materials.every((m) => m.emissiveIntensity > 0)).toBe(true);
  led.set(0);
  expect(led.materials.every((m) => m.emissiveIntensity === 0)).toBe(true);
});

test('status LED red is a clear red', () => {
  expect(STATUS_LED_RED.toUpperCase()).toBe('#FF2A1A');
});
