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
    name: "Kho lạnh thành phẩm",
    description: "Kho lạnh 2–8°C dành cho thành phẩm, có giám sát nhiệt độ liên tục.",
    zoneCount: 4,
    locationCount: 128,
    utilization: 87,
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
  {
    id: "k06",
    code: "K06",
    name: "Kho lạnh nguyên liệu",
    description: "Kho lạnh 2–8°C dành cho nguyên liệu và bán thành phẩm.",
    zoneCount: 4,
    locationCount: 136,
    utilization: 82,
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
  makeZone("zone-p3", "k02", "P3", "Khu carton & pallet", 9, 68, 32, "Bao bì vận chuyển và pallet chờ cấp phát."),
  makeZone("zone-f1", "k03", "F1", "Thành phẩm A", -10.1, 82, 44, "Thành phẩm đã xuất xưởng, ưu tiên đơn gần."),
  makeZone("zone-f2", "k03", "F2", "Thành phẩm B", -3.4, 74, 38, "Thành phẩm theo lô và tuyến phân phối."),
  makeZone("zone-f3", "k03", "F3", "Khu soạn hàng", 3.4, 66, 30, "Soạn và ghép đơn trước khi xuất kho."),
  makeZone("zone-f4", "k03", "F4", "Khu staging", 10.1, 78, 36, "Tập kết thành phẩm chờ bàn giao vận chuyển."),
  makeZone("zone-cold-1", "k04", "C1", "Kho lạnh thành phẩm A", -16, 88, 38, "Buồng lạnh thành phẩm, panel PU 100 mm, dàn lạnh và kệ selective."),
  makeZone("zone-cold-2", "k04", "C2", "Kho lạnh thành phẩm B", 0, 84, 34, "Buồng lạnh thành phẩm tách biệt theo điều kiện bảo quản."),
  makeZone("zone-cold-3", "k04", "C3", "Khu soạn hàng lạnh", 16, 80, 30, "Khu gom và soạn hàng trước khi xuất kho."),
  makeZone("zone-cold-4", "k04", "C4", "Phòng máy lạnh", -16, 95, 26, "Máy nén, bình chứa lỏng, manifold và tủ điều khiển."),
  makeZone("zone-cold-raw-1", "k06", "C1", "Kho lạnh nguyên liệu A", -16, 82, 40, "Nguyên liệu lạnh theo lô và hạn dùng."),
  makeZone("zone-cold-raw-2", "k06", "C2", "Kho lạnh nguyên liệu B", 0, 80, 36, "Nguyên liệu bảo quản lạnh và đông."),
  makeZone("zone-cold-raw-3", "k06", "C3", "Khu staging nguyên liệu", 16, 78, 32, "Khu tập kết nguyên liệu trước cấp phát."),
  makeZone("zone-cold-raw-4", "k06", "C4", "Phòng máy lạnh", -16, 94, 28, "Thiết bị lạnh và tuyến ống kỹ thuật."),
  makeZone("zone-qc-1", "k05", "Q1", "Chờ lấy mẫu", -9, 72, 12, "Lô mới nhập chờ QC lấy mẫu."),
  makeZone("zone-qc-2", "k05", "Q2", "Đang kiểm nghiệm", 0, 79, 14, "Lô đang được kiểm nghiệm chất lượng."),
  makeZone("zone-qc-3", "k05", "Q3", "Chờ quyết định", 9, 70, 10, "Lô chờ phê duyệt hoặc xử lý sai lệch."),
];

function makeZone(
  id: string,
  warehouseId: string,
  code: string,
  name: string,
  x: number,
  utilization: number,
  locationCount: number,
  description: string,
): WarehouseZone {
  const occupiedCount = Math.round((locationCount * utilization) / 100);
  return {
    id,
    warehouseId,
    code,
    name,
    floor: "1F",
    description,
    locationCount,
    occupiedCount,
    emptyCount: locationCount - occupiedCount,
    utilization,
    position: [x, 1.8, 0],
    size: [6, 3.8, 14],
  };
}

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
