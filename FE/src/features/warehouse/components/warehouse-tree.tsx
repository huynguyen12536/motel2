"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { WarehouseTreeNode } from "@/features/warehouse/types/warehouse.types";
import { cn } from "@/lib/utils/cn";

export function WarehouseTree({
  root,
  selectedId,
  onSelect,
}: {
  root: WarehouseTreeNode;
  selectedId: string | null;
  onSelect: (node: WarehouseTreeNode) => void;
}) {
  return (
    <section className="wms-wh-tree" aria-label="Cấu trúc kho">
      <h2 className="wms-wh-panel-title">Cấu trúc kho</h2>
      <ul className="wms-wh-tree__list">
        <TreeNode
          node={root}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </ul>
    </section>
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: WarehouseTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: WarehouseTreeNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const [open, setOpen] = useState(depth < 2);

  return (
    <li>
      <div
        className={cn(
          "wms-wh-tree__row",
          selectedId === node.id && "wms-wh-tree__row--active",
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="wms-wh-tree__chevron"
            aria-expanded={open}
            aria-label={open ? "Thu gọn" : "Mở rộng"}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronRight
              size={14}
              className={cn(open && "wms-wh-tree__chevron-icon--open")}
            />
          </button>
        ) : (
          <span className="wms-wh-tree__spacer" />
        )}
        <button
          type="button"
          className="wms-wh-tree__label"
          onClick={() => onSelect(node)}
        >
          {node.label}
        </button>
      </div>
      {hasChildren && open ? (
        <ul className="wms-wh-tree__list">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
