"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AppSelect } from "@/components/shared/app-select";
import { DatePicker } from "@/components/shared/date-picker";
import { PageSectionNav } from "@/components/shared/layout/page-section-nav";
import { DashboardKpiGrid } from "@/features/dashboard/components/dashboard-kpi-grid";
import { InventoryMovementCard } from "@/features/dashboard/components/inventory-movement-card";
import { QualityStatusCard } from "@/features/dashboard/components/quality-status-card";
import { MaterialGroupChart } from "@/features/dashboard/components/material-group-chart";
import { RecentDocumentsCard } from "@/features/dashboard/components/recent-documents-card";
import { PendingQueueCard } from "@/features/dashboard/components/pending-queue-card";
import { WarehouseAreaOverview } from "@/features/dashboard/components/warehouse-area-overview";
import {
  DASHBOARD_PERIOD_OPTIONS,
  getDashboardSnapshot,
  pendingQueue,
  recentDocuments,
  warehouseAreaOverview,
} from "@/features/dashboard/mocks/dashboard.mock";
import type { DashboardPeriodKey } from "@/features/dashboard/types/dashboard.types";
import "./dashboard.css";

export function DashboardOverview() {
  const t = useTranslations("dashboardSections");
  const controls = useTranslations("dashboardControls");
  const [period, setPeriod] = useState<DashboardPeriodKey>("7d");
  // Demo documents use 13 Aug 2026 as their reference date; never label it "today".
  const [documentDate, setDocumentDate] = useState(new Date(2026, 7, 13));

  const snapshot = useMemo(() => getDashboardSnapshot(period), [period]);
  const documents = useMemo(
    () => recentDocuments.filter((item) => {
      const date = item.createdAt.slice(0, 10).split("/").map(Number);
      const timestamp = new Date(date[2], date[1] - 1, date[0]).getTime();
      const age = Math.round((documentDate.getTime() - timestamp) / 86400000);
      return age >= 0 && age <= Number(period.slice(0, -1));
    }),
    [period, documentDate],
  );

  return (
    <div className="wms-dash">
      <div className="wms-dash__body">
        <header id="dashboard-overview" className="wms-page-head">
          <div className="wms-page-head__text">
            <h1 className="wms-page-title">Tổng quan kho</h1>
            <p className="wms-page-subtitle">
              Giám sát tồn kho, chất lượng và vận hành GMP-WHO
            </p>
          </div>
          <div className="wms-page-head__controls">
            <DatePicker value={documentDate} onChange={setDocumentDate} label={controls("date")} description={controls("dateNote")} />
            <label className="sr-only" htmlFor="dash-period">
              {controls("period")}
            </label>
            <AppSelect
              id="dash-period"
              className="wms-page-period"
              value={period}
              label={controls("period")}
              onValueChange={(value) => setPeriod(value as DashboardPeriodKey)}
              options={DASHBOARD_PERIOD_OPTIONS.map((option) => ({ value: option.value, label: controls(option.value) }))}
            />
          </div>
        </header>

        <PageSectionNav label={t("label")} items={[
          { id: "dashboard-overview", label: t("overview") },
          { id: "dashboard-analysis", label: t("analysis") },
          { id: "dashboard-operations", label: t("operations") },
          { id: "dashboard-areas", label: t("areas") },
        ]} />

        <div key={`kpi-${period}`}>
          <DashboardKpiGrid items={snapshot.kpis} />
        </div>

        <section
          id="dashboard-analysis"
          className="wms-analytics"
          aria-label="Phân tích kho"
        >
          <InventoryMovementCard
            key={`inv-${period}`}
            initialRange={
              period === "90d" ? "3m" : period === "30d" ? "30d" : "7d"
            }
          />
          <QualityStatusCard
            key={`quality-${period}`}
            items={snapshot.qualityStatus}
            totalLots={snapshot.qualityTotalLots}
          />
          <MaterialGroupChart
            key={`materials-${period}`}
            items={snapshot.materialGroups}
          />
        </section>

        <section
          id="dashboard-operations"
          className="wms-ops"
          aria-label="Vận hành"
        >
          <RecentDocumentsCard key={`docs-${period}`} items={documents} />
          <PendingQueueCard items={pendingQueue} />
        </section>

        <section
          id="dashboard-areas"
          className="wms-areas"
          aria-label="Tình trạng kho theo khu vực"
        >
          <WarehouseAreaOverview items={warehouseAreaOverview} />
        </section>
      </div>
    </div>
  );
}
