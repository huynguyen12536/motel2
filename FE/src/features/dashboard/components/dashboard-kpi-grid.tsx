import { Boxes, ClipboardPlus, FlaskConical, TriangleAlert } from "lucide-react";
import { DashboardKpiCard } from "@/features/dashboard/components/dashboard-kpi-card";
import type { DashboardKpi } from "@/features/dashboard/types/dashboard.types";

const KPI_ICONS = {
  materials: Boxes,
  inboundToday: ClipboardPlus,
  quarantineLots: FlaskConical,
  expiringLots: TriangleAlert,
} as const;

export function DashboardKpiGrid({ items }: { items: DashboardKpi[] }) {
  return (
    <section className="wms-kpi-grid" aria-label="Chỉ số tổng quan">
      {items.map((kpi) => (
        <DashboardKpiCard
          key={kpi.id}
          kpi={kpi}
          icon={KPI_ICONS[kpi.id as keyof typeof KPI_ICONS] ?? Boxes}
        />
      ))}
    </section>
  );
}
