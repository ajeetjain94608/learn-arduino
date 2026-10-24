import { expect, test } from 'vitest';
import { detectQuality } from './quality';

test('desktop gets the full-quality tier', () => {
  expect(detectQuality({ dpr: 1, coarsePointer: false, maxTextureSize: 16384 })).toEqual({ pixelRatio: 1, shadowMapSize: 2048, msaaSamples: 4, surfacePx: 36 });
});

test('phones cap pixel ratio at 2 and use a smaller shadow map', () => {
  expect(detectQuality({ dpr: 3, coarsePointer: true, maxTextureSize: 8192 })).toEqual({ pixelRatio: 2, shadowMapSize: 1024, msaaSamples: 4, surfacePx: 36 });
});

test('very high DPR drops to the low tier', () => {
  expect(detectQuality({ dpr: 3.5, coarsePointer: true, maxTextureSize: 8192 })).toEqual({ pixelRatio: 1.5, shadowMapSize: 512, msaaSamples: 0, surfacePx: 24 });
});

test('weak GPUs (small max texture) drop to the low tier', () => {
  expect(detectQuality({ dpr: 2, coarsePointer: true, maxTextureSize: 2048 })).toEqual({ pixelRatio: 1.5, shadowMapSize: 512, msaaSamples: 0, surfacePx: 24 });
});
