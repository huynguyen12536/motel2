// Geometry/layout adapted from Wayne Chou's WareTwin (MIT).
// See scripts/vendor/waretwin/LICENSE and public/models/warehouse/WARETWIN.md.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

class NodeFileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => { this.result = value; this.onloadend?.(); });
  }
}
globalThis.FileReader ??= NodeFileReader;
const layout = JSON.parse(await readFile(new URL("./vendor/waretwin/warehouse_layout.json", import.meta.url), "utf8"));
const sourceCommit = "81f365f323e1a097e5819ca9045637544163f219";
if (layout.units !== "m") throw new Error("Expected WareTwin coordinates in meters");
const scene = new THREE.Scene();
scene.name = "WareTwin_Open_Warehouse_Templates";
const groundRacks = layout.racks.filter((rack) => (rack.floor ?? 1) === 1);
scene.userData = {
  source: "https://github.com/WayneChou-bot/WareTwin", sourceCommit, license: "MIT",
  units: "meters", millimetersPerUnit: 1000, openPlan: true,
  buildings: ["A", "B", "C"], templateCopies: true,
  width: layout.size.width, depth: layout.size.depth, racksPerBuilding: groundRacks.length,
  scope: "Static ground-floor layout and labeled equipment; no shell, mezzanine, simulation or business-zone mapping",
};
const cube = new THREE.BoxGeometry();
const dummy = new THREE.Object3D();
const buckets = new Map();
const template = new THREE.Group();
const labelPositions = [];
const labels = [];
// Local 5x7 sign lettering: no network fonts, textures, or hundreds of HTML overlays.
const glyphs = {
  A:[14,17,17,31,17,17,17], B:[30,17,17,30,17,17,30], C:[14,17,16,16,16,17,14],
  D:[30,17,17,17,17,17,30], E:[31,16,16,30,16,16,31], F:[31,16,16,30,16,16,16],
  G:[14,17,16,23,17,17,15], H:[17,17,17,31,17,17,17], I:[14,4,4,4,4,4,14],
  J:[7,2,2,2,18,18,12], K:[17,18,20,24,20,18,17], L:[16,16,16,16,16,16,31],
  M:[17,27,21,21,17,17,17], N:[17,25,21,19,17,17,17], O:[14,17,17,17,17,17,14],
  P:[30,17,17,30,16,16,16], Q:[14,17,17,17,21,18,13], R:[30,17,17,30,20,18,17],
  S:[15,16,16,14,1,1,30], T:[31,4,4,4,4,4,4], U:[17,17,17,17,17,17,14],
  V:[17,17,17,17,17,10,4], W:[17,17,17,21,21,21,10], X:[17,17,10,4,10,17,17],
  Y:[17,17,10,4,4,4,4], Z:[31,1,2,4,8,16,31],
  0:[14,17,19,21,25,17,14], 1:[4,12,4,4,4,4,14], 2:[14,17,1,2,4,8,31],
  3:[30,1,1,14,1,1,30], 4:[2,6,10,18,31,2,2], 5:[31,16,16,30,1,1,30],
  6:[14,16,16,30,17,17,14], 7:[31,1,2,4,8,8,8], 8:[14,17,17,14,17,17,14],
  9:[14,17,17,15,1,1,14], "-":[0,0,0,31,0,0,0], " ":[0,0,0,0,0,0,0],
};
function sign(text, position, width = 2.8, kind = "equipment") {
  text = text.toUpperCase();
  const [x, y, z] = position;
  const pixel = Math.min((width - 0.2) / (text.length * 6 - 1), 0.09);
  const height = pixel * 7 + 0.15;
  box(template, "Nameplates", "#172c45", [width, 0.03, height], position);
  const startX = x - (text.length * 6 - 1) * pixel / 2;
  const startZ = z - pixel * 7 / 2;
  for (const [i, letter] of [...text].entries()) {
    const rows = glyphs[letter];
    if (!rows) throw new Error(`Unsupported sign character ${letter}`);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!(rows[row] & (1 << (4 - col)))) continue;
        const left = startX + (i * 6 + col) * pixel, top = startZ + row * pixel;
        const right = left + pixel * 0.9, bottom = top + pixel * 0.9;
        labelPositions.push(left,y+0.02,top, left,y+0.02,bottom, right,y+0.02,top, right,y+0.02,top, left,y+0.02,bottom, right,y+0.02,bottom);
      }
    }
  }
  labels.push({ text, kind, position });
}
function box(parent, kind, color, size, position, rotation = 0) {
  const key = `${parent.uuid}:${kind}:${color}`;
  let bucket = buckets.get(key);
  if (!bucket) { bucket = { parent, kind, color, matrices: [] }; buckets.set(key, bucket); }
  dummy.position.set(...position); dummy.scale.set(...size); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix();
  bucket.matrices.push(dummy.matrix.clone());
}
function group(name) { const g = new THREE.Group(); g.name = name; template.add(g); return g; }
const floor = new THREE.Mesh(new THREE.BoxGeometry(layout.size.width, 0.12, layout.size.depth), new THREE.MeshStandardMaterial({ color: "#d7dee5", roughness: 0.9 }));
floor.name = "WareTwin_Floor";
floor.position.set(layout.size.width / 2, -0.06, layout.size.depth / 2);
template.add(floor);
const palette = ["#b8834a", "#c99a63", "#a87440", "#d2a874", "#9c6b3c"];
let seed = 1234;
function random() {
  let t = seed += 0x6d2b79f5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
let boxCount = 0;
for (const zone of layout.zones.filter((z) => (z.floor ?? 1) === 1)) {
  const parent = group(`WareTwinZone_${zone.id}`);
  const racks = groundRacks.filter((r) => r.zone === zone.id);
  parent.userData = { sourceZone: zone.id, rackCount: racks.length, illustrative: true };
  for (const rack of racks) {
    const [x, , z] = rack.position, [w, h, d] = rack.size;
    if (rack.rotation !== 0) throw new Error(`Unimplemented rack rotation: ${rack.id}`);
    const levelH = h / rack.levels;
    sign(rack.id, [x + w / 2, h + 0.12, z + d / 2], w, "rack");
    for (const [dx, dz] of [[0, 0], [w, 0], [0, d], [w, d]])
      box(parent, "RackPosts", "#2f3a4a", [0.1, h, 0.1], [x + dx, h / 2, z + dz]);
    for (let l = 0; l < rack.levels; l++) {
      const y = l * levelH + 0.05;
      for (const dz of [0.02, d - 0.02]) box(parent, "RackBeams", "#e07a1f", [w, 0.1, 0.08], [x + w / 2, y, z + dz]);
      box(parent, "RackBeams", "#e07a1f", [w, 0.04, d], [x + w / 2, y - 0.02, z + d / 2]);
      for (let s = 0; s < 2; s++) {
        if (random() > 0.72) continue;
        const bw = 1.1 + random() * 0.3, bh = Math.min(levelH - 0.25, 0.7 + random() * 0.6);
        const angle = (random() - 0.5) * 0.08;
        const color = palette[Math.floor(random() * palette.length)];
        box(parent, "Cartons", color, [bw, bh, d - 0.2], [x + 0.75 + s * 1.5, y + bh / 2 + 0.03, z + d / 2], angle);
        boxCount++;
      }
    }
  }
}
const fixtures = group("WareTwinFixtures");
for (const c of layout.conveyors) {
  sign(c.id, [c.path[0][0], 2, c.path[0][1]], 2.4);
  for (let i = 0; i < c.path.length - 1; i++) {
    const [ax, az] = c.path[i], [bx, bz] = c.path[i + 1];
    const length = Math.hypot(bx - ax, bz - az), angle = Math.atan2(bz - az, bx - ax);
    const at = (x, y, z) => [(ax + bx) / 2 + Math.cos(angle) * x - Math.sin(angle) * z, y, (az + bz) / 2 + Math.sin(angle) * x + Math.cos(angle) * z];
    box(fixtures, "ConveyorBelt", "#1f2937", [length, 0.12, c.width], at(0, 0.8, 0), -angle);
    for (const side of [-1, 1]) box(fixtures, "ConveyorRail", "#4b5563", [length, 0.3, 0.1], at(0, 0.75, side * (c.width + 0.12) / 2), -angle);
    const supports = Math.max(2, Math.floor(length / 3));
    for (let k = 0; k < supports; k++) box(fixtures, "ConveyorLegs", "#374151", [0.12, 0.74, c.width], at(-length / 2 + 1 + k * (length - 2) / (supports - 1), 0.37, 0), -angle);
    const parcels = Math.max(2, Math.floor(length / 5));
    for (let k = 0; k < parcels; k++) box(fixtures, "Parcels", "#c49a6c", [0.7, 0.5, 0.6], at(-length / 2 + (k + 0.5) * length / parcels, 1.11, 0), -angle);
    for (const point of [c.path[i], c.path[i + 1]]) box(fixtures, "ConveyorTerminals", "#39424f", [1.6, 1.5, 1.6], [point[0], 0.75, point[1]]);
  }
}
function rectSurface(rect, name, color, y = 0.008) {
  const [x0, z0, x1, z1] = rect;
  box(fixtures, name, color, [x1 - x0, 0.008, z1 - z0], [(x0 + x1) / 2, y, (z0 + z1) / 2]);
}
for (const station of layout.stations) {
  const [x0, z0, x1, z1] = station.rect;
  rectSurface(station.rect, "StationPads", "#b4c9db");
  for (let i = 0; i < Math.floor((x1 - x0) / 4); i++) {
    const x = x0 + 2 + i * 4, z = (z0 + z1) / 2;
    box(fixtures, "Workstations", "#334155", [2.4, 0.9, 1.2], [x, 0.45, z]);
    box(fixtures, "Parcels", "#c49a6c", [0.8, 0.5, 0.7], [x, 1.15, z]);
    if (station.kind === "PACKING" && i % 2 === 0) {
      const arm = new THREE.Group(); arm.name = "PackingArm"; arm.position.set(x + 1.6, 0, z); template.add(arm);
      const metal = new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.5, roughness: 0.3 });
      for (const [height, length, angle, offset] of [[1.2, 1.8, 0.35, 0], [2.1, 1.5, -0.9, -0.5]]) {
        const segment = new THREE.Mesh(new THREE.BoxGeometry(0.3, length, 0.3), metal);
        segment.position.set(offset, height, 0); segment.rotation.z = angle; arm.add(segment);
      }
      box(fixtures, "PackingArmBases", "#1f2937", [0.8, 0.6, 0.8], [x + 1.6, 0.3, z]);
    }
  }
  sign(station.id, [(x0 + x1) / 2, 2.9, z1 - 0.7], 4);
}
for (const dock of layout.docks) {
  rectSurface(dock.rect, "DockPads", dock.kind === "INBOUND" ? "#a9c9bb" : "#adc4df");
  sign(dock.id, [dock.door[0], 0.08, 1], 5);
  box(fixtures, "TruckTrailers", "#d9dee7", [2.6, 3.2, 9], [dock.door[0], 1.9, -4.75]);
}
for (const charging of layout.charging_stations) {
  const [x, , z] = charging.position;
  box(fixtures, "ChargingStations", "#1f2937", [0.8, 1.2, 0.4], [x, 0.6, z]);
  box(fixtures, "ChargingIndicators", "#22c55e", [0.5, 0.25, 0.02], [x, 0.9, z + 0.21]);
  sign(charging.id, [x, 1.4, z], 2);
}
// Static AMRs at upstream spawn coordinates: geometry only, not a running fleet.
for (const robot of layout.spawn.robots.filter((r) => (r.floor ?? 1) === 1)) {
  const [x, , z] = robot.position;
  box(fixtures, "AMRChassis", "#d7dce6", [0.95, 0.32, 0.68], [x, 0.22, z], -robot.heading);
  box(fixtures, "AMRCovers", "#111827", [0.8, 0.1, 0.58], [x, 0.42, z], -robot.heading);
  box(fixtures, "AMRPlatforms", "#1f2937", [0.6, 0.06, 0.6], [x, 0.5, z]);
  for (const [dx, dz] of [[-0.32,-0.32],[0.32,-0.32],[-0.32,0.32],[0.32,0.32]])
    box(fixtures, "AMRWheels", "#0f172a", [0.24, 0.24, 0.1], [x + dx, 0.12, z + dz]);
  sign(robot.id, [x, 1, z], 1.5);
}
// Forklift from upstream People.tsx; remains stationary.
const forklift = new THREE.Group(); forklift.name = "Forklift"; forklift.position.set(8, 0, 4); forklift.rotation.y = 0.4; template.add(forklift);
box(forklift, "Body", "#f59e0b", [2.2,0.9,1.2], [0,0.6,0]);
box(forklift, "Cab", "#111827", [0.9,1.1,1], [-0.3,1.6,0]);
box(forklift, "Mast", "#374151", [0.12,2.4,1], [1.3,1.2,0]);
for (const z of [-0.45,0.45]) box(forklift, "Forks", "#9ca3af", [1,0.06,0.14], [1.7,0.12,z]);
for (const [x,z] of [[-0.7,-0.6],[0.7,-0.6],[-0.7,0.6],[0.7,0.6]])
  box(forklift, "Wheels", "#0f172a", [0.56,0.56,0.25], [x,0.28,z]);
sign("FORKLIFT", [8,2.6,4], 3);
for (const camera of layout.cameras.filter((c) => (c.floor ?? 1) === 1)) {
  const [x,y,z] = camera.position;
  box(fixtures, "CameraPoles", "#64748b", [0.08,y,0.08], [x,y/2,z]);
  box(fixtures, "Cameras", "#e2e8f0", [0.45,0.25,0.25], [x,y,z]);
  box(fixtures, "CameraLenses", "#0f172a", [0.04,0.17,0.17], [x+0.25,y,z]);
  sign(camera.id, [x,y+0.4,z], 2.6);
}
for (const sensor of layout.sensors.filter((s) => s.position[1] < 7)) {
  box(fixtures, "Sensors", "#22d3ee", [0.22,0.22,0.22], sensor.position);
  sign(sensor.id, [sensor.position[0],sensor.position[1]+0.3,sensor.position[2]], 2.8);
}
for (const zone of layout.zones.filter((z) => (z.floor ?? 1) === 1)) {
  const xs = zone.polygon.map((p) => p[0]), zs = zone.polygon.map((p) => p[1]);
  const x0=Math.min(...xs), x1=Math.max(...xs), z0=Math.min(...zs), z1=Math.max(...zs);
  for (const x of [x0,x1]) box(fixtures,"ZoneLines",zone.color,[0.08,0.014,z1-z0],[x,0.025,(z0+z1)/2]);
  for (const z of [z0,z1]) box(fixtures,"ZoneLines",zone.color,[x1-x0,0.014,0.08],[(x0+x1)/2,0.025,z]);
  sign(`ZONE ${zone.id}`, [(x0+x1)/2,0.08,z0-1], 5);
}
for (const parking of layout.parking) rectSurface(parking.rect, "ParkingPads", "#adb7c4");
for (const area of layout.restricted_areas) rectSurface(area.rect, "RestrictedPads", "#deb5b5");
for (const walk of layout.walkways) {
  const xs = walk.polygon.map((p) => p[0]), zs = walk.polygon.map((p) => p[1]);
  rectSurface([Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], "Walkways", "#e4d99a", 0.016);
}
const letteringGeometry = new THREE.BufferGeometry();
letteringGeometry.setAttribute("position", new THREE.Float32BufferAttribute(labelPositions, 3));
const lettering = new THREE.Mesh(letteringGeometry, new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide }));
lettering.name = "EquipmentAndRackLettering"; template.add(lettering);
for (const { parent, kind, color, matrices } of buckets.values()) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: kind === "RackPosts" ? 0.6 : 0.85, metalness: kind.startsWith("Rack") ? 0.5 : 0.1 });
  const mesh = new THREE.InstancedMesh(cube, material, matrices.length);
  mesh.name = `${parent.name}_${kind}_${color.slice(1)}`;
  matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  parent.add(mesh);
}
for (const [i, id] of ["A", "B", "C"].entries()) {
  const building = template.clone(true);
  building.name = `Warehouse_${id}`;
  building.position.x = i * (layout.size.width + 20);
  building.userData = { illustrative: true, template: "WareTwin ground floor", rackCount: groundRacks.length, cartonCount: boxCount, labels, staticEquipment: true };
  building.getObjectByName("WareTwin_Floor").name = `Warehouse_${id}_Floor`;
  building.getObjectByName("EquipmentAndRackLettering").name = `EquipmentAndRackLettering_${id}`;
  building.getObjectByName("Forklift").name = `Forklift_${id}`;
  scene.add(building);
}
const output = new URL("../public/models/warehouse/", import.meta.url);
await mkdir(output, { recursive: true });
const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
await writeFile(new URL("warehouse-waretwin-open.glb", output), Buffer.from(glb));
console.log(JSON.stringify({ file: fileURLToPath(new URL("warehouse-waretwin-open.glb", output)), bytes: glb.byteLength, racksPerBuilding: groundRacks.length, cartonsPerBuilding: boxCount, instancedBatchesPerBuilding: buckets.size }));
