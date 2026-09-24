export type LocationStatus =
  | "EMPTY"
  | "OCCUPIED"
  | "FULL"
  | "QUARANTINE"
  | "ON_HOLD"
  | "UNAVAILABLE";

export type QualityStatusCode =
  | "PASSED"
  | "QUARANTINE"
  | "FAILED"
  | "ON_HOLD";

export type WarehouseFallbackType = "WAREHOUSE" | "ZONE" | "RACK";

export type WarehousePageTab =
  | "model3d"
  | "warehouses"
  | "zones"
  | "locations";

export type WarehouseDetailTab = "locations" | "materials" | "history";

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  description: string;
  zoneCount: number;
  locationCount: number;
  utilization: number;
};

export type WarehouseZone = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  floor: string;
  description: string;
  locationCount: number;
  occupiedCount: number;
  emptyCount: number;
  utilization: number;
  /** Local 3D placement for placeholder boxes */
  position: [number, number, number];
  size: [number, number, number];
};

export type WarehouseRack = {
  id: string;
  zoneId: string;
  aisle: string;
  name: string;
};

export type WarehouseLocation = {
  id: string;
  code: string;
  warehouseId: string;
  zoneId: string;
  aisle: string;
  rack: string;
  materialName: string | null;
  lotCount: number;
  capacity: number;
  status: LocationStatus;
  updatedAt: string;
};

export type WarehouseTreeNode = {
  id: string;
  label: string;
  kind: "root" | "warehouse" | "zone" | "aisle" | "rack";
  warehouseId?: string;
  zoneId?: string;
  children?: WarehouseTreeNode[];
};

export type WarehouseKpi = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
};

export type Warehouse3DModelConfig = {
  id: string;
  name: string;
  glbUrl: string | null;
  fallbackType: WarehouseFallbackType;
  meshMappings: Record<string, string>;
  defaultCamera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  floorMappings: Record<string, string[]> | null;
};

export type WarehouseMaterialSummary = {
  id: string;
  name: string;
  lotCount: number;
  quality: QualityStatusCode;
};

export type WarehouseHistoryItem = {
  id: string;
  time: string;
  action: string;
  actor: string;
};
