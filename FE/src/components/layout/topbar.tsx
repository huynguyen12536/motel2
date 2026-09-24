"use client";
import { useEffect, useRef, useState } from "react";
import { Grid3X3, Menu, Search } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar.store";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  TopbarBellIcon,
  TopbarMailIcon,
} from "@/components/layout/topbar-icons";
import { dashboardUser } from "@/features/dashboard/mocks/dashboard.mock";
import { cn } from "@/lib/utils/cn";

const SEARCH_PLACEHOLDER = "Tìm vật liệu, mã số lô, nhà cung cấp...";
const SCROLL_GLASS_AT = 12;

export function Topbar({ showMenuButton }: { showMenuButton: boolean }) {
  const openDrawer = useSidebarStore((state) => state.openDrawer);
  const barRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const scroller = bar.closest(".wms-shell__content");
    if (!(scroller instanceof HTMLElement)) return;

    const onScroll = () => {
      setScrolled(scroller.scrollTop > SCROLL_GLASS_AT);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={barRef}
      className={cn("wms-topbar", scrolled && "wms-topbar--scrolled")}
    >
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
        <button
          type="button"
          className="wms-circle-btn wms-circle-btn--icon"
          aria-label="Ứng dụng nhanh"
        >
          <Grid3X3 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="wms-circle-btn wms-circle-btn--mail"
          aria-label="Tin nhắn"
        >
          <TopbarMailIcon size={18} />
          <span className="wms-circle-btn__badge">{dashboardUser.mailBadge}</span>
        </button>
        <button
          type="button"
          className="wms-circle-btn wms-circle-btn--bell"
          aria-label="Thông báo"
        >
          <TopbarBellIcon size={18} />
          <span className="wms-circle-btn__badge">
            {dashboardUser.notificationBadge}
          </span>
        </button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
