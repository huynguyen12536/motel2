"use client";
import { ChevronRight, Maximize2, Plus } from "lucide-react";

export function WarehousePageHeader({
  onAdd,
  onFullscreen,
}: {
  onAdd: () => void;
  onFullscreen: () => void;
}) {
  return (
    <header className="wms-wh-header">
      <div className="min-w-0">
        <nav className="wms-wh-breadcrumb" aria-label="Breadcrumb">
          <span>Danh mục</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">Kho &amp; vị trí</span>
        </nav>
        <h1 className="wms-wh-title">Kho &amp; vị trí</h1>
        <p className="wms-wh-subtitle">
          Quản lý cấu trúc kho, sơ đồ 3D và vị trí lưu trữ.
        </p>
      </div>
      <div className="wms-wh-header__actions">
        <button type="button" className="wms-wh-btn wms-wh-btn--primary" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" />
          Thêm kho / khu vực / vị trí
        </button>
        <button
          type="button"
          className="wms-wh-btn wms-wh-btn--ghost"
          onClick={onFullscreen}
          aria-label="Toàn màn hình"
        >
          <Maximize2 size={16} aria-hidden="true" />
          Toàn màn hình
        </button>
      </div>
    </header>
  );
}
