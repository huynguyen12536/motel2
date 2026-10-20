import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { campusOverview } from "../../src/features/warehouse/3d/campus-camera-fit";

for (const aspect of [0.65, 1.4, 2.4]) {
  test(`overview keeps the entire GLB in frame at aspect ${aspect}`, () => {
    const box = new THREE.Box3(new THREE.Vector3(-50, -3, -42.5), new THREE.Vector3(50, 3, 42.5));
    const fit = campusOverview(box, 36, aspect);
    const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 2000);
    camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const projected = new THREE.Vector3(x, y, z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
  });
}
