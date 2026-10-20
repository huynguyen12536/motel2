import { DashboardKpiCard } from "@/features/dashboard/components/dashboard-kpi-card";
import {
  ExpiryMetricIcon,
  InboundMetricIcon,
  MaterialsMetricIcon,
  QuarantineMetricIcon,
} from "@/features/dashboard/components/dashboard-metric-icons";
import type { DashboardKpi } from "@/features/dashboard/types/dashboard.types";

const KPI_ICONS = {
  materials: MaterialsMetricIcon,
  inboundToday: InboundMetricIcon,
  quarantineLots: QuarantineMetricIcon,
  expiringLots: ExpiryMetricIcon,
} as const;

export function DashboardKpiGrid({ items }: { items: DashboardKpi[] }) {
  return (
    <section className="wms-kpi-grid" aria-label="Chỉ số tổng quan">
      <span className="wms-kpi-grid__scan" aria-hidden="true" />
      {items.map((kpi, index) => (
        <DashboardKpiCard
          key={kpi.id}
          kpi={kpi}
          index={index}
          icon={
            KPI_ICONS[kpi.id as keyof typeof KPI_ICONS] ?? MaterialsMetricIcon
          }
        />
      ))}
    </section>
  );
}
