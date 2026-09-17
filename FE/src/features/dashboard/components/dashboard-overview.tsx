"use client";
import { motion, useReducedMotion } from "motion/react";
import { DashboardKpiGrid } from "@/features/dashboard/components/dashboard-kpi-grid";
import { RecentDocumentsCard } from "@/features/dashboard/components/recent-documents-card";
import { PendingQueueCard } from "@/features/dashboard/components/pending-queue-card";
import { QualityStatusCard } from "@/features/dashboard/components/quality-status-card";
import { ExpiringLotsCard } from "@/features/dashboard/components/expiring-lots-card";
import { InventoryMovementCard } from "@/features/dashboard/components/inventory-movement-card";
import { DASHBOARD_FOOTER_DATE } from "@/features/dashboard/constants/dashboard.constants";
import {
  dashboardKpis,
  expiringLots,
  inventoryMovement,
  pendingQueue,
  qualityStatus,
  qualityStatusTotalLots,
  recentDocuments,
} from "@/features/dashboard/mocks/dashboard.mock";
import "./dashboard.css";

const rise = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export function DashboardOverview() {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="wms-dash">
      <motion.div
        className="wms-dash__body"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: reduceMotion ? 0 : 0.045 },
          },
        }}
      >
        <motion.header className="wms-page-head" variants={rise} transition={transition}>
          <div className="wms-page-head__text">
            <h1 className="wms-page-title">Tổng quan kho</h1>
          </div>
          <div className="wms-page-head__controls">
            <p className="wms-page-date">{DASHBOARD_FOOTER_DATE}</p>
            <label className="sr-only" htmlFor="dash-period">
              Kỳ báo cáo
            </label>
            <select id="dash-period" className="wms-page-period" defaultValue="7d">
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
              <option value="90d">90 ngày qua</option>
            </select>
          </div>
        </motion.header>

        <motion.div variants={rise} transition={transition}>
          <DashboardKpiGrid items={dashboardKpis} />
        </motion.div>

        <motion.div className="wms-mid" variants={rise} transition={transition}>
          <RecentDocumentsCard items={recentDocuments} />
          <PendingQueueCard items={pendingQueue} />
        </motion.div>

        <motion.div className="wms-bottom" variants={rise} transition={transition}>
          <QualityStatusCard
            items={qualityStatus}
            totalLots={qualityStatusTotalLots}
          />
          <ExpiringLotsCard items={expiringLots} />
          <InventoryMovementCard points={inventoryMovement} />
        </motion.div>
      </motion.div>
    </div>
  );
}
