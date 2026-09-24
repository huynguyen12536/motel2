import type { LocationStatus } from "@/features/warehouse/types/warehouse.types";

export const LOCATION_STATUS_META: Record<
  LocationStatus,
  { label: string; className: string }
> = {
  EMPTY: { label: "Trống", className: "wms-loc-status--empty" },
  OCCUPIED: { label: "Đang dùng", className: "wms-loc-status--occupied" },
  FULL: { label: "Đầy", className: "wms-loc-status--full" },
  QUARANTINE: { label: "Cách ly", className: "wms-loc-status--quarantine" },
  ON_HOLD: { label: "Tạm giữ", className: "wms-loc-status--hold" },
  UNAVAILABLE: { label: "Không khả dụng", className: "wms-loc-status--na" },
};

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
