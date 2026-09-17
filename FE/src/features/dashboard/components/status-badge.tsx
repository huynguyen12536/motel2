import type { DocumentStatus, ExpiringLotStatus } from "@/features/dashboard/types/dashboard.types";

type Status = DocumentStatus | ExpiringLotStatus;

export function StatusBadge({
  status,
  label,
}: {
  status: Status;
  label: string;
}) {
  return <span className={`wms-badge wms-badge--${status}`}>{label}</span>;
}
