import type { Warehouse3DModelConfig } from "@/features/warehouse/types/warehouse.types";

/** Central GLB registry — null glbUrl = explicit placeholder (never fake a model). */
export const warehouseModels: Record<string, Warehouse3DModelConfig> = {
  k01: {
    id: "k01",
    name: "Kho nguyên liệu",
    glbUrl: "/models/warehouse/warehouse-raw-materials.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_A: "zone-a",
      Zone_B: "zone-b",
      Zone_C: "zone-c",
      Zone_Q: "zone-q",
    },
    defaultCamera: {
      position: [72, 56, 72],
      target: [0, 1, 0],
    },
    floorMappings: null,
  },
  k02: {
    id: "k02",
    name: "Kho bao bì",
    glbUrl: "/models/warehouse/warehouse-packaging.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_P1: "zone-p1",
      Zone_P2: "zone-p2",
      Zone_P3: "zone-p3",
    },
    defaultCamera: {
      position: [16, 12, 16],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
  k03: {
    id: "k03",
    name: "Kho thành phẩm",
    glbUrl: "/models/warehouse/warehouse-finished-goods.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_F1: "zone-f1",
      Zone_F2: "zone-f2",
      Zone_F3: "zone-f3",
      Zone_F4: "zone-f4",
    },
    defaultCamera: {
      position: [16, 12, 16],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
  k04: {
    id: "k04",
    name: "Kho lạnh thành phẩm",
    glbUrl: "/models/warehouse/warehouse-cold-finished.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_C1: "zone-cold-1",
      Zone_C2: "zone-cold-2",
      Zone_C3: "zone-cold-3",
      Zone_C4: "zone-cold-4",
    },
    defaultCamera: {
      position: [48, 38, 48],
      target: [0, 2, 0],
    },
    floorMappings: null,
  },
  k06: {
    id: "k06",
    name: "Kho lạnh nguyên liệu",
    glbUrl: "/models/warehouse/warehouse-cold-raw-materials.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_C1: "zone-cold-raw-1",
      Zone_C2: "zone-cold-raw-2",
      Zone_C3: "zone-cold-raw-3",
      Zone_C4: "zone-cold-raw-4",
    },
    defaultCamera: {
      position: [48, 38, 48],
      target: [0, 2, 0],
    },
    floorMappings: null,
  },
  k05: {
    id: "k05",
    name: "Khu cách ly",
    glbUrl: "/models/warehouse/warehouse-quarantine.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_Q1: "zone-qc-1",
      Zone_Q2: "zone-qc-2",
      Zone_Q3: "zone-qc-3",
    },
    defaultCamera: {
      position: [12, 10, 12],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
};

export function getWarehouseModel(
  warehouseId: string,
): Warehouse3DModelConfig | null {
  return warehouseModels[warehouseId] ?? null;
}
