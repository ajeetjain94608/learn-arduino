import { expect, test } from 'vitest';
import * as THREE from 'three';
import { ENV_HEIGHT, ENV_SIZE, ENV_WIDTH, environmentFromBuffer } from './bakedEnvironment';

test('baked environment dimensions follow the PMREM CubeUV layout for a 64 px cube', () => {
  expect(ENV_SIZE).toBe(64);
  expect(ENV_WIDTH).toBe(3 * Math.max(64, 16 * 7));
  expect(ENV_HEIGHT).toBe(4 * 64);
});

test('turns the baked half-float texels into a ready-to-use CubeUV environment texture', () => {
  const tex = environmentFromBuffer(new Uint16Array(ENV_WIDTH * ENV_HEIGHT * 4).buffer);
  expect(tex.mapping).toBe(THREE.CubeUVReflectionMapping);
  expect(tex.type).toBe(THREE.HalfFloatType);
  expect(tex.image.width).toBe(ENV_WIDTH);
  expect(tex.image.height).toBe(ENV_HEIGHT);
  expect(tex.generateMipmaps).toBe(false);
});

test('rejects a file of the wrong size instead of rendering garbage', () => {
  expect(() => environmentFromBuffer(new ArrayBuffer(100))).toThrow(/size/);
});
