import * as THREE from "three";

/** Fit the reference front-oblique view to the actual viewport, not a square sphere. */
export function campusOverview(box: THREE.Box3, fov: number, aspect: number) {
  const center = box.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(4, 58, 87).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tanX = tanY * Math.max(aspect, 0.01);
  let distance = 8;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center);
    const depth = corner.dot(direction);
    distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / tanX, depth + Math.abs(corner.dot(up)) / tanY);
  }
  return { target: center, position: center.clone().addScaledVector(direction, distance * 1.12) };
}
