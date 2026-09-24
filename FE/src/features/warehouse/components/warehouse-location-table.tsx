"use client";
import { useMemo, useState } from "react";
import type {
  LocationStatus,
  WarehouseLocation,
  WarehouseZone,
} from "@/features/warehouse/types/warehouse.types";
import { LOCATION_STATUS_META } from "@/features/warehouse/utils/warehouse.utils";

export function WarehouseLocationTable({
  items,
  zones,
  selectedZoneId,
  onSelectLocation,
}: {
  items: WarehouseLocation[];
  zones: WarehouseZone[];
  selectedZoneId: string | null;
  onSelectLocation: (locationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LocationStatus | "all">("all");
  const [zoneFilter, setZoneFilter] = useState(selectedZoneId ?? "all");

  const effectiveZone = selectedZoneId ?? zoneFilter;

  const rows = useMemo(() => {
    return items.filter((item) => {
      if (effectiveZone !== "all" && item.zoneId !== effectiveZone) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        item.code.toLowerCase().includes(q) ||
        (item.materialName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, effectiveZone, status, query]);

  const zoneName = (zoneId: string) =>
    zones.find((zone) => zone.id === zoneId)?.name ?? zoneId;

  return (
    <section className="wms-wh-table-card" aria-label="Danh sách vị trí">
      <div className="wms-wh-table-card__head">
        <h2 className="wms-wh-panel-title">Danh sách vị trí</h2>
        <div className="wms-wh-table-card__filters">
          <input
            className="wms-wh-input"
            type="search"
            placeholder="Tìm kiếm vị trí..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Tìm kiếm vị trí"
          />
          <select
            className="wms-wh-select"
            value={effectiveZone}
            onChange={(event) => setZoneFilter(event.target.value)}
            disabled={Boolean(selectedZoneId)}
            aria-label="Lọc khu vực"
          >
            <option value="all">Tất cả khu vực</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <select
            className="wms-wh-select"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as LocationStatus | "all")
            }
            aria-label="Lọc trạng thái"
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(LOCATION_STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="wms-wh-table-wrap wms-wh-table-desktop">
        <table className="wms-wh-table">
          <thead>
            <tr>
              <th scope="col">Mã vị trí</th>
              <th scope="col">Khu vực</th>
              <th scope="col">Dãy / Kệ</th>
              <th scope="col">Loại hàng</th>
              <th scope="col">Sức chứa</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Cập nhật</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const meta = LOCATION_STATUS_META[row.status];
              return (
                <tr
                  key={row.id}
                  className="wms-wh-row"
                  style={{ animationDelay: `${Math.min(index * 20, 160)}ms` }}
                >
                  <td className="wms-wh-table__code">{row.code}</td>
                  <td>{zoneName(row.zoneId)}</td>
                  <td>
                    {row.aisle} / {row.rack}
                  </td>
                  <td>{row.materialName ?? "—"}</td>
                  <td>
                    {row.lotCount}/{row.capacity}
                  </td>
                  <td>
                    <span className={`wms-loc-status ${meta.className}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td>{row.updatedAt}</td>
                  <td>
                    <button
                      type="button"
                      className="wms-wh-link"
                      onClick={() => onSelectLocation(row.id)}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="wms-wh-mobile-list">
        {rows.map((row) => {
          const meta = LOCATION_STATUS_META[row.status];
          return (
            <li key={row.id} className="wms-wh-mobile-card">
              <div className="wms-wh-mobile-card__top">
                <p className="wms-wh-table__code">{row.code}</p>
                <span className={`wms-loc-status ${meta.className}`}>
                  {meta.label}
                </span>
              </div>
              <p>
                {zoneName(row.zoneId)} · {row.aisle}/{row.rack}
              </p>
              <p>{row.materialName ?? "Trống"} · {row.lotCount}/{row.capacity}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
