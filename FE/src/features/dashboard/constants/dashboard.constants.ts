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
  border: "#E6EDF5",
  borderSubtle: "#EDF2F7",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#0EA5E9",
  purple: "#7C3AED",
  /* BI-style soft series (lavender → blue) */
  chartLavender: "#C4B5FD",
  chartPeriwinkle: "#A5B4FC",
  chartIndigo: "#818CF8",
  chartBlue: "#60A5FA",
  chartDeep: "#3B82F6",
  receivedBar: "#C4B5FD",
  issuedBar: "#818CF8",
  stockLine: "#4F46E5",
  stockFill: "#A5B4FC",
  barPrimary: "#A5B4FC",
} as const;

export const QUALITY_COLORS: Record<QualityStatusCode, string> = {
  PASSED: "#34D399",
  QUARANTINE: "#FBBF24",
  FAILED: "#F87171",
  ON_HOLD: "#A78BFA",
};

export const DASHBOARD_SEARCH_PLACEHOLDER =
  "Tìm vật liệu, mã số lô, nhà cung cấp...";

export const DASHBOARD_FOOTER_DATE = "Hôm nay - 13 Tháng 8, 2026";
