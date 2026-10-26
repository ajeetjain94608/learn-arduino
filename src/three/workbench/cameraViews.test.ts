import { expect, test } from 'vitest';
import * as THREE from 'three';
import { clampZoom, fitOrtho, fitView, MAX_ZOOM, MIN_ZOOM, orbitAround, VIEWS, VIEW_DIR } from './cameraViews';

test('landscape screens are fitted by height', () => {
  expect(fitOrtho(16 / 9)).toEqual({ halfH: 64, halfW: 64 * (16 / 9) });
});

test('portrait screens are fitted by width so the whole circuit stays visible', () => {
  const { halfH, halfW } = fitOrtho(390 / 844);
  expect(halfH).toBeCloseTo(205.59, 2);
  expect(halfW).toBeCloseTo(95, 5);
});

test('view presets match the approved spike framing', () => {
  expect(VIEW_DIR).toEqual([85, 200, 190]);
  expect(VIEWS.board).toEqual({ target: [-37, 3, 4], zoom: 1.55 });
  expect(VIEWS.circuit).toEqual({ target: [4, 0, 5], zoom: 1.0 });
});

test('rotating about the target keeps the distance and height', () => {
  const p = orbitAround([10, 50, 0], [0, 0, 0], Math.PI / 2);
  expect(p[0]).toBeCloseTo(0, 6);
  expect(p[1]).toBe(50);
  expect(p[2]).toBeCloseTo(-10, 6);
});

test('zoom steps stay within the allowed range', () => {
  expect(clampZoom(1 * 1.25)).toBeCloseTo(1.25, 6);
  expect(clampZoom(6.5 * 1.25)).toBe(MAX_ZOOM);
  expect(clampZoom(0.1)).toBe(MIN_ZOOM);
});

test('you can zoom out far enough to see a whole bench with its props', () => {
  expect(MIN_ZOOM).toBeLessThanOrEqual(0.3); // about three times more of the bench than before
});

// where a box's corners land on screen for a camera looking at `target` from VIEW_DIR at this zoom
function onScreen(box: THREE.Box3, target: [number, number, number], zoom: number, aspect: number) {
  const z = new THREE.Vector3(...VIEW_DIR).normalize(), right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize(), up = new THREE.Vector3().crossVectors(z, right);
  const t = new THREE.Vector3(...target), { halfW, halfH } = fitOrtho(aspect);
  let maxX = 0, maxY = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const zz of [box.min.z, box.max.z]) {
    const d = new THREE.Vector3(x, y, zz).sub(t);
    maxX = Math.max(maxX, Math.abs(d.dot(right)) * zoom / halfW);
    maxY = Math.max(maxY, Math.abs(d.dot(up)) * zoom / halfH);
  }
  return { maxX, maxY };
}

test('"fit everything" puts the whole box in view, filling it', () => {
  for (const aspect of [16 / 9, 390 / 844, 844 / 390]) {
    const box = new THREE.Box3(new THREE.Vector3(-90, 0, -80), new THREE.Vector3(160, 40, 120));
    const f = fitView(box, aspect, 0.08);
    const { maxX, maxY } = onScreen(box, f.target, f.zoom, aspect);
    expect(Math.max(maxX, maxY), `aspect ${aspect}`).toBeLessThanOrEqual(1);       // nothing outside the view
    expect(Math.max(maxX, maxY), `aspect ${aspect}`).toBeGreaterThan(0.85);        // and the view is used
  }
});

test('"fit everything" centres what is off to one side', () => {
  const near = new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10));
  const far = near.clone().translate(new THREE.Vector3(300, 0, -200));
  const a = fitView(near, 1.5), b = fitView(far, 1.5);
  expect(b.target[0]).toBeGreaterThan(a.target[0] + 100);
  expect(b.zoom).toBeCloseTo(a.zoom, 5);   // same size, same zoom
});

test('"fit everything" never zooms beyond the allowed range', () => {
  const huge = new THREE.Box3(new THREE.Vector3(-5000, 0, -5000), new THREE.Vector3(5000, 100, 5000));
  expect(fitView(huge, 1.5).zoom).toBe(MIN_ZOOM);
  const tiny = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.1, 0.1));
  expect(fitView(tiny, 1.5).zoom).toBe(MAX_ZOOM);
});
