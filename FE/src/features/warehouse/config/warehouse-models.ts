import type { Warehouse3DModelConfig } from "@/features/warehouse/types/warehouse.types";

/** Central GLB registry — null glbUrl = explicit placeholder (never fake a model). */
export const warehouseModels: Record<string, Warehouse3DModelConfig> = {
  k01: {
    id: "k01",
    name: "Kho nguyên liệu",
    glbUrl: "/models/warehouse/warehouse-main.glb",
    fallbackType: "WAREHOUSE",
    meshMappings: {
      Zone_A: "zone-a",
      Zone_B: "zone-b",
      Zone_C: "zone-c",
      Zone_Q: "zone-q",
    },
    defaultCamera: {
      position: [18, 14, 18],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
  k02: {
    id: "k02",
    name: "Kho bao bì",
    glbUrl: null,
    fallbackType: "WAREHOUSE",
    meshMappings: {},
    defaultCamera: {
      position: [16, 12, 16],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
  k03: {
    id: "k03",
    name: "Kho thành phẩm",
    glbUrl: null,
    fallbackType: "WAREHOUSE",
    meshMappings: {},
    defaultCamera: {
      position: [16, 12, 16],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
  k04: {
    id: "k04",
    name: "Kho mát 2–8°C",
    glbUrl: null,
    fallbackType: "WAREHOUSE",
    meshMappings: {},
    defaultCamera: {
      position: [14, 11, 14],
      target: [0, 0, 0],
    },
    floorMappings: null,
  },
  k05: {
    id: "k05",
    name: "Khu cách ly",
    glbUrl: null,
    fallbackType: "WAREHOUSE",
    meshMappings: {},
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
