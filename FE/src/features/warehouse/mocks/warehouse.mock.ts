import type {
  LocationStatus,
  Warehouse,
  WarehouseHistoryItem,
  WarehouseKpi,
  WarehouseLocation,
  WarehouseMaterialSummary,
  WarehouseRack,
  WarehouseTreeNode,
  WarehouseZone,
} from "@/features/warehouse/types/warehouse.types";

export const warehouses: Warehouse[] = [
  {
    id: "k01",
    code: "K01",
    name: "Kho nguyên liệu",
    description:
      "Kho lưu trữ nguyên liệu dược phẩm theo tiêu chuẩn GMP-WHO, nhiệt độ thường.",
    zoneCount: 4,
    locationCount: 92,
    utilization: 83,
  },
  {
    id: "k02",
    code: "K02",
    name: "Kho bao bì",
    description: "Kho bao bì và vật tư phụ trợ đóng gói.",
    zoneCount: 3,
    locationCount: 64,
    utilization: 63,
  },
  {
    id: "k03",
    code: "K03",
    name: "Kho thành phẩm",
    description: "Kho thành phẩm chờ xuất / phân phối.",
    zoneCount: 4,
    locationCount: 110,
    utilization: 76,
  },
  {
    id: "k04",
    code: "K04",
    name: "Kho mát 2–8°C",
    description: "Kho lạnh kiểm soát nhiệt độ 2–8°C.",
    zoneCount: 2,
    locationCount: 42,
    utilization: 91,
  },
  {
    id: "k05",
    code: "K05",
    name: "Khu cách ly",
    description: "Khu cách ly / QC chờ kiểm nghiệm.",
    zoneCount: 2,
    locationCount: 18,
    utilization: 74,
  },
];

export const warehouseZones: WarehouseZone[] = [
  {
    id: "zone-a",
    warehouseId: "k01",
    code: "A",
    name: "Khu A",
    floor: "1F",
    description: "Khu lưu trữ nguyên liệu dược phẩm, nhiệt độ thường.",
    locationCount: 92,
    occupiedCount: 76,
    emptyCount: 16,
    utilization: 83,
    position: [-6, 0.6, -4],
    size: [5, 1.2, 4],
  },
  {
    id: "zone-b",
    warehouseId: "k01",
    code: "B",
    name: "Khu B",
    floor: "1F",
    description: "Khu nguyên liệu phụ, gần khu vực nhận hàng.",
    locationCount: 88,
    occupiedCount: 61,
    emptyCount: 27,
    utilization: 69,
    position: [0, 0.6, -4],
    size: [5, 1.2, 4],
  },
  {
    id: "zone-c",
    warehouseId: "k01",
    code: "C",
    name: "Khu C",
    floor: "1F",
    description: "Khu tá dược và dung môi nhẹ.",
    locationCount: 76,
    occupiedCount: 52,
    emptyCount: 24,
    utilization: 68,
    position: [6, 0.6, -4],
    size: [5, 1.2, 4],
  },
  {
    id: "zone-q",
    warehouseId: "k01",
    code: "Q",
    name: "Khu cách ly",
    floor: "1F",
    description: "Khu cách ly chờ kết quả kiểm nghiệm.",
    locationCount: 38,
    occupiedCount: 32,
    emptyCount: 6,
    utilization: 84,
    position: [0, 0.6, 4],
    size: [8, 1.2, 3.5],
  },
  {
    id: "zone-p1",
    warehouseId: "k02",
    code: "P1",
    name: "Khu bao bì chính",
    floor: "1F",
    description: "Bao bì sơ cấp và nhãn.",
    locationCount: 40,
    occupiedCount: 24,
    emptyCount: 16,
    utilization: 60,
    position: [-3, 0.55, 0],
    size: [5, 1.1, 5],
  },
  {
    id: "zone-p2",
    warehouseId: "k02",
    code: "P2",
    name: "Khu bao bì phụ",
    floor: "1F",
    description: "Thùng carton và pallet.",
    locationCount: 24,
    occupiedCount: 16,
    emptyCount: 8,
    utilization: 67,
    position: [4, 0.55, 0],
    size: [4.5, 1.1, 5],
  },
];

export const warehouseRacks: WarehouseRack[] = [
  { id: "rack-a01", zoneId: "zone-a", aisle: "01", name: "Kệ 01" },
  { id: "rack-a02", zoneId: "zone-a", aisle: "01", name: "Kệ 02" },
  { id: "rack-a03", zoneId: "zone-a", aisle: "02", name: "Kệ 01" },
  { id: "rack-b01", zoneId: "zone-b", aisle: "01", name: "Kệ 01" },
  { id: "rack-b02", zoneId: "zone-b", aisle: "01", name: "Kệ 02" },
];

export const warehouseLocations: WarehouseLocation[] = [
  loc("A-01-01", "k01", "zone-a", "01", "Kệ 01", "Paracetamol", 5, 10, "OCCUPIED"),
  loc("A-01-02", "k01", "zone-a", "01", "Kệ 01", "Amoxicillin", 3, 8, "OCCUPIED"),
  loc("A-01-03", "k01", "zone-a", "01", "Kệ 01", null, 0, 8, "EMPTY"),
  loc("A-01-04", "k01", "zone-a", "01", "Kệ 02", "Vitamin C", 8, 10, "FULL"),
  loc("A-02-01", "k01", "zone-a", "02", "Kệ 01", "Ceftiofur 5%", 2, 6, "OCCUPIED"),
  loc("A-02-02", "k01", "zone-a", "02", "Kệ 01", null, 0, 6, "EMPTY"),
  loc("B-01-01", "k01", "zone-b", "01", "Kệ 01", "Doxycycline", 4, 8, "OCCUPIED"),
  loc("B-01-02", "k01", "zone-b", "01", "Kệ 01", null, 0, 8, "EMPTY"),
  loc("B-01-03", "k01", "zone-b", "01", "Kệ 02", "Ibuprofen", 6, 10, "OCCUPIED"),
  loc("C-01-01", "k01", "zone-c", "01", "Kệ 01", "Metformin", 3, 8, "OCCUPIED"),
  loc("C-01-02", "k01", "zone-c", "01", "Kệ 01", null, 0, 8, "QUARANTINE"),
  loc("Q-01-01", "k01", "zone-q", "01", "Kệ 01", "Lô CF2408", 1, 4, "QUARANTINE"),
  loc("Q-01-02", "k01", "zone-q", "01", "Kệ 01", "Lô AM2410", 2, 4, "ON_HOLD"),
  loc("P1-01-01", "k02", "zone-p1", "01", "Kệ 01", "Nhãn chai 60ml", 12, 20, "OCCUPIED"),
  loc("P1-01-02", "k02", "zone-p1", "01", "Kệ 01", null, 0, 20, "EMPTY"),
  loc("P2-01-01", "k02", "zone-p2", "01", "Kệ 01", "Thùng carton", 40, 50, "OCCUPIED"),
];

export const warehouseKpis: WarehouseKpi[] = [
  { id: "wh", label: "Tổng kho", value: 5 },
  { id: "zones", label: "Tổng khu vực", value: 18 },
  { id: "locs", label: "Tổng vị trí", value: 326 },
  { id: "util", label: "Sử dụng trung bình", value: 76, suffix: "%" },
];

export const warehouseTree: WarehouseTreeNode = {
  id: "root",
  label: "Tất cả kho",
  kind: "root",
  children: warehouses.map((wh) => ({
    id: wh.id,
    label: `${wh.name} [${wh.code.replace("K0", "")}]`,
    kind: "warehouse" as const,
    warehouseId: wh.id,
    children: warehouseZones
      .filter((zone) => zone.warehouseId === wh.id)
      .map((zone) => ({
        id: zone.id,
        label: zone.name,
        kind: "zone" as const,
        warehouseId: wh.id,
        zoneId: zone.id,
        children: groupAisles(zone.id),
      })),
  })),
};

export const zoneMaterials: Record<string, WarehouseMaterialSummary[]> = {
  "zone-a": [
    { id: "m1", name: "Paracetamol", lotCount: 5, quality: "PASSED" },
    { id: "m2", name: "Amoxicillin", lotCount: 3, quality: "PASSED" },
    { id: "m3", name: "Vitamin C", lotCount: 8, quality: "PASSED" },
  ],
  "zone-q": [
    { id: "m4", name: "Lô CF2408", lotCount: 1, quality: "QUARANTINE" },
    { id: "m5", name: "Lô AM2410", lotCount: 2, quality: "ON_HOLD" },
  ],
};

export const zoneHistory: Record<string, WarehouseHistoryItem[]> = {
  "zone-a": [
    {
      id: "h1",
      time: "13/08/2026 14:20",
      action: "Nhập lô Paracetamol vào A-01-01",
      actor: "Nguyễn Văn A",
    },
    {
      id: "h2",
      time: "12/08/2026 09:10",
      action: "Điều chuyển Vitamin C sang A-01-04",
      actor: "Trần Thị B",
    },
  ],
};

function loc(
  code: string,
  warehouseId: string,
  zoneId: string,
  aisle: string,
  rack: string,
  materialName: string | null,
  lotCount: number,
  capacity: number,
  status: LocationStatus,
): WarehouseLocation {
  return {
    id: code.toLowerCase(),
    code,
    warehouseId,
    zoneId,
    aisle,
    rack,
    materialName,
    lotCount,
    capacity,
    status,
    updatedAt: "13/08/2026",
  };
}

function groupAisles(zoneId: string): WarehouseTreeNode[] {
  const racks = warehouseRacks.filter((rack) => rack.zoneId === zoneId);
  const aisleMap = new Map<string, WarehouseRack[]>();
  for (const rack of racks) {
    const list = aisleMap.get(rack.aisle) ?? [];
    list.push(rack);
    aisleMap.set(rack.aisle, list);
  }
  return [...aisleMap.entries()].map(([aisle, items]) => ({
    id: `${zoneId}-aisle-${aisle}`,
    label: `Dãy ${aisle}`,
    kind: "aisle" as const,
    zoneId,
    children: items.map((rack) => ({
      id: rack.id,
      label: rack.name,
      kind: "rack" as const,
      zoneId,
    })),
  }));
}
