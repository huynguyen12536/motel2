import { QUALITY_COLORS } from "@/features/dashboard/constants/dashboard.constants";
import type {
  DashboardHeaderUser,
  DashboardKpi,
  ExpiringLot,
  InventoryMovementPoint,
  PendingQueueItem,
  QualityStatusItem,
  RecentDocument,
} from "@/features/dashboard/types/dashboard.types";

export const dashboardUser: DashboardHeaderUser = {
  name: "Nguyễn Văn A",
  role: "Quản trị hệ thống",
  initials: "NA",
  mailBadge: 5,
  notificationBadge: 3,
};

export const dashboardKpis: DashboardKpi[] = [
  {
    id: "materials",
    label: "Tổng vật liệu",
    value: 1248,
    trendLabel: "+12% so với 7 ngày trước",
    trendPositive: true,
    tone: "primary",
  },
  {
    id: "inboundToday",
    label: "Phiếu nhập hôm nay",
    value: 24,
    trendLabel: "+33% so với hôm qua",
    trendPositive: true,
    tone: "success",
  },
  {
    id: "quarantineLots",
    label: "Lô đang cách ly",
    value: 18,
    trendLabel: "+6% so với 7 ngày trước",
    trendPositive: true,
    tone: "warning",
  },
  {
    id: "expiringLots",
    label: "Lô sắp hết hạn",
    value: 32,
    trendLabel: "-18% so với 7 ngày trước",
    trendPositive: false,
    tone: "danger",
  },
];

export const recentDocuments: RecentDocument[] = [
  {
    id: "doc-1",
    code: "PN-2026-0321",
    type: "inbound",
    typeLabel: "Nhập kho",
    party: "Công ty TNHH Dược phẩm Công nghệ Sinh học Việt Nam",
    createdAt: "13/08/2026 14:36",
    status: "pendingApproval",
    statusLabel: "Chờ duyệt",
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
  },
];

export const pendingQueue: PendingQueueItem[] = [
  {
    id: "pq-1",
    kind: "inboundApproval",
    title: "Phiếu nhập PN-2026-0321 chờ duyệt",
    subtitle: "Công ty TNHH Dược phẩm Công nghệ Sinh học Việt Nam",
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
];

export const qualityStatus: QualityStatusItem[] = [
  {
    code: "PASSED",
    label: "Đạt",
    value: 892,
    percent: 72,
    color: QUALITY_COLORS.PASSED,
  },
  {
    code: "QUARANTINE",
    label: "Cách ly",
    value: 178,
    percent: 14,
    color: QUALITY_COLORS.QUARANTINE,
  },
  {
    code: "FAILED",
    label: "Không đạt",
    value: 124,
    percent: 10,
    color: QUALITY_COLORS.FAILED,
  },
  {
    code: "ON_HOLD",
    label: "Tạm giữ",
    value: 54,
    percent: 4,
    color: QUALITY_COLORS.ON_HOLD,
  },
];

export const qualityStatusTotalLots = 1248;

export const expiringLots: ExpiringLot[] = [
  {
    id: "lot-1",
    materialName: "Ceftiofur 5%",
    lotCode: "CF2408",
    expiryDate: "15/09/2026",
    status: "warning",
    statusLabel: "Cảnh báo",
  },
  {
    id: "lot-2",
    materialName: "Vitamin B12",
    lotCode: "VB1201",
    expiryDate: "20/09/2026",
    status: "warning",
    statusLabel: "Cảnh báo",
  },
  {
    id: "lot-3",
    materialName: "Amoxicillin Trihydrate Pharmaceutical Grade",
    lotCode: "AMX0824",
    expiryDate: "25/09/2026",
    status: "warning",
    statusLabel: "Cảnh báo",
  },
  {
    id: "lot-4",
    materialName: "Paracetamol",
    lotCode: "PCM0724",
    expiryDate: "28/09/2026",
    status: "warning",
    statusLabel: "Cảnh báo",
  },
  {
    id: "lot-5",
    materialName: "Doxycycline",
    lotCode: "DOX0824",
    expiryDate: "30/09/2026",
    status: "warning",
    statusLabel: "Cảnh báo",
  },
];

export const inventoryMovement: InventoryMovementPoint[] = [
  { date: "07/08", received: 320, issued: 250, stock: 960 },
  { date: "08/08", received: 350, issued: 220, stock: 1100 },
  { date: "09/08", received: 290, issued: 190, stock: 1050 },
  { date: "10/08", received: 330, issued: 240, stock: 1260 },
  { date: "11/08", received: 380, issued: 280, stock: 1420 },
  { date: "12/08", received: 430, issued: 300, stock: 1600 },
  { date: "13/08", received: 450, issued: 320, stock: 1800 },
];
