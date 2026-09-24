"use client";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  ClipboardCheck,
  FileInput,
  FileOutput,
  TriangleAlert,
} from "lucide-react";
import {
  filterPendingQueue,
  PENDING_QUEUE_FILTER_OPTIONS,
} from "@/features/dashboard/mocks/dashboard.mock";
import type {
  PendingQueueFilterKey,
  PendingQueueItem,
  PendingQueueKind,
} from "@/features/dashboard/types/dashboard.types";

const QUEUE_ICONS: Record<PendingQueueKind, typeof FileInput> = {
  inboundApproval: FileInput,
  qcCheck: ClipboardCheck,
  outboundConfirm: FileOutput,
  expiringLot: TriangleAlert,
};

export function PendingQueueCard({ items }: { items: PendingQueueItem[] }) {
  const [filter, setFilter] = useState<PendingQueueFilterKey>("all");
  const visible = useMemo(
    () => filterPendingQueue(items, filter),
    [items, filter],
  );

  return (
    <section className="wms-card">
      <div className="wms-card__head wms-card__head--queue">
        <h2 className="wms-card__title">Hàng chờ xử lý</h2>
        <div className="wms-queue__head-actions">
          <label className="wms-range-select wms-range-select--inline">
            <span className="sr-only">Lọc hàng chờ</span>
            <select
              className="wms-range-select__control"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as PendingQueueFilterKey)
              }
            >
              {PENDING_QUEUE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <a href="#" className="wms-card__link">
            Xem toàn bộ
            <ChevronRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="wms-empty">Không có công việc chờ xử lý.</p>
      ) : (
        <div className="wms-card__scroll" tabIndex={0}>
          <ul className="wms-queue">
            {visible.map((item, index) => {
              const Icon = QUEUE_ICONS[item.kind];
              return (
                <li
                  key={item.id}
                  className="wms-queue__item wms-queue__item--enter"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <span
                    className={`wms-queue__icon wms-queue__icon--${item.kind}`}
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </span>
                  <div className="wms-queue__body">
                    <p className="wms-queue__title" title={item.title}>
                      {item.title}
                    </p>
                    <p className="wms-queue__subtitle" title={item.subtitle}>
                      {item.subtitle}
                    </p>
                  </div>
                  <time className="wms-queue__time">{item.time}</time>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
