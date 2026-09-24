"use client";
import { Suspense, useEffect, useMemo } from "react";
import {
  Bounds,
  Center,
  ContactShadows,
  Html,
  useGLTF,
} from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type {
  Warehouse3DModelConfig,
  WarehouseZone,
} from "@/features/warehouse/types/warehouse.types";
import {
  PlaceholderZoneMesh,
  WarehouseFloor,
} from "@/features/warehouse/3d/model-placeholder-meshes";
import { CameraController } from "@/features/warehouse/3d/camera-controller";
import { ZoneLabel } from "@/features/warehouse/3d/zone-label";

export function WarehouseScene({
  model,
  zones,
  selectedZoneId,
  onSelectZone,
  cameraGoal,
  resetToken,
}: {
  model: Warehouse3DModelConfig;
  zones: WarehouseZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  cameraGoal: {
    position: [number, number, number];
    target: [number, number, number];
  } | null;
  resetToken: number;
}) {
  return (
    <>
      <color attach="background" args={["#F8FAFC"]} />
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[12, 18, 10]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={["#F8FAFC", "#E2E8F0", 0.35]} />
      <CameraController goal={cameraGoal} resetToken={resetToken} />

      {model.glbUrl ? (
        <Suspense fallback={<SceneLoader />}>
          <GlbWarehouse
            url={model.glbUrl}
            mappings={model.meshMappings}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
        </Suspense>
      ) : (
        <>
          <WarehouseFloor />
          <gridHelper
            args={[28, 28, "#E2E8F0", "#F1F5F9"]}
            position={[0, 0.01, 0]}
          />
          {zones.map((zone) => (
            <PlaceholderZoneMesh
              key={zone.id}
              zone={zone}
              selected={selectedZoneId === zone.id}
              onSelect={onSelectZone}
            />
          ))}
        </>
      )}

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.28}
        scale={36}
        blur={2.4}
        far={14}
      />
    </>
  );
}

function SceneLoader() {
  return (
    <Html center>
      <div className="wms-wh-loader">
        <p>Đang tải mô hình 3D...</p>
      </div>
    </Html>
  );
}

function GlbWarehouse({
  url,
  mappings,
  zones,
  selectedZoneId,
  onSelectZone,
}: {
  url: string;
  mappings: Record<string, string>;
  zones: WarehouseZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => scene.clone(true), [scene]);

  const { meshByZone, labelAnchors } = useMemo(() => {
    const map = new Map<string, THREE.Mesh[]>();

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;

      const zoneId = resolveZoneId(obj.name, mappings);
      if (!zoneId) return;

      const list = map.get(zoneId) ?? [];
      list.push(obj);
      map.set(zoneId, list);
    });

    const anchors = zones.map((zone) => {
      const meshes = map.get(zone.id);
      if (!meshes?.length) {
        return {
          zone,
          position: [
            zone.position[0],
            zone.position[1] + zone.size[1] / 2 + 0.4,
            zone.position[2],
          ] as [number, number, number],
        };
      }
      const box = new THREE.Box3();
      for (const mesh of meshes) box.expandByObject(mesh);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      return {
        zone,
        position: [center.x, center.y + size.y / 2 + 0.4, center.z] as [
          number,
          number,
          number,
        ],
      };
    });

    return { meshByZone: map, labelAnchors: anchors };
  }, [root, mappings, zones]);

  useEffect(() => {
    for (const [zoneId, meshes] of meshByZone) {
      const selected = zoneId === selectedZoneId;
      for (const mesh of meshes) {
        applyZoneMaterial(mesh, selected, false);
      }
    }
  }, [selectedZoneId, meshByZone]);

  const onPointer = (
    event: ThreeEvent<PointerEvent | MouseEvent>,
    kind: "over" | "out" | "click",
  ) => {
    event.stopPropagation();
    const zoneId = findZoneFromObject(event.object, mappings);
    if (!zoneId) return;

    if (kind === "click") {
      onSelectZone(zoneId);
      return;
    }

    document.body.style.cursor = kind === "over" ? "pointer" : "auto";
    const meshes = meshByZone.get(zoneId) ?? [];
    for (const mesh of meshes) {
      applyZoneMaterial(mesh, zoneId === selectedZoneId, kind === "over");
    }
  };

  return (
    <Bounds fit clip observe margin={1.25}>
      <Center>
        <group
          onClick={(event) => onPointer(event, "click")}
          onPointerOver={(event) => onPointer(event, "over")}
          onPointerOut={(event) => onPointer(event, "out")}
        >
          <primitive object={root} />
        </group>
        {labelAnchors.map(({ zone, position }) => (
          <group key={zone.id} position={position}>
            <ZoneLabel zone={zone} visible local />
          </group>
        ))}
      </Center>
    </Bounds>
  );
}

function resolveZoneId(
  meshName: string,
  mappings: Record<string, string>,
): string | null {
  if (mappings[meshName]) return mappings[meshName];
  for (const [key, zoneId] of Object.entries(mappings)) {
    if (meshName === key || meshName.startsWith(`${key}_`)) return zoneId;
  }
  return null;
}

function findZoneFromObject(
  object: THREE.Object3D,
  mappings: Record<string, string>,
): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const zoneId = resolveZoneId(current.name, mappings);
    if (zoneId) return zoneId;
    current = current.parent;
  }
  return null;
}

function applyZoneMaterial(
  mesh: THREE.Mesh,
  selected: boolean,
  hovered: boolean,
) {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  for (const mat of materials) {
    if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
    if (!mat.userData.__wmsBase) {
      mat.userData.__wmsBase = {
        color: mat.color.clone(),
        emissive: mat.emissive.clone(),
        emissiveIntensity: mat.emissiveIntensity,
      };
    }
    const base = mat.userData.__wmsBase as {
      color: THREE.Color;
      emissive: THREE.Color;
      emissiveIntensity: number;
    };

    mat.color.copy(base.color);
    mat.emissive.copy(base.emissive);

    if (selected) {
      mat.emissive.set("#2563EB");
      mat.emissiveIntensity = 0.22;
      mat.transparent = true;
      mat.opacity = 0.92;
    } else if (hovered) {
      mat.emissive.set("#93C5FD");
      mat.emissiveIntensity = 0.12;
      mat.transparent = true;
      mat.opacity = 0.95;
    } else {
      mat.emissiveIntensity = base.emissiveIntensity;
      mat.transparent = false;
      mat.opacity = 1;
    }
    mat.needsUpdate = true;
  }
}

useGLTF.preload("/models/warehouse/warehouse-main.glb");
