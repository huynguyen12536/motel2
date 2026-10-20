"use client";
import { Component, type ReactNode, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { getWarehouseModel } from "@/features/warehouse/config/warehouse-models";
import { warehouseZones } from "@/features/warehouse/mocks/warehouse.mock";
import { WarehouseScene } from "@/features/warehouse/3d/warehouse-scene";
import type { ViewPlane } from "@/features/warehouse/3d/camera-controller";
import { ViewerToolbar } from "@/features/warehouse/3d/viewer-toolbar";
import { ModelPlaceholder } from "@/features/warehouse/3d/model-placeholder";
import type { Warehouse3DModelConfig } from "@/features/warehouse/types/warehouse.types";
import type { WarehouseZone } from "@/features/warehouse/types/warehouse.types";

export function WarehouseViewer({
  warehouseId,
  warehouseName,
  selectedZoneId,
  onSelectZone,
}: {
  warehouseId: string;
  warehouseName: string;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}) {
  const model = getWarehouseModel(warehouseId);
  const zones = useMemo(
    () => warehouseZones.filter((zone) => zone.warehouseId === warehouseId),
    [warehouseId],
  );
  const [resetToken, setResetToken] = useState(0);
  const [zoomToken, setZoomToken] = useState(0);
  const [floor, setFloor] = useState("ALL");
  const [viewPlane, setViewPlane] = useState<ViewPlane>("3d");

  const cameraGoal = useMemo(() => {
    if (!selectedZoneId) return null;
    const zone = zones.find((item) => item.id === selectedZoneId);
    if (!zone) return null;
    const [x, y, z] = zone.position;
    return {
      position: [x + 8, y + 7, z + 8] as [number, number, number],
      target: [x, y, z] as [number, number, number],
    };
  }, [selectedZoneId, zones]);

  if (!model) {
    return (
      <div className="wms-wh-viewer" aria-label="Mô hình 3D kho">
        <ModelPlaceholder
          name={warehouseName}
          type="WAREHOUSE"
          message="Không tìm thấy cấu hình mô hình."
        />
      </div>
    );
  }

  return (
    <ViewerShell
      key={`${warehouseId}-${model.glbUrl ?? "none"}`}
      model={model}
      warehouseName={warehouseName}
      zones={zones}
      selectedZoneId={selectedZoneId}
      onSelectZone={onSelectZone}
      cameraGoal={cameraGoal}
      resetToken={resetToken}
      zoomToken={zoomToken}
      onReset={() => setResetToken((token) => token + 1)}
      onZoom={() => setZoomToken((token) => token + 1)}
      floor={floor}
      onFloorChange={setFloor}
      viewPlane={viewPlane}
      onViewPlane={setViewPlane}
    />
  );
}

function ViewerShell({
  model,
  warehouseName,
  zones,
  selectedZoneId,
  onSelectZone,
  cameraGoal,
  resetToken,
  zoomToken,
  onReset,
  onZoom,
  floor,
  onFloorChange,
  viewPlane,
  onViewPlane,
}: {
  model: Warehouse3DModelConfig;
  warehouseName: string;
  zones: WarehouseZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  cameraGoal: {
    position: [number, number, number];
    target: [number, number, number];
  } | null;
  resetToken: number;
  zoomToken: number;
  onReset: () => void;
  onZoom: () => void;
  floor: string;
  onFloorChange: (floor: string) => void;
  viewPlane: ViewPlane;
  onViewPlane: (plane: ViewPlane) => void;
}) {
  const [loadError, setLoadError] = useState(false);
  const hasGlb = Boolean(model.glbUrl) && !loadError;
  const floorsEnabled = Boolean(model.floorMappings);

  return (
    <section className="wms-wh-viewer" aria-label="Mô hình 3D kho">
      <div className="wms-wh-viewer__chrome">
        <div className="wms-wh-viewer__meta">
          <p className="wms-wh-viewer__meta-label">Kho đang xem</p>
          <p className="wms-wh-viewer__meta-value">{warehouseName}</p>
        </div>
        <span
          className={
            hasGlb
              ? "wms-wh-viewer__badge"
              : "wms-wh-viewer__badge wms-wh-viewer__badge--warn"
          }
        >
          {hasGlb ? "3D warehouse model (.glb)" : "Chưa có GLB"}
        </span>
      </div>

      <div className="wms-wh-viewer__stage">
        <ViewerToolbar
          onReset={onReset}
          onZoom={onZoom}
          onFit={onReset}
          floorsEnabled={floorsEnabled}
          floors={model.floorMappings ? Object.keys(model.floorMappings).reverse() : []}
          floor={floor}
          onFloorChange={onFloorChange}
          viewPlane={viewPlane}
          onViewPlane={onViewPlane}
        />

        {hasGlb ? (
          <GlbErrorBoundary onError={() => setLoadError(true)}>
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{
                position: model.defaultCamera.position,
                fov: 42,
                near: 0.1,
                far: 800,
              }}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              aria-label={`Không gian 3D ${warehouseName}`}
            >
              <WarehouseScene
                model={model}
                zones={zones}
                floor={floor}
                selectedZoneId={selectedZoneId}
                onSelectZone={onSelectZone}
                cameraGoal={cameraGoal}
                resetToken={resetToken}
                zoomToken={zoomToken}
                viewPlane={viewPlane}
              />
            </Canvas>
          </GlbErrorBoundary>
        ) : (
          <>
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{
                position: model.defaultCamera.position,
                fov: 42,
                near: 0.1,
                far: 800,
              }}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              aria-label={`Placeholder 3D ${warehouseName}`}
            >
              <WarehouseScene
                model={{ ...model, glbUrl: null }}
                zones={zones}
                floor={floor}
                selectedZoneId={selectedZoneId}
                onSelectZone={onSelectZone}
                cameraGoal={cameraGoal}
                resetToken={resetToken}
                zoomToken={zoomToken}
                viewPlane={viewPlane}
              />
            </Canvas>
            <div className="wms-wh-viewer__hint" role="note">
              <p>
                {loadError
                  ? "Không tải được GLB — đang dùng placeholder."
                  : "Đang hiển thị placeholder — chưa có file .glb cho kho này."}
              </p>
              {loadError ? (
                <button
                  type="button"
                  className="wms-wh-link"
                  onClick={() => setLoadError(false)}
                >
                  Thử lại
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

class GlbErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
