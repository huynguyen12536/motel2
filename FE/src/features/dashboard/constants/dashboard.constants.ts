import type { QualityStatusCode } from "@/features/dashboard/types/dashboard.types";

export const DASHBOARD_COLORS = {
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  navy: "#0F172A",
  textPrimary: "#111827",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  pageBg: "#F4F8FC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  borderSubtle: "#EDF2F7",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#0EA5E9",
  purple: "#7C3AED",
  receivedBar: "#93C5FD",
  issuedBar: "#2563EB",
  stockLine: "#16A34A",
} as const;

export const QUALITY_COLORS: Record<QualityStatusCode, string> = {
  PASSED: DASHBOARD_COLORS.success,
  QUARANTINE: DASHBOARD_COLORS.warning,
  FAILED: DASHBOARD_COLORS.danger,
  ON_HOLD: DASHBOARD_COLORS.purple,
};

export const DASHBOARD_SEARCH_PLACEHOLDER =
  "Tìm vật liệu, mã số lô, nhà cung cấp...";

export const DASHBOARD_FOOTER_DATE = "Hôm nay - 13 Tháng 8, 2026";
