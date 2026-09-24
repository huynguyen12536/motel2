"use client";
import type {
  Warehouse,
  WarehouseDetailTab,
  WarehouseHistoryItem,
  WarehouseLocation,
  WarehouseMaterialSummary,
  WarehouseZone,
} from "@/features/warehouse/types/warehouse.types";
import { LOCATION_STATUS_META } from "@/features/warehouse/utils/warehouse.utils";

export function WarehouseDetailPanel({
  warehouse,
  zone,
  locations,
  materials,
  history,
  tab,
  onTabChange,
}: {
  warehouse: Warehouse | null;
  zone: WarehouseZone | null;
  locations: WarehouseLocation[];
  materials: WarehouseMaterialSummary[];
  history: WarehouseHistoryItem[];
  tab: WarehouseDetailTab;
  onTabChange: (tab: WarehouseDetailTab) => void;
}) {
  if (!zone || !warehouse) {
    return (
      <aside className="wms-wh-detail" aria-label="Chi tiết khu vực">
        <div className="wms-wh-detail__empty">
          <p className="wms-wh-detail__empty-title">
            Chọn một khu vực trên mô hình để xem chi tiết.
          </p>
          <p className="wms-wh-detail__empty-sub">
            Click vào khối placeholder hoặc node trên cây cấu trúc kho.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="wms-wh-detail" aria-label={`Chi tiết ${zone.name}`}>
      <div className="wms-wh-detail__head">
        <h2 className="wms-wh-detail__title">{zone.name}</h2>
        <p className="wms-wh-detail__sub">
          {warehouse.name} — Tầng {zone.floor}
        </p>
        <p className="wms-wh-detail__desc">{zone.description}</p>
      </div>

      <div className="wms-wh-detail__stats">
        <Stat label="Tổng vị trí" value={zone.locationCount} />
        <Stat label="Đang sử dụng" value={zone.occupiedCount} />
        <Stat label="Trống" value={zone.emptyCount} />
        <Stat label="Utilization" value={`${zone.utilization}%`} />
      </div>

      <div className="wms-wh-util">
        <div className="wms-wh-util__track" aria-hidden="true">
          <span
            className="wms-wh-util__fill"
            style={{ width: `${zone.utilization}%` }}
          />
        </div>
      </div>

      <div className="wms-wh-detail-tabs" role="tablist">
        <DetailTab
          active={tab === "locations"}
          onClick={() => onTabChange("locations")}
          label={`Vị trí (${locations.length})`}
        />
        <DetailTab
          active={tab === "materials"}
          onClick={() => onTabChange("materials")}
          label={`Vật liệu (${materials.length})`}
        />
        <DetailTab
          active={tab === "history"}
          onClick={() => onTabChange("history")}
          label="Lịch sử"
        />
      </div>

      <div className="wms-wh-detail__body">
        {tab === "locations" ? (
          <table className="wms-wh-mini-table">
            <thead>
              <tr>
                <th scope="col">Mã vị trí</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Vật liệu</th>
                <th scope="col">SL lô</th>
              </tr>
            </thead>
            <tbody>
              {locations.slice(0, 8).map((row) => {
                const meta = LOCATION_STATUS_META[row.status];
                return (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>
                      <span className={`wms-loc-status ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td>{row.materialName ?? "—"}</td>
                    <td>{row.lotCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        {tab === "materials" ? (
          <ul className="wms-wh-simple-list">
            {materials.length === 0 ? (
              <li>Chưa có vật liệu trong khu vực.</li>
            ) : (
              materials.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span>
                    {item.lotCount} lô · {item.quality}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {tab === "history" ? (
          <ul className="wms-wh-simple-list">
            {history.length === 0 ? (
              <li>Chưa có lịch sử.</li>
            ) : (
              history.map((item) => (
                <li key={item.id}>
                  <strong>{item.action}</strong>
                  <span>
                    {item.time} · {item.actor}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <button type="button" className="wms-wh-btn wms-wh-btn--ghost wms-wh-detail__cta">
        Xem chi tiết khu vực →
      </button>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="wms-wh-detail__stat">
      <p className="wms-wh-detail__stat-label">{label}</p>
      <p className="wms-wh-detail__stat-value">{value}</p>
    </div>
  );
}

function DetailTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={
        active
          ? "wms-wh-detail-tabs__btn wms-wh-detail-tabs__btn--active"
          : "wms-wh-detail-tabs__btn"
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}
