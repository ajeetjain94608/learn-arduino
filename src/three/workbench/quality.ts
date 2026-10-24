export type Quality = { pixelRatio: number; shadowMapSize: 512 | 1024 | 2048; msaaSamples: 0 | 4; surfacePx: 24 | 36 };

export function detectQuality(i: { dpr: number; coarsePointer: boolean; maxTextureSize: number }): Quality {
  if (i.maxTextureSize < 4096 || i.dpr > 3) return { pixelRatio: Math.min(i.dpr, 1.5), shadowMapSize: 512, msaaSamples: 0, surfacePx: 24 };
  if (i.coarsePointer) return { pixelRatio: Math.min(i.dpr, 2), shadowMapSize: 1024, msaaSamples: 4, surfacePx: 36 };
  return { pixelRatio: Math.min(i.dpr, 2), shadowMapSize: 2048, msaaSamples: 4, surfacePx: 36 };
}

// Reads the device once; cheap enough to call at startup.
export function deviceQuality(): Quality {
  let maxTextureSize = 4096;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  } catch {
    // keep the conservative default
  }
  return detectQuality({ dpr: window.devicePixelRatio || 1, coarsePointer: matchMedia('(pointer: coarse)').matches, maxTextureSize });
}
