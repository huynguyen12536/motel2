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

export type DashboardKpi = {
  id: string;
  label: string;
  value: number;
  trendLabel: string;
  trendPositive: boolean;
  tone: KpiTone;
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
  status: ExpiringLotStatus;
  statusLabel: string;
};

export type InventoryMovementPoint = {
  date: string;
  received: number;
  issued: number;
  stock: number;
};

export type DashboardHeaderUser = {
  name: string;
  role: string;
  initials: string;
  mailBadge: number;
  notificationBadge: number;
};
