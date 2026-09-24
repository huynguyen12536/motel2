import { QUALITY_COLORS } from "@/features/dashboard/constants/dashboard.constants";
import type {
  DashboardHeaderUser,
  DashboardKpi,
  DashboardNotification,
  DashboardPeriodKey,
  DashboardPeriodSnapshot,
  ExpiringLot,
  InventoryMovementPoint,
  InventoryRangeKey,
  MaterialGroup,
  PendingQueueFilterKey,
  PendingQueueItem,
  QualityStatusItem,
  RecentDocument,
  WarehouseAreaOverviewItem,
} from "@/features/dashboard/types/dashboard.types";

export const dashboardUser: DashboardHeaderUser = {
  name: "Nguyễn Văn A",
  role: "Quản trị hệ thống",
  initials: "NA",
  mailBadge: 5,
  notificationBadge: 3,
};

export const DASHBOARD_PERIOD_OPTIONS: {
  value: DashboardPeriodKey;
  label: string;
}[] = [
  { value: "7d", label: "7 ngày qua" },
  { value: "30d", label: "30 ngày qua" },
  { value: "90d", label: "90 ngày qua" },
];

export const INVENTORY_RANGE_OPTIONS: {
  value: InventoryRangeKey;
  label: string;
}[] = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "3m", label: "3 tháng" },
  { value: "12m", label: "12 tháng" },
];

export const PENDING_QUEUE_FILTER_OPTIONS: {
  value: PendingQueueFilterKey;
  label: string;
}[] = [
  { value: "all", label: "Tất cả" },
  { value: "inboundApproval", label: "Chờ duyệt nhập" },
  { value: "qcCheck", label: "Chờ kiểm chất lượng" },
  { value: "outboundConfirm", label: "Chờ xác nhận xuất" },
  { value: "expiringLot", label: "Sắp hết hạn" },
];

const PERIOD_MAX_DAYS: Record<DashboardPeriodKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function qualityItems(
  passed: number,
  quarantine: number,
  failed: number,
  onHold: number,
): QualityStatusItem[] {
  const total = passed + quarantine + failed + onHold;
  const pct = (n: number) => Math.round((n / total) * 100);
  return [
    {
      code: "PASSED",
      label: "Đạt",
      value: passed,
      percent: pct(passed),
      color: QUALITY_COLORS.PASSED,
    },
    {
      code: "QUARANTINE",
      label: "Cách ly",
      value: quarantine,
      percent: pct(quarantine),
      color: QUALITY_COLORS.QUARANTINE,
    },
    {
      code: "FAILED",
      label: "Không đạt",
      value: failed,
      percent: pct(failed),
      color: QUALITY_COLORS.FAILED,
    },
    {
      code: "ON_HOLD",
      label: "Tạm giữ",
      value: onHold,
      percent: pct(onHold),
      color: QUALITY_COLORS.ON_HOLD,
    },
  ];
}

const kpis7d: DashboardKpi[] = [
  {
    id: "materials",
    label: "Tổng vật liệu",
    value: 1248,
    trendLabel: "+12% so với 7 ngày trước",
    trendPositive: true,
    tone: "primary",
    sparkline: [980, 1020, 1080, 1110, 1180, 1210, 1248],
  },
  {
    id: "inboundToday",
    label: "Phiếu nhập hôm nay",
    value: 24,
    trendLabel: "+33% so với hôm qua",
    trendPositive: true,
    tone: "success",
    sparkline: [12, 15, 14, 18, 16, 20, 24],
  },
  {
    id: "quarantineLots",
    label: "Lô đang cách ly",
    value: 18,
    trendLabel: "+6% so với 7 ngày trước",
    trendPositive: true,
    tone: "warning",
    sparkline: [14, 15, 13, 16, 17, 16, 18],
  },
  {
    id: "expiringLots",
    label: "Lô sắp hết hạn",
    value: 32,
    trendLabel: "-18% so với 7 ngày trước",
    trendPositive: false,
    tone: "danger",
    sparkline: [42, 40, 38, 36, 35, 33, 32],
  },
];

const kpis30d: DashboardKpi[] = [
  {
    id: "materials",
    label: "Tổng vật liệu",
    value: 1310,
    trendLabel: "+8% so với 30 ngày trước",
    trendPositive: true,
    tone: "primary",
    sparkline: [1100, 1140, 1180, 1210, 1250, 1280, 1310],
  },
  {
    id: "inboundToday",
    label: "Phiếu nhập hôm nay",
    value: 19,
    trendLabel: "-5% so với trung bình 30 ngày",
    trendPositive: false,
    tone: "success",
    sparkline: [22, 20, 21, 18, 17, 20, 19],
  },
  {
    id: "quarantineLots",
    label: "Lô đang cách ly",
    value: 22,
    trendLabel: "+12% so với 30 ngày trước",
    trendPositive: true,
    tone: "warning",
    sparkline: [16, 17, 18, 19, 20, 21, 22],
  },
  {
    id: "expiringLots",
    label: "Lô sắp hết hạn",
    value: 41,
    trendLabel: "+9% so với 30 ngày trước",
    trendPositive: true,
    tone: "danger",
    sparkline: [35, 36, 38, 39, 40, 40, 41],
  },
];

const kpis90d: DashboardKpi[] = [
  {
    id: "materials",
    label: "Tổng vật liệu",
    value: 1426,
    trendLabel: "+15% so với 90 ngày trước",
    trendPositive: true,
    tone: "primary",
    sparkline: [1180, 1220, 1280, 1320, 1360, 1400, 1426],
  },
  {
    id: "inboundToday",
    label: "Phiếu nhập hôm nay",
    value: 21,
    trendLabel: "+4% so với trung bình 90 ngày",
    trendPositive: true,
    tone: "success",
    sparkline: [18, 19, 20, 22, 21, 20, 21],
  },
  {
    id: "quarantineLots",
    label: "Lô đang cách ly",
    value: 15,
    trendLabel: "-10% so với 90 ngày trước",
    trendPositive: false,
    tone: "warning",
    sparkline: [20, 19, 18, 17, 16, 15, 15],
  },
  {
    id: "expiringLots",
    label: "Lô sắp hết hạn",
    value: 28,
    trendLabel: "-22% so với 90 ngày trước",
    trendPositive: false,
    tone: "danger",
    sparkline: [38, 36, 34, 32, 30, 29, 28],
  },
];

const materials7d: MaterialGroup[] = [
  { id: "mg-1", name: "Nguyên liệu dược", value: 420 },
  { id: "mg-2", name: "Bao bì", value: 312 },
  { id: "mg-3", name: "Tá dược", value: 198 },
  { id: "mg-4", name: "Hóa chất", value: 156 },
  { id: "mg-5", name: "Vật tư tiêu hao", value: 108 },
];

const materials30d: MaterialGroup[] = [
  { id: "mg-1", name: "Nguyên liệu dược", value: 486 },
  { id: "mg-2", name: "Bao bì", value: 340 },
  { id: "mg-3", name: "Tá dược", value: 220 },
  { id: "mg-4", name: "Hóa chất", value: 172 },
  { id: "mg-5", name: "Vật tư tiêu hao", value: 126 },
];

const materials90d: MaterialGroup[] = [
  { id: "mg-1", name: "Nguyên liệu dược", value: 540 },
  { id: "mg-2", name: "Bao bì", value: 390 },
  { id: "mg-3", name: "Tá dược", value: 250 },
  { id: "mg-4", name: "Hóa chất", value: 198 },
  { id: "mg-5", name: "Vật tư tiêu hao", value: 150 },
];

export const dashboardByPeriod: Record<
  DashboardPeriodKey,
  DashboardPeriodSnapshot
> = {
  "7d": {
    kpis: kpis7d,
    qualityStatus: qualityItems(892, 178, 124, 54),
    qualityTotalLots: 1248,
    materialGroups: materials7d,
  },
  "30d": {
    kpis: kpis30d,
    qualityStatus: qualityItems(940, 196, 110, 64),
    qualityTotalLots: 1310,
    materialGroups: materials30d,
  },
  "90d": {
    kpis: kpis90d,
    qualityStatus: qualityItems(1020, 160, 140, 106),
    qualityTotalLots: 1426,
    materialGroups: materials90d,
  },
};

/** @deprecated prefer getDashboardSnapshot(period).kpis */
export const dashboardKpis = dashboardByPeriod["7d"].kpis;

export const inventoryMovementByRange: Record<
  InventoryRangeKey,
  InventoryMovementPoint[]
> = {
  "7d": [
    { date: "07/08", received: 320, issued: 250, stock: 960 },
    { date: "08/08", received: 350, issued: 220, stock: 1100 },
    { date: "09/08", received: 290, issued: 190, stock: 1050 },
    { date: "10/08", received: 330, issued: 240, stock: 1260 },
    { date: "11/08", received: 380, issued: 280, stock: 1420 },
    { date: "12/08", received: 430, issued: 300, stock: 1600 },
    { date: "13/08", received: 450, issued: 320, stock: 1800 },
  ],
  "30d": [
    { date: "Tuần 1", received: 1180, issued: 920, stock: 1420 },
    { date: "Tuần 2", received: 1260, issued: 980, stock: 1580 },
    { date: "Tuần 3", received: 1340, issued: 1050, stock: 1710 },
    { date: "Tuần 4", received: 1410, issued: 1120, stock: 1860 },
  ],
  "3m": [
    { date: "T6", received: 4200, issued: 3600, stock: 1520 },
    { date: "T7", received: 4580, issued: 3900, stock: 1680 },
    { date: "T8", received: 4860, issued: 4100, stock: 1860 },
  ],
  "12m": [
    { date: "T9", received: 3800, issued: 3400, stock: 1200 },
    { date: "T10", received: 4000, issued: 3500, stock: 1280 },
    { date: "T11", received: 4100, issued: 3600, stock: 1320 },
    { date: "T12", received: 4300, issued: 3700, stock: 1400 },
    { date: "T1", received: 4400, issued: 3800, stock: 1460 },
    { date: "T2", received: 4500, issued: 3900, stock: 1520 },
    { date: "T3", received: 4600, issued: 4000, stock: 1580 },
    { date: "T4", received: 4700, issued: 4050, stock: 1640 },
    { date: "T5", received: 4800, issued: 4100, stock: 1700 },
    { date: "T6", received: 4900, issued: 4200, stock: 1760 },
    { date: "T7", received: 5000, issued: 4300, stock: 1820 },
    { date: "T8", received: 5100, issued: 4400, stock: 1900 },
  ],
};

/** @deprecated prefer getInventoryMovement(range) */
export const inventoryMovement = inventoryMovementByRange["7d"];

export const qualityStatus = dashboardByPeriod["7d"].qualityStatus;
export const qualityStatusTotalLots = dashboardByPeriod["7d"].qualityTotalLots;
export const materialGroups = dashboardByPeriod["7d"].materialGroups;

export const recentDocuments: RecentDocument[] = [
  {
    id: "doc-1",
    code: "PN-2026-0321",
    type: "inbound",
    typeLabel: "Nhập kho",
    party: "Công ty Dược Phú Thịnh",
    createdAt: "13/08/2026 14:36",
    status: "pendingApproval",
    statusLabel: "Chờ duyệt",
    daysAgo: 0,
  },
  {
    id: "doc-2",
    code: "PX-2026-0187",
    type: "outbound",
    typeLabel: "Xuất kho",
    party: "Sản xuất - Nhà máy A",
    createdAt: "13/08/2026 13:20",
    status: "approved",
    statusLabel: "Đã duyệt",
    daysAgo: 0,
  },
  {
    id: "doc-3",
    code: "KK-2026-0045",
    type: "inventory",
    typeLabel: "Kiểm kê",
    party: "Kho Nguyên liệu",
    createdAt: "12/08/2026 16:15",
    status: "inProgress",
    statusLabel: "Đang kiểm",
    daysAgo: 1,
  },
  {
    id: "doc-4",
    code: "PN-2026-0320",
    type: "inbound",
    typeLabel: "Nhập kho",
    party: "Công ty Hóa chất Á Châu",
    createdAt: "12/08/2026 10:22",
    status: "completed",
    statusLabel: "Hoàn thành",
    daysAgo: 1,
  },
  {
    id: "doc-5",
    code: "PX-2026-0186",
    type: "outbound",
    typeLabel: "Xuất kho",
    party: "Phòng R&D",
    createdAt: "11/08/2026 15:08",
    status: "approved",
    statusLabel: "Đã duyệt",
    daysAgo: 2,
  },
  {
    id: "doc-6",
    code: "PN-2026-0301",
    type: "inbound",
    typeLabel: "Nhập kho",
    party: "Công ty Dược Đông Á",
    createdAt: "28/07/2026 09:10",
    status: "completed",
    statusLabel: "Hoàn thành",
    daysAgo: 16,
  },
  {
    id: "doc-7",
    code: "PX-2026-0150",
    type: "outbound",
    typeLabel: "Xuất kho",
    party: "Sản xuất - Nhà máy B",
    createdAt: "20/07/2026 11:40",
    status: "approved",
    statusLabel: "Đã duyệt",
    daysAgo: 24,
  },
  {
    id: "doc-8",
    code: "KK-2026-0030",
    type: "inventory",
    typeLabel: "Kiểm kê",
    party: "Kho Thành phẩm",
    createdAt: "01/06/2026 14:00",
    status: "completed",
    statusLabel: "Hoàn thành",
    daysAgo: 73,
  },
];

export const pendingQueue: PendingQueueItem[] = [
  {
    id: "pq-1",
    kind: "inboundApproval",
    title: "Phiếu nhập PN-2026-0321 chờ duyệt",
    subtitle: "Công ty Dược Phú Thịnh",
    time: "14:36",
  },
  {
    id: "pq-2",
    kind: "qcCheck",
    title: "Lô CF2408 chờ kiểm tra chất lượng",
    subtitle: "Ceftiofur 5% - Nguyên liệu",
    time: "11:20",
  },
  {
    id: "pq-3",
    kind: "outboundConfirm",
    title: "Phiếu xuất PX-2026-0187 chờ xác nhận",
    subtitle: "Sản xuất - Nhà máy A",
    time: "10:15",
  },
  {
    id: "pq-4",
    kind: "expiringLot",
    title: "Lô VB1201 sắp hết hạn (30 ngày)",
    subtitle: "Vitamin B12 - Thành phẩm",
    time: "09:48",
  },
  {
    id: "pq-5",
    kind: "inboundApproval",
    title: "Phiếu nhập PN-2026-0318 chờ duyệt",
    subtitle: "Công ty Hóa chất Á Châu",
    time: "08:12",
  },
  {
    id: "pq-6",
    kind: "qcCheck",
    title: "Lô AMX0824 chờ kiểm tra chất lượng",
    subtitle: "Amoxicillin - Nguyên liệu",
    time: "07:55",
  },
  {
    id: "pq-7",
    kind: "outboundConfirm",
    title: "Phiếu xuất PX-2026-0184 chờ xác nhận",
    subtitle: "Phòng R&D",
    time: "Hôm qua",
  },
  {
    id: "pq-8",
    kind: "expiringLot",
    title: "Lô PCM0724 sắp hết hạn (45 ngày)",
    subtitle: "Paracetamol - Thành phẩm",
    time: "Hôm qua",
  },
];

export const expiringLots: ExpiringLot[] = [
  {
    id: "lot-1",
    materialName: "Ceftiofur 5%",
    lotCode: "CF2408",
    expiryDate: "15/09/2026",
    quantity: "25kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 33,
  },
  {
    id: "lot-2",
    materialName: "Vitamin B12",
    lotCode: "VB1201",
    expiryDate: "20/09/2026",
    quantity: "10kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 38,
  },
  {
    id: "lot-3",
    materialName: "Amoxicillin",
    lotCode: "AMX0824",
    expiryDate: "25/09/2026",
    quantity: "50kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 43,
  },
  {
    id: "lot-4",
    materialName: "Paracetamol",
    lotCode: "PCM0724",
    expiryDate: "28/09/2026",
    quantity: "100kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 46,
  },
  {
    id: "lot-5",
    materialName: "Doxycycline",
    lotCode: "DOX0824",
    expiryDate: "30/09/2026",
    quantity: "30kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 48,
  },
  {
    id: "lot-6",
    materialName: "Ibuprofen",
    lotCode: "IBU0624",
    expiryDate: "15/10/2026",
    quantity: "40kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 63,
  },
  {
    id: "lot-7",
    materialName: "Metformin",
    lotCode: "MET0524",
    expiryDate: "20/11/2026",
    quantity: "80kg",
    status: "warning",
    statusLabel: "Cảnh báo",
    daysUntilExpiry: 99,
  },
];

export const dashboardNotifications: DashboardNotification[] = [
  {
    id: "n-1",
    kind: "warning",
    title: "Lô VB1201 sắp hết hạn trong 30 ngày",
    time: "09:48",
  },
  {
    id: "n-2",
    kind: "warning",
    title: "Tồn kho Ceftiofur 5% dưới mức tối thiểu",
    time: "08:20",
  },
  {
    id: "n-3",
    kind: "success",
    title: "Đã hoàn thành kiểm kê định kỳ",
    time: "Hôm qua",
  },
  {
    id: "n-4",
    kind: "info",
    title: "Phiếu nhập PN-2026-0320 đã được duyệt",
    time: "Hôm qua",
  },
  {
    id: "n-5",
    kind: "info",
    title: "Phiếu xuất PX-2026-0187 đã gửi sản xuất",
    time: "13:20",
  },
  {
    id: "n-6",
    kind: "success",
    title: "Lô CF2408 đã đạt kiểm nghiệm",
    time: "2 ngày trước",
  },
];

export const warehouseAreaOverview: WarehouseAreaOverviewItem[] = [
  {
    id: "RAW",
    name: "Kho nguyên liệu",
    totalLots: 428,
    passed: 376,
    quarantine: 32,
    onHold: 12,
    failed: 8,
    utilization: 82,
    status: "NORMAL",
  },
  {
    id: "QUARANTINE",
    name: "Khu cách ly",
    totalLots: 38,
    passed: 0,
    quarantine: 32,
    onHold: 4,
    failed: 2,
    utilization: 74,
    status: "ATTENTION",
  },
  {
    id: "COOL",
    name: "Kho mát 2–8°C",
    totalLots: 126,
    passed: 118,
    quarantine: 5,
    onHold: 2,
    failed: 1,
    utilization: 91,
    status: "ATTENTION",
  },
  {
    id: "PACKAGING",
    name: "Kho bao bì",
    totalLots: 254,
    passed: 248,
    quarantine: 2,
    onHold: 3,
    failed: 1,
    utilization: 63,
    status: "NORMAL",
  },
  {
    id: "FINISHED",
    name: "Kho thành phẩm",
    totalLots: 402,
    passed: 382,
    quarantine: 8,
    onHold: 5,
    failed: 7,
    utilization: 76,
    status: "NORMAL",
  },
  {
    id: "PASSED",
    name: "Khu hàng đạt",
    totalLots: 186,
    passed: 186,
    quarantine: 0,
    onHold: 0,
    failed: 0,
    utilization: 68,
    status: "NORMAL",
  },
  {
    id: "REJECT",
    name: "Khu hàng không đạt",
    totalLots: 24,
    passed: 0,
    quarantine: 0,
    onHold: 6,
    failed: 18,
    utilization: 88,
    status: "ATTENTION",
  },
  {
    id: "FREEZER",
    name: "Kho đông ≤ −20°C",
    totalLots: 64,
    passed: 58,
    quarantine: 3,
    onHold: 2,
    failed: 1,
    utilization: 94,
    status: "CRITICAL",
  },
  {
    id: "SAMPLE",
    name: "Khu mẫu lưu",
    totalLots: 92,
    passed: 84,
    quarantine: 5,
    onHold: 2,
    failed: 1,
    utilization: 71,
    status: "NORMAL",
  },
  {
    id: "EXCIPIENT",
    name: "Kho tá dược",
    totalLots: 168,
    passed: 154,
    quarantine: 8,
    onHold: 4,
    failed: 2,
    utilization: 79,
    status: "NORMAL",
  },
  {
    id: "SOLVENT",
    name: "Kho dung môi",
    totalLots: 47,
    passed: 40,
    quarantine: 4,
    onHold: 2,
    failed: 1,
    utilization: 86,
    status: "ATTENTION",
  },
  {
    id: "API",
    name: "Kho dược chất (API)",
    totalLots: 112,
    passed: 98,
    quarantine: 9,
    onHold: 3,
    failed: 2,
    utilization: 84,
    status: "ATTENTION",
  },
  {
    id: "RETURNS",
    name: "Khu hàng trả về",
    totalLots: 31,
    passed: 6,
    quarantine: 14,
    onHold: 8,
    failed: 3,
    utilization: 57,
    status: "ATTENTION",
  },
  {
    id: "STAGING",
    name: "Khu staging xuất",
    totalLots: 78,
    passed: 72,
    quarantine: 2,
    onHold: 3,
    failed: 1,
    utilization: 69,
    status: "NORMAL",
  },
  {
    id: "HAZMAT",
    name: "Kho hóa chất nguy hiểm",
    totalLots: 41,
    passed: 33,
    quarantine: 5,
    onHold: 2,
    failed: 1,
    utilization: 96,
    status: "CRITICAL",
  },
];

export function getDashboardSnapshot(period: DashboardPeriodKey) {
  return dashboardByPeriod[period];
}

export function getInventoryMovement(range: InventoryRangeKey) {
  return inventoryMovementByRange[range];
}

export function filterPendingQueue(
  items: PendingQueueItem[],
  filter: PendingQueueFilterKey,
) {
  if (filter === "all") return items;
  return items.filter((item) => item.kind === filter);
}

export function filterRecentDocuments(
  items: RecentDocument[],
  period: DashboardPeriodKey,
) {
  const maxDays = PERIOD_MAX_DAYS[period];
  return items.filter((item) => item.daysAgo <= maxDays);
}

export function filterExpiringLots(
  items: ExpiringLot[],
  period: DashboardPeriodKey,
) {
  const maxDays = PERIOD_MAX_DAYS[period];
  return items.filter((item) => item.daysUntilExpiry <= maxDays + 40);
}
