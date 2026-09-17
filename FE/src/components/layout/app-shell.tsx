"use client";
import { Be_Vietnam_Pro } from "next/font/google";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSidebarStore } from "@/stores/sidebar.store";
import {
  DesktopSidebar,
  useHydrateSidebarCollapse,
} from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { cn } from "@/lib/utils/cn";
import "./app-shell.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  useHydrateSidebarCollapse();
  const open = useSidebarStore((state) => state.open);
  const collapsed = useSidebarStore((state) => state.collapsed);
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isTabletUp = useMediaQuery("(min-width: 1024px)");
  const showFixedSidebar = isTabletUp;
  const compact = isTabletUp && !isDesktop;
  const iconCollapsed = collapsed || compact;

  return (
    <div
      className={cn(
        "wms-shell",
        beVietnamPro.variable,
        beVietnamPro.className,
        iconCollapsed && "wms-shell--collapsed",
        compact && "wms-shell--compact",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-card focus:p-4"
      >
        {t("skipContent")}
      </a>

      {showFixedSidebar ? (
        <DesktopSidebar collapsed={collapsed} compact={compact} />
      ) : null}

      <MobileSidebar open={open && !showFixedSidebar} />

      <div className="wms-shell__main">
        <Topbar
          showCollapse={isDesktop}
          collapsed={collapsed}
          showMenuButton={!showFixedSidebar}
        />
        <main id="main-content" className="wms-shell__content">
          {children}
        </main>
      </div>
    </div>
  );
}
