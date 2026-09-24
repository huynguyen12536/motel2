"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { WarehousePageHeader } from "@/features/warehouse/components/warehouse-page-header";
import { WarehouseTabs } from "@/features/warehouse/components/warehouse-tabs";
import { WarehouseKpis } from "@/features/warehouse/components/warehouse-kpis";
import { WarehouseTree } from "@/features/warehouse/components/warehouse-tree";
import { WarehouseLocationTable } from "@/features/warehouse/components/warehouse-location-table";
import { WarehouseDetailPanel } from "@/features/warehouse/components/warehouse-detail-panel";
import {
  warehouses,
  warehouseKpis,
  warehouseLocations,
  warehouseTree,
  warehouseZones,
  zoneHistory,
  zoneMaterials,
} from "@/features/warehouse/mocks/warehouse.mock";
import type {
  WarehouseDetailTab,
  WarehousePageTab,
  WarehouseTreeNode,
} from "@/features/warehouse/types/warehouse.types";
import "./warehouse.css";

const WarehouseViewer = dynamic(
  () =>
    import("@/features/warehouse/3d/warehouse-viewer").then(
      (mod) => mod.WarehouseViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="wms-wh-viewer wms-wh-viewer--loading">
        <p>Đang khởi tạo không gian 3D...</p>
      </div>
    ),
  },
);

export function WarehouseLocationsPage() {
  const [tab, setTab] = useState<WarehousePageTab>("model3d");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "k01");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [treeSelectedId, setTreeSelectedId] = useState<string | null>("root");
  const [detailTab, setDetailTab] = useState<WarehouseDetailTab>("locations");

  const warehouse = warehouses.find((item) => item.id === warehouseId) ?? null;
  const zonesForWarehouse = useMemo(
    () => warehouseZones.filter((zone) => zone.warehouseId === warehouseId),
    [warehouseId],
  );
  const selectedZone =
    warehouseZones.find((zone) => zone.id === selectedZoneId) ?? null;
  const detailLocations = useMemo(
    () =>
      warehouseLocations.filter((item) =>
        selectedZoneId ? item.zoneId === selectedZoneId : false,
      ),
    [selectedZoneId],
  );
  const locationsForTable = useMemo(
    () =>
      warehouseLocations.filter((item) => item.warehouseId === warehouseId),
    [warehouseId],
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
    setTreeSelectedId(zoneId);
    setDetailTab("locations");
  };

  const onTreeSelect = (node: WarehouseTreeNode) => {
    setTreeSelectedId(node.id);
    if (node.kind === "warehouse" && node.warehouseId) {
      setWarehouseId(node.warehouseId);
      setSelectedZoneId(null);
      return;
    }
    if (node.zoneId) {
      onSelectZone(node.zoneId);
    }
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
          <div className="wms-wh-main">
            <div className="wms-wh-main__viewer min-w-0">
              <div className="wms-wh-warehouse-select">
                <label htmlFor="wh-select">
                  <span className="sr-only">Chọn kho</span>
                  <select
                    id="wh-select"
                    className="wms-wh-select"
                    value={warehouseId}
                    onChange={(event) => {
                      setWarehouseId(event.target.value);
                      setSelectedZoneId(null);
                    }}
                  >
                    {warehouses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <WarehouseViewer
                warehouseId={warehouseId}
                warehouseName={warehouse?.name ?? "Kho"}
                selectedZoneId={selectedZoneId}
                onSelectZone={onSelectZone}
              />
            </div>
            <WarehouseDetailPanel
              warehouse={warehouse}
              zone={selectedZone}
              locations={detailLocations}
              materials={zoneMaterials[selectedZoneId ?? ""] ?? []}
              history={zoneHistory[selectedZoneId ?? ""] ?? []}
              tab={detailTab}
              onTabChange={setDetailTab}
            />
          </div>

          <WarehouseKpis items={warehouseKpis} />

          <div className="wms-wh-bottom">
            <WarehouseTree
              root={warehouseTree}
              selectedId={treeSelectedId}
              onSelect={onTreeSelect}
            />
            <WarehouseLocationTable
              items={locationsForTable}
              zones={zonesForWarehouse}
              selectedZoneId={selectedZoneId}
              onSelectLocation={(locationId) => {
                const location = warehouseLocations.find(
                  (item) => item.id === locationId,
                );
                if (location) onSelectZone(location.zoneId);
              }}
            />
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
