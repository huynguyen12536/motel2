import * as THREE from "three";

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

/** Camera-relative movement in scene units (meters) per second, not keyboard repeats. */
export function keyboardTravel(
  camera: THREE.Camera,
  plane: "3d" | "oxy" | "oxz" | "oyz",
  held: ReadonlySet<string>,
  seconds: number,
  out: THREE.Vector3,
) {
  const horizontal = Number(held.has("d")) - Number(held.has("a"));
  const vertical = Number(held.has("w")) - Number(held.has("s"));
  out.set(0, 0, 0);
  if (!horizontal && !vertical) return out;
  if (plane === "oxy") out.set(horizontal, vertical, 0);
  else if (plane === "oyz") out.set(0, vertical, horizontal);
  else {
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    // A ground-plane perpendicular stays stable even when looking nearly straight down.
    forward.set(right.z, 0, -right.x);
    out.addScaledVector(right, horizontal).addScaledVector(forward, vertical);
  }
  // Normalize diagonals; clamp long frames to avoid teleporting after a stalled tab.
  return out.normalize().multiplyScalar(12 * (held.has("shift") ? 2.5 : 1) * Math.min(Math.max(seconds, 0), 0.05));
}
