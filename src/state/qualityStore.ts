import { create } from 'zustand';
import { detectDeviceTier, nextTier, resolveQuality, TIERS, type Quality, type Tier } from '../three/workbench/quality';

// One quality setting shared by the renderer and the scene (texture sizes). Detected once, optionally forced.
export const useQualityStore = create<{ tier: Tier; quality: Quality; cycle(): void }>((set, get) => {
  const initial = resolveQuality(location.search, detectDeviceTier());
  return {
    ...initial,
    cycle: () => { const tier = nextTier(get().tier); set({ tier, quality: TIERS[tier] }); },
  };
});
