import {
  ChevronRight,
  ClipboardCheck,
  FileInput,
  FileOutput,
  TriangleAlert,
} from "lucide-react";
import { DASHBOARD_FOOTER_DATE } from "@/features/dashboard/constants/dashboard.constants";
import type {
  PendingQueueItem,
  PendingQueueKind,
} from "@/features/dashboard/types/dashboard.types";

const QUEUE_ICONS: Record<
  PendingQueueKind,
  typeof FileInput
> = {
  inboundApproval: FileInput,
  qcCheck: ClipboardCheck,
  outboundConfirm: FileOutput,
  expiringLot: TriangleAlert,
};

export function PendingQueueCard({ items }: { items: PendingQueueItem[] }) {
  return (
    <section className="wms-card">
      <div className="wms-card__head">
        <h2 className="wms-card__title">Hàng chờ xử lý</h2>
        <a href="#" className="wms-card__link">
          Xem toàn bộ
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      </div>
      {items.length === 0 ? (
        <p className="wms-empty">Không có công việc chờ xử lý.</p>
      ) : (
        <ul className="wms-queue">
          {items.map((item) => {
            const Icon = QUEUE_ICONS[item.kind];
            return (
              <li key={item.id} className="wms-queue__item">
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
      )}
      <p className="wms-queue__footer">{DASHBOARD_FOOTER_DATE}</p>
    </section>
  );
}
