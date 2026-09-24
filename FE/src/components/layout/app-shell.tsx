"use client";
import { IBM_Plex_Sans } from "next/font/google";
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

const appFont = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-app",
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
        appFont.variable,
        appFont.className,
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
        <DesktopSidebar
          collapsed={collapsed}
          compact={compact}
          showCollapse={isDesktop}
        />
      ) : null}

      <MobileSidebar open={open && !showFixedSidebar} />

      <div className="wms-shell__main">
        <main id="main-content" className="wms-shell__content">
          <Topbar showMenuButton={!showFixedSidebar} />
          <div className="wms-shell__page">{children}</div>
        </main>
      </div>
    </div>
  );
}
