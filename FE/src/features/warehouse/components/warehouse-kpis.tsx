"use client";
import type { WarehouseKpi } from "@/features/warehouse/types/warehouse.types";

export function WarehouseKpis({ items }: { items: WarehouseKpi[] }) {
  return (
    <section className="wms-wh-kpis" aria-label="Tóm tắt kho">
      {items.map((item) => (
        <article key={item.id} className="wms-wh-kpi">
          <p className="wms-wh-kpi__label">{item.label}</p>
          <p className="wms-wh-kpi__value">
            {item.value.toLocaleString("vi-VN")}
            {item.suffix ?? ""}
          </p>
        </article>
      ))}
    </section>
  );
}
