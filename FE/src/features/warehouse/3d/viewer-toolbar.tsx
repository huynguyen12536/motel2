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
  onFit,
  floorsEnabled,
  floor,
  onFloorChange,
}: {
  onReset: () => void;
  onFit: () => void;
  floorsEnabled: boolean;
  floor: string;
  onFloorChange: (floor: string) => void;
}) {
  const floors = ["3F", "2F", "1F", "GF"];

  return (
    <>
      <div className="wms-wh-toolbar" role="toolbar" aria-label="Điều khiển 3D">
        <ToolbarBtn label="Xoay / Orbit" onClick={() => undefined}>
          <Move size={16} />
        </ToolbarBtn>
        <ToolbarBtn label="Phóng to" onClick={() => undefined}>
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
      </div>

      <div className="wms-wh-floors" aria-label="Chọn tầng">
        <p className="wms-wh-floors__title">Tầng</p>
        {floors.map((item) => (
          <button
            key={item}
            type="button"
            className={
              floor === item
                ? "wms-wh-floors__btn wms-wh-floors__btn--active"
                : "wms-wh-floors__btn"
            }
            disabled={!floorsEnabled}
            title={
              floorsEnabled ? item : "Mô hình chưa hỗ trợ phân tầng."
            }
            aria-pressed={floor === item}
            onClick={() => onFloorChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </>
  );
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="wms-wh-toolbar__btn"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
