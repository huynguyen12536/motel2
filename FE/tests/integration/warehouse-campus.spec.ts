import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { prepareCampusModel, campusZoneForObject } from "../../src/features/warehouse/3d/campus-model";
import { campusMillimetersToUnits, CAMPUS_BUILDINGS, CAMPUS_MODEL_URL } from "../../src/features/warehouse/config/warehouse-campus";

function loadGlbJson() {
  const bytes = readFileSync(`public${CAMPUS_MODEL_URL}`);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
}

test("open campus contains exactly three buildings and no shell or outbuildings", () => {
  const json = loadGlbJson();
  const names = json.nodes.map((node: { name: string }) => node.name);
  expect(names.filter((name: string) => /^Warehouse_[ABC]$/.test(name))).toEqual(["Warehouse_A", "Warehouse_B", "Warehouse_C"]);
  expect(names.filter((name: string) => /Roof|Ceiling|Wall|Facade|Door|Shutter|Gatehouse|Truss|Gable/.test(name))).toEqual([]);
  const roots = json.scenes[0].nodes.map((id: number) => json.nodes[id].name);
  expect(roots.sort()).toEqual(["Warehouse_A", "Warehouse_B", "Warehouse_C"]);
  expect(json.scenes[0].extras).toMatchObject({ millimetersPerUnit: 1000, openPlan: true });
});

test("floors preserve existing dimensions with 1000 mm per scene unit", () => {
  const json = loadGlbJson();
  for (const id of CAMPUS_BUILDINGS) {
    const node = json.nodes.find((item: { name: string }) => item.name === `Warehouse_${id}_Floor`);
    const geometry = json.accessors[json.meshes[node.mesh].primitives[0].attributes.POSITION];
    expect(geometry.max[0] - geometry.min[0]).toBe(campusMillimetersToUnits(100000));
    expect(geometry.max[2] - geometry.min[2]).toBe(campusMillimetersToUnits(70000));
  }
});

for (const id of CAMPUS_BUILDINGS) {
  test(`isolation of ${id} removes other buildings from camera bounds, without changing source`, () => {
    const source = new THREE.Group();
    for (const name of ["CampusGround", "Warehouse_A", "Warehouse_B", "Warehouse_C"]) {
      const group = new THREE.Group(); group.name = name; source.add(group);
    }
    const isolated = prepareCampusModel(source, id);
    expect(isolated.children.map((child) => child.name)).toEqual([`Warehouse_${id}`]);
    expect(source.children).toHaveLength(4);
  });
}

test("zone picking still resolves a batched rack to its containing zone", () => {
  const zone = new THREE.Group(); zone.name = "Zone_C";
  const mesh = new THREE.Object3D(); mesh.name = "MergedRack"; zone.add(mesh);
  expect(campusZoneForObject(mesh)).toBe("zone-c");
  expect(campusMillimetersToUnits(1000)).toBe(1);
});
