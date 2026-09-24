"use client";
import { ChevronRight, Warehouse } from "lucide-react";
import { useCountUp } from "@/features/dashboard/hooks/use-count-up";
import type {
  WarehouseAreaOverviewItem,
  WarehouseAreaStatus,
} from "@/features/dashboard/types/dashboard.types";

const ZONE_SUBTITLE: Record<string, string> = {
  RAW: "Kho chính",
  QUARANTINE: "QC Zone",
  COOL: "Temperature Controlled",
  PACKAGING: "Kho phụ trợ",
  FINISHED: "Kho chính",
  PASSED: "Released Zone",
  REJECT: "Reject Zone",
  FREEZER: "Cold Chain",
  SAMPLE: "Retention Sample",
  EXCIPIENT: "Kho phụ trợ",
  SOLVENT: "Hazard Control",
  API: "High Value",
  RETURNS: "Returns / Reverse",
  STAGING: "Outbound Staging",
  HAZMAT: "Hazmat Controlled",
};

const STATUS_META: Record<
  WarehouseAreaStatus,
  { label: string; className: string }
> = {
  NORMAL: { label: "Bình thường", className: "wms-area-status--normal" },
  ATTENTION: { label: "Cần chú ý", className: "wms-area-status--attention" },
  CRITICAL: {
    label: "Quá tải / Cần xử lý",
    className: "wms-area-status--critical",
  },
};

function formatLots(value: number) {
  return Math.round(value).toLocaleString("vi-VN");
}

function utilizationTone(value: number) {
  if (value > 90) return "critical";
  if (value >= 80) return "warn";
  return "ok";
}

function useAreaMetrics(item: WarehouseAreaOverviewItem) {
  return {
    totalLots: useCountUp(item.totalLots, 720),
    passed: useCountUp(item.passed, 720),
    quarantine: useCountUp(item.quarantine, 720),
    onHold: useCountUp(item.onHold, 720),
    failed: useCountUp(item.failed, 720),
    utilization: useCountUp(item.utilization, 720),
  };
}

function QualityCount({
  value,
  tone,
  label,
}: {
  value: number;
  tone: "passed" | "quarantine" | "hold" | "failed";
  label: string;
}) {
  return (
    <span className={`wms-area-count wms-area-count--${tone}`} title={label}>
      <span className="wms-area-count__dot" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {formatLots(value)}
    </span>
  );
}

function UtilizationBar({
  value,
  target,
}: {
  value: number;
  target: number;
}) {
  const display = Math.round(value);
  const tone = utilizationTone(target);
  return (
    <div className="wms-area-util">
      <span className="wms-area-util__value">{display}%</span>
      <div
        className="wms-area-util__track"
        role="progressbar"
        aria-valuenow={display}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Mức sử dụng ${display}%`}
      >
        <span
          className={`wms-area-util__fill wms-area-util__fill--${tone} wms-area-util__fill--live`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: WarehouseAreaStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`wms-area-status ${meta.className}`}>{meta.label}</span>
  );
}

function ZoneCell({ item }: { item: WarehouseAreaOverviewItem }) {
  const subtitle = ZONE_SUBTITLE[item.id];
  return (
    <div className="wms-area-zone">
      <span className="wms-area-zone__icon" aria-hidden="true">
        <Warehouse size={15} strokeWidth={1.75} />
      </span>
      <div className="wms-area-zone__text min-w-0">
        <p className="wms-area-zone__name" title={item.name}>
          {item.name}
        </p>
        {subtitle ? (
          <p className="wms-area-zone__sub" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AreaDesktopRow({
  item,
  index,
}: {
  item: WarehouseAreaOverviewItem;
  index: number;
}) {
  const metrics = useAreaMetrics(item);
  return (
    <tr
      className="wms-area-row"
      style={{ animationDelay: `${Math.min(index * 25, 150)}ms` }}
    >
      <td>
        <ZoneCell item={item} />
      </td>
      <td className="wms-area-total">{formatLots(metrics.totalLots)}</td>
      <td className="wms-area-col--passed">
        <QualityCount value={metrics.passed} tone="passed" label="Đạt" />
      </td>
      <td>
        <QualityCount
          value={metrics.quarantine}
          tone="quarantine"
          label="Cách ly"
        />
      </td>
      <td className="wms-area-col--hold">
        <QualityCount value={metrics.onHold} tone="hold" label="Tạm giữ" />
      </td>
      <td>
        <QualityCount value={metrics.failed} tone="failed" label="Không đạt" />
      </td>
      <td>
        <UtilizationBar
          value={metrics.utilization}
          target={item.utilization}
        />
      </td>
      <td>
        <StatusPill status={item.status} />
      </td>
    </tr>
  );
}

function AreaDesktopTable({ items }: { items: WarehouseAreaOverviewItem[] }) {
  return (
    <div className="wms-table-wrap wms-table-desktop wms-area-table-wrap">
      <table className="wms-table wms-table--areas">
        <thead>
          <tr>
            <th scope="col">Kho / Khu vực</th>
            <th scope="col">Tổng lô</th>
            <th scope="col">Đạt</th>
            <th scope="col">Cách ly</th>
            <th scope="col">Tạm giữ</th>
            <th scope="col">Không đạt</th>
            <th scope="col">Sử dụng</th>
            <th scope="col">Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <AreaDesktopRow key={item.id} item={item} index={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AreaMobileCard({
  item,
  index,
}: {
  item: WarehouseAreaOverviewItem;
  index: number;
}) {
  const metrics = useAreaMetrics(item);
  return (
    <li
      className="wms-area-mobile__card"
      style={{ animationDelay: `${Math.min(index * 25, 150)}ms` }}
    >
      <div className="wms-area-mobile__top">
        <ZoneCell item={item} />
        <StatusPill status={item.status} />
      </div>
      <p className="wms-area-mobile__total">
        Tổng lô: <strong>{formatLots(metrics.totalLots)}</strong>
      </p>
      <dl className="wms-area-mobile__counts">
        <div>
          <dt>Đạt</dt>
          <dd>
            <QualityCount value={metrics.passed} tone="passed" label="Đạt" />
          </dd>
        </div>
        <div>
          <dt>Cách ly</dt>
          <dd>
            <QualityCount
              value={metrics.quarantine}
              tone="quarantine"
              label="Cách ly"
            />
          </dd>
        </div>
        <div>
          <dt>Tạm giữ</dt>
          <dd>
            <QualityCount value={metrics.onHold} tone="hold" label="Tạm giữ" />
          </dd>
        </div>
        <div>
          <dt>Không đạt</dt>
          <dd>
            <QualityCount
              value={metrics.failed}
              tone="failed"
              label="Không đạt"
            />
          </dd>
        </div>
      </dl>
      <div className="wms-area-mobile__util">
        <span className="wms-area-mobile__util-label">Sử dụng</span>
        <UtilizationBar
          value={metrics.utilization}
          target={item.utilization}
        />
      </div>
    </li>
  );
}

function AreaMobileList({ items }: { items: WarehouseAreaOverviewItem[] }) {
  return (
    <ul className="wms-area-mobile">
      {items.map((item, index) => (
        <AreaMobileCard key={item.id} item={item} index={index} />
      ))}
    </ul>
  );
}

export function WarehouseAreaOverview({
  items,
}: {
  items: WarehouseAreaOverviewItem[];
}) {
  return (
    <section
      className="wms-card wms-card--areas"
      aria-labelledby="wms-area-title"
    >
      <div className="wms-card__head wms-card__head--areas">
        <div className="min-w-0">
          <h2 id="wms-area-title" className="wms-card__title">
            Tình trạng kho theo khu vực
          </h2>
          <p className="wms-card__subtitle">
            Theo dõi số lượng lô, trạng thái chất lượng và mức sử dụng từng khu
            vực kho.
          </p>
        </div>
        <a href="#" className="wms-card__link">
          Xem chi tiết
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      </div>

      {items.length === 0 ? (
        <div className="wms-area-empty">
          <p className="wms-area-empty__title">Chưa có dữ liệu khu vực kho.</p>
          <p className="wms-area-empty__sub">
            Dữ liệu sẽ hiển thị khi kho đã được cấu hình.
          </p>
        </div>
      ) : (
        <div className="wms-area-scroll" tabIndex={0}>
          <AreaDesktopTable items={items} />
          <AreaMobileList items={items} />
        </div>
      )}
    </section>
  );
}
