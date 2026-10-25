// Renders project-card pictures (transparent PNG) from the same 3D builders the app uses, with the same
// lighting, baked room reflections and ink outlines. Driven by tools/bake-thumbs.mjs.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildUnoBoard } from '../src/three/boards/uno/UnoBoard';
import { buildLed5mm } from '../src/three/parts/Led5mm';
import { LAYER_NO_OUTLINE } from '../src/three/shared/layers';
import { loadBakedEnvironment } from '../src/three/workbench/bakedEnvironment';
import { VIEW_DIR } from '../src/three/workbench/cameraViews';
import envUrl from '../src/three/workbench/env/room-env.bin?url';
import { EDGE_SHADER } from '../src/three/workbench/OutlineRenderer';

const W = 320, H = 224, PAD = 0.1, INK = '#122036';

async function render(build: () => THREE.Object3D, viewDir: [number, number, number] = VIEW_DIR): Promise<string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = await loadBakedEnvironment(envUrl);
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight('#FFF9EF', '#B9AC93', 1.35));
  const sun = new THREE.DirectionalLight('#FFF4E2', 1.9);
  sun.position.set(-60, 170, 110);
  scene.add(sun);
  const obj = build();
  scene.add(obj);

  // Frame the object from the app's camera direction, tightly, with a little padding.
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  camera.position.copy(center).add(new THREE.Vector3(...viewDir).normalize().multiplyScalar(500));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const v = new THREE.Vector3(), lo = new THREE.Vector2(Infinity, Infinity), hi = new THREE.Vector2(-Infinity, -Infinity);
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    lo.min(new THREE.Vector2(v.x, v.y)); hi.max(new THREE.Vector2(v.x, v.y));
  }
  let halfW = ((hi.x - lo.x) / 2) * (1 + PAD), halfH = ((hi.y - lo.y) / 2) * (1 + PAD);
  if (halfW / halfH > W / H) halfH = halfW / (W / H); else halfW = halfH * (W / H);
  const cx = (hi.x + lo.x) / 2, cy = (hi.y + lo.y) / 2;
  Object.assign(camera, { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH });
  camera.updateProjectionMatrix();
  camera.layers.enable(LAYER_NO_OUTLINE);

  // Same ink-outline pipeline as the app's OutlineRenderer.
  const normalRT = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H), type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const edges = new ShaderPass(EDGE_SHADER);
  edges.uniforms.tNormal.value = normalRT.texture;
  edges.uniforms.tDepth.value = normalRT.depthTexture;
  (edges.uniforms.texel.value as THREE.Vector2).set(1 / W, 1 / H);
  (edges.uniforms.ink.value as THREE.Color).set(INK);
  composer.addPass(edges);
  composer.addPass(new OutputPass());

  scene.overrideMaterial = new THREE.MeshNormalMaterial();
  camera.layers.disable(LAYER_NO_OUTLINE);
  renderer.setRenderTarget(normalRT);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  camera.layers.enable(LAYER_NO_OUTLINE);
  scene.overrideMaterial = null;
  composer.render();
  return renderer.domElement.toDataURL('image/png');
}

const thumbs = {
  uno: await render(() => buildUnoBoard(36, 8).group),
  'led-red': await render(() => {
    const led = buildLed5mm('red');
    led.g.remove(led.halo); // the glow would swamp a small picture
    led.epoxy.emissiveIntensity = 0.7;
    led.epoxy.opacity = 0.9;
    return led.g;
  }, [60, 55, 190]), // lower, more side-on than the bench camera so the LED reads as an LED
};
(window as unknown as { __thumbs: Record<string, string> }).__thumbs = thumbs;
document.body.textContent = `baked ${Object.keys(thumbs).join(', ')}`;
