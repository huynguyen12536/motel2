"use client";
import Image from "next/image";
import {
  Bell,
  ChevronDown,
  LogOut,
  Mail,
  Menu,
  Search,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useSidebarStore } from "@/stores/sidebar.store";
import { signOut } from "@/features/auth/api/sign-out";
import { clearSession } from "@/lib/auth/session";
import { DASHBOARD_SEARCH_PLACEHOLDER } from "@/features/dashboard/constants/dashboard.constants";
import type { DashboardHeaderUser } from "@/features/dashboard/types/dashboard.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DashboardHeader({ user }: { user: DashboardHeaderUser }) {
  const t = useTranslations();
  const toggle = useSidebarStore((state) => state.toggle);
  const router = useRouter();
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await clearSession(client);
      router.replace("/auth/sign-in");
    },
    onError: () => toast.error(t("logoutError")),
  });

  return (
    <header className="wms-header">
      <div className="wms-header__left">
        <button
          type="button"
          className="wms-icon-btn"
          aria-label={t("openMenu")}
          onClick={toggle}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <Image
          src="/images/auth/logo-mark.png"
          alt=""
          width={28}
          height={28}
          className="size-7 object-contain"
          aria-hidden="true"
        />
        <div className="wms-header__brand">
          <p className="wms-header__title">WMS APA Nano</p>
          <p className="wms-header__subtitle">
            Hệ thống quản lý kho vật liệu
          </p>
        </div>
      </div>

      <div className="wms-header__right">
        <label className="wms-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder={DASHBOARD_SEARCH_PLACEHOLDER}
            aria-label={DASHBOARD_SEARCH_PLACEHOLDER}
          />
        </label>

        <button
          type="button"
          className="wms-icon-btn md:hidden"
          aria-label={DASHBOARD_SEARCH_PLACEHOLDER}
        >
          <Search size={18} aria-hidden="true" />
        </button>

        <button type="button" className="wms-icon-btn" aria-label="Thư">
          <Mail size={18} aria-hidden="true" />
          <span className="wms-icon-btn__badge">{user.mailBadge}</span>
        </button>

        <button type="button" className="wms-icon-btn" aria-label="Thông báo">
          <Bell size={18} aria-hidden="true" />
          <span className="wms-icon-btn__badge">{user.notificationBadge}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="wms-user" aria-label={user.name}>
              <span className="wms-user__avatar" aria-hidden="true">
                {user.initials}
              </span>
              <span className="wms-user__meta">
                <span className="wms-user__name">{user.name}</span>
                <span className="wms-user__role">{user.role}</span>
              </span>
              <ChevronDown size={16} color="#94A3B8" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={logout.isPending}
              onSelect={() => logout.mutate()}
            >
              <LogOut />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
