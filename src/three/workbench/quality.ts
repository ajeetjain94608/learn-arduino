// pixelRatio is a cap: the renderer uses min(devicePixelRatio, cap).
export type Quality = { pixelRatio: number; shadowMapSize: 512 | 1024 | 2048; msaaSamples: 0 | 4; surfacePx: 24 | 36 };
export type Tier = 'desktop' | 'phone' | 'low';

export const TIERS: Record<Tier, Quality> = {
  desktop: { pixelRatio: 2, shadowMapSize: 2048, msaaSamples: 4, surfacePx: 36 },
  phone: { pixelRatio: 2, shadowMapSize: 1024, msaaSamples: 4, surfacePx: 36 },
  low: { pixelRatio: 1.5, shadowMapSize: 512, msaaSamples: 0, surfacePx: 24 },
};
const ORDER: Tier[] = ['desktop', 'phone', 'low'];

type DeviceInfo = { dpr: number; coarsePointer: boolean; maxTextureSize: number; deviceMemory?: number };

export function detectTier(i: DeviceInfo): Tier {
  // Almost every WebGL2 Android GPU reports textures ≥ 4096, so memory (navigator.deviceMemory, GB) is the useful signal.
  if (i.maxTextureSize < 4096 || i.dpr > 3 || (i.deviceMemory !== undefined && i.deviceMemory <= 3)) return 'low';
  return i.coarsePointer ? 'phone' : 'desktop';
}

export function detectQuality(i: DeviceInfo): Quality {
  const q = TIERS[detectTier(i)];
  return { ...q, pixelRatio: Math.min(i.dpr, q.pixelRatio) };
}

// ?quality=low|phone|desktop forces a tier (device testing; Stage 8 adds it to Settings).
export function resolveQuality(search: string, detected: Tier): { tier: Tier; quality: Quality } {
  const forced = new URLSearchParams(search).get('quality');
  const tier = ORDER.includes(forced as Tier) ? (forced as Tier) : detected;
  return { tier, quality: TIERS[tier] };
}

export const nextTier = (t: Tier): Tier => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];

// Reads the device once at startup. The probe context is released straight away.
export function detectDeviceTier(): Tier {
  let maxTextureSize = 4096;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) {
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // keep the conservative default
  }
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return detectTier({ dpr: window.devicePixelRatio || 1, coarsePointer, maxTextureSize, deviceMemory });
}
