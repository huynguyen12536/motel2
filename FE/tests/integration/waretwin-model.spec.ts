import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prepareCampusModel, campusZoneForObject, disposeCampusMaterials } from "../../src/features/warehouse/3d/campus-model";
import { CAMPUS_BUILDINGS, CAMPUS_MODEL_URL } from "../../src/features/warehouse/config/warehouse-campus";

const bytes = readFileSync(`public${CAMPUS_MODEL_URL}`);
const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));

test("WareTwin GLB records attribution and contains no shell or mezzanine", () => {
  expect(json.scenes[0].extras).toMatchObject({
    sourceCommit: "81f365f323e1a097e5819ca9045637544163f219",
    license: "MIT", millimetersPerUnit: 1000, openPlan: true,
    racksPerBuilding: 160, templateCopies: true,
  });
  expect(json.nodes.filter((node: { name: string }) => /Roof|Ceiling|Wall|Mezzanine/.test(node.name))).toEqual([]);
  expect(json.scenes[0].nodes.map((id: number) => json.nodes[id].name)).toEqual(["Warehouse_A", "Warehouse_B", "Warehouse_C"]);
  expect(json.extensionsUsed).toContain("EXT_mesh_gpu_instancing");
  expect(bytes.byteLength).toBeLessThan(4 * 1024 * 1024);
});

for (const id of CAMPUS_BUILDINGS) {
  test(`Three.js loads WareTwin ${id}, fits one 100x70m floor, and retains instancing`, async () => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    const isolated = prepareCampusModel(gltf.scene, id);
    expect(isolated.children.map((child) => child.name)).toEqual([`Warehouse_${id}`]);
    const floor = isolated.getObjectByName(`Warehouse_${id}_Floor`)!;
    const size = new THREE.Box3().setFromObject(floor).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(100);
    expect(size.z).toBeCloseTo(70);
    let instances = 0;
    isolated.traverse((object) => {
      if ((object as THREE.InstancedMesh).isInstancedMesh) instances++;
      expect(campusZoneForObject(object)).toBeNull();
    });
    expect(instances).toBe(62);
    expect(isolated.children[0].userData).toMatchObject({ rackCount: 160, cartonCount: 915, illustrative: true });
    const labels = isolated.children[0].userData.labels as {text: string; kind: string}[];
    expect(labels.filter((label) => label.kind === "rack")).toHaveLength(160);
    expect(new Set(labels.filter((label) => label.kind === "rack").map((label) => label.text)).size).toBe(160);
    expect(labels.map((label) => label.text)).toContain("FORKLIFT");
    expect(isolated.getObjectByName(`EquipmentAndRackLettering_${id}`)).toBeDefined();
    expect(isolated.getObjectByName(`Forklift_${id}`)).toBeDefined();
    disposeCampusMaterials(isolated);
    expect(gltf.scene.children).toHaveLength(3);
  });
}
