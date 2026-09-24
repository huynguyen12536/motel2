import {
  CalendarClock,
  FileInput,
  Package,
  ShieldAlert,
} from "lucide-react";
import { DashboardKpiCard } from "@/features/dashboard/components/dashboard-kpi-card";
import type { DashboardKpi } from "@/features/dashboard/types/dashboard.types";

const KPI_ICONS = {
  materials: Package,
  inboundToday: FileInput,
  quarantineLots: ShieldAlert,
  expiringLots: CalendarClock,
} as const;

export function DashboardKpiGrid({ items }: { items: DashboardKpi[] }) {
  return (
    <section className="wms-kpi-grid" aria-label="Chỉ số tổng quan">
      {items.map((kpi, index) => (
        <DashboardKpiCard
          key={kpi.id}
          kpi={kpi}
          index={index}
          icon={KPI_ICONS[kpi.id as keyof typeof KPI_ICONS] ?? Package}
        />
      ))}
    </section>
  );
}
