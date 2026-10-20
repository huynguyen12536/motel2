"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScrollChain } from "@/hooks/use-scroll-chain";
import { useSidebarStore } from "@/stores/sidebar.store";
import {
  DesktopSidebar,
  useHydrateSidebarCollapse,
} from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { cn } from "@/lib/utils/cn";
import { PageFrame } from "@/components/shared/layout/page-frame";
import "./app-shell.css";
import "./page-layout.css";
import "./reference-theme.css";
import "./materials.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname=usePathname();
  const pageRef = useScrollChain();
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
        "wms-shell compta-theme",
        pathname.startsWith("/settings")&&"wms-shell--settings",
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
          <div ref={pageRef} className="wms-shell__page"><PageFrame>{children}</PageFrame></div>
        </main>
      </div>
    </div>
  );
}
