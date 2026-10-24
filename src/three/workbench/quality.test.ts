import { expect, test } from 'vitest';
import { detectQuality, nextTier, resolveQuality, TIERS } from './quality';

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

test('phones with little memory get the low tier (most Android GPUs report large textures, so size alone never triggers it)', () => {
  expect(detectQuality({ dpr: 2.75, coarsePointer: true, maxTextureSize: 16384, deviceMemory: 3 })).toEqual(TIERS.low);
  expect(detectQuality({ dpr: 2.75, coarsePointer: true, maxTextureSize: 16384, deviceMemory: 8 })).toEqual(TIERS.phone);
});

test('a quality can be forced for testing on a device', () => {
  expect(resolveQuality('?quality=low', 'phone')).toEqual({ tier: 'low', quality: TIERS.low });
  expect(resolveQuality('?test&quality=desktop', 'low')).toEqual({ tier: 'desktop', quality: TIERS.desktop });
  expect(resolveQuality('?quality=ultra', 'phone')).toEqual({ tier: 'phone', quality: TIERS.phone });
  expect(resolveQuality('', 'phone').tier).toBe('phone');
});

test('the fps chip cycles through the tiers', () => {
  expect(nextTier('desktop')).toBe('phone');
  expect(nextTier('phone')).toBe('low');
  expect(nextTier('low')).toBe('desktop');
});
