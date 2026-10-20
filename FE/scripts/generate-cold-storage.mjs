/**
 * Conceptual digital-twin of the cold-storage warehouse.
 *
 * Drawing interpretation (1 unit = 1 m). Not a certified construction model.
 * Footprint 48 m (X) x 30 m (Z). Grid X: 1–7 @ 8 m. Grid Z: A–D @ 10 m.
 *
 * One structural grid for columns, walls and floors:
 *   X: -24 -16 -8 0 8 16 24
 *   Z: -15 -5 5 15
 * Bands, south (+Z) to north (−Z):
 *   Loading apron / docks          z 15 → 22
 *   Receiving | Prep | Pack | Dispatch   z 5 → 15
 *   Cool 2–8 | Freezer −20 | Deep −25    z −5 → 5
 *   Machine | Electrical | Office | Support | Technical   z −15 → −5
 *   Condenser bank (outdoor)       z −17.3
 *
 * Systems stay in named groups so the viewer can toggle layers.
 * Exact pipe diameters, compressor models and cable sizes are CONCEPTUAL.
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

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
globalThis.self ??= globalThis;

const PROP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "assets/props");

function fract(value) {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const distLeft = Math.abs(estimate - left);
  const distUp = Math.abs(estimate - up);
  const distUpperLeft = Math.abs(estimate - upperLeft);
  if (distLeft <= distUp && distLeft <= distUpperLeft) return left;
  if (distUp <= distUpperLeft) return up;
  return upperLeft;
}

function decodePng(bytes) {
  const buffer = Buffer.from(bytes);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels || buffer[24] !== 8 || buffer[28] !== 0) {
    throw new Error("Unsupported PNG layout for prop textures");
  }
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  let source = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[source++];
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const raw = inflated[source++];
      const left = i >= channels ? row[i - channels] : 0;
      const up = previous[i];
      const upperLeft = i >= channels ? previous[i - channels] : 0;
      if (filter === 0) row[i] = raw;
      else if (filter === 1) row[i] = (raw + left) & 255;
      else if (filter === 2) row[i] = (raw + up) & 255;
      else if (filter === 3) row[i] = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[i] = (raw + paethPredictor(left, up, upperLeft)) & 255;
      else throw new Error(`Unsupported PNG filter ${filter}`);
    }
    for (let x = 0; x < width; x++) {
      const sourceIndex = x * channels;
      const target = (y * width + x) * 4;
      pixels[target] = row[sourceIndex];
      pixels[target + 1] = row[sourceIndex + 1];
      pixels[target + 2] = row[sourceIndex + 2];
      pixels[target + 3] = channels === 4 ? row[sourceIndex + 3] : 255;
    }
    previous = row;
  }
  return { width, height, data: pixels };
}

function pngBytesFromGlb(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  const image = json.images?.[0];
  if (!image || image.bufferView === undefined) return null;
  const binStart = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binStart);
  const bin = bytes.subarray(binStart + 8, binStart + 8 + binLength);
  const view = json.bufferViews[image.bufferView];
  const start = view.byteOffset || 0;
  return bin.subarray(start, start + view.byteLength);
}

function bakeVertexColors(root, image) {
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const uv = mesh.geometry.getAttribute("uv");
    if (!uv) return;
    const geometry = mesh.geometry.clone();
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    colors.fill(1);
    const index = geometry.getIndex();
    const groups = geometry.groups?.length
      ? geometry.groups
      : [{ start: 0, count: index ? index.count : uv.count, materialIndex: 0 }];
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const group of groups) {
      const material = materials[group.materialIndex] ?? materials[0];
      const tint = material?.color ?? new THREE.Color(0xffffff);
      const paint = (vertex) => {
        const x = Math.min(image.width - 1, Math.max(0, Math.floor(fract(uv.getX(vertex)) * image.width)));
        const y = Math.min(image.height - 1, Math.max(0, Math.floor(fract(uv.getY(vertex)) * image.height)));
        const pixel = (y * image.width + x) * 4;
        colors[vertex * 3] = (image.data[pixel] / 255) * tint.r;
        colors[vertex * 3 + 1] = (image.data[pixel + 1] / 255) * tint.g;
        colors[vertex * 3 + 2] = (image.data[pixel + 2] / 255) * tint.b;
      };
      if (index) {
        for (let cursor = group.start; cursor < group.start + group.count; cursor++) paint(index.getX(cursor));
      } else {
        for (let cursor = group.start; cursor < group.start + group.count; cursor++) paint(cursor);
      }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.geometry = geometry;
    for (const material of materials) {
      if (!material) continue;
      material.vertexColors = true;
      material.color?.set(0xffffff);
      material.map = null;
    }
  });
}

async function loadTemplate(fileName, bake) {
  const bytes = await readFile(resolve(PROP_DIR, fileName));
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolveLoad, rejectLoad) => {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    loader.parse(arrayBuffer, "", resolveLoad, rejectLoad);
  });
  if (bake) {
    const png = pngBytesFromGlb(bytes);
    if (png) bakeVertexColors(gltf.scene, decodePng(png));
  }
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material) continue;
      material.map = null;
      material.metalness = Math.min(material.metalness ?? 0.15, 0.4);
      material.roughness = Math.max(material.roughness ?? 0.55, 0.42);
      material.envMapIntensity = 0.2;
    }
  });
  return gltf.scene;
}

let templates;

function placeProp(parent, name, template, position, yaw, scale, userData, bottom = 0) {
  const node = group(parent, name, position, userData);
  node.rotation.y = yaw;
  const model = template.clone(true);
  model.name = `${name}_MODEL`;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y += bottom - bounds.min.y;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  node.add(model);
  return bounds;
}

const W = 48;
const D = 30;
const HALF_W = W / 2;
const HALF_D = D / 2;

const mats = {
  MAT_FLOOR_EPOXY_GRAY: mat("MAT_FLOOR_EPOXY_GRAY", 0xb7bec4, 0.04, 0.92),
  MAT_SLAB: mat("MAT_SLAB", 0x9aa3a8, 0.05, 0.95),
  MAT_PANEL_WHITE: mat("MAT_PANEL_WHITE", 0xf4f7fb, 0.08, 0.72),
  MAT_PANEL_COOL: mat("MAT_PANEL_COOL", 0xf7fbfe, 0.06, 0.7),
  MAT_PANEL_FREEZER: mat("MAT_PANEL_FREEZER", 0xe7f1fb, 0.06, 0.68),
  MAT_PANEL_DEEP: mat("MAT_PANEL_DEEP", 0xd5e6f6, 0.06, 0.66),
  MAT_PANEL_OPS: mat("MAT_PANEL_OPS", 0xf6f1e8, 0.05, 0.74),
  MAT_PANEL_MACHINE: mat("MAT_PANEL_MACHINE", 0xdfe6ec, 0.1, 0.62),
  MAT_PANEL_OFFICE: mat("MAT_PANEL_OFFICE", 0xf8f3ea, 0.04, 0.76),
  MAT_BAND_CYAN: mat("MAT_BAND_CYAN", 0x3aa0c8, 0.12, 0.5),
  MAT_BAND_BLUE: mat("MAT_BAND_BLUE", 0x2f6fbf, 0.12, 0.48),
  MAT_BAND_NAVY: mat("MAT_BAND_NAVY", 0x1e4b8a, 0.12, 0.46),
  MAT_BAND_AMBER: mat("MAT_BAND_AMBER", 0xd97706, 0.1, 0.5),
  MAT_BAND_ORANGE: mat("MAT_BAND_ORANGE", 0xe07a2f, 0.1, 0.48),
  MAT_FLOOR_COOL: mat("MAT_FLOOR_COOL", 0xd5e3ea, 0.04, 0.88),
  MAT_FLOOR_FREEZER: mat("MAT_FLOOR_FREEZER", 0xc5d7e6, 0.04, 0.86),
  MAT_FLOOR_DEEP: mat("MAT_FLOOR_DEEP", 0xb7cbe0, 0.04, 0.84),
  MAT_FLOOR_OPS: mat("MAT_FLOOR_OPS", 0xe4ddd2, 0.04, 0.9),
  MAT_FLOOR_MACHINE: mat("MAT_FLOOR_MACHINE", 0xc8cfd4, 0.08, 0.78),
  MAT_FLOOR_OFFICE: mat("MAT_FLOOR_OFFICE", 0xe8e0d4, 0.04, 0.86),
  MAT_WALL_EXT: mat("MAT_WALL_EXT", 0xd7e3ee, 0.16, 0.58),
  MAT_WALL_PLINTH: mat("MAT_WALL_PLINTH", 0x3d6f99, 0.2, 0.5),
  MAT_STEEL_GALVANIZED: mat("MAT_STEEL_GALVANIZED", 0xc5ced6, 0.35, 0.42),
  MAT_DOOR_LEAF: mat("MAT_DOOR_LEAF", 0xfbfcfd, 0.08, 0.55),
  MAT_DOOR_FRAME: mat("MAT_DOOR_FRAME", 0x9aa7b2, 0.45, 0.38),
  MAT_DOOR_TRACK: mat("MAT_DOOR_TRACK", 0x6d7882, 0.4, 0.4),
  MAT_ROOF: mat("MAT_ROOF", 0x7e8b93, 0.45, 0.48),
  MAT_RACK_BLUE: mat("MAT_RACK_BLUE", 0x2f6fbf, 0.45, 0.4),
  MAT_RACK_ORANGE: mat("MAT_RACK_ORANGE", 0xe07a2f, 0.35, 0.45),
  MAT_RACK_DECK: mat("MAT_RACK_DECK", 0xd8c3a0, 0.08, 0.82),
  MAT_RACK_SIGN: mat("MAT_RACK_SIGN", 0xf8f1d0, 0.05, 0.7),
  MAT_PALLET_WOOD: mat("MAT_PALLET_WOOD", 0x8a5a32, 0.02, 0.9),
  MAT_CARGO: mat("MAT_CARGO", 0xd5e4ea, 0.04, 0.78),
  MAT_PIPE_SUCTION_BLUE: mat("MAT_PIPE_SUCTION_BLUE", 0x2563eb, 0.35, 0.4),
  MAT_PIPE_DISCHARGE_RED: mat("MAT_PIPE_DISCHARGE_RED", 0xdc2626, 0.35, 0.4),
  MAT_PIPE_LIQUID_GREEN: mat("MAT_PIPE_LIQUID_GREEN", 0x16a34a, 0.35, 0.4),
  MAT_PIPE_OIL_ORANGE: mat("MAT_PIPE_OIL_ORANGE", 0xea580c, 0.35, 0.42),
  MAT_PIPE_HOTGAS_PURPLE: mat("MAT_PIPE_HOTGAS_PURPLE", 0x7c3aed, 0.35, 0.42),
  MAT_DRAIN: mat("MAT_DRAIN", 0x78716c, 0.2, 0.7),
  MAT_WATER: mat("MAT_WATER", 0x38bdf8, 0.25, 0.45),
  MAT_YELLOW: mat("MAT_YELLOW", 0xf5c542, 0.15, 0.55),
  MAT_DOOR: mat("MAT_DOOR", 0xc5d0d6, 0.3, 0.5),
  MAT_RUBBER: mat("MAT_RUBBER", 0x1f2428, 0.05, 0.9),
  MAT_CONDENSER: mat("MAT_CONDENSER", 0xd7dee3, 0.4, 0.45),
  MAT_PANEL_ELEC: mat("MAT_PANEL_ELEC", 0x334155, 0.4, 0.45),
  MAT_SENSOR: mat("MAT_SENSOR", 0xf8fafc, 0.1, 0.4),
  MAT_TRUCK: mat("MAT_TRUCK", 0x64748b, 0.3, 0.55),
  MAT_DESK: mat("MAT_DESK", 0xd7c4a3, 0.05, 0.72),
  MAT_SCREEN: mat("MAT_SCREEN", 0x38bdf8, 0.08, 0.28),
  MAT_BEZEL: mat("MAT_BEZEL", 0x1e293b, 0.2, 0.55),
  MAT_CHAIR: mat("MAT_CHAIR", 0x334155, 0.08, 0.7),
  MAT_GLASS: new THREE.MeshStandardMaterial({
    name: "MAT_GLASS",
    color: 0x7dd3fc,
    metalness: 0.15,
    roughness: 0.18,
    transparent: true,
    opacity: 0.45,
  }),
};

function mat(name, color, metalness, roughness) {
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  material.name = name;
  return material;
}

function box(parent, name, size, position, material, userData) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (userData) mesh.userData = { designStatus: "CONCEPTUAL", ...userData };
  parent.add(mesh);
  return mesh;
}

function cyl(parent, name, radius, length, position, axis, material, userData) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  if (userData) mesh.userData = { designStatus: "CONCEPTUAL", ...userData };
  parent.add(mesh);
  return mesh;
}

function group(parent, name, position = [0, 0, 0], userData) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(...position);
  if (userData) node.userData = { designStatus: "CONCEPTUAL", ...userData };
  parent.add(node);
  return node;
}

const GRID_X = [-24, -16, -8, 0, 8, 16, 24];
const GRID_Z = [-15, -5, 5, 15];
const PANEL_H = 6.2;

function zoneFinish(zoneType) {
  switch (zoneType) {
    case "COLD_STORAGE":
      return { wall: mats.MAT_PANEL_COOL, floor: mats.MAT_FLOOR_COOL, band: mats.MAT_BAND_CYAN };
    case "FREEZER":
      return { wall: mats.MAT_PANEL_FREEZER, floor: mats.MAT_FLOOR_FREEZER, band: mats.MAT_BAND_BLUE };
    case "DEEP_FREEZER":
      return { wall: mats.MAT_PANEL_DEEP, floor: mats.MAT_FLOOR_DEEP, band: mats.MAT_BAND_NAVY };
    case "MACHINE_ROOM":
    case "TECHNICAL_CORRIDOR":
      return { wall: mats.MAT_PANEL_MACHINE, floor: mats.MAT_FLOOR_MACHINE, band: mats.MAT_BAND_ORANGE };
    case "ELECTRICAL_ROOM":
      return { wall: mats.MAT_PANEL_MACHINE, floor: mats.MAT_FLOOR_MACHINE, band: mats.MAT_YELLOW };
    case "OFFICE":
    case "SUPPORT":
      return { wall: mats.MAT_PANEL_OFFICE, floor: mats.MAT_FLOOR_OFFICE, band: mats.MAT_BAND_AMBER };
    default:
      return { wall: mats.MAT_PANEL_OPS, floor: mats.MAT_FLOOR_OPS, band: mats.MAT_BAND_AMBER };
  }
}

function slidingColdDoor(parent, name, doorLocal, wallZ) {
  const door = group(parent, `DOOR_${name}`, [doorLocal, 0, wallZ], {
    type: "COLD_DOOR",
    style: "double_leaf",
    width_mm: 3000,
    height_mm: 2500,
    source: "Quaternius metal door CC0",
  });
  const scale = 2.5 / 4;
  placeProp(door, `${name}_LEAF_L`, templates.door, [-0.7, 0, 0.2], 0, scale, { type: "COLD_DOOR" });
  placeProp(door, `${name}_LEAF_R`, templates.door, [1.05, 0, 0.2], 0, scale, { type: "COLD_DOOR" });
}

function firstBayCenter(x0, x1) {
  for (let i = 0; i < GRID_X.length - 1; i++) {
    const a = GRID_X[i];
    const b = GRID_X[i + 1];
    if (a >= x0 - 0.01 && b <= x1 + 0.01) return (a + b) / 2;
  }
  return (x0 + x1) / 2;
}

function panelRoom(parent, name, x0, z0, x1, z1, h, userData) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const room = group(parent, name, [cx, 0, cz], userData);
  const finish = zoneFinish(userData?.zoneType);
  const t = 0.1;
  const inset = t / 2;
  const onSouthExterior = z1 >= HALF_D - 0.01;
  const onNorthExterior = z0 <= -HALF_D + 0.01;
  box(room, `${name}_FLOOR`, [w - 0.24, 0.06, d - 0.24], [0, 0.11, 0], finish.floor, {
    type: "cold_room_floor",
    composition: "slab / waterproof / insulation / epoxy",
  });
  const spanX = w - 0.24;
  const spanZ = d - 0.24;
  const band = (wallName, size, position) => {
    box(room, `${name}_${wallName}_BAND`, size, position, finish.band);
  };
  if (!onNorthExterior) {
    box(room, `${name}_WALL_N`, [spanX, h, t], [0, h / 2, -d / 2 + inset], finish.wall, {
      type: "cold_room_panel",
      thickness_mm: 100,
      material: "PU insulated sandwich panel",
    });
    band("WALL_N", [spanX, 0.16, 0.02], [0, h - 0.2, -d / 2 + inset + 0.06]);
  }
  if (!onSouthExterior) {
    const doorW = 3.2;
    const doorLocal = firstBayCenter(x0, x1) - cx;
    const leftEdge = -spanX / 2;
    const rightEdge = spanX / 2;
    const doorL = doorLocal - doorW / 2;
    const doorR = doorLocal + doorW / 2;
    const leftW = doorL - leftEdge;
    const rightW = rightEdge - doorR;
    const z = d / 2 - inset;
    box(room, `${name}_WALL_S_L`, [leftW, h, t], [(leftEdge + doorL) / 2, h / 2, z], finish.wall, {
      type: "cold_room_panel",
      thickness_mm: 100,
    });
    box(room, `${name}_WALL_S_R`, [rightW, h, t], [(doorR + rightEdge) / 2, h / 2, z], finish.wall, {
      type: "cold_room_panel",
      thickness_mm: 100,
    });
    box(room, `${name}_WALL_S_HEAD`, [doorW, h - 2.6, t], [doorLocal, 2.6 + (h - 2.6) / 2, z], finish.wall);
    band("WALL_S", [spanX, 0.16, 0.02], [0, h - 0.2, z + 0.06]);
    slidingColdDoor(room, name, doorLocal, z);
  }
  box(room, `${name}_WALL_W`, [t, h, spanZ], [-w / 2 + inset, h / 2, 0], finish.wall, {
    type: "cold_room_panel",
    thickness_mm: 100,
  });
  box(room, `${name}_WALL_E`, [t, h, spanZ], [w / 2 - inset, h / 2, 0], finish.wall, {
    type: "cold_room_panel",
    thickness_mm: 100,
  });
  band("WALL_W", [0.02, 0.16, spanZ], [-w / 2 + inset + 0.06, h - 0.2, 0]);
  band("WALL_E", [0.02, 0.16, spanZ], [w / 2 - inset - 0.06, h - 0.2, 0]);
  return room;
}

function addRack(parent, name, x, z, yaw, meta, levels = 4) {
  const sideLabel = meta.sideLabel;
  const locationCode = meta.locationCode;
  const rack = group(parent, name, [x, 0, z], {
    type: "RACK",
    rackId: locationCode,
    zoneName: meta.zoneName,
    zone: meta.zoneId,
    sideLabel,
    locationCode,
    height_mm: 4500,
    depth_mm: 1100,
    bayWidth_mm: 2700,
    capacityKg: 1000,
  });
  rack.rotation.y = yaw;
  const w = 2.7;
  const d = 1.1;
  const h = 4.5;
  for (const px of [-w / 2, w / 2]) {
    for (const pz of [-d / 2, d / 2]) {
      box(rack, `${name}_POST`, [0.08, h, 0.08], [px, h / 2, pz], mats.MAT_RACK_BLUE);
    }
  }
  box(rack, `${name}_SIGN`, [1.35, 0.36, 0.04], [0, 4.2, d / 2 + 0.06], mats.MAT_RACK_SIGN, {
    type: "RACK_SIGN",
    locationCode,
    zoneName: meta.zoneName,
    sideLabel,
  });
  for (let level = 0; level < levels; level++) {
    const y = 0.35 + level * 1.05;
    const levelNo = String(level + 1).padStart(2, "0");
    box(rack, `${name}_BEAM_F_L${level + 1}`, [w, 0.08, 0.08], [0, y, d / 2], mats.MAT_RACK_ORANGE, {
      type: "LEVEL_MARK",
      zoneName: meta.zoneName,
      rackId: locationCode,
      level: levelNo,
      slots: `${locationCode}-L${levelNo}-P01 / P02`,
    });
    box(rack, `${name}_BEAM_B_L${level + 1}`, [w, 0.08, 0.08], [0, y, -d / 2], mats.MAT_RACK_ORANGE);
    box(rack, `${name}_SUPPORT_L${level + 1}`, [0.08, 0.06, d - 0.16], [0, y + 0.02, 0], mats.MAT_RACK_ORANGE);
    for (const [positionNo, px] of [["01", -0.64], ["02", 0.64]]) {
      const slotCode = `${locationCode}-L${levelNo}-P${positionNo}`;
      box(rack, `${name}_DECK_L${levelNo}_P${positionNo}`, [1.18, 0.045, d - 0.16], [px, y + 0.08, 0], mats.MAT_RACK_DECK, {
        type: "LOCATION",
        locationCode: slotCode,
        zoneName: meta.zoneName,
        rackId: locationCode,
        level: levelNo,
        position: positionNo,
      });
    }
    if (level % 2 === 0) {
      box(rack, `${name}_PALLET_L${level + 1}`, [1.05, 0.12, 0.9], [-0.64, y + 0.18, 0], mats.MAT_PALLET_WOOD, {
        type: "PALLET_POSITION",
        locationCode: `${locationCode}-L${levelNo}-P01`,
      });
      box(rack, `${name}_CARGO_L${level + 1}`, [0.95, 0.62, 0.78], [-0.64, y + 0.56, 0], mats.MAT_CARGO);
    }
  }
  return rack;
}

function fillRacks(parent, prefix, width, depth, zoneId, zoneName, code) {
  const racks = group(parent, `RACKS_${prefix}`);
  const bay = 2.9;
  const count = Math.max(2, Math.floor((width - 1.6) / bay));
  const start = -((count - 1) * bay) / 2;
  const meta = { zoneId, zoneName, code };
  for (let i = 0; i < count; i++) {
    const x = start + i * bay;
    const index = String(i + 1).padStart(2, "0");
    addRack(racks, `RACK_${prefix}_${index}_N`, x, -depth / 2 + 1.15, 0, {
      ...meta,
      sideLabel: "Bắc",
      locationCode: `${code}-R${index}-BAC`,
    });
    addRack(racks, `RACK_${prefix}_${index}_S`, x, depth / 2 - 1.15, Math.PI, {
      ...meta,
      sideLabel: "Nam",
      locationCode: `${code}-R${index}-NAM`,
    });
  }
  racks.userData = { type: "RACK_ROW", zone: zoneId, zoneName, designStatus: "CONCEPTUAL" };
}

function evaporator(parent, name, x, y, z) {
  const unit = group(parent, name, [x, y, z], {
    type: "EVAPORATOR",
    equipmentId: name,
    width_mm: 3000,
    height_mm: 1200,
    depth_mm: 800,
    fans: 3,
  });
  box(unit, `${name}_BODY`, [3, 1.2, 0.8], [0, 0, 0], mats.MAT_CONDENSER);
  for (const fx of [-0.9, 0, 0.9]) {
    cyl(unit, `${name}_FAN`, 0.28, 0.08, [fx, -0.15, 0.42], "z", mats.MAT_STEEL_GALVANIZED);
  }
  return unit;
}

function pushPoint(list, point) {
  const last = list[list.length - 1];
  if (!last || last.some((value, index) => Math.abs(value - point[index]) > 0.02)) list.push(point);
}

function orthogonalize(points) {
  const path = [[...points[0]]];
  for (let i = 1; i < points.length; i++) {
    const a = path[path.length - 1];
    const b = points[i];
    if (Math.abs(b[1] - a[1]) > 0.02) pushPoint(path, [a[0], b[1], a[2]]);
    if (Math.abs(b[0] - a[0]) > 0.02) pushPoint(path, [b[0], b[1], a[2]]);
    pushPoint(path, [b[0], b[1], b[2]]);
  }
  return path;
}

function pipeRun(parent, name, points, radius, material, userData) {
  const run = group(parent, name, [0, 0, 0], userData);
  const path = orthogonalize(points);
  for (let i = 0; i < path.length - 1; i++) {
    const a = new THREE.Vector3(...path[i]);
    const b = new THREE.Vector3(...path[i + 1]);
    const delta = b.clone().sub(a);
    const length = delta.length();
    if (length < 0.04) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const axis = Math.abs(delta.x) >= Math.abs(delta.y) && Math.abs(delta.x) >= Math.abs(delta.z)
      ? "x"
      : Math.abs(delta.z) >= Math.abs(delta.y)
        ? "z"
        : "y";
    cyl(run, `${name}_${i + 1}`, radius, length, [mid.x, mid.y, mid.z], axis, material, userData);
  }
  for (let i = 1; i < path.length - 1; i++) {
    box(run, `${name}_ELBOW_${i}`, [radius * 2.4, radius * 2.4, radius * 2.4], path[i], material, userData);
  }
  return run;
}

function sensor(parent, name, position, type) {
  box(parent, name, [0.18, 0.18, 0.12], position, mats.MAT_SENSOR, {
    type,
    sensorId: name,
  });
}

function build() {
  const root = new THREE.Group();
  root.name = "ROOT";

  const building = group(root, "BUILDING");
  const floor = group(building, "FLOOR");
  box(floor, "FOUNDATION_SLAB", [W + 2, 0.35, D + 2], [0, -0.28, 0], mats.MAT_SLAB, {
    type: "foundation",
  });
  box(floor, "INDUSTRIAL_FLOOR", [W, 0.12, D], [0, 0.02, 0], mats.MAT_FLOOR_EPOXY_GRAY, {
    type: "floor",
    finish: "industrial epoxy",
    cutaway: "one technical detail only — layers stored as metadata",
    layers: "compacted soil / concrete / waterproof / insulation / epoxy",
  });
  box(floor, "FLOOR_CUTAWAY", [1.6, 0.45, 0.9], [-22.5, 0.15, -13], mats.MAT_SLAB, {
    type: "floor_cutaway",
    layers: "soil, slab, waterproof, insulation, protection, epoxy",
  });

  const walls = group(building, "WALLS");
  const h = 8.2;
  box(walls, "WALL_NORTH", [W, h, 0.2], [0, h / 2, -HALF_D], mats.MAT_WALL_EXT);
  box(walls, "WALL_NORTH_PLINTH", [W, 0.7, 0.04], [0, 0.35, -HALF_D + 0.12], mats.MAT_WALL_PLINTH);
  const dockXs = [-20, -4, 12];
  const dockHalf = 2.2;
  const southSpans = [];
  let cursor = -HALF_W;
  for (const dockX of dockXs) {
    const openL = dockX - dockHalf;
    if (openL - cursor > 0.2) southSpans.push([cursor, openL]);
    cursor = dockX + dockHalf;
  }
  if (HALF_W - cursor > 0.2) southSpans.push([cursor, HALF_W]);
  southSpans.forEach(([a, b], index) => {
    box(walls, `WALL_SOUTH_${index + 1}`, [b - a, h, 0.2], [(a + b) / 2, h / 2, HALF_D], mats.MAT_WALL_EXT);
  });
  box(walls, "WALL_SOUTH_HEAD", [W, h - 4.5, 0.2], [0, 4.5 + (h - 4.5) / 2, HALF_D], mats.MAT_WALL_EXT);
  box(walls, "WALL_WEST", [0.2, h, D], [-HALF_W, h / 2, 0], mats.MAT_WALL_EXT);
  box(walls, "WALL_EAST", [0.2, h, D], [HALF_W, h / 2, 0], mats.MAT_WALL_EXT);

  const structure = group(building, "STRUCTURE");
  for (const x of GRID_X) {
    for (const z of GRID_Z) {
      box(structure, `COLUMN_${x}_${z}`, [0.4, PANEL_H, 0.4], [x, PANEL_H / 2, z], mats.MAT_STEEL_GALVANIZED, {
        type: "COLUMN",
        gridX: String(x),
        gridZ: String(z),
      });
    }
  }

  const roof = group(building, "ROOF");
  box(roof, "ROOF_DECK", [W + 0.6, 0.16, D + 0.6], [0, h + 0.2, 0], mats.MAT_ROOF);
  for (let i = 0; i <= 6; i++) {
    const x = -HALF_W + i * 8;
    box(roof, `ROOF_TRUSS_${i + 1}`, [0.16, 0.45, D], [x, h - 0.15, 0], mats.MAT_STEEL_GALVANIZED);
  }

  const doors = group(building, "DOORS");
  for (const [index, x] of dockXs.entries()) {
    const dock = group(doors, `DOCK_DOOR_0${index + 1}`, [x, 0, HALF_D + 0.05], { type: "DOCK_DOOR" });
    box(dock, `DOCK_DOOR_0${index + 1}_FRAME_L`, [0.12, 4.3, 0.16], [-2.15, 2.15, 0], mats.MAT_STEEL_GALVANIZED);
    box(dock, `DOCK_DOOR_0${index + 1}_FRAME_R`, [0.12, 4.3, 0.16], [2.15, 2.15, 0], mats.MAT_STEEL_GALVANIZED);
    box(dock, `DOCK_DOOR_0${index + 1}_HEADER`, [4.4, 0.16, 0.18], [0, 4.22, 0], mats.MAT_STEEL_GALVANIZED);
    for (let panel = 0; panel < 4; panel++) {
      box(dock, `DOCK_DOOR_0${index + 1}_PANEL_${panel + 1}`, [4.05, 0.92, 0.08], [0, 0.52 + panel * 1.0, 0.06], mats.MAT_DOOR_LEAF);
      if (panel > 0) {
        box(dock, `DOCK_DOOR_0${index + 1}_SEAM_${panel}`, [4.05, 0.04, 0.02], [0, panel * 1.0, 0.11], mats.MAT_DOOR_TRACK);
      }
    }
    box(dock, `DOCK_DOOR_0${index + 1}_SAFETY`, [4.05, 0.12, 0.02], [0, 0.18, 0.11], mats.MAT_YELLOW);
    box(doors, `LOADING_DOCK_0${index + 1}`, [4.6, 1.05, 2.4], [x, 0.5, HALF_D + 1.5], mats.MAT_STEEL_GALVANIZED, {
      type: "LOADING_DOCK",
    });
  }

  const zones = group(root, "ZONES");
  const cool = panelRoom(zones, "ZONE_COOL_2_8C", -24, -5, -8, 5, PANEL_H, {
    zoneId: "COLD-01",
    name: "Kho mát 2–8°C",
    temperatureMin: 2,
    temperatureMax: 8,
    zoneType: "COLD_STORAGE",
  });
  const freezer = panelRoom(zones, "ZONE_FREEZER_MINUS20", -8, -5, 8, 5, PANEL_H, {
    zoneId: "FREEZER-01",
    name: "Kho đông -20°C",
    targetTemperature: -20,
    zoneType: "FREEZER",
  });
  const deep = panelRoom(zones, "ZONE_DEEP_FREEZER_MINUS25", 8, -5, 24, 5, PANEL_H, {
    zoneId: "DEEP-01",
    name: "Kho đông sâu -25°C",
    targetTemperature: -25,
    zoneType: "DEEP_FREEZER",
  });

  panelRoom(zones, "ZONE_RECEIVING", -24, 5, -8, 15, PANEL_H, {
    zoneId: "RECV-01",
    name: "Khu nhận hàng",
    zoneType: "RECEIVING",
  });
  panelRoom(zones, "ZONE_PREP", -8, 5, 0, 15, PANEL_H, {
    zoneId: "PREP-01",
    name: "Khu chuẩn bị hàng",
    zoneType: "STAGING",
  });
  panelRoom(zones, "ZONE_PACKING", 0, 5, 8, 15, PANEL_H, {
    zoneId: "PACK-01",
    name: "Khu đóng gói",
    zoneType: "PACKING",
  });
  panelRoom(zones, "ZONE_DISPATCH", 8, 5, 24, 15, PANEL_H, {
    zoneId: "DISP-01",
    name: "Khu xuất hàng",
    zoneType: "DISPATCH",
  });

  const machine = panelRoom(zones, "PHONG_MAY_LANH", -24, -15, -8, -5, PANEL_H, {
    zoneId: "MECH-01",
    name: "Phòng máy lạnh",
    zoneType: "MACHINE_ROOM",
  });
  panelRoom(zones, "ELECTRICAL_ROOM", -8, -15, 0, -5, PANEL_H, {
    zoneId: "ELEC-01",
    name: "Phòng điện",
    zoneType: "ELECTRICAL_ROOM",
  });
  const office = panelRoom(zones, "ZONE_OFFICE", 0, -15, 8, -5, PANEL_H, {
    zoneId: "OFF-01",
    name: "Phòng giám sát",
    zoneType: "OFFICE",
  });
  monitoringRoom(office);
  panelRoom(zones, "ZONE_SUPPORT", 8, -15, 16, -5, PANEL_H, {
    zoneId: "SUP-01",
    name: "Khu phụ trợ",
    zoneType: "SUPPORT",
  });
  panelRoom(zones, "ZONE_TECHNICAL", 16, -15, 24, -5, PANEL_H, {
    zoneId: "TECH-01",
    name: "Khu kỹ thuật",
    zoneType: "TECHNICAL_CORRIDOR",
  });

  const storage = group(root, "STORAGE");
  const racks = group(storage, "RACKS");
  fillRacks(racks, "COOL", 14, 8.2, "ZONE_COOL_2_8C", "Kho mát 2–8°C", "MAT");
  racks.children.at(-1).position.set(-16, 0, 0);
  fillRacks(racks, "FREEZER20", 14, 8.2, "ZONE_FREEZER_MINUS20", "Kho đông -20°C", "D20");
  racks.children.at(-1).position.set(0, 0, 0);
  fillRacks(racks, "DEEP25", 14, 8.2, "ZONE_DEEP_FREEZER_MINUS25", "Kho đông sâu -25°C", "D25");
  racks.children.at(-1).position.set(16, 0, 0);

  const pallets = group(storage, "PALLETS");
  box(pallets, "PALLET_STAGING_01", [1.2, 0.9, 1.0], [-16, 0.55, 10], mats.MAT_CARGO, { type: "STAGING_PALLET" });
  box(pallets, "PALLET_STAGING_02", [1.2, 0.9, 1.0], [16, 0.55, 10], mats.MAT_CARGO, { type: "STAGING_PALLET" });

  for (const x of [-20, -12, -4, 4, 12, 20]) {
    box(floor, `FORKLIFT_MARK_${x}`, [1.6, 0.02, 0.12], [x, 0.1, 5.2], mats.MAT_YELLOW, { type: "FLOOR_MARKING" });
  }
  box(floor, "AISLE_MARK_MAIN", [0.12, 0.02, 18], [0, 0.1, 5], mats.MAT_YELLOW);

  const compXs = [-21, -18.2, -13.2];
  const compZ = -10;
  const evapXs = [-20, -12, -4, 4, 12, 20];
  const evapY = 5.2;
  const evapZ = -4.0;
  const suctionZ = -4.4;
  const suctionY = 6.3;
  const liquidZ = -4.15;
  const liquidY = 5.9;
  const hotZ = -4.4;
  const hotY = 5.55;
  const condenserTie = [-16, 1.45, -16.5];

  const refrig = group(root, "REFRIGERATION");
  const compressors = group(refrig, "COMPRESSORS");
  for (const [index, x] of compXs.entries()) {
    const id = `COMPRESSOR_0${index + 1}`;
    box(compressors, id, [1.3, 1.5, 1.1], [x, 0.9, compZ], mats.MAT_STEEL_GALVANIZED, {
      type: "COMPRESSOR",
      equipmentId: id,
    });
    cyl(compressors, `${id}_HEAD`, 0.28, 0.35, [x, 1.85, compZ], "y", mats.MAT_PIPE_DISCHARGE_RED);
  }
  box(machine, "LIQUID_RECEIVER", [1.6, 1.1, 0.7], [3.5, 0.7, -2], mats.MAT_PIPE_LIQUID_GREEN, { type: "LIQUID_RECEIVER" });
  box(machine, "OIL_SEPARATOR", [0.55, 1.3, 0.55], [2.5, 0.8, 1.5], mats.MAT_PIPE_OIL_ORANGE, { type: "OIL_SEPARATOR" });
  box(machine, "PUMP_SET", [1.4, 0.7, 0.8], [-5, 0.5, 2], mats.MAT_STEEL_GALVANIZED, { type: "PUMP_SET" });
  hmiPedestal(machine, "MACHINE_HMI", -5.5, -3.2, 0);
  box(machine, "MANIFOLD", [3.2, 0.28, 0.28], [0, 3.3, -1.2], mats.MAT_STEEL_GALVANIZED, { type: "MANIFOLD" });

  const condensers = group(refrig, "CONDENSERS");
  const bank = group(condensers, "CONDENSER_BANK_01", [-16, 0, -17.3], { type: "CONDENSER" });
  box(bank, "CONDENSER_FRAME", [8, 0.2, 2.4], [0, 1.6, 0], mats.MAT_STEEL_GALVANIZED);
  box(bank, "CONDENSER_COIL", [7.4, 1.3, 1.6], [0, 0.8, 0], mats.MAT_CONDENSER);
  for (const x of [-2.4, 0, 2.4]) cyl(bank, "CONDENSER_FAN", 0.55, 0.2, [x, 1.85, 0], "y", mats.MAT_STEEL_GALVANIZED);

  const evaps = group(refrig, "EVAPORATORS");
  const evapNames = ["EVAP_COOL_01", "EVAP_COOL_02", "EVAP_FREEZER_01", "EVAP_FREEZER_02", "EVAP_DEEP_01", "EVAP_DEEP_02"];
  evapXs.forEach((x, index) => evaporator(evaps, evapNames[index], x, evapY, evapZ));

  const piping = group(refrig, "REFRIGERATION_PIPES");
  pipeRun(piping, "PIPE_SUCTION_MAIN", [
    [-22, suctionY, suctionZ],
    [22, suctionY, suctionZ],
  ], 0.16, mats.MAT_PIPE_SUCTION_BLUE, { system: "SUCTION", insulated: true });
  pipeRun(piping, "PIPE_SUCTION_TO_MACHINE", [
    [-18, suctionY, suctionZ],
    [-18, suctionY, -6.5],
    [-18, 2.3, -6.5],
    [-18, 2.3, compZ],
  ], 0.16, mats.MAT_PIPE_SUCTION_BLUE, { system: "SUCTION", insulated: true, connects: "COMPRESSOR" });
  for (const x of evapXs) {
    pipeRun(piping, `PIPE_SUCTION_EVAP_${x}`, [[x, evapY + 0.6, suctionZ], [x, suctionY, suctionZ]], 0.1, mats.MAT_PIPE_SUCTION_BLUE, {
      system: "SUCTION",
      insulated: true,
      connects: "EVAPORATOR",
    });
  }
  for (const x of compXs) {
    pipeRun(piping, `PIPE_SUCTION_COMP_${x}`, [[x, 1.15, compZ], [x, 2.3, compZ], [-18, 2.3, compZ]], 0.1, mats.MAT_PIPE_SUCTION_BLUE, {
      system: "SUCTION",
      insulated: true,
      connects: "COMPRESSOR",
    });
  }
  pipeRun(piping, "PIPE_DISCHARGE_MAIN", [
    [-16, 3.3, compZ],
    [-16, 3.3, -11.2],
    [-16, 3.3, condenserTie[2]],
    condenserTie,
  ], 0.12, mats.MAT_PIPE_DISCHARGE_RED, { system: "DISCHARGE", connects: "CONDENSER_BANK_01" });
  for (const x of compXs) {
    pipeRun(piping, `PIPE_DISCHARGE_COMP_${x}`, [[x, 2.05, compZ], [x, 3.3, compZ], [-16, 3.3, compZ]], 0.1, mats.MAT_PIPE_DISCHARGE_RED, {
      system: "DISCHARGE",
      connects: "COMPRESSOR",
    });
  }
  pipeRun(piping, "PIPE_LIQUID_MAIN", [
    [-12.5, 1.25, -12],
    [-12.5, liquidY, -12],
    [-12.5, liquidY, liquidZ],
    [22, liquidY, liquidZ],
  ], 0.1, mats.MAT_PIPE_LIQUID_GREEN, { system: "LIQUID", connects: "LIQUID_RECEIVER" });
  for (const x of evapXs) {
    pipeRun(piping, `PIPE_LIQUID_EVAP_${x}`, [[x, liquidY, liquidZ], [x, evapY + 0.35, liquidZ]], 0.07, mats.MAT_PIPE_LIQUID_GREEN, {
      system: "LIQUID",
      connects: "EVAPORATOR",
    });
  }
  pipeRun(piping, "PIPE_HOTGAS_MAIN", [
    [-16, 3.1, -11.2],
    [-16, hotY, -11.2],
    [-16, hotY, hotZ],
    [22, hotY, hotZ],
  ], 0.08, mats.MAT_PIPE_HOTGAS_PURPLE, { system: "HOT_GAS_DEFROST" });
  for (const x of evapXs) {
    pipeRun(piping, `PIPE_HOTGAS_EVAP_${x}`, [[x, hotY, hotZ], [x, evapY + 0.15, hotZ]], 0.06, mats.MAT_PIPE_HOTGAS_PURPLE, {
      system: "HOT_GAS_DEFROST",
      connects: "EVAPORATOR",
    });
  }
  pipeRun(piping, "PIPE_OIL_RETURN", [
    [-13.5, 0.9, -8.5],
    [-13.5, 0.55, -8.5],
    [-21, 0.55, -8.5],
    [-21, 0.55, compZ],
  ], 0.06, mats.MAT_PIPE_OIL_ORANGE, { system: "OIL_RETURN", connects: "OIL_SEPARATOR" });
  for (const x of compXs) {
    pipeRun(piping, `PIPE_OIL_COMP_${x}`, [[x, 0.55, compZ], [x, 0.55, -8.5]], 0.05, mats.MAT_PIPE_OIL_ORANGE, {
      system: "OIL_RETURN",
      connects: "COMPRESSOR",
    });
  }
  box(piping, "VALVE_SUCTION_01", [0.22, 0.22, 0.22], [-18, suctionY, -6.5], mats.MAT_STEEL_GALVANIZED, { type: "ISOLATION_VALVE" });
  box(piping, "VALVE_LIQUID_01", [0.18, 0.18, 0.18], [-12.5, liquidY, -8], mats.MAT_STEEL_GALVANIZED, { type: "SERVICE_VALVE" });
  box(piping, "VALVE_DISCHARGE_01", [0.2, 0.2, 0.2], [-16, 3.3, -14], mats.MAT_STEEL_GALVANIZED, { type: "CHECK_VALVE" });

  const electrical = group(root, "ELECTRICAL");
  const panels = group(electrical, "PANELS");
  switchboard(panels, "MAIN_SWITCHBOARD", [-6.4, 0, -13.2], Math.PI, { type: "MDB" });
  switchboard(panels, "MCC_PANEL", [-4.2, 0, -13.2], Math.PI, { type: "MCC" });
  switchboard(panels, "ATS", [-2.0, 0, -13.2], Math.PI, { type: "ATS" }, 0.85);
  switchboard(panels, "GENERATOR", [-4.8, 0, -8.6], 0, { type: "GENERATOR" });
  wallCabinet(panels, "COLD_ROOM_DB_01", [-22.2, 0, -4.55], 0, { type: "DB" });
  wallCabinet(panels, "COLD_ROOM_DB_02", [6.2, 0, -4.55], 0, { type: "DB" });
  wallCabinet(panels, "LIGHTING_DB", [-7.2, 0, -6.4], 0, { type: "DB" });
  wallCabinet(panels, "CONTROL_DB", [-5.2, 0, -6.4], 0, { type: "DB" });

  const trays = group(electrical, "CABLE_TRAYS");
  box(trays, "CABLE_TRAY_MAIN", [18, 0.08, 0.32], [-12, 4.7, -13.6], mats.MAT_STEEL_GALVANIZED, { type: "CABLE_TRAY" });
  box(trays, "CABLE_TRAY_MACHINE_ROOM", [12, 0.08, 0.28], [-16, 4.5, -10], mats.MAT_STEEL_GALVANIZED, { type: "CABLE_TRAY" });
  box(trays, "CABLE_TRAY_RISER", [0.28, 1.1, 0.28], [-4, 5.15, -8.5], mats.MAT_STEEL_GALVANIZED, { type: "CABLE_TRAY" });
  box(trays, "CABLE_TRAY_COLD_ROOM", [44, 0.08, 0.28], [0, 5.45, -4.9], mats.MAT_STEEL_GALVANIZED, { type: "CABLE_TRAY" });

  for (const x of [-18, -8, 0, 8, 16]) {
    box(building, `LED_WAREHOUSE_${x}`, [1.6, 0.08, 0.28], [x, 7.6, 8], mats.MAT_GLASS, { type: "LIGHT", area: "WAREHOUSE" });
  }
  box(cool, "LED_COLD_COOL", [1.2, 0.06, 0.2], [0, 5.9, 0], mats.MAT_GLASS, { type: "LIGHT", area: "COLD_ROOM" });
  box(machine, "LED_MACHINE", [1.2, 0.06, 0.2], [0, 5.0, 0], mats.MAT_GLASS, { type: "LIGHT", area: "MACHINE_ROOM" });

  const water = group(root, "WATER");
  const supply = group(water, "SUPPLY");
  pipeRun(supply, "WATER_SUPPLY_MAIN", [[-22, 0.12, -13], [-22, 0.12, 10], [20, 0.12, 10]], 0.06, mats.MAT_WATER, { system: "WATER_SUPPLY" });
  const drain = group(water, "DRAINAGE");
  pipeRun(drain, "EVAP_DRAIN_HEADER", [[-22, 0.1, -3.2], [22, 0.1, -3.2], [-22, 0.1, 12]], 0.05, mats.MAT_DRAIN, { system: "CONDENSATE" });
  for (const x of evapXs) {
    pipeRun(drain, `EVAP_DRAIN_${x}`, [[x, evapY - 0.6, evapZ], [x, 0.1, evapZ], [x, 0.1, -3.2]], 0.045, mats.MAT_DRAIN, {
      system: "CONDENSATE",
      connects: "EVAPORATOR",
    });
  }
  box(drain, "FLOOR_DRAIN_01", [0.35, 0.06, 0.35], [-22, 0.16, 12], mats.MAT_DRAIN, { type: "FLOOR_DRAIN" });
  box(water, "DRAIN_PUMP", [0.7, 0.55, 0.55], [-21.2, 0.45, 12], mats.MAT_STEEL_GALVANIZED, { type: "PUMP" });

  const sensors = group(root, "SENSORS");
  sensor(sensors, "TEMP_SENSOR_ZONE_COOL_01", [-16, 4.2, 0], "TEMPERATURE");
  sensor(sensors, "HUM_SENSOR_ZONE_COOL_01", [-14, 4.2, 0], "HUMIDITY");
  sensor(sensors, "TEMP_SENSOR_ZONE_FREEZER_01", [0, 4.2, 0], "TEMPERATURE");
  sensor(sensors, "TEMP_SENSOR_ZONE_DEEP_01", [16, 4.2, 0], "TEMPERATURE");
  sensor(sensors, "DOOR_SENSOR_FREEZER_01", [-4, 2.2, 4.7], "DOOR");
  sensor(sensors, "PRESSURE_SENSOR_SUCTION_01", [-18, 3.2, -6.5], "PRESSURE");

  const equipment = group(root, "EQUIPMENT");
  forklift(equipment, "FORKLIFT_RECEIVING", -16, 10, 0.4);
  forklift(equipment, "FORKLIFT_DISPATCH", 16, 10, -0.6);
  conveyor(equipment, "CONVEYOR_PACKING", 4, 10, 6, 0);
  conveyor(equipment, "CONVEYOR_RECEIVING", -16, 11.5, 8, 0);
  for (const [index, x] of dockXs.entries()) {
    truck(equipment, `TRUCK_DOCK_0${index + 1}`, x);
  }
  box(equipment, "FIRE_EXTINGUISHER_01", [0.28, 0.7, 0.28], [-23.2, 0.5, 6], mats.MAT_PIPE_DISCHARGE_RED, {
    type: "FIRE_EXTINGUISHER",
    note: "conceptual reference",
  });
  box(equipment, "EMERGENCY_EXIT_01", [1.2, 2.1, 0.08], [23.6, 1.2, 6], mats.MAT_YELLOW, { type: "EMERGENCY_EXIT" });

  // Keep legacy click names used by the current warehouse page.
  alias(cool, "Zone_C1");
  alias(freezer, "Zone_C2");
  alias(deep, "Zone_C3");
  alias(machine, "Zone_C4");

  return root;
}

function alias(source, name) {
  const marker = new THREE.Object3D();
  marker.name = name;
  source.add(marker);
}

function workstation(parent, name, x, z, yaw) {
  const node = group(parent, name, [x, 0, z], { type: "WORKSTATION", role: "monitoring" });
  node.rotation.y = yaw;
  box(node, `${name}_TOP`, [1.35, 0.05, 0.68], [0, 0.74, 0], mats.MAT_DESK);
  for (const [lx, lz] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]]) {
    box(node, `${name}_LEG`, [0.05, 0.74, 0.05], [lx, 0.37, lz], mats.MAT_STEEL_GALVANIZED);
  }
  box(node, `${name}_BEZEL`, [0.58, 0.36, 0.04], [0, 1.1, -0.28], mats.MAT_BEZEL);
  box(node, `${name}_SCREEN`, [0.5, 0.28, 0.012], [0, 1.11, -0.255], mats.MAT_SCREEN);
  box(node, `${name}_NECK`, [0.06, 0.14, 0.06], [0, 0.86, -0.28], mats.MAT_BEZEL);
  box(node, `${name}_KEYBOARD`, [0.4, 0.02, 0.14], [0, 0.78, 0.02], mats.MAT_BEZEL);
  box(node, `${name}_SEAT`, [0.46, 0.07, 0.46], [0, 0.48, 0.62], mats.MAT_CHAIR);
  box(node, `${name}_BACK`, [0.46, 0.4, 0.05], [0, 0.72, 0.82], mats.MAT_CHAIR);
  cyl(node, `${name}_POST`, 0.035, 0.22, [0, 0.34, 0.62], "y", mats.MAT_STEEL_GALVANIZED);
  cyl(node, `${name}_BASE`, 0.2, 0.04, [0, 0.2, 0.62], "y", mats.MAT_STEEL_GALVANIZED);
}

function videoWall(parent, name, x, z, yaw) {
  const node = group(parent, name, [x, 0, z], { type: "VIDEO_WALL", role: "monitoring" });
  node.rotation.y = yaw;
  box(node, `${name}_BACK`, [2.5, 1.35, 0.06], [0, 1.65, 0], mats.MAT_BEZEL);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 2; row++) {
      box(
        node,
        `${name}_SCREEN_${col}_${row}`,
        [0.72, 0.48, 0.02],
        [-0.78 + col * 0.78, 1.4 + row * 0.54, 0.04],
        mats.MAT_SCREEN,
      );
    }
  }
}

function noticeBoard(parent, name, x, z, yaw) {
  const node = group(parent, name, [x, 0, z], { type: "NOTICE_BOARD", role: "operations" });
  node.rotation.y = yaw;
  box(node, `${name}_FRAME`, [2.4, 1.25, 0.04], [0, 1.65, 0], mats.MAT_BEZEL);
  box(node, `${name}_BOARD`, [2.22, 1.08, 0.02], [0, 1.66, 0.03], mats.MAT_DOOR_LEAF);
  box(node, `${name}_NOTE_A`, [0.32, 0.22, 0.01], [-0.7, 1.9, 0.05], mats.MAT_YELLOW);
  box(node, `${name}_NOTE_B`, [0.4, 0.26, 0.01], [0.15, 1.75, 0.05], mats.MAT_RACK_SIGN);
  box(node, `${name}_NOTE_C`, [0.28, 0.18, 0.01], [0.7, 1.95, 0.05], mats.MAT_SCREEN);
}

function wallCabinet(parent, name, position, yaw, userData) {
  const node = group(parent, name, position, userData);
  node.rotation.y = yaw;
  box(node, `${name}_BODY`, [0.62, 0.78, 0.18], [0, 1.55, 0], mats.MAT_PANEL_ELEC);
  box(node, `${name}_DOOR`, [0.52, 0.66, 0.02], [0, 1.56, 0.1], mats.MAT_STEEL_GALVANIZED);
  box(node, `${name}_LABEL`, [0.24, 0.08, 0.012], [0, 1.78, 0.12], mats.MAT_YELLOW);
  box(node, `${name}_HANDLE`, [0.04, 0.16, 0.03], [0.18, 1.5, 0.12], mats.MAT_BEZEL);
}

function monitoringRoom(office) {
  videoWall(office, "MONITOR_WALL", 0, 4.35, Math.PI);
  noticeBoard(office, "OPS_BOARD", 0, -4.65, 0);
  workstation(office, "OPS_DESK_01", -2.15, 1.6, Math.PI);
  workstation(office, "OPS_DESK_02", 0, 1.6, Math.PI);
  workstation(office, "OPS_DESK_03", 2.15, 1.6, Math.PI);
}

function hmiPedestal(parent, name, x, z, yaw) {
  const node = group(parent, name, [x, 0, z], { type: "HMI", role: "machine_control" });
  node.rotation.y = yaw;
  box(node, `${name}_CABINET`, [0.55, 1.15, 0.4], [0, 0.58, 0], mats.MAT_PANEL_ELEC);
  box(node, `${name}_BEZEL`, [0.42, 0.28, 0.03], [0, 1.28, 0.18], mats.MAT_BEZEL);
  box(node, `${name}_SCREEN`, [0.34, 0.2, 0.012], [0, 1.29, 0.2], mats.MAT_SCREEN);
}

function switchboard(parent, name, position, yaw, userData, scale = 1) {
  const node = group(parent, name, position, userData);
  node.rotation.y = yaw;
  node.scale.setScalar(scale);
  box(node, `${name}_BODY`, [0.85, 2.05, 0.42], [0, 1.02, 0], mats.MAT_PANEL_ELEC);
  box(node, `${name}_DOOR`, [0.72, 1.75, 0.03], [0, 1.05, 0.22], mats.MAT_STEEL_GALVANIZED);
  box(node, `${name}_SCREEN`, [0.18, 0.12, 0.015], [0.18, 1.62, 0.25], mats.MAT_SCREEN);
  box(node, `${name}_STRIPE`, [0.72, 0.07, 0.015], [0, 0.32, 0.25], mats.MAT_YELLOW);
  for (let slot = 0; slot < 5; slot++) {
    box(node, `${name}_BREAKER_${slot}`, [0.42, 0.05, 0.02], [-0.08, 1.35 - slot * 0.14, 0.25], mats.MAT_BEZEL);
  }
}

function conveyor(parent, name, x, z, length, yaw) {
  const node = group(parent, name, [x, 0, z], { type: "CONVEYOR", role: "transport" });
  node.rotation.y = yaw;
  const height = 0.7;
  box(node, `${name}_BELT`, [length, 0.05, 0.62], [0, height, 0], mats.MAT_RUBBER);
  box(node, `${name}_RAIL_L`, [length, 0.1, 0.05], [0, height - 0.08, -0.34], mats.MAT_STEEL_GALVANIZED);
  box(node, `${name}_RAIL_R`, [length, 0.1, 0.05], [0, height - 0.08, 0.34], mats.MAT_STEEL_GALVANIZED);
  const rollers = Math.max(2, Math.floor(length / 0.4));
  for (let index = 0; index < rollers; index++) {
    const rx = -length / 2 + 0.25 + index * ((length - 0.5) / rollers);
    cyl(node, `${name}_ROLLER_${index}`, 0.055, 0.58, [rx, height + 0.03, 0], "z", mats.MAT_STEEL_GALVANIZED);
  }
  for (const lx of [-length / 2 + 0.25, length / 2 - 0.25]) {
    box(node, `${name}_LEG_L`, [0.07, height, 0.07], [lx, height / 2, -0.28], mats.MAT_STEEL_GALVANIZED);
    box(node, `${name}_LEG_R`, [0.07, height, 0.07], [lx, height / 2, 0.28], mats.MAT_STEEL_GALVANIZED);
  }
  box(node, `${name}_CARTON`, [0.48, 0.32, 0.38], [-0.8, height + 0.21, 0], mats.MAT_CARGO);
}

function forklift(parent, name, x, z, yaw) {
  placeProp(parent, name, templates.forklift, [x, 0, z], yaw + Math.PI / 2, 1.35, { type: "FORKLIFT" });
}

function truck(parent, name, x) {
  const scale = 1;
  const probe = templates.truck.clone(true);
  probe.scale.setScalar(scale);
  probe.updateMatrixWorld(true);
  const length = new THREE.Box3().setFromObject(probe).getSize(new THREE.Vector3()).z;
  placeProp(parent, name, templates.truck, [x, 0, 18.2 + length / 2], 0, scale, { type: "TRUCK" });
}

templates = {
  forklift: await loadTemplate("forklift.glb", false),
  truck: await loadTemplate("truck.glb", true),
  door: await loadTemplate("metal-door.glb", true),
};

const scene = new THREE.Scene();
scene.name = "WMS_ColdStorage_Technical";
scene.add(build());
{
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z, bounds.min.y].every(Number.isFinite)) {
    throw new Error("Warehouse bounds are not finite");
  }
  console.log(`bounds ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`);
}

const exporter = new GLTFExporter();
const glb = await new Promise((resolveExport, reject) => {
  exporter.parse(scene, resolveExport, reject, { binary: true });
});
const outputDir = resolve("public/models/warehouse");
await mkdir(outputDir, { recursive: true });
const bytes = Buffer.from(glb);
const targets = [
  "warehouse-cold-storage.glb",
  "warehouse_cold_storage.glb",
  "warehouse-cold-finished.glb",
  "warehouse-cold-raw-materials.glb",
];
for (const file of targets) {
  await writeFile(resolve(outputDir, file), bytes);
  console.log(`${file}: ${Math.round(bytes.byteLength / 1024)} KB`);
}
