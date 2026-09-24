"use client";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DashboardKpiGrid } from "@/features/dashboard/components/dashboard-kpi-grid";
import { InventoryMovementCard } from "@/features/dashboard/components/inventory-movement-card";
import { QualityStatusCard } from "@/features/dashboard/components/quality-status-card";
import { MaterialGroupChart } from "@/features/dashboard/components/material-group-chart";
import { RecentDocumentsCard } from "@/features/dashboard/components/recent-documents-card";
import { PendingQueueCard } from "@/features/dashboard/components/pending-queue-card";
import { WarehouseAreaOverview } from "@/features/dashboard/components/warehouse-area-overview";
import { DASHBOARD_FOOTER_DATE } from "@/features/dashboard/constants/dashboard.constants";
import {
  DASHBOARD_PERIOD_OPTIONS,
  filterRecentDocuments,
  getDashboardSnapshot,
  pendingQueue,
  recentDocuments,
  warehouseAreaOverview,
} from "@/features/dashboard/mocks/dashboard.mock";
import type { DashboardPeriodKey } from "@/features/dashboard/types/dashboard.types";
import "./dashboard.css";

function sectionMotion(reduce: boolean | null, delay: number) {
  if (reduce) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.28,
      delay: delay / 1000,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

export function DashboardOverview() {
  const reduceMotion = useReducedMotion();
  const [period, setPeriod] = useState<DashboardPeriodKey>("7d");

  const snapshot = useMemo(() => getDashboardSnapshot(period), [period]);
  const documents = useMemo(
    () => filterRecentDocuments(recentDocuments, period),
    [period],
  );

  return (
    <motion.div
      className="wms-dash"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
    >
      <div className="wms-dash__body">
        <motion.header
          className="wms-page-head"
          {...sectionMotion(reduceMotion, 0)}
        >
          <div className="wms-page-head__text">
            <h1 className="wms-page-title">Tổng quan kho</h1>
            <p className="wms-page-subtitle">
              Giám sát tồn kho, chất lượng và vận hành GMP-WHO
            </p>
          </div>
          <div className="wms-page-head__controls">
            <p className="wms-page-date">{DASHBOARD_FOOTER_DATE}</p>
            <label className="sr-only" htmlFor="dash-period">
              Lọc kỳ báo cáo
            </label>
            <select
              id="dash-period"
              className="wms-page-period"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as DashboardPeriodKey)
              }
            >
              {DASHBOARD_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </motion.header>

        <motion.div key={`kpi-${period}`} {...sectionMotion(reduceMotion, 50)}>
          <DashboardKpiGrid items={snapshot.kpis} />
        </motion.div>

        <motion.section
          className="wms-analytics"
          aria-label="Phân tích kho"
          {...sectionMotion(reduceMotion, 120)}
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
        </motion.section>

        <motion.section
          className="wms-ops"
          aria-label="Vận hành"
          {...sectionMotion(reduceMotion, 180)}
        >
          <RecentDocumentsCard key={`docs-${period}`} items={documents} />
          <PendingQueueCard items={pendingQueue} />
        </motion.section>

        <motion.section
          className="wms-areas"
          aria-label="Tình trạng kho theo khu vực"
          {...sectionMotion(reduceMotion, 220)}
        >
          <WarehouseAreaOverview items={warehouseAreaOverview} />
        </motion.section>
      </div>
    </motion.div>
  );
}
