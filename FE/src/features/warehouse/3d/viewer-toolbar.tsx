"use client";
import {
  Focus,
  Maximize2,
  Move,
  RotateCcw,
  ZoomIn,
} from "lucide-react";

export function ViewerToolbar({
  onReset,
  onZoom,
  onFit,
  floorsEnabled,
  floors,
  floor,
  onFloorChange,
  viewPlane,
  onViewPlane,
}: {
  onReset: () => void;
  onZoom: () => void;
  onFit: () => void;
  floorsEnabled: boolean;
  floors: string[];
  floor: string;
  onFloorChange: (floor: string) => void;
  viewPlane: "3d" | "oxy" | "oxz" | "oyz";
  onViewPlane: (plane: "3d" | "oxy" | "oxz" | "oyz") => void;
}) {
  const floorOptions = [
    { value: "ALL", label: "Tất cả" },
    ...floors.map((item) => ({ value: item, label: item })),
  ];

  return (
    <>
      <div className="wms-wh-toolbar" role="toolbar" aria-label="Điều khiển 3D">
        <ToolbarBtn label="Xoay / Orbit" onClick={() => undefined}>
          <Move size={16} />
        </ToolbarBtn>
        <ToolbarBtn label="Phóng to" onClick={onZoom}>
          <ZoomIn size={16} />
        </ToolbarBtn>
        <ToolbarBtn label="Đặt lại camera" onClick={onReset}>
          <RotateCcw size={16} />
        </ToolbarBtn>
        <ToolbarBtn label="Fit view" onClick={onFit}>
          <Maximize2 size={16} />
        </ToolbarBtn>
        <ToolbarBtn label="Focus khu vực" onClick={onFit}>
          <Focus size={16} />
        </ToolbarBtn>
        <ToolbarBtn label="Phối cảnh 3D" pressed={viewPlane === "3d"} onClick={() => onViewPlane("3d")}>
          3D
        </ToolbarBtn>
        <ToolbarBtn label="Mặt OXY — nhìn dọc trục Z. Giữ WASD để di chuyển, Shift để đi nhanh" pressed={viewPlane === "oxy"} onClick={() => onViewPlane("oxy")}>
          XY
        </ToolbarBtn>
        <ToolbarBtn label="Mặt OXZ — nhìn từ trên. Giữ WASD để di chuyển, Shift để đi nhanh" pressed={viewPlane === "oxz"} onClick={() => onViewPlane("oxz")}>
          XZ
        </ToolbarBtn>
        <ToolbarBtn label="Mặt OYZ — nhìn dọc trục X. Giữ WASD để di chuyển, Shift để đi nhanh" pressed={viewPlane === "oyz"} onClick={() => onViewPlane("oyz")}>
          YZ
        </ToolbarBtn>
      </div>

      {floorsEnabled ? (
        <div className="wms-wh-floors" aria-label="Chọn tầng">
          <p className="wms-wh-floors__title">Tầng</p>
          {floorOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              floor === item.value
                ? "wms-wh-floors__btn wms-wh-floors__btn--active"
                : "wms-wh-floors__btn"
            }
            disabled={!floorsEnabled}
            title={
              floorsEnabled
                ? item.value === "ALL"
                  ? "Hiển thị toàn bộ tầng"
                  : `Chỉ hiển thị tầng ${item.label}`
                : "Mô hình chưa hỗ trợ phân tầng."
            }
            aria-pressed={floor === item.value}
            onClick={() => onFloorChange(item.value)}
          >
            {item.label}
          </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function ToolbarBtn({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={pressed ? "wms-wh-toolbar__btn wms-wh-toolbar__btn--active" : "wms-wh-toolbar__btn"}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
