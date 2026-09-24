export type KpiTone = "primary" | "success" | "warning" | "danger";

export type DocumentType = "inbound" | "outbound" | "inventory";

export type DocumentStatus =
  | "pendingApproval"
  | "approved"
  | "inProgress"
  | "completed";

export type QualityStatusCode = "PASSED" | "QUARANTINE" | "FAILED" | "ON_HOLD";

export type ExpiringLotStatus = "warning";

export type PendingQueueKind =
  | "inboundApproval"
  | "qcCheck"
  | "outboundConfirm"
  | "expiringLot";

export type DashboardNotificationKind = "warning" | "info" | "success";

/** Page header period filter */
export type DashboardPeriodKey = "7d" | "30d" | "90d";

/** Inventory chart range filter */
export type InventoryRangeKey = "7d" | "30d" | "3m" | "12m";

export type PendingQueueFilterKey = "all" | PendingQueueKind;

export type DashboardKpi = {
  id: string;
  label: string;
  value: number;
  trendLabel: string;
  trendPositive: boolean;
  tone: KpiTone;
  sparkline: number[];
};

export type RecentDocument = {
  id: string;
  code: string;
  type: DocumentType;
  typeLabel: string;
  party: string;
  createdAt: string;
  status: DocumentStatus;
  statusLabel: string;
  /** Days ago from mock “today” 13/08/2026 — used by period filter */
  daysAgo: number;
};

export type PendingQueueItem = {
  id: string;
  kind: PendingQueueKind;
  title: string;
  subtitle: string;
  time: string;
};

export type QualityStatusItem = {
  code: QualityStatusCode;
  label: string;
  value: number;
  percent: number;
  color: string;
};

export type ExpiringLot = {
  id: string;
  materialName: string;
  lotCode: string;
  expiryDate: string;
  quantity: string;
  status: ExpiringLotStatus;
  statusLabel: string;
  daysUntilExpiry: number;
};

export type InventoryMovementPoint = {
  date: string;
  received: number;
  issued: number;
  stock: number;
};

export type MaterialGroup = {
  id: string;
  name: string;
  value: number;
};

export type DashboardNotification = {
  id: string;
  kind: DashboardNotificationKind;
  title: string;
  time: string;
};

export type DashboardHeaderUser = {
  name: string;
  role: string;
  initials: string;
  mailBadge: number;
  notificationBadge: number;
};

export type DashboardPeriodSnapshot = {
  kpis: DashboardKpi[];
  qualityStatus: QualityStatusItem[];
  qualityTotalLots: number;
  materialGroups: MaterialGroup[];
};

export type WarehouseAreaStatus = "NORMAL" | "ATTENTION" | "CRITICAL";

export type WarehouseAreaOverviewItem = {
  id: string;
  name: string;
  totalLots: number;
  passed: number;
  quarantine: number;
  onHold: number;
  failed: number;
  utilization: number;
  status: WarehouseAreaStatus;
};
