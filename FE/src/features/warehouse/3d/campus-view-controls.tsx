"use client";
import { Focus, Hand, MousePointer2, Sun, Tags, ZoomIn } from "lucide-react";
import type { ViewPlane } from "./camera-controller";

export function CampusViewControls({ pan, onPan, labels, onLabels, shadows, onShadows, onFit, onZoom, plane, onPlane }: {
  pan: boolean; onPan: () => void;
  labels: boolean; onLabels: () => void;
  shadows: boolean; onShadows: () => void;
  onFit: () => void; onZoom: () => void;
  plane: ViewPlane; onPlane: (plane: ViewPlane) => void;
}) {
  return <div className="wms-campus-tools" role="toolbar" aria-label="Điều khiển cảnh 3D">
    <button type="button" aria-label="Xoay mô hình bằng kéo chuột trái" title="Xoay bằng chuột trái" aria-pressed={!pan} onClick={() => pan && onPan()}><MousePointer2 size={18} /></button>
    <button type="button" aria-label="Kéo bản đồ bằng chuột trái" title="Kéo bản đồ bằng chuột trái" aria-pressed={pan} onClick={() => !pan && onPan()}><Hand size={18} /></button>
    <button type="button" aria-label="Hiện tên kệ và thiết bị" title="Bật/tắt tên kệ và thiết bị" aria-pressed={labels} onClick={onLabels}><Tags size={18} /></button>
    <button type="button" aria-label="Bật bóng đổ" title="Bật/tắt bóng đổ — tắt để giảm tải GPU" aria-pressed={shadows} onClick={onShadows}><Sun size={18} /></button>
    <button type="button" aria-label="Đặt lại toàn cảnh" title="Đặt lại toàn cảnh" onClick={onFit}><Focus size={18} /></button>
    <button type="button" aria-label="Phóng to" title="Phóng to" onClick={onZoom}><ZoomIn size={18} /></button>
    {([['3d', '3D'], ['oxy', 'XY'], ['oxz', 'XZ'], ['oyz', 'YZ']] as const).map(([id, label]) =>
      <button key={id} type="button" aria-label={`Góc nhìn ${label}`} aria-pressed={plane === id} onClick={() => onPlane(id)}>{label}</button>)}
  </div>;
}
