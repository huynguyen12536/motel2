"use client";
import { Box } from "lucide-react";

export function ModelPlaceholder({
  name,
  type,
  message = "Chưa có file GLB",
}: {
  name: string;
  type: "WAREHOUSE" | "ZONE" | "RACK";
  message?: string;
}) {
  return (
    <div className="wms-wh-placeholder" role="status">
      <span className="wms-wh-placeholder__icon" aria-hidden="true">
        <Box size={28} strokeWidth={1.6} />
      </span>
      <p className="wms-wh-placeholder__title">Chưa có mô hình 3D</p>
      <p className="wms-wh-placeholder__name">
        {name}
        <span className="wms-wh-placeholder__type"> · {type}</span>
      </p>
      <p className="wms-wh-placeholder__sub">{message}</p>
      <p className="wms-wh-placeholder__hint">
        Thêm file .glb để hiển thị khu vực này.
      </p>
      <button type="button" className="wms-wh-placeholder__btn" disabled>
        Chọn mô hình
      </button>
    </div>
  );
}
