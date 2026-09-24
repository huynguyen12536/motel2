"use client";
import { useMemo, useState } from "react";
import { Edges } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { WarehouseZone } from "@/features/warehouse/types/warehouse.types";
import { ZoneLabel } from "@/features/warehouse/3d/zone-label";

export function PlaceholderZoneMesh({
  zone,
  selected,
  onSelect,
}: {
  zone: WarehouseZone;
  selected: boolean;
  onSelect: (zoneId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = useMemo(() => {
    if (selected) return "#93C5FD";
    if (hovered) return "#BFDBFE";
    return "#DBEAFE";
  }, [hovered, selected]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(zone.id);
  };

  return (
    <group position={zone.position}>
      <mesh
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={zone.size} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={selected ? 0.55 : 0.45}
          roughness={0.85}
          metalness={0.05}
        />
        <Edges
          threshold={15}
          color={selected ? "#2563EB" : "#93C5FD"}
          scale={1.001}
        />
      </mesh>
      <ZoneLabel zone={zone} visible />
    </group>
  );
}

export function WarehouseFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[28, 20]} />
      <meshStandardMaterial color="#F1F5F9" roughness={0.95} />
    </mesh>
  );
}
