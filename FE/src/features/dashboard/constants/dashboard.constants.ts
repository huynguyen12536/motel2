import type { QualityStatusCode } from "@/features/dashboard/types/dashboard.types";

export const DASHBOARD_COLORS = {
  primary: "#044CE2",
  primaryHover: "#063586",
  navy: "#162A50",
  textPrimary: "#063586",
  textSecondary: "#65758D",
  textMuted: "#65758D",
  pageBg: "#F3F4F6",
  card: "#FFFFFF",
  border: "#E5E7EB",
  borderSubtle: "#E5E7EB",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#044CE2",
  purple: "#6D7893",
  /* Stable series keys; restrained blue ramp matching the operations palette. */
  chartLavender: "#D3E0F3",
  chartPeriwinkle: "#A9C2E7",
  chartIndigo: "#759BD0",
  chartBlue: "#2860B9",
  chartDeep: "#1F529E",
  receivedBar: "#253A69",
  issuedBar: "#7C91B3",
  stockLine: "#1FD2D8",
  stockFill: "#1FD2D8",
  barPrimary: "#253A69",
} as const;

export const QUALITY_COLORS: Record<QualityStatusCode, string> = {
  PASSED: "#34D399",
  QUARANTINE: "#FBBF24",
  FAILED: "#F87171",
  ON_HOLD: "#6D7893",
};

export const DASHBOARD_SEARCH_PLACEHOLDER =
  "Tìm vật liệu, mã số lô, nhà cung cấp...";

export const DASHBOARD_FOOTER_DATE = "Hôm nay - 13 Tháng 8, 2026";
