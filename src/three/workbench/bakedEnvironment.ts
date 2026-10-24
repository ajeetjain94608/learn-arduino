import * as THREE from 'three';

// The workbench's soft "room" reflections, pre-computed by tools/bake-env (PMREM of three's RoomEnvironment).
// Generating it at startup cost ~1 s of GPU work; loading the baked texels costs a few milliseconds.
export const ENV_SIZE = 64;
export const ENV_WIDTH = 3 * Math.max(ENV_SIZE, 16 * 7); // PMREM CubeUV layout
export const ENV_HEIGHT = 4 * ENV_SIZE;

export function environmentFromBuffer(buffer: ArrayBuffer): THREE.DataTexture {
  const expected = ENV_WIDTH * ENV_HEIGHT * 4 * 2;
  if (buffer.byteLength !== expected) throw new Error(`Baked environment has the wrong size: ${buffer.byteLength} bytes, expected ${expected}`);
  const tex = new THREE.DataTexture(new Uint16Array(buffer), ENV_WIDTH, ENV_HEIGHT, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.CubeUVReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
