"use client";
import {
  Bell,
  Grid3X3,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar.store";
import { UserMenu } from "@/components/layout/user-menu";
import { dashboardUser } from "@/features/dashboard/mocks/dashboard.mock";

const SEARCH_PLACEHOLDER = "Tìm vật liệu, mã số lô, nhà cung cấp...";

export function Topbar({
  showCollapse,
  collapsed,
  showMenuButton,
}: {
  showCollapse: boolean;
  collapsed: boolean;
  showMenuButton: boolean;
}) {
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed);
  const openDrawer = useSidebarStore((state) => state.openDrawer);

  return (
    <header className="wms-topbar">
      <div className="wms-topbar__left">
        {showMenuButton ? (
          <button
            type="button"
            className="wms-circle-btn"
            aria-label="Mở menu"
            onClick={openDrawer}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        ) : null}
        {showCollapse ? (
          <button
            type="button"
            className="wms-circle-btn"
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      <label className="wms-topbar__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={SEARCH_PLACEHOLDER}
        />
      </label>

      <div className="wms-topbar__right">
        <button
          type="button"
          className="wms-circle-btn lg:hidden"
          aria-label={SEARCH_PLACEHOLDER}
        >
          <Search size={18} aria-hidden="true" />
        </button>
        <button type="button" className="wms-circle-btn" aria-label="Ứng dụng nhanh">
          <Grid3X3 size={18} aria-hidden="true" />
        </button>
        <button type="button" className="wms-circle-btn" aria-label="Tin nhắn">
          <Mail size={18} aria-hidden="true" />
          <span className="wms-circle-btn__badge">{dashboardUser.mailBadge}</span>
        </button>
        <button type="button" className="wms-circle-btn" aria-label="Thông báo">
          <Bell size={18} aria-hidden="true" />
          <span className="wms-circle-btn__badge">
            {dashboardUser.notificationBadge}
          </span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
