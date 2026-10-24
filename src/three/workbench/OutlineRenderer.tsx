import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { useThemeStore } from '../../theme/themeStore';
import { THEMES } from '../../theme/themes';
import { LAYER_NO_OUTLINE } from '../shared/layers';
import type { Quality } from './quality';

// Edge detection over view-space normals and (orthographic, hence linear) depth.
const EDGE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    texel: { value: new THREE.Vector2() },
    ink: { value: new THREE.Color() },
    strength: { value: 0.85 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, tNormal, tDepth; uniform vec2 texel; uniform vec3 ink; uniform float strength; varying vec2 vUv;
    float D(vec2 o){ return texture2D(tDepth, vUv + o * texel).x; }
    vec3 N(vec2 o){ return texture2D(tNormal, vUv + o * texel).xyz * 2.0 - 1.0; }
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float d = D(vec2(0.0));
      float dd = max(max(abs(D(vec2(1.,0.)) - d), abs(D(vec2(-1.,0.)) - d)), max(abs(D(vec2(0.,1.)) - d), abs(D(vec2(0.,-1.)) - d)));
      vec3 n = N(vec2(0.0));
      float nd = max(max(1.0 - dot(n, N(vec2(1.,0.))), 1.0 - dot(n, N(vec2(-1.,0.)))), max(1.0 - dot(n, N(vec2(0.,1.))), 1.0 - dot(n, N(vec2(0.,-1.)))));
      float e = max(smoothstep(0.0006, 0.0014, dd), smoothstep(0.12, 0.35, nd));
      gl_FragColor = vec4(mix(col.rgb, ink, e * strength), col.a);
    }`,
};

// Takes over rendering: normals+depth pass, then colour pass with ink outlines composited on top.
export function OutlineRenderer({ quality }: { quality: Quality }) {
  const { gl, scene, camera, size } = useThree();
  const theme = useThemeStore((s) => s.theme);

  const pipeline = useMemo(() => {
    const normalRT = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1), type: THREE.HalfFloatType });
    const composer = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.msaaSamples }));
    composer.addPass(new RenderPass(scene, camera));
    const edges = new ShaderPass(EDGE_SHADER);
    // ShaderPass clones its uniforms and drops render-target textures, so bind them afterwards.
    edges.uniforms.tNormal.value = normalRT.texture;
    edges.uniforms.tDepth.value = normalRT.depthTexture;
    composer.addPass(edges);
    composer.addPass(new OutputPass());
    return { normalRT, composer, edges, normalMat: new THREE.MeshNormalMaterial() };
  }, [gl, scene, camera, quality.msaaSamples]);

  useEffect(() => () => { pipeline.normalRT.dispose(); pipeline.composer.dispose(); pipeline.normalMat.dispose(); }, [pipeline]);

  useEffect(() => {
    const pr = gl.getPixelRatio();
    pipeline.composer.setPixelRatio(pr);
    pipeline.composer.setSize(size.width, size.height);
    pipeline.normalRT.setSize(Math.floor(size.width * pr), Math.floor(size.height * pr));
    (pipeline.edges.uniforms.texel.value as THREE.Vector2).set(1 / (size.width * pr), 1 / (size.height * pr)).multiplyScalar(pr > 1.5 ? 1.25 : 1);
  }, [gl, size.width, size.height, pipeline]);

  useEffect(() => { (pipeline.edges.uniforms.ink.value as THREE.Color).set(THEMES[theme].scene.ink); }, [theme, pipeline]);

  useFrame(() => {
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = pipeline.normalMat;
    camera.layers.disable(LAYER_NO_OUTLINE);
    gl.setRenderTarget(pipeline.normalRT);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    camera.layers.enable(LAYER_NO_OUTLINE);
    scene.overrideMaterial = null;
    scene.background = bg;
    pipeline.composer.render();
  }, 1);

  return null;
}
