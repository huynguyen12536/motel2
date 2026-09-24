"use client";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import type {
  DashboardNotification,
  DashboardNotificationKind,
} from "@/features/dashboard/types/dashboard.types";

type TabId = "all" | DashboardNotificationKind;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "warning", label: "Cảnh báo" },
  { id: "info", label: "Thông tin" },
  { id: "success", label: "Thành công" },
];

const KIND_ICON = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
} as const;

function filterNotifications(
  items: DashboardNotification[],
  tab: TabId,
): DashboardNotification[] {
  if (tab === "all") return items;
  return items.filter((item) => item.kind === tab);
}

export function NotificationsPanel({
  items,
}: {
  items: DashboardNotification[];
}) {
  const [tab, setTab] = useState<TabId>("all");
  const visible = filterNotifications(items, tab);

  return (
    <section className="wms-card">
      <div className="wms-card__head">
        <h2 className="wms-card__title">Cảnh báo &amp; thông báo</h2>
      </div>
      <div className="wms-alert-tabs" role="tablist" aria-label="Loại thông báo">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={
              tab === item.id
                ? "wms-alert-tabs__btn wms-alert-tabs__btn--active"
                : "wms-alert-tabs__btn"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        key={tab}
        className="wms-alert-panel wms-card__scroll"
        role="tabpanel"
        aria-live="polite"
        tabIndex={0}
      >
        {visible.length === 0 ? (
          <p className="wms-empty">Không có cảnh báo mới.</p>
        ) : (
          <ul className="wms-alerts">
            {visible.map((item, index) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li
                  key={item.id}
                  className="wms-alerts__item"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <span
                    className={`wms-alerts__icon wms-alerts__icon--${item.kind}`}
                    aria-hidden="true"
                  >
                    <Icon size={15} />
                  </span>
                  <div className="wms-alerts__body min-w-0">
                    <p className="wms-alerts__title truncate" title={item.title}>
                      {item.title}
                    </p>
                    <time className="wms-alerts__time">{item.time}</time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
