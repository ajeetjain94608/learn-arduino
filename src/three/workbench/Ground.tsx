import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useThemeStore } from '../../theme/themeStore';
import { THEMES } from '../../theme/themes';
import { noOutline } from '../shared/layers';

// Workbench floor: theme background, a fine + major grid, and a shadow catcher.
export function Ground() {
  const theme = useThemeStore((s) => s.theme);
  const t = THEMES[theme].scene;
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => { scene.background = new THREE.Color(t.bg); }, [scene, t.bg]);

  const grids = useMemo(() => {
    const fine = new THREE.GridHelper(1200, 240, t.gridFine, t.gridFine);
    const major = new THREE.GridHelper(1200, 48, t.gridMajor, t.gridMajor);
    fine.position.y = 0.02;
    major.position.y = 0.03;
    return [noOutline(fine), noOutline(major)];
  }, [t.gridFine, t.gridMajor]);
  useLayoutEffect(() => () => grids.forEach((g) => g.geometry.dispose()), [grids]);

  const shadowCatcher = useMemo(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShadowMaterial());
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return noOutline(m);
  }, []);
  useLayoutEffect(() => {
    const mat = shadowCatcher.material as THREE.ShadowMaterial;
    mat.color.set(t.shadow);
    mat.opacity = t.shadowOpacity;
  }, [shadowCatcher, t.shadow, t.shadowOpacity]);

  return (
    <>
      <primitive object={shadowCatcher} />
      {grids.map((g) => <primitive key={g.uuid} object={g} />)}
    </>
  );
}
