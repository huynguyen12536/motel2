"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { navigationGroups } from "@/config/navigation";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils/cn";
import { useSidebarStore } from "@/stores/sidebar.store";

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const can = usePermission();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navigationGroups.map((group) => [group.id, true])),
  );

  const toggleGroup = (id: string) => {
    if (collapsed) return;
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <nav className="wms-side__nav" aria-label="Điều hướng chính">
      {navigationGroups.map((group) => {
        const items = group.items.filter(
          (item) => !item.permission || can(item.permission),
        );
        if (items.length === 0) return null;
        const isOpen = collapsed || openGroups[group.id] !== false;
        return (
          <div key={group.id} className="wms-side__group">
            <button
              type="button"
              className="wms-side__group-btn"
              aria-expanded={isOpen}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="wms-side__group-label">{group.label}</span>
              <ChevronDown
                size={14}
                className={cn(
                  "wms-side__chevron transition-transform",
                  !isOpen && "-rotate-90",
                )}
                aria-hidden="true"
              />
            </button>
            {isOpen ? (
              <ul className="wms-side__list">
                {items.map((item) => {
                  const ready = item.ready === true;
                  const active =
                    ready &&
                    (pathname === item.href ||
                      pathname.startsWith(`${item.href}/`));
                  return (
                    <li key={item.id}>
                      <Link
                        href={ready ? item.href : "#"}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        aria-disabled={!ready || undefined}
                        onClick={(event) => {
                          if (!ready) {
                            event.preventDefault();
                            return;
                          }
                          onNavigate?.();
                        }}
                        className={cn(
                          "wms-side__item",
                          active && "wms-side__item--active",
                          !ready && "wms-side__item--muted",
                        )}
                      >
                        <item.icon aria-hidden="true" />
                        <span className="wms-side__item-label">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="wms-side__brand">
      <Image
        src="/images/auth/logo-mark.png"
        alt=""
        width={28}
        height={28}
        className="size-7 object-contain"
        aria-hidden="true"
      />
      {!collapsed ? (
        <div className="wms-side__brand-text">
          <p className="wms-side__brand-title">WMS APA Nano</p>
          <p className="wms-side__brand-sub">Hệ thống quản lý kho vật liệu</p>
        </div>
      ) : null}
    </div>
  );
}

export function DesktopSidebar({
  collapsed,
  compact,
}: {
  collapsed: boolean;
  compact: boolean;
}) {
  const iconOnly = collapsed || compact;
  return (
    <aside
      className={cn(
        "wms-shell__sidebar",
        iconOnly && "wms-shell__sidebar--collapsed",
        compact && "wms-shell__sidebar--compact",
      )}
      aria-label="Sidebar"
    >
      <div className={cn("wms-side", iconOnly && "wms-side--collapsed")}>
        <SidebarBrand collapsed={iconOnly} />
        <SidebarNav collapsed={iconOnly} />
      </div>
    </aside>
  );
}

export function useHydrateSidebarCollapse() {
  const hydrateCollapsed = useSidebarStore((state) => state.hydrateCollapsed);
  useEffect(() => {
    hydrateCollapsed();
  }, [hydrateCollapsed]);
}
