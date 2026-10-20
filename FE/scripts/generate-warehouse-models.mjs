import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

class NodeFileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader ??= NodeFileReader;

const outputDir = resolve("public/models/warehouse");
await mkdir(outputDir, { recursive: true });
const openCampus = process.argv.includes("--open-campus");

const specs = [
  { file: "warehouse-raw-materials.glb", kind: "raw", zones: ["Zone_A", "Zone_B", "Zone_C", "Zone_Q"], accent: 0x2f9fc7 },
  { file: "warehouse-packaging.glb", kind: "packaging", zones: ["Zone_P1", "Zone_P2", "Zone_P3"], accent: 0x3fbf98 },
  { file: "warehouse-finished-goods.glb", kind: "finished", zones: ["Zone_F1", "Zone_F2", "Zone_F3", "Zone_F4"], accent: 0x448bd1 },
  { file: "warehouse-quarantine.glb", kind: "quarantine", zones: ["Zone_Q1", "Zone_Q2", "Zone_Q3"], accent: 0xe2a93b },
];

for (const spec of specs) {
  if (openCampus && spec.kind !== "raw") continue;
  if (process.argv.includes("--campus-only") && spec.kind !== "raw") continue;
  const scene = buildWarehouse(spec);
  if (openCampus) {
    // Strip the enclosure before batching: walls otherwise merge with floors/trim.
    scene.children.slice().forEach((child) => {
      if (child.name !== "CampusGround" && !/^Warehouse_[ABC]$/.test(child.name)) scene.remove(child);
    });
    const enclosure = /^(RoofAssembly_|Warehouse_[ABC]_(?:BackWall|LeftWall|RightWall|Window_|Truss_|Dock_)|WallPanelJoint|WallPlinth|Facade|Door|Shutter)/;
    const remove = [];
    scene.traverse((object) => { if (enclosure.test(object.name)) remove.push(object); });
    remove.forEach((object) => object.removeFromParent());
    const floorColors = { A: 0xdce7f0, B: 0xdfece5, C: 0xeee5d5 };
    scene.traverse((object) => {
      const id = /^Warehouse_([ABC])_Floor$/.exec(object.name)?.[1];
      if (id && object instanceof THREE.Mesh) {
        object.material = object.material.clone();
        object.material.color.setHex(floorColors[id]);
      }
    });
    scene.userData = { units: "meters", millimetersPerUnit: 1000, buildings: ["A", "B", "C"], openPlan: true };
  }
  if (spec.kind === "raw") batchStaticMeshes(scene);
  const data = await exportGlb(scene);
  const filename = openCampus ? "warehouse-campus-open.glb" : spec.file;
  await writeFile(resolve(outputDir, filename), Buffer.from(data));
  console.log(`${filename}: ${Math.round(data.byteLength / 1024)} KB`);
}

function material(color, metalness = 0.15, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function box(parent, name, size, position, mat, bevel = false) {
  const geometry = new THREE.BoxGeometry(...size, bevel ? 2 : 1, bevel ? 2 : 1, bevel ? 2 : 1);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildWarehouse(spec) {
  if (spec.kind === "raw") return buildLogisticsCampus(spec);
  if (spec.kind === "cold") return buildColdStorage(spec);

  const scene = new THREE.Scene();
  scene.name = `WMS_${spec.kind}`;
  const concrete = material(0xb7c0c6, 0.05, 0.92);
  const steel = material(0x334b5d, 0.72, 0.32);
  const beam = material(spec.accent, 0.48, 0.38);
  const cardboard = material(spec.kind === "cold" ? 0xcbdce5 : 0xa8733d, 0.03, 0.88);
  const light = new THREE.MeshStandardMaterial({ color: 0xeaf9ff, emissive: 0xbfefff, emissiveIntensity: 1.4, roughness: 0.25 });

  box(scene, "Floor", [31, 0.35, 21], [0, -0.2, 0], concrete);
  box(scene, "BackWall", [31, 5.4, 0.25], [0, 2.5, -10.4], material(spec.kind === "cold" ? 0xd8e6ec : 0x9caab3, 0.2, 0.78));
  box(scene, "LeftWall", [0.25, 5.4, 21], [-15.4, 2.5, 0], material(0x8798a4, 0.22, 0.75));

  for (let x = -12; x <= 12; x += 6) {
    box(scene, `CeilingBeam_${x}`, [0.22, 0.22, 20], [x, 5.05, 0], steel);
    for (const z of [-7, 0, 7]) box(scene, `Light_${x}_${z}`, [2.5, 0.08, 0.34], [x, 4.88, z], light);
  }

  const columns = spec.zones.length;
  const zoneWidth = 27 / columns;
  spec.zones.forEach((zoneName, zoneIndex) => {
    const zone = new THREE.Group();
    zone.name = zoneName;
    zone.position.x = -13.5 + zoneWidth / 2 + zoneIndex * zoneWidth;
    scene.add(zone);
    const rows = spec.kind === "quarantine" ? 2 : 3;
    for (let row = 0; row < rows; row++) {
      createRack(zone, `${zoneName}_Rack_${row + 1}`, row * 6 - 6, Math.min(5.4, zoneWidth - 0.65), steel, beam, cardboard, spec.kind, row);
    }
  });

  if (spec.kind === "cold") {
    for (let x = -11; x <= 11; x += 7.3) {
      const fan = new THREE.Group();
      fan.name = `ColdUnit_${x}`;
      fan.position.set(x, 3.8, -10.1);
      box(fan, `ColdUnitBody_${x}`, [3.2, 1.25, 0.48], [0, 0, 0], material(0xe5eef2, 0.25, 0.5));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 10, 24), steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 0.28;
      fan.add(ring);
      scene.add(fan);
    }
  }

  if (spec.kind === "quarantine") {
    const cage = material(0xe0a72f, 0.62, 0.36);
    for (const x of [-14, 14]) box(scene, `SafetyPost_${x}`, [0.14, 2.3, 0.14], [x, 1.15, 8], cage);
    for (let x = -14; x <= 14; x += 1) box(scene, `SafetyRail_${x}`, [0.035, 2.1, 0.035], [x, 1.1, 8], cage);
    box(scene, "SafetyTop", [28.2, 0.1, 0.1], [0, 2.2, 8], cage);
  }

  const dock = material(0x1f3445, 0.58, 0.4);
  box(scene, "DockPlatform", [7, 0.45, 3.4], [0, 0.05, 8.4], dock);
  for (let x = -2.5; x <= 2.5; x += 2.5) createPallet(scene, `DockPallet_${x}`, [x, 0.35, 8.2], cardboard, spec.kind === "packaging" ? 3 : 2);
  return scene;
}

function buildColdStorage(spec) {
  const scene = new THREE.Scene();
  scene.name = `WMS_ColdStorage_${spec.coldVariant === "raw" ? "RawMaterials" : "FinishedGoods"}`;
  const floor = material(0xaeb8bc, 0.04, 0.94);
  const insulated = material(0xdce6e9, 0.2, 0.64);
  const panelJoint = material(0x91a8b2, 0.45, 0.42);
  const steel = material(0x263b49, 0.74, 0.3);
  const blue = material(0x46a9d5, 0.42, 0.38);
  const green = material(0x45b98f, 0.3, 0.44);
  const amber = material(0xe5b447, 0.3, 0.5);
  const cargo = material(spec.coldVariant === "raw" ? 0xb99462 : 0xc8dce4, 0.04, 0.76);
  const rubber = material(0x20262a, 0.08, 0.86);
  const glass = new THREE.MeshStandardMaterial({ color: 0x6e9eb0, metalness: 0.25, roughness: 0.2, transparent: true, opacity: 0.75 });
  // 72 x 42 m footprint: a proper industrial cold store rather than a small demo room.
  const width = 72;
  const depth = 42;
  const wallHeight = 10.5;

  box(scene, "Floor", [width, 0.3, depth], [0, -0.2, 0], floor);
  box(scene, "ColdStorageFoundation", [width + 1.5, 0.25, depth + 1.5], [0, -0.45, 0], floor);
  box(scene, "BackWall", [width, wallHeight, 0.35], [0, wallHeight / 2, -depth / 2], insulated);
  box(scene, "LeftWall", [0.35, wallHeight, depth], [-width / 2, wallHeight / 2, 0], insulated);
  box(scene, "RightWall", [0.35, wallHeight, depth], [width / 2, wallHeight / 2, 0], insulated);
  box(scene, "FrontWallLeft", [14, wallHeight, 0.35], [-29, wallHeight / 2, depth / 2], insulated);
  box(scene, "FrontWallRight", [14, wallHeight, 0.35], [29, wallHeight / 2, depth / 2], insulated);
  box(scene, "RoofAssembly_Cold", [width, 0.3, 10], [0, wallHeight + 0.25, -16], insulated);
  box(scene, "RoofAssembly_ColdFront", [width, 0.3, 10], [0, wallHeight + 0.25, 16], insulated);
  box(scene, "RoofRidge", [width, 0.25, 0.4], [0, wallHeight + 0.45, 0], panelJoint);
  for (let x = -34; x <= 34; x += 2.2) {
    box(scene, "ColdRoofSeam", [0.06, 0.08, 10], [x, wallHeight + 0.45, -16], panelJoint);
    box(scene, "ColdRoofSeam", [0.06, 0.08, 10], [x, wallHeight + 0.45, 16], panelJoint);
  }

  const serviceRooms = [
    { name: "Cold_MachineRoom", x: -27, z: -13, w: 17, d: 11, mat: panelJoint },
    { name: "Cold_ChangeRoom", x: -27, z: 0, w: 17, d: 10, mat: insulated },
    { name: "Cold_ReceivingOffice", x: -27, z: 12.5, w: 17, d: 9, mat: insulated },
  ];
  for (const room of serviceRooms) {
    box(scene, `${room.name}_Back`, [room.w, 4.9, 0.18], [room.x, 2.45, room.z - room.d / 2], room.mat);
    box(scene, `${room.name}_Left`, [0.18, 4.9, room.d], [room.x - room.w / 2, 2.45, room.z], room.mat);
    box(scene, `${room.name}_Right`, [0.18, 4.9, room.d], [room.x + room.w / 2, 2.45, room.z], room.mat);
    box(scene, `${room.name}_Header`, [room.w, 0.25, 0.25], [room.x, 5.1, room.z], panelJoint);
  }
  box(scene, "MachineRoomDoor", [3.5, 4.2, 0.12], [-27, 2.1, -7.4], steel);

  box(scene, "ColdMainAisle", [10, 0.06, 36], [0, 0.02, 0], steel);
  for (const z of [-15, -10, -5, 0, 5, 10, 15]) box(scene, "AisleMark", [0.3, 0.03, 2.4], [0, 0.08, z], amber);
  for (const x of [-5.2, 5.2]) box(scene, "AisleEdge", [0.12, 0.04, 36], [x, 0.08, 0], blue);

  const rooms = [
    { zone: "Zone_C1", name: "ColdRoom_01", x: 20, z: -13.5, w: 28, d: 11, seed: 1 },
    { zone: "Zone_C2", name: "ColdRoom_02", x: 20, z: -1, w: 28, d: 11, seed: 2 },
    { zone: "Zone_C3", name: "ColdRoom_03", x: 20, z: 11.5, w: 28, d: 10, seed: 3 },
    { zone: "Zone_C4", name: "ColdRoom_04", x: 1, z: -14, w: 9, d: 10, seed: 4 },
  ];
  for (const room of rooms) {
    const group = new THREE.Group();
    group.name = room.zone;
    group.position.set(room.x, 0, room.z);
    scene.add(group);
    box(group, `${room.name}_Back`, [room.w, 5.8, 0.18], [0, 2.9, -room.d / 2], insulated);
    box(group, `${room.name}_Left`, [0.18, 5.8, room.d], [-room.w / 2, 2.9, 0], insulated);
    box(group, `${room.name}_Right`, [0.18, 5.8, room.d], [room.w / 2, 2.9, 0], insulated);
    box(group, `${room.name}_Header`, [room.w, 0.22, 0.22], [0, 5.85, 0], panelJoint);
    box(group, `${room.name}_DoorFrame`, [3.5, 4.3, 0.16], [0, 2.2, room.d / 2], steel);
    box(group, `${room.name}_Door`, [3.1, 4, 0.1], [0, 2.05, room.d / 2 + 0.12], blue);
    createRack(group, `${room.zone}_Rack_L`, -room.d / 2 + 2.2, Math.min(8.5, room.w - 1.8), steel, blue, cargo, "cold", room.seed);
    createRack(group, `${room.zone}_Rack_R`, room.d / 2 - 2.2, Math.min(8.5, room.w - 1.8), steel, green, cargo, "cold", room.seed + 1);
    for (const x of [-room.w / 2 + 1, room.w / 2 - 1]) {
      box(group, `${room.name}_EvapUnit`, [2.4, 0.75, 0.5], [x, 8.15, 0], panelJoint);
      box(group, `${room.name}_TempLight`, [1.5, 0.08, 0.2], [x, 8.55, 0], glass);
    }
  }

  createConveyor(scene, "ColdConveyor", [-1.5, 0.72, 17.2], 24, steel, blue, cargo);
  createPallet(scene, "ColdDispatchPallet", [16, 0.35, 20.2], cargo, 3);
  createPallet(scene, "ColdReceivingPallet", [-8, 0.35, 19.2], cargo, 2);
  createForklift(scene, "ColdForkliftReceiving", [-8, 0.15, 17], Math.PI / 2, amber, steel, rubber);
  createForklift(scene, "ColdForkliftDispatch", [25, 0.15, 20], -Math.PI / 2, amber, steel, rubber);
  for (const x of [-30, -20, -10, 0, 10, 20, 30]) box(scene, "ColdLight", [3, 0.12, 0.5], [x, 10.05, 0], glass);
  createRefrigerationPlant(scene, steel, panelJoint, blue, glass, -26, -13);
  return scene;
}

function createRefrigerationPlant(parent, steel, casing, blue, glass, x, z) {
  const group = new THREE.Group();
  group.name = "RefrigerationPlant";
  group.position.set(x, 0, z);
  parent.add(group);
  const dark = material(0x172731, 0.82, 0.27);
  const copper = material(0xb66b39, 0.74, 0.3);
  const warning = material(0xe9b83f, 0.35, 0.46);
  const white = material(0xe9f2f4, 0.18, 0.42);
  const led = new THREE.MeshStandardMaterial({
    color: 0xcaf4ff,
    emissive: 0x72d9ff,
    emissiveIntensity: 1.8,
    roughness: 0.22,
  });

  box(group, "CompressorSkid", [15.2, 0.3, 7.7], [0, 0.16, 0], dark, true);
  for (const xLeg of [-6.7, -2.2, 2.2, 6.7]) {
    for (const zLeg of [-3, 3]) box(group, "SkidFoot", [0.28, 0.5, 0.28], [xLeg, -0.12, zLeg], steel, true);
  }

  // Five independent screw-compressor packages: motor, coupling guard, service panel and gauges.
  for (let index = 0; index < 5; index += 1) {
    const compressorX = -5.6 + index * 2.8;
    const machine = new THREE.Group();
    machine.name = `ScrewCompressor_${String(index + 1).padStart(2, "0")}`;
    machine.position.set(compressorX, 0.35, 0);
    group.add(machine);
    box(machine, "CompressorFrame", [2.05, 0.18, 2.35], [0, 0, 0], steel, true);
    box(machine, "CompressorBody", [1.45, 1.25, 1.15], [-0.18, 0.78, 0], casing, true);
    box(machine, "MotorHousing", [0.72, 0.78, 1.28], [0.72, 0.82, 0], dark, true);
    for (const y of [0.52, 0.8, 1.08]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 8, 20), steel);
      ring.name = "CompressorCoolingRing";
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-0.18, y, 0.59);
      machine.add(ring);
    }
    box(machine, "ElectricalJunctionBox", [0.42, 0.5, 0.72], [0.22, 1.65, -0.48], white, true);
    box(machine, "EmergencyStop", [0.14, 0.22, 0.14], [0.22, 1.76, -0.88], warning, true);
    addPressureGauge(machine, "SuctionGauge", [-0.42, 1.75, 0.72], blue, Math.PI / 2);
    addPressureGauge(machine, "DischargeGauge", [0.25, 1.75, 0.72], warning, Math.PI / 2);
    createPipeBetween(machine, "SuctionStub", [-0.72, 1.34, 0.58], [-1.15, 1.34, 0.58], 0.1, glass);
    createPipeBetween(machine, "DischargeStub", [0.38, 1.48, 0.58], [0.8, 1.48, 0.58], 0.1, copper);
  }

  // Oil separator / receiver tanks with inspection ports and safety valves.
  for (const [index, tankX] of [-5.1, 0, 5.1].entries()) {
    const tank = new THREE.Group();
    tank.name = `ReceiverTank_${index + 1}`;
    tank.position.set(tankX, 0, 2.55);
    group.add(tank);
    cylinder(tank, "ReceiverTankBody", 0.7, 2.65, [0, 1.62, 0], blue);
    cylinder(tank, "ReceiverTankTop", 0.72, 0.18, [0, 2.98, 0], steel);
    cylinder(tank, "ReceiverTankBottom", 0.72, 0.18, [0, 0.25, 0], steel);
    for (const y of [0.75, 1.45, 2.15]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.035, 8, 24), steel);
      band.name = "TankReinforcementBand";
      band.rotation.x = Math.PI / 2;
      band.position.set(0, y, 0);
      tank.add(band);
    }
    for (const legX of [-0.42, 0.42]) box(tank, "TankLeg", [0.12, 0.7, 0.12], [legX, -0.05, 0], steel);
    addPressureGauge(tank, "TankGauge", [0, 2.3, 0.72], warning, Math.PI / 2);
    cylinder(tank, "SafetyValve", 0.12, 0.35, [0, 3.25, 0], warning);
  }

  // Fin-and-fan condenser bank, built from a real frame and repeated fan modules.
  const condenser = new THREE.Group();
  condenser.name = "AirCooledCondenserBank";
  condenser.position.set(0, 0, -2.55);
  group.add(condenser);
  box(condenser, "CondenserLowerFrame", [14.5, 0.2, 0.24], [0, 0.55, 0], steel, true);
  box(condenser, "CondenserUpperFrame", [14.5, 0.2, 0.24], [0, 4.25, 0], steel, true);
  for (const x of [-6.2, -3.1, 0, 3.1, 6.2]) {
    box(condenser, "CondenserUpright", [0.16, 3.8, 0.16], [x, 2.4, 0], steel, true);
    for (let y = 0.85; y < 4; y += 0.26) box(condenser, "CondenserFin", [2.45, 0.035, 0.08], [x, y, 0.1], blue);
    const fan = new THREE.Group();
    fan.name = "CondenserFan";
    fan.position.set(x, 2.4, 0.25);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.07, 10, 28), dark);
    guard.rotation.x = Math.PI / 2;
    fan.add(guard);
    cylinder(fan, "FanHub", 0.16, 0.22, [0, 0, 0.05], white, [Math.PI / 2, 0, 0]);
    for (let blade = 0; blade < 5; blade += 1) {
      const arm = box(fan, "FanBlade", [0.65, 0.055, 0.1], [0.36, 0, 0.05], white, true);
      arm.rotation.z = (blade * Math.PI * 2) / 5;
    }
    condenser.add(fan);
  }

  for (const pipeZ of [-1.55, -0.55, 0.55, 1.55]) {
    createPipeBetween(group, "RefrigerantHeader", [-6.8, 4.55, pipeZ], [6.8, 4.55, pipeZ], 0.11, pipeZ < 0 ? copper : glass);
  }
  createPipeBetween(group, "LiquidLine", [6.8, 4.55, 1.55], [6.8, 2.8, 2.55], 0.13, copper);
  createPipeBetween(group, "SuctionLine", [-6.8, 4.55, -1.55], [-6.8, 2.9, -2.55], 0.16, glass);
  box(group, "PlantCanopy", [16, 0.18, 8.8], [0, 5.2, 0], casing, true);
  for (const xLight of [-5, 0, 5]) box(group, "PlantServiceLight", [1.2, 0.08, 0.24], [xLight, 5.05, 0], led, true);
  box(group, "PlantControlCabinet", [1.25, 2.2, 0.55], [7.2, 1.3, 2.7], white, true);
  box(group, "ControlScreen", [0.55, 0.42, 0.035], [7.2, 1.55, 2.99], blue, true);
  box(group, "ControlWarningLamp", [0.12, 0.12, 0.12], [7.2, 2.05, 3.02], warning, true);
}

function cylinder(parent, name, radius, height, position, mat, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createPipeBetween(parent, name, start, end, radius, mat) {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const length = direction.length();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat);
  pipe.name = name;
  pipe.position.copy(startVector).add(endVector).multiplyScalar(0.5);
  pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  pipe.castShadow = true;
  pipe.receiveShadow = true;
  parent.add(pipe);
  return pipe;
}

function addPressureGauge(parent, name, position, mat, rotationY = 0) {
  const gauge = new THREE.Group();
  gauge.name = name;
  gauge.position.set(...position);
  gauge.rotation.y = rotationY;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 10, 24), mat);
  rim.rotation.x = Math.PI / 2;
  gauge.add(rim);
  cylinder(gauge, "GaugeFace", 0.21, 0.035, [0, 0, 0], new THREE.MeshStandardMaterial({ color: 0xf2f6f5, roughness: 0.28 }), [Math.PI / 2, 0, 0]);
  const needle = box(gauge, "GaugeNeedle", [0.03, 0.18, 0.02], [0.06, 0.03, 0.03], mat, true);
  needle.rotation.z = -0.65;
  parent.add(gauge);
}

function buildLogisticsCampus(spec) {
  const scene = new THREE.Scene();
  scene.name = "WMS_Logistics_Campus";

  const concrete = material(0xaeb7bc, 0.04, 0.94);
  const asphalt = material(0x424b50, 0.02, 0.96);
  const wall = material(0xd9dee1, 0.34, 0.58);
  const roof = material(0x87949b, 0.48, 0.46);
  const steel = material(0x263b49, 0.74, 0.3);
  const accent = material(spec.accent, 0.42, 0.38);
  const safety = material(0xe9b83f, 0.28, 0.5);
  const cardboard = material(0xa8733d, 0.03, 0.88);
  const darkRubber = material(0x20262a, 0.08, 0.86);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x70a5bd,
    metalness: 0.2,
    roughness: 0.18,
    transparent: true,
    opacity: 0.72,
  });

  box(scene, "CampusGround", [92, 0.35, 64], [0, -0.3, 0], concrete);
  box(scene, "MainRoad", [18, 0.08, 62], [0, -0.08, 0], asphalt);
  box(scene, "CrossRoad", [90, 0.08, 12], [0, -0.07, 5], asphalt);
  for (let z = -27; z <= 28; z += 5.5) {
    box(scene, `RoadMark_C_${z}`, [0.22, 0.025, 2.5], [0, 0, z], safety);
  }
  for (let x = -39; x <= 39; x += 6) {
    box(scene, `RoadMark_X_${x}`, [2.8, 0.025, 0.2], [x, 0, 5], safety);
  }

  const buildings = [
    { id: "A", center: [-27, 0, -14], zones: ["Zone_A", "Zone_B"], labelColor: 0x2f9fc7 },
    { id: "B", center: [27, 0, -14], zones: ["Zone_C"], labelColor: 0x46b58b },
    { id: "C", center: [27, 0, 18], zones: ["Zone_Q"], labelColor: 0xd89b38 },
  ];

  for (const building of buildings) {
    createCampusWarehouse(
      scene,
      building,
      { concrete, wall, roof, steel, accent, safety, cardboard, glass, darkRubber },
    );
  }

  createGatehouse(scene, [-27, 0, 19], wall, roof, glass, accent);
  createForklift(scene, "Forklift_A", [-17, 0.15, -5], Math.PI * 0.12, safety, steel, darkRubber);
  createForklift(scene, "Forklift_B", [17, 0.15, -6], -Math.PI * 0.18, safety, steel, darkRubber);
  createForklift(scene, "Forklift_C", [17, 0.15, 15], Math.PI * 0.55, safety, steel, darkRubber);

  for (const [index, position] of [[-6, -23], [7, 25], [-7, 18], [6, -3]].entries()) {
    createLampPost(scene, `CampusLamp_${index}`, position, steel);
  }

  return scene;
}

function createCampusWarehouse(scene, building, mats) {
  const [cx, , cz] = building.center;
  // Source dimensions in millimeters; one scene unit represents 1000 mm.
  const width = (building.id === "A" ? 34000 : 30000) / 1000;
  const depth = (building.id === "A" ? 23000 : 22000) / 1000;
  const height = 7400 / 1000;
  const group = new THREE.Group();
  group.name = `Warehouse_${building.id}`;
  group.position.set(cx, 0, cz);
  if (building.id === "C") group.rotation.y = Math.PI;
  scene.add(group);

  box(group, `Warehouse_${building.id}_Floor`, [width, 0.26, depth], [0, 0, 0], mats.concrete);
  box(group, `Warehouse_${building.id}_BackWall`, [width, height, 0.3], [0, height / 2, -depth / 2], mats.wall);
  box(group, `Warehouse_${building.id}_LeftWall`, [0.3, height, depth], [-width / 2, height / 2, 0], mats.wall);
  box(group, `Warehouse_${building.id}_RightWall`, [0.3, height, depth], [width / 2, height / 2, 0], mats.wall);
  const roofing = new THREE.Group();
  roofing.name = `RoofAssembly_${building.id}`;
  group.add(roofing);
  const slope = 0.12;
  const rise = (depth / 2 + 0.5) * Math.tan(slope);
  for (const side of [-1, 1]) {
    const panel = box(roofing, "RoofPanel", [width + 1, 0.22, (depth / 2 + 0.5) / Math.cos(slope)], [0, height + rise / 2, side * (depth / 2 + 0.5) / 2], mats.roof);
    panel.rotation.x = side * slope;
    for (let x = -width / 2; x <= width / 2; x += 1.2) {
      const seam = box(roofing, "RoofSeam", [0.055, 0.06, (depth / 2 + 0.5) / Math.cos(slope)], [x, height + rise / 2 + 0.15, side * (depth / 2 + 0.5) / 2], mats.roof);
      seam.rotation.x = side * slope;
    }
    box(roofing, "Gutter", [width + 1, 0.2, 0.22], [0, height - 0.05, side * (depth / 2 + 0.5)], mats.steel);
  }
  box(roofing, "RidgeCap", [width + 1.1, 0.18, 0.32], [0, height + rise + 0.12, 0], mats.roof);
  const ceiling = material(0xe9e9e2, 0.08, 0.85);
  box(roofing, "InsulatedCeiling", [width - 0.4, 0.1, depth - 0.4], [0, height - 0.2, 0], ceiling);
  for (const x of [-width / 2, width / 2]) {
    const shape = new THREE.Shape();
    shape.moveTo(-depth / 2, 0);
    shape.lineTo(depth / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }), mats.wall);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(x - 0.11, height, 0);
    gable.name = "Gable";
    roofing.add(gable);
  }
  for (const side of [-1, 1]) {
    for (let z = -depth / 2 + 0.6; z < depth / 2; z += 1.2) {
      box(group, "WallPanelJoint", [0.045, height - 0.8, 0.055], [side * (width / 2 + 0.17), height / 2 + 0.3, z], mats.roof);
    }
    box(group, "WallPlinth", [0.4, 0.65, depth], [side * width / 2, 0.35, 0], mats.concrete);
  }

  for (let x = -width / 2 + 3; x <= width / 2 - 3; x += 5.5) {
    box(group, `Warehouse_${building.id}_Window_${x}`, [3.2, 1.05, 0.12], [x, 5.55, -depth / 2 + 0.18], mats.glass);
    box(group, `Warehouse_${building.id}_Truss_${x}`, [0.18, 0.18, depth - 0.8], [x, 6.9, 0], mats.steel);
    const light = new THREE.MeshStandardMaterial({color: 0xf2f6ef, emissive: 0xdcefff, emissiveIntensity: 1.2});
    for (const z of [-6, 0, 6]) box(roofing, "CeilingLight", [2.2, 0.12, 0.5], [x, 6.75, z], light);
  }

  const doorXs = building.id === "A" ? [-10, 0, 10] : [-7, 7];
  let wallStart = -width / 2;
  for (const x of doorXs) {
    const edge = x - 3;
    box(group, "FacadePier", [edge - wallStart, height, 0.3], [(wallStart + edge) / 2, height / 2, depth / 2], mats.wall);
    wallStart = x + 3;
    box(group, "DoorLintel", [6, height - 5, 0.3], [x, 5 + (height - 5) / 2, depth / 2], mats.wall);
    for (const dx of [-3, 3]) box(group, "DoorGuide", [0.15, 5, 0.24], [x + dx, 2.5, depth / 2 + 0.22], mats.steel);
    box(group, "ShutterHousing", [6.3, 0.45, 0.5], [x, 5.05, depth / 2 + 0.28], mats.roof);
    const open = x === doorXs[0];
    const shutterHeight = open ? 1 : 4.8;
    box(group, "Shutter", [5.8, shutterHeight, 0.12], [x, 4.95 - shutterHeight / 2, depth / 2 + 0.05], mats.roof);
    for (let y = 4.95 - shutterHeight; y < 4.9; y += 0.32) box(group, "ShutterSlat", [5.8, 0.035, 0.035], [x, y, depth / 2 + 0.13], mats.steel);
    box(group, `Warehouse_${building.id}_Dock_${x}`, [6.4, 0.45, 3], [x, 0.15, depth / 2 + 1.5], mats.steel);
  }
  box(group, "FacadeEnd", [width / 2 - wallStart, height, 0.3], [(wallStart + width / 2) / 2, height / 2, depth / 2], mats.wall);

  building.zones.forEach((zoneName, zoneIndex) => {
    const zone = new THREE.Group();
    zone.name = zoneName;
    const zoneWidth = (width - 5) / building.zones.length;
    zone.position.x = -width / 2 + 2.5 + zoneWidth / 2 + zoneIndex * zoneWidth;
    group.add(zone);
    const rackWidth = Math.min(6.2, zoneWidth - 1.2);
    for (let row = 0; row < 3; row++) {
      createRack(zone, `${zoneName}_Rack_${row + 1}`, -6 + row * 5.6, rackWidth, mats.steel, mats.accent, mats.cardboard, "raw", row + zoneIndex);
    }
  });

  createConveyor(group, `Conveyor_${building.id}`, [0, 0.72, depth / 2 - 3.2], width - 5, mats.steel, mats.accent, mats.cardboard);
  createForklift(group, `ForkliftInside_${building.id}`, [width / 2 - 4.2, 0.15, 3.4], Math.PI, mats.safety, mats.steel, mats.darkRubber);
}

function createConveyor(parent, prefix, position, length, steel, accent, cargo) {
  const group = new THREE.Group();
  group.name = prefix;
  group.position.set(...position);
  parent.add(group);
  for (const x of [-length / 2, length / 2]) {
    box(group, `${prefix}_Leg_${x}`, [0.18, 1.35, 0.18], [x, -0.05, 0], steel);
  }
  box(group, `${prefix}_RailFront`, [length, 0.18, 0.16], [0, 0.55, 0.65], steel);
  box(group, `${prefix}_RailBack`, [length, 0.18, 0.16], [0, 0.55, -0.65], steel);
  for (let x = -length / 2 + 0.5; x < length / 2; x += 0.8) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.18, 10), accent);
    roller.name = `${prefix}_Roller`;
    roller.position.set(x, 0.58, 0);
    roller.rotation.x = Math.PI / 2;
    group.add(roller);
  }
  for (let x = -length / 2 + 2; x < length / 2 - 1; x += 5.5) {
    box(group, `${prefix}_Cargo`, [1.35, 0.9, 1.05], [x, 1.15, 0], cargo);
  }
}

function createForklift(parent, name, position, rotation, yellow, steel, rubber) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  group.rotation.y = rotation;
  parent.add(group);
  box(group, `${name}_Body`, [2.3, 0.95, 1.55], [0, 0.72, 0], yellow);
  box(group, `${name}_Cab`, [1.25, 1.55, 1.35], [-0.35, 1.75, 0], steel);
  box(group, `${name}_MastLeft`, [0.14, 2.65, 0.16], [1.22, 1.55, -0.52], steel);
  box(group, `${name}_MastRight`, [0.14, 2.65, 0.16], [1.22, 1.55, 0.52], steel);
  box(group, `${name}_ForkLeft`, [2.2, 0.1, 0.13], [2.2, 0.28, -0.42], steel);
  box(group, `${name}_ForkRight`, [2.2, 0.1, 0.13], [2.2, 0.28, 0.42], steel);
  for (const x of [-0.72, 0.72]) {
    for (const z of [-0.83, 0.83]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), rubber);
      wheel.name = `${name}_Wheel`;
      wheel.position.set(x, 0.34, z);
      wheel.rotation.x = Math.PI / 2;
      group.add(wheel);
    }
  }
}

function createGatehouse(parent, position, wall, roof, glass, accent) {
  const group = new THREE.Group();
  group.name = "Gatehouse";
  group.position.set(...position);
  parent.add(group);
  box(group, "GatehouseBody", [9, 3.5, 7], [0, 1.75, 0], wall);
  box(group, "GatehouseRoof", [9.7, 0.24, 7.7], [0, 3.62, 0], roof);
  box(group, "GatehouseWindow", [5.4, 1.35, 0.12], [0, 2.15, 3.53], glass);
  box(group, "GatehouseSign", [5.8, 0.55, 0.16], [0, 3.1, 3.58], accent);
}

function createLampPost(parent, name, position, steel) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(position[0], 0, position[1]);
  parent.add(group);
  box(group, `${name}_Pole`, [0.18, 6.5, 0.18], [0, 3.25, 0], steel);
  box(group, `${name}_Arm`, [2.4, 0.14, 0.14], [1.1, 6.4, 0], steel);
  const lamp = new THREE.MeshStandardMaterial({ color: 0xf5fbff, emissive: 0xccecff, emissiveIntensity: 1.6 });
  box(group, `${name}_Light`, [0.9, 0.12, 0.42], [2.05, 6.3, 0], lamp);
}

function createRack(parent, prefix, z, width, steel, beam, cardboard, kind, seed) {
  const h = kind === "cold" ? 3.5 : 4.1;
  const d = 1.55;
  for (const x of [-width / 2, width / 2]) {
    for (const zz of [-d / 2, d / 2]) box(parent, `${prefix}_Post`, [0.12, h, 0.12], [x, h / 2, z + zz], steel);
  }
  for (let level = 0; level < 4; level++) {
    const y = 0.42 + level * 1.05;
    for (const zz of [-d / 2, d / 2]) box(parent, `${prefix}_Beam`, [width + 0.18, 0.13, 0.13], [0, y, z + zz], beam);
    box(parent, `${prefix}_Shelf`, [width, 0.07, d], [0, y + 0.06, z], steel);
    const slots = Math.max(2, Math.floor(width / 1.25));
    for (let slot = 0; slot < slots; slot++) {
      if ((slot + level + seed) % 5 === 0) continue;
      const px = -width / 2 + 0.65 + slot * ((width - 1.3) / Math.max(1, slots - 1));
      const height = kind === "packaging" ? 0.72 : 0.58 + ((slot + level) % 2) * 0.16;
      box(parent, `${prefix}_Cargo`, [0.92, height, 1.04], [px, y + height / 2 + 0.1, z], cardboard);
    }
  }
}

function createPallet(parent, prefix, position, cargo, stacks) {
  const wood = material(0x80542f, 0.02, 0.9);
  const group = new THREE.Group();
  group.name = prefix;
  group.position.set(...position);
  for (const x of [-0.75, 0, 0.75]) box(group, `${prefix}_Slat`, [0.62, 0.12, 1.8], [x, 0, 0], wood);
  for (let y = 0; y < stacks; y++) {
    for (const x of [-0.48, 0.48]) box(group, `${prefix}_Box`, [0.88, 0.62, 0.78], [x, 0.43 + y * 0.64, 0], cargo);
  }
  parent.add(group);
}

function exportGlb(scene) {
  return new Promise((resolveExport, reject) => {
    new GLTFExporter().parse(scene, resolveExport, reject, {
      binary: true,
      onlyVisible: true,
      truncateDrawRange: true,
    });
  });
}

// Batch within semantic groups: zone picking and roof visibility remain independent.
function batchStaticMeshes(parent) {
  for (const child of [...parent.children]) if (!(child instanceof THREE.Mesh)) batchStaticMeshes(child);
  const batches = new Map();
  for (const child of [...parent.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const batch = batches.get(child.material) ?? [];
    batch.push(child);
    batches.set(child.material, batch);
  }
  for (const [mat, meshes] of batches) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrix));
    const merged = mergeGeometries(geometries);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) throw new Error(`Cannot batch ${parent.name}`);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `${parent.name}_Batch_${parent.children.length}`;
    meshes.forEach(item => parent.remove(item));
    parent.add(mesh);
  }
}
