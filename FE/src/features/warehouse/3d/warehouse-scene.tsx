"use client";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Bounds,
  Center,
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
import { CameraController, type ViewPlane } from "@/features/warehouse/3d/camera-controller";
import { ZoneLabel } from "@/features/warehouse/3d/zone-label";

export function WarehouseScene({
  model,
  zones,
  floor,
  selectedZoneId,
  onSelectZone,
  cameraGoal,
  resetToken,
  zoomToken,
  viewPlane,
}: {
  model: Warehouse3DModelConfig;
  zones: WarehouseZone[];
  floor: string;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  cameraGoal: {
    position: [number, number, number];
    target: [number, number, number];
  } | null;
  resetToken: number;
  zoomToken: number;
  viewPlane: ViewPlane;
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
      <CameraController
        goal={cameraGoal}
        defaultGoal={model.defaultCamera}
        resetToken={resetToken}
        zoomToken={zoomToken}
        viewPlane={viewPlane}
      />
      {!model.glbUrl ? (
        <gridHelper args={[64, 32, "#94a3b8", "#e2e8f0"]} position={[0, -0.02, 0]} />
      ) : null}

      {model.glbUrl ? (
        <Suspense fallback={<SceneLoader />}>
          <GlbWarehouse
            url={model.glbUrl}
            mappings={model.meshMappings}
            floorMappings={model.floorMappings}
            showEnvelope={model.id !== "k01" && model.id !== "k04" && model.id !== "k06"}
            floor={floor}
            viewPlane={viewPlane}
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
          {viewPlane === "oxy" ? <OxyPlaneGrid /> : null}
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
    </>
  );
}

function SceneLoader() {
  return (
    <Html center>
      <div className="wms-wh-loader" role="status" aria-label="Đang tải mô hình 3D">
        <div className="wms-wh-loader__racks" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Đang dựng không gian kho...</p>
      </div>
    </Html>
  );
}

type StorageLabel = {
  id: string;
  kind: string;
  position: [number, number, number];
  room: string;
  code: string;
  slots: string;
  side: string;
};

function GlbWarehouse({
  url,
  mappings,
  floorMappings,
  showEnvelope,
  floor,
  viewPlane,
  zones,
  selectedZoneId,
  onSelectZone,
}: {
  url: string;
  mappings: Record<string, string>;
  floorMappings: Record<string, string[]> | null;
  showEnvelope: boolean;
  floor: string;
  viewPlane: ViewPlane;
  zones: WarehouseZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}) {
  const { scene } = useGLTF(url);
  const floors = useMemo(
    () => (floorMappings ? Object.keys(floorMappings) : ["1F"]),
    [floorMappings],
  );
  const floorRoots = useMemo(
    () =>
      floors.map((floorName) => ({
        floorName,
        root: cloneSceneWithMaterials(
          scene,
          floorName,
          floorMappings?.[floorName] ?? Object.keys(mappings),
          Boolean(floorMappings),
        ),
      })),
    [floorMappings, floors, mappings, scene],
  );

  const { meshByZone, labelAnchors, storageLabels } = useMemo(() => {
    const map = new Map<string, THREE.Mesh[]>();

    for (const { root } of floorRoots) {
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.castShadow = true;
        obj.receiveShadow = true;

        const zoneId = findZoneFromObject(obj, mappings);
        if (!zoneId) return;

        const list = map.get(zoneId) ?? [];
        list.push(obj);
        map.set(zoneId, list);
      });
    }

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
      for (const mesh of meshes) {
        if (mesh.parent) box.expandByObject(mesh);
      }
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

    const storageLabels: StorageLabel[] = [];
    for (const { root } of floorRoots) {
      root.updateWorldMatrix(true, true);
      root.traverse((obj) => {
        const kind = obj.userData?.type;
        if (kind !== "RACK" && kind !== "LEVEL_MARK") return;
        const point = new THREE.Vector3(
          0,
          kind === "RACK" ? 4.55 : 0.22,
          kind === "RACK" ? 0 : 0.12,
        );
        obj.localToWorld(point);
        root.worldToLocal(point);
        storageLabels.push({
          id: obj.uuid,
          kind,
          position: [point.x, point.y, point.z],
          room: String(obj.userData.zoneName ?? ""),
          code: String(obj.userData.locationCode ?? obj.userData.rackId ?? ""),
          slots: String(obj.userData.slots ?? ""),
          side: String(obj.userData.sideLabel ?? ""),
        });
      });
    }

    return { meshByZone: map, labelAnchors: anchors, storageLabels };
  }, [floorRoots, mappings, zones]);

  useEffect(() => {
    for (const [zoneId, meshes] of meshByZone) {
      const selected = zoneId === selectedZoneId;
      for (const mesh of meshes) {
        applyZoneMaterial(mesh, selected, false);
      }
    }
  }, [selectedZoneId, meshByZone]);

  const campusRoofsRef = useRef<THREE.Object3D[]>([]);
  useLayoutEffect(() => {
    const roofs: THREE.Object3D[] = [];
    if (!showEnvelope) {
      for (const { root } of floorRoots) root.traverse(object => {
        if (/^RoofAssembly_(?:[ABC]|Cold|ColdFront)$/.test(object.name)) roofs.push(object);
      });
    }
    campusRoofsRef.current = roofs;
  }, [floorRoots, showEnvelope]);
  useFrame(({ camera }) => {
    updateCampusRoofVisibility(campusRoofsRef.current, camera);
  });

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
    <Bounds key={floor} fit clip margin={1.2}>
      <Center>
        {viewPlane === "oxy" ? <OxyPlaneGrid /> : null}
        {showEnvelope ? <WarehouseEnvelope floor={floor} /> : null}
        {floorRoots
          .filter(({ floorName }) => floor === "ALL" || floor === floorName)
          .map(({ floorName, root }) => {
          const originalIndex = floors.indexOf(floorName);
          const layerY = originalIndex * 5.4;
          const showZoneLabels = floor !== "ALL" && floor === floorName;
          const showFloorSlab = floor !== "ALL" || floorName === "GF";

          return (
            <group
              key={floorName}
              position={[0, layerY, 0]}
              onClick={(event) => onPointer(event, "click")}
              onPointerOver={(event) => onPointer(event, "over")}
              onPointerOut={(event) => onPointer(event, "out")}
            >
              {floorName === "1F" || floorName === "GF" ? <FloorGrid /> : null}
              {showFloorSlab ? (
                <mesh position={[0, -0.18, 0]} receiveShadow>
                  <boxGeometry args={[27, 0.16, 14.5]} />
                  <meshStandardMaterial
                    color={floorName === "GF" ? "#AEB8BE" : "#C3CCD1"}
                    roughness={0.92}
                    metalness={0.04}
                  />
                </mesh>
              ) : null}
              <primitive object={root} />
              {storageLabels.map((label) => (
                <Html
                  key={label.id}
                  position={label.position}
                  center
                  distanceFactor={label.kind === "RACK" ? 12 : 6}
                  style={{ pointerEvents: "none" }}
                >
                  {label.kind === "RACK" ? (
                    <div className="wms-wh-rack-label">
                      <p className="wms-wh-rack-label__room">{label.room}</p>
                      <p className="wms-wh-rack-label__code">
                        {label.code}
                        {label.side ? ` · ${label.side}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="wms-wh-slot-label" title={label.slots}>
                      {label.slots.replace(/^.*-L/, "L").replace("-P01 / P02", " · P01–P02")}
                    </div>
                  )}
                </Html>
              ))}
              {floor !== "ALL" ? (
                <Html
                  position={[-14.4, 2.2, 0]}
                  center
                  distanceFactor={18}
                  style={{ pointerEvents: "none" }}
                >
                  <span className="wms-wh-floor-label">{floorName}</span>
                </Html>
              ) : null}
              {showZoneLabels
                ? labelAnchors
                    .filter(({ zone }) =>
                      (floorMappings?.[floorName] ?? []).some(
                        (meshName) => mappings[meshName] === zone.id,
                      ),
                    )
                    .map(({ zone, position }) => (
                    <group key={zone.id} position={position}>
                      <ZoneLabel zone={zone} visible local />
                    </group>
                  ))
                : null}
            </group>
          );
        })}
      </Center>
    </Bounds>
  );
}

function ignoreGridBounds(grid: THREE.GridHelper | null) {
  if (!grid) return;
  const box = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
  grid.geometry.boundingBox = box;
  grid.geometry.computeBoundingBox = () => {
    grid.geometry.boundingBox = box;
  };
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of materials) {
    material.transparent = true;
    material.opacity = 0.8;
    material.depthWrite = false;
  }
}

function OxyPlaneGrid() {
  return (
    <gridHelper
      ref={ignoreGridBounds}
      args={[320, 160, "#5b6b7c", "#b7c3d0"]}
      position={[0, 0, -20]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}

function FloorGrid() {
  const ref = useRef<THREE.GridHelper>(null);

  useLayoutEffect(() => {
    const raw = ref.current?.material;
    const materials = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const material of materials) {
      material.transparent = true;
      material.opacity = 0.9;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
      material.polygonOffsetUnits = -2;
    }
  }, []);

  return (
    <gridHelper
      ref={ref}
      args={[64, 32, "#5b6b7c", "#8ea0b3"]}
      position={[0, 0.16, 0]}
    />
  );
}

type ShellMaterials = {
  wall: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
};

function createShellMaterials(): ShellMaterials {
  return {
    wall: new THREE.MeshStandardMaterial({
      color: "#E5E9EB",
      metalness: 0.28,
      roughness: 0.66,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide,
      depthWrite: true,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: "#405463",
      metalness: 0.62,
      roughness: 0.34,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: "#6A93A9",
      metalness: 0.35,
      roughness: 0.2,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    }),
  };
}

function updateCampusRoofVisibility(roofs: THREE.Object3D[], camera: THREE.Camera) {
  for (const roof of roofs) {
    const distance = camera.position.distanceTo(roof.getWorldPosition(new THREE.Vector3()));
    // Hysteresis avoids flickering at the transition while orbiting.
    roof.visible = roof.visible ? distance > 34 : distance > 40;
  }
}

function updateShellOpacity(materials: ShellMaterials, camera: THREE.Camera, floor: string) {
  const distance = camera.position.length();
  const zoomFactor = THREE.MathUtils.smoothstep(distance, 17, 29);
  const shellOpacity = floor === "ALL" ? THREE.MathUtils.lerp(0.055, 1, zoomFactor) : 0.055;
  materials.wall.opacity = shellOpacity;
  materials.wall.depthWrite = shellOpacity > 0.72;
  materials.trim.opacity = floor === "ALL" ? THREE.MathUtils.lerp(0.12, 0.98, zoomFactor) : 0.08;
  materials.trim.depthWrite = floor === "ALL" && zoomFactor > 0.72;
  materials.glass.opacity = floor === "ALL" ? THREE.MathUtils.lerp(0.04, 0.78, zoomFactor) : 0.035;
}

function WarehouseEnvelope({ floor }: { floor: string }) {
  const shellMaterials = useMemo(() => createShellMaterials(), []);
  const { wall: wallMaterial, trim: trimMaterial, glass: glassMaterial } = shellMaterials;

  useEffect(
    () => () => {
      shellMaterials.wall.dispose();
      shellMaterials.trim.dispose();
      shellMaterials.glass.dispose();
    },
    [shellMaterials],
  );

  useFrame(({ camera }) => {
    updateShellOpacity(shellMaterials, camera, floor);
  });

  const doorXs = [-10.5, 0, 10.5];
  const windowXs = [-12, -8, -4, 4, 8, 12];

  return (
    <group name="WarehouseEnvelope">
      {floor === "ALL" ? (
        <>
          <mesh position={[0, -0.58, 0]} receiveShadow>
            <boxGeometry args={[32.4, 0.45, 23.5]} />
            <meshStandardMaterial color="#9BA5AA" roughness={0.96} metalness={0.02} />
          </mesh>
        </>
      ) : null}

      <mesh position={[-16.2, 5.3, 0]} castShadow receiveShadow material={wallMaterial}>
        <boxGeometry args={[0.35, 11.2, 23.5]} />
      </mesh>
      <mesh position={[16.2, 5.3, 0]} castShadow receiveShadow material={wallMaterial}>
        <boxGeometry args={[0.35, 11.2, 23.5]} />
      </mesh>
      <mesh position={[0, 5.3, -11.7]} castShadow receiveShadow material={wallMaterial}>
        <boxGeometry args={[32.7, 11.2, 0.35]} />
      </mesh>

      <mesh position={[0, 9.1, 11.7]} castShadow receiveShadow material={wallMaterial}>
        <boxGeometry args={[32.7, 3.6, 0.35]} />
      </mesh>
      <mesh position={[0, 3.4, 11.7]} castShadow receiveShadow material={wallMaterial}>
        <boxGeometry args={[32.7, 7.8, 0.35]} />
      </mesh>

      {doorXs.map((x) => (
        <group key={`door-${x}`} position={[x, 2.7, 11.48]}>
          <mesh material={trimMaterial}>
            <boxGeometry args={[6.1, 5.4, 0.16]} />
          </mesh>
          <mesh position={[0, 0, 0.1]} material={wallMaterial}>
            <boxGeometry args={[5.45, 4.82, 0.12]} />
          </mesh>
          {[1.7, 0.55, -0.6, -1.75].map((y) => (
            <mesh key={y} position={[0, y, 0.19]} material={trimMaterial}>
              <boxGeometry args={[5.35, 0.06, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}

      {windowXs.map((x) => (
        <mesh key={`window-${x}`} position={[x, 8.55, 11.48]} material={glassMaterial}>
          <boxGeometry args={[2.8, 1.05, 0.12]} />
        </mesh>
      ))}

      {floor === "ALL" ? (
        <>
          <mesh position={[0, 11.12, 0]} castShadow receiveShadow material={wallMaterial}>
            <boxGeometry args={[33.4, 0.34, 24.2]} />
          </mesh>
          <mesh position={[0, 12.08, -1.8]} castShadow receiveShadow material={wallMaterial}>
            <boxGeometry args={[17.2, 1.75, 6.1]} />
          </mesh>
          <mesh position={[0, 13.03, -1.8]} castShadow receiveShadow material={trimMaterial}>
            <boxGeometry args={[17.8, 0.22, 6.7]} />
          </mesh>
          {[-6.2, -3.1, 0, 3.1, 6.2].map((x) => (
            <mesh key={`clerestory-${x}`} position={[x, 12.12, 1.28]} material={glassMaterial}>
              <boxGeometry args={[2.1, 0.62, 0.08]} />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
}

function cloneSceneWithMaterials(
  scene: THREE.Group,
  floorName: string,
  allowedZones: string[],
  redistributeZones: boolean,
) {
  const clone = scene.clone(true);
  const zoneGroups = ["Zone_A", "Zone_B", "Zone_C", "Zone_Q"];
  const visibleGroups = zoneGroups
    .map((name) => clone.getObjectByName(name))
    .filter(
      (group): group is THREE.Object3D =>
        Boolean(group && allowedZones.includes(group.name)),
    );

  zoneGroups.forEach((name) => {
    const group = clone.getObjectByName(name);
    if (group) group.visible = allowedZones.includes(name);
  });

  if (redistributeZones) {
    const positions = visibleGroups.length === 2 ? [-6.5, 6.5] : [0];
    visibleGroups.forEach((group, index) => {
      group.position.x = positions[index] ?? 0;
    });
  }

  const roof = clone.getObjectByName("ROOF");
  if (roof) roof.visible = false;

  clone.traverse((object) => {
    const values = [
      object.position.x,
      object.position.y,
      object.position.z,
      object.scale.x,
      object.scale.y,
      object.scale.z,
    ];
    if (values.some((value) => !Number.isFinite(value))) {
      object.visible = false;
      object.position.set(0, 0, 0);
      object.scale.set(1, 1, 1);
    }
    if (!(object instanceof THREE.Mesh)) return;
    if (
      object.name === "Floor" ||
      object.name === "BackWall" ||
      object.name === "LeftWall" ||
      object.name.startsWith("CeilingBeam_") ||
      object.name.startsWith("Light_") ||
      (floorName !== "GF" && object.name.startsWith("Dock"))
    ) {
      object.visible = false;
    }
    object.material = Array.isArray(object.material)
      ? object.material.map((item) => item.clone())
      : object.material.clone();
  });
  return clone;
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

useGLTF.preload("/models/warehouse/warehouse-raw-materials.glb");
useGLTF.preload("/models/warehouse/warehouse-packaging.glb");
useGLTF.preload("/models/warehouse/warehouse-finished-goods.glb");
useGLTF.preload("/models/warehouse/warehouse-cold-finished.glb");
useGLTF.preload("/models/warehouse/warehouse-cold-raw-materials.glb");
useGLTF.preload("/models/warehouse/warehouse-quarantine.glb");
