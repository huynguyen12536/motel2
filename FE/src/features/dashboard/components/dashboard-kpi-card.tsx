import type { LucideIcon } from "lucide-react";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { DashboardKpi, KpiTone } from "@/features/dashboard/types/dashboard.types";

export function DashboardKpiCard({
  kpi,
  icon: Icon,
}: {
  kpi: DashboardKpi;
  icon: LucideIcon;
}) {
  return (
    <article className="wms-kpi">
      <div className="wms-kpi__top">
        <p className="wms-kpi__label">{kpi.label}</p>
        <span
          className={`wms-kpi__icon wms-kpi__icon--${kpi.tone as KpiTone}`}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
      </div>
      <div>
        <p className="wms-kpi__value">{formatDashboardNumber(kpi.value)}</p>
        <p
          className={
            kpi.trendPositive
              ? "wms-kpi__trend wms-kpi__trend--up"
              : "wms-kpi__trend wms-kpi__trend--down"
          }
        >
          {kpi.trendLabel}
        </p>
      </div>
    </article>
  );
}
