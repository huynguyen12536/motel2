import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/features/dashboard/components/status-badge";
import type { RecentDocument } from "@/features/dashboard/types/dashboard.types";

export function RecentDocumentsCard({ items }: { items: RecentDocument[] }) {
  return (
    <section className="wms-card">
      <div className="wms-card__head">
        <h2 className="wms-card__title">Phiếu gần đây</h2>
        <a href="#" className="wms-card__link">
          Xem tất cả
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      </div>
      {items.length === 0 ? (
        <p className="wms-empty">Không có dữ liệu.</p>
      ) : (
        <div className="wms-card__scroll" tabIndex={0}>
          <div className="wms-table-wrap wms-table-desktop">
            <table className="wms-table wms-table--docs">
              <thead>
                <tr>
                  <th scope="col">Mã phiếu</th>
                  <th scope="col">Loại</th>
                  <th scope="col">Nhà cung cấp / Bộ phận</th>
                  <th scope="col">Ngày tạo</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr
                    key={row.id}
                    className="wms-row-enter"
                    style={{ animationDelay: `${index * 25}ms` }}
                  >
                    <td className="wms-table__code" title={row.code}>
                      {row.code}
                    </td>
                    <td title={row.typeLabel}>{row.typeLabel}</td>
                    <td title={row.party}>{row.party}</td>
                    <td title={row.createdAt}>{row.createdAt}</td>
                    <td>
                      <StatusBadge status={row.status} label={row.statusLabel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="wms-mobile-list">
            {items.map((row) => (
              <li key={row.id} className="wms-mobile-card">
                <p className="wms-mobile-card__code">{row.code}</p>
                <div className="wms-mobile-card__row">
                  <p className="wms-mobile-card__meta">
                    {row.typeLabel} · {row.createdAt}
                  </p>
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </div>
                <p className="wms-mobile-card__meta" title={row.party}>
                  {row.party}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
