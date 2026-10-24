import * as THREE from 'three';

// A part is an outer pivot (at the part's centre, carrying userData) and an inner group offset back by the
// centre, so children keep using the parent's coordinates while lift and scale happen about the centre.
export function makePart(parent: THREE.Object3D, partId: string, kind: string, center: THREE.Vector3): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.copy(center);
  pivot.userData = { partId, kind, baseY: center.y };
  const inner = new THREE.Group();
  inner.position.copy(center).negate();
  pivot.add(inner);
  parent.add(pivot);
  return inner;
}

export function findPart(obj: THREE.Object3D | null): { partId: string; kind: string; pivot: THREE.Object3D } | null {
  for (let o = obj; o; o = o.parent) if (o.userData?.partId) return { partId: o.userData.partId, kind: o.userData.kind, pivot: o };
  return null;
}
