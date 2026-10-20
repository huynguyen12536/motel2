import * as THREE from "three";
import { CAMPUS_ZONES, type CampusView } from "@/features/warehouse/config/warehouse-campus";

export function prepareCampusModel(source: THREE.Group, view: CampusView) {
  const root = source.clone(true);
  // Remove, rather than hide, other buildings so bounds and camera fit stay exact.
  root.children.slice().forEach((child) => {
    const keep = child.name === `Warehouse_${view}`;
    if (!keep) root.remove(child);
  });
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone()) : object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return root;
}

export function campusZoneForObject(object: THREE.Object3D): string | null {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    for (const [name, zone] of Object.entries(CAMPUS_ZONES)) {
      if (node.name === name || node.name.startsWith(`${name}_`)) return zone;
    }
  }
  return null;
}

export function disposeCampusMaterials(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  materials.forEach((material) => material.dispose());
}
