"use client";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/features/dashboard/hooks/use-count-up";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { DashboardKpi } from "@/features/dashboard/types/dashboard.types";

export function DashboardKpiCard({
  kpi,
  icon: Icon,
  index = 0,
}: {
  kpi: DashboardKpi;
  icon: LucideIcon;
  index?: number;
}) {
  const animated = useCountUp(kpi.value, 700);

  return (
    <article
      className="wms-kpi"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="wms-kpi__body">
        <p className="wms-kpi__label truncate">{kpi.label}</p>
        <div className="wms-kpi__row">
          <span
            className={`wms-kpi__icon wms-kpi__icon--${kpi.tone}`}
            aria-hidden="true"
          >
            <Icon size={24} strokeWidth={1.75} />
          </span>
          <p className="wms-kpi__value">
            {formatDashboardNumber(animated)}
          </p>
        </div>
      </div>
    </article>
  );
}
