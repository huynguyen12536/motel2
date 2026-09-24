"use client";
import { Html } from "@react-three/drei";
import type { WarehouseZone } from "@/features/warehouse/types/warehouse.types";

export function ZoneLabel({
  zone,
  visible,
  /** When set, label is local to parent group (y offset only). */
  local = false,
}: {
  zone: WarehouseZone;
  visible: boolean;
  local?: boolean;
}) {
  if (!visible) return null;

  const position = local
    ? ([0, 0.35, 0] as [number, number, number])
    : ([
        zone.position[0],
        zone.position[1] + zone.size[1] / 2 + 0.6,
        zone.position[2],
      ] as [number, number, number]);

  return (
    <Html position={position} center distanceFactor={14} style={{ pointerEvents: "none" }}>
      <div className="wms-wh-zone-label">
        <span
          className={`wms-wh-zone-label__dot ${
            zone.utilization >= 90
              ? "wms-wh-zone-label__dot--warn"
              : "wms-wh-zone-label__dot--ok"
          }`}
          aria-hidden="true"
        />
        <div>
          <p className="wms-wh-zone-label__name">{zone.name}</p>
          <p className="wms-wh-zone-label__meta">{zone.locationCount} vị trí</p>
        </div>
      </div>
    </Html>
  );
}
