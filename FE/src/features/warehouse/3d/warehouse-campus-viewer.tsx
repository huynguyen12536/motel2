"use client";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Bounds, Center, Html, useBounds, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CAMPUS_BUILDINGS, CAMPUS_MODEL_URL, CAMPUS_MM_PER_UNIT, type CampusView } from "@/features/warehouse/config/warehouse-campus";
import { prepareCampusModel, campusZoneForObject, disposeCampusMaterials } from "./campus-model";
import { CameraController, type ViewPlane } from "./camera-controller";
import { CampusViewControls } from "./campus-view-controls";
import { CampusEnvironment, CampusFrameRate } from "./campus-environment";
import { campusOverview } from "./campus-camera-fit";

export function WarehouseCampusViewer({ selectedZoneId, onSelectZone }: {
  selectedZoneId: string | null;
  onSelectZone: (zone: string) => void;
}) {
  const [view, setView] = useState<CampusView>("A");
  const [resetToken, setResetToken] = useState(0);
  const [zoomToken, setZoomToken] = useState(0);
  const [viewPlane, setViewPlane] = useState<ViewPlane>("3d");
  const [pan, setPan] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [shadows, setShadows] = useState(false);
  const [fps, setFps] = useState(0);
  const camera = useMemo(() => ({ position: [85, 65, 85] as [number, number, number], target: [0, 0, 0] as [number, number, number] }), []);
  return (
    <>
      <div className="wms-campus-switch" role="group" aria-label="Chọn bản đồ kho">
        {CAMPUS_BUILDINGS.map((id) => (
          <button key={id} type="button" className="wms-wh-btn" aria-pressed={view === id}
            onClick={() => { setView(id); onSelectZone(""); }}>
            Kho {id}
          </button>
        ))}
      </div>
      <section className="wms-wh-viewer wms-campus-viewport" aria-label={`Bản đồ kho ${view}`}>
        <div className="wms-wh-viewer__chrome">
          <p className="wms-wh-viewer__meta-value">Kho {view} · Mô hình 3D</p>
          <span className="wms-wh-viewer__badge">{CAMPUS_MM_PER_UNIT} mm = 1 đơn vị 3D</span>
        </div>
        <div className="wms-wh-viewer__stage">
          <CampusViewControls pan={pan} onPan={() => setPan((value) => !value)} labels={showLabels} onLabels={() => setShowLabels((value) => !value)}
            shadows={shadows} onShadows={() => setShadows((value) => !value)} onFit={() => setResetToken((value) => value + 1)}
            onZoom={() => setZoomToken((value) => value + 1)} plane={viewPlane} onPlane={setViewPlane} />
          <p className="wms-campus-gesture">{pan ? "Kéo để di chuyển" : "Kéo để xoay"} · Cuộn để zoom</p>
          <span className="wms-campus-fps" aria-label="Tốc độ khung hình">{fps} FPS · {shadows ? "Bóng đổ bật" : "Tiết kiệm GPU"}</span>
          <CampusBoundary>
            <Canvas dpr={[1, 1.5]} shadows={shadows} camera={{ position: camera.position, fov: 36, near: 0.1, far: 1000 }}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }} aria-label={`Mô hình mở kho ${view}`}>
              <CampusEnvironment shadows={shadows} />
              <CampusFrameRate onUpdate={setFps} />
              <CameraController goal={null} defaultGoal={camera} resetToken={0} zoomToken={zoomToken} viewPlane={viewPlane} panMode={pan} />
              <Suspense fallback={<Html center><p className="wms-wh-loader" role="status">Đang tải kho {view}...</p></Html>}>
                <Bounds fit clip observe margin={1.25} maxDuration={0}>
                  <Center key={view}>
                    <CampusModel view={view} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} showLabels={showLabels} />
                  </Center>
                  <RefitCampus token={resetToken} view={view} />
                </Bounds>
              </Suspense>
            </Canvas>
          </CampusBoundary>
        </div>
      </section>
      <p className="wms-campus-note">Mẫu minh họa: 100 × 70 m mỗi kho; A/B/C dùng cùng mẫu, chưa phải mặt bằng thực tế 10 ha. Thiết bị đang ở trạng thái tĩnh. Phóng gần để đọc mã kệ. Giữ WASD để di chuyển, Shift để đi nhanh.</p>
    </>
  );
}

function RefitCampus({ token, view }: { token: number; view: CampusView }) {
  const bounds = useBounds();
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    bounds.refresh().clip();
    if (camera instanceof THREE.OrthographicCamera) { bounds.fit(); return; }
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const overview = campusOverview(bounds.getSize().box, camera.fov, camera.aspect);
    bounds.moveTo(overview.position).lookAt({ target: overview.target, up: [0, 1, 0] });
  }, [bounds, camera, token, view]);
  return null;
}

function CampusModel({ view, selectedZoneId, onSelectZone, showLabels }: { view: CampusView; selectedZoneId: string | null; onSelectZone: (id: string) => void; showLabels: boolean }) {
  const { scene } = useGLTF(CAMPUS_MODEL_URL);
  const model = useMemo(() => prepareCampusModel(scene, view), [scene, view]);
  const building = model.children[0];
  const labels = (building?.userData.labels ?? []) as { text: string; position: [number, number, number] }[];
  useEffect(() => () => disposeCampusMaterials(model), [model]);
  useEffect(() => {
    model.traverse((object) => {
      if (object.name.includes("Nameplates") || object.name.startsWith("EquipmentAndRackLettering")) object.visible = showLabels;
    });
  }, [model, showLabels]);
  useEffect(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#1b2230"; context.fillRect(0, 0, 256, 256);
    context.strokeStyle = "#2d3a50"; context.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { const p = i * 32; context.beginPath(); context.moveTo(p, 0); context.lineTo(p, 256); context.moveTo(0, p); context.lineTo(256, p); context.stroke(); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(100 / 8, 70 / 8); texture.colorSpace = THREE.SRGBColorSpace;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (object.name.endsWith("_Floor")) { material.color.set("#ffffff"); material.map = texture; material.needsUpdate = true; }
        if (object.name.includes("StationPads")) material.color.set("#1e3a5f");
        if (object.name.includes("ParkingPads")) material.color.set("#263449");
        if (object.name.includes("RestrictedPads")) material.color.set("#59272d");
        if (object.name.includes("Walkways")) material.color.set("#514822");
      }
    });
    return () => texture.dispose();
  }, [model]);
  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const selected = campusZoneForObject(object) === selectedZoneId && selectedZoneId !== null;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.set(selected ? "#2860b9" : "#000000"); material.emissiveIntensity = selected ? 0.25 : 0;
        }
      }
    });
  }, [model, selectedZoneId]);
  return <group><primitive object={model} dispose={null} onClick={(event: { object: THREE.Object3D; stopPropagation: () => void }) => {
    const zone = campusZoneForObject(event.object); if (zone) { event.stopPropagation(); onSelectZone(zone); }
  }} />{showLabels && building && labels.filter((label) => /^(ZONE |INBOUND-1$|OUTBOUND-1$)/.test(label.text)).map((label) => {
    const zone = /^ZONE ([ABCD])$/.exec(label.text)?.[1];
    const position: [number, number, number] = zone
      ? [(["A", "C"].includes(zone) ? 8 : 92) + building.position.x, 1.2, ["A", "B"].includes(zone) ? 8.5 : 63.5]
      : [label.position[0] + building.position.x + 6, 6.2, 1];
    return <Html key={label.text} position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <span className={`wms-campus-sign${zone ? "" : " wms-campus-sign--dock"}`}>{label.text}</span>
    </Html>;
  })}</group>;
}

class CampusBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="wms-wh-placeholder" role="alert"><p>Không tải được bản đồ kho.</p><button type="button" className="wms-wh-btn" onClick={() => this.setState({ failed: false })}>Thử lại</button></div> : this.props.children;
  }
}
