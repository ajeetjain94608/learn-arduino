import { useThemeStore } from '../../theme/themeStore';
import { THEMES } from '../../theme/themes';
import type { Quality } from './quality';

// Soft, low-contrast light for the matte illustration look.
export function Lights({ quality }: { quality: Quality }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <>
      <hemisphereLight args={['#FFF9EF', '#B9AC93', THEMES[theme].scene.hemi]} />
      <directionalLight
        color="#FFF4E2"
        intensity={1.9}
        position={[-60, 170, 110]}
        castShadow
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.35}
        shadow-radius={4}
      >
        <orthographicCamera attach="shadow-camera" args={[-110, 110, 90, -90, 20, 420]} />
      </directionalLight>
    </>
  );
}
