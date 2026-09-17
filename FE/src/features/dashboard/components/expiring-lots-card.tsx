import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/features/dashboard/components/status-badge";
import type { ExpiringLot } from "@/features/dashboard/types/dashboard.types";

export function ExpiringLotsCard({ items }: { items: ExpiringLot[] }) {
  return (
    <section className="wms-card">
      <div className="wms-card__head">
        <h2 className="wms-card__title">Lô sắp hết hạn</h2>
        <a href="#" className="wms-card__link">
          Xem tất cả
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      </div>
      {items.length === 0 ? (
        <p className="wms-empty">Không có lô sắp hết hạn.</p>
      ) : (
        <>
          <div className="wms-table-wrap wms-table-desktop" tabIndex={0}>
            <table className="wms-table wms-table--lots">
              <thead>
                <tr>
                  <th scope="col">Tên vật liệu</th>
                  <th scope="col">Mã lô</th>
                  <th scope="col">Hạn sử dụng</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lot) => (
                  <tr key={lot.id}>
                    <td title={lot.materialName}>{lot.materialName}</td>
                    <td className="wms-table__code" title={lot.lotCode}>
                      {lot.lotCode}
                    </td>
                    <td title={lot.expiryDate}>{lot.expiryDate}</td>
                    <td>
                      <StatusBadge status={lot.status} label={lot.statusLabel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="wms-mobile-list">
            {items.map((lot) => (
              <li key={lot.id} className="wms-mobile-card">
                <p className="wms-mobile-card__code" title={lot.materialName}>
                  {lot.materialName}
                </p>
                <div className="wms-mobile-card__row">
                  <p className="wms-mobile-card__meta">
                    {lot.lotCode} · {lot.expiryDate}
                  </p>
                  <StatusBadge status={lot.status} label={lot.statusLabel} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
