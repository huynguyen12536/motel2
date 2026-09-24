"use client";
import type { WarehousePageTab } from "@/features/warehouse/types/warehouse.types";

const TABS: { id: WarehousePageTab; label: string }[] = [
  { id: "model3d", label: "Mô hình 3D" },
  { id: "warehouses", label: "Danh sách kho" },
  { id: "zones", label: "Danh sách khu vực" },
  { id: "locations", label: "Danh sách vị trí" },
];

export function WarehouseTabs({
  value,
  onChange,
}: {
  value: WarehousePageTab;
  onChange: (tab: WarehousePageTab) => void;
}) {
  return (
    <div className="wms-wh-tabs" role="tablist" aria-label="Chế độ xem kho">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={
            value === tab.id
              ? "wms-wh-tabs__btn wms-wh-tabs__btn--active"
              : "wms-wh-tabs__btn"
          }
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
