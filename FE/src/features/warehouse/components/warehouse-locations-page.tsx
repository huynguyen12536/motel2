"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { WarehousePageHeader } from "@/features/warehouse/components/warehouse-page-header";
import { WarehouseTabs } from "@/features/warehouse/components/warehouse-tabs";
import { WarehouseLocationTable } from "@/features/warehouse/components/warehouse-location-table";
import { WarehouseDetailPanel } from "@/features/warehouse/components/warehouse-detail-panel";
import { WarehouseLoadingSkeleton } from "@/features/warehouse/components/warehouse-loading-skeleton";
import {
  warehouses,
  warehouseLocations,
  warehouseZones,
  zoneHistory,
  zoneMaterials,
} from "@/features/warehouse/mocks/warehouse.mock";
import type {
  WarehouseDetailTab,
  WarehousePageTab,
} from "@/features/warehouse/types/warehouse.types";
import "./warehouse.css";

const WarehouseCampusViewer = dynamic(
  () =>
    import("@/features/warehouse/3d/warehouse-campus-viewer").then(
      (mod) => mod.WarehouseCampusViewer,
    ),
  {
    ssr: false,
    loading: () => <WarehouseLoadingSkeleton compact />,
  },
);

export function WarehouseLocationsPage() {
  const [tab, setTab] = useState<WarehousePageTab>("model3d");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "k01");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<WarehouseDetailTab>("locations");

  const warehouse = warehouses.find((item) => item.id === warehouseId) ?? null;
  const selectedZone =
    warehouseZones.find((zone) => zone.id === selectedZoneId) ?? null;
  const detailLocations = useMemo(
    () =>
      warehouseLocations.filter((item) =>
        selectedZoneId ? item.zoneId === selectedZoneId : false,
      ),
    [selectedZoneId],
  );

  const onSelectZone = (zoneId: string) => {
    if (!zoneId) {
      setSelectedZoneId(null);
      return;
    }
    const zone = warehouseZones.find((item) => item.id === zoneId);
    if (!zone) return;
    setWarehouseId(zone.warehouseId);
    setSelectedZoneId(zoneId);
    setDetailTab("locations");
  };


  return (
    <div className="wms-wh">
      <WarehousePageHeader
        onAdd={() =>
          toast.message("Chức năng thêm đang ở chế độ mock — chưa nối backend.")
        }
        onFullscreen={() => {
          const el = document.querySelector(".wms-wh-viewer__stage");
          if (el instanceof HTMLElement && el.requestFullscreen) {
            void el.requestFullscreen();
          } else {
            toast.message("Trình duyệt không hỗ trợ toàn màn hình.");
          }
        }}
      />

      <WarehouseTabs value={tab} onChange={setTab} />

      {tab === "model3d" ? (
        <>
          <div className={selectedZone ? "wms-wh-main" : "wms-wh-main wms-wh-main--campus"}>
            <div className="wms-wh-main__viewer min-w-0">
              <WarehouseCampusViewer
                selectedZoneId={selectedZoneId}
                onSelectZone={onSelectZone}
              />
            </div>
            {selectedZone && <WarehouseDetailPanel
              warehouse={warehouse}
              zone={selectedZone}
              locations={detailLocations}
              materials={zoneMaterials[selectedZoneId ?? ""] ?? []}
              history={zoneHistory[selectedZoneId ?? ""] ?? []}
              tab={detailTab}
              onTabChange={setDetailTab}
            />}
          </div>

        </>
      ) : null}

      {tab === "warehouses" ? (
        <ListCard title="Danh sách kho">
          <table className="wms-wh-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên kho</th>
                <th>Khu vực</th>
                <th>Vị trí</th>
                <th>Sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.zoneCount}</td>
                  <td>{item.locationCount}</td>
                  <td>{item.utilization}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListCard>
      ) : null}

      {tab === "zones" ? (
        <ListCard title="Danh sách khu vực">
          <table className="wms-wh-table">
            <thead>
              <tr>
                <th>Khu vực</th>
                <th>Kho</th>
                <th>Tầng</th>
                <th>Vị trí</th>
                <th>Sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {warehouseZones.map((zone) => (
                <tr key={zone.id}>
                  <td>{zone.name}</td>
                  <td>
                    {
                      warehouses.find((item) => item.id === zone.warehouseId)
                        ?.name
                    }
                  </td>
                  <td>{zone.floor}</td>
                  <td>{zone.locationCount}</td>
                  <td>{zone.utilization}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListCard>
      ) : null}

      {tab === "locations" ? (
        <WarehouseLocationTable
          items={warehouseLocations}
          zones={warehouseZones}
          selectedZoneId={null}
          onSelectLocation={() => undefined}
        />
      ) : null}
    </div>
  );
}

function ListCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wms-wh-table-card">
      <h2 className="wms-wh-panel-title">{title}</h2>
      <div className="wms-wh-table-wrap">{children}</div>
    </section>
  );
}
