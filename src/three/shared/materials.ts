import * as THREE from 'three';

export const std = (color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

// Matte "technical illustration" palette approved in the 3D spike. Shared, created once.
export const MATERIALS = {
  pcb: std('#0A7C88', 0.72),
  pcbEdge: std('#CDBF98', 0.9),
  header: std('#2A2D36', 0.72),
  hole: new THREE.MeshBasicMaterial({ color: '#0B0C10' }),
  chip: std('#2C2F38', 0.6),
  metal: std('#CFD3D9', 0.42, 0.55),
  metalDark: std('#9EA4AD', 0.45, 0.5),
  black: std('#24272F', 0.68),
  smdBlack: std('#22252C', 0.6),
  tin: std('#D9DDE2', 0.35, 0.55),
  breadboard: std('#F8F4EB', 0.88),
};
