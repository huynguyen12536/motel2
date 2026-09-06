"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Layers2, X } from "lucide-react";
import { navigation, type NavigationItem } from "@/config/navigation";
import { site } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import { usePermission } from "@/hooks/use-permission";
import { useSidebarStore } from "@/stores/sidebar.store";
import { Button } from "@/components/ui/button";
export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const can = usePermission();
  const close = useSidebarStore((state) => state.close);
  const renderItems = (items: NavigationItem[]) =>
    items
      .filter((item) => !item.permission || can(item.permission))
      .map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={close}
            aria-current={pathname === item.href ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
              pathname === item.href
                ? "bg-accent text-primary"
                : "text-muted-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {t(item.title)}
          </Link>
          {item.children && (
            <ul className="ml-5 mt-1">{renderItems(item.children)}</ul>
          )}
        </li>
      ));
  return (
    <div className="flex h-full flex-col bg-card p-5">
      <div className="mb-10 flex h-8 items-center gap-2.5 px-2">
        <Layers2 className="size-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">
          {site.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-label={t("closeMenu")}
          onClick={close}
        >
          <X />
        </Button>
      </div>
      <p className="mb-3 px-3 text-xs font-medium text-muted-foreground">
        {t("workspace")}
      </p>
      <nav aria-label={t("mainNavigation")}>
        <ul className="space-y-1">{renderItems(navigation)}</ul>
      </nav>
      <div className="mt-auto border-t px-3 pt-5 text-xs leading-5 text-muted-foreground">
        {t("workspaceNote")}
      </div>
    </div>
  );
}
