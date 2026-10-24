import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ENV_SIZE } from '../src/three/workbench/bakedEnvironment';

// Renders RoomEnvironment through PMREM once and exposes the CubeUV texels (half floats, RGBA) for saving.
const renderer = new THREE.WebGLRenderer();
const pmrem = new THREE.PMREMGenerator(renderer);
const rt = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: ENV_SIZE });
const { width, height } = rt;
const data = new Uint16Array(width * height * 4);
renderer.readRenderTargetPixels(rt, 0, 0, width, height, data);
(window as unknown as { __baked: { width: number; height: number; data: number[] } }).__baked = { width, height, data: Array.from(data) };
document.body.textContent = `baked ${width}x${height}`;
