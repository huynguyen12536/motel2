"use client";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { signOut } from "@/features/auth/api/sign-out";
import { clearSession } from "@/lib/auth/session";
import { dashboardUser } from "@/features/dashboard/mocks/dashboard.mock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const t = useTranslations();
  const router = useRouter();
  const client = useQueryClient();
  const user = dashboardUser;
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await clearSession(client);
      router.replace("/auth/sign-in");
    },
    onError: () => toast.error(t("logoutError")),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wms-account-trigger"
          aria-label={`${user.name} — ${user.role}`}
        >
          <span className="wms-account-trigger__avatar" aria-hidden="true">
            {user.initials}
          </span>
          <span className="wms-account-trigger__caret" aria-hidden="true">
            <ChevronDown size={12} strokeWidth={2.5} />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="wms-account-menu z-[60] min-w-[320px] max-h-[min(480px,calc(100dvh-96px))] border-0 bg-transparent p-0 shadow-none"
      >
        <div className="wms-account-panel">
          <div className="wms-account-card">
            <div className="wms-account-card__row">
              <span className="wms-account-card__avatar" aria-hidden="true">
                {user.initials}
              </span>
              <div className="wms-account-card__meta">
                <p className="wms-account-card__name">{user.name}</p>
                <p className="wms-account-card__role">{user.role}</p>
              </div>
            </div>
            <DropdownMenuSeparator className="wms-account-card__rule" />
            <Link href="/settings" className="wms-account-card__action">
              <UserRound size={16} aria-hidden="true" />
              Xem hồ sơ &amp; cài đặt tài khoản
            </Link>
          </div>

          <div className="wms-account-list">
            <DropdownMenuItem asChild className="wms-account-item">
              <Link href="/settings">
                <span className="wms-account-item__icon" aria-hidden="true">
                  <Settings size={18} />
                </span>
                <span className="wms-account-item__label">
                  Cài đặt và quyền riêng tư
                </span>
                <ChevronRight
                  size={18}
                  className="wms-account-item__chevron"
                  aria-hidden="true"
                />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="wms-account-item">
              <a href="mailto:admin@apa.local">
                <span className="wms-account-item__icon" aria-hidden="true">
                  <CircleHelp size={18} />
                </span>
                <span className="wms-account-item__label">
                  Trợ giúp và hỗ trợ
                </span>
                <ChevronRight
                  size={18}
                  className="wms-account-item__chevron"
                  aria-hidden="true"
                />
              </a>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="wms-account-item"
              variant="destructive"
              disabled={logout.isPending}
              onSelect={() => logout.mutate()}
            >
              <span className="wms-account-item__icon" aria-hidden="true">
                <LogOut size={18} />
              </span>
              <span className="wms-account-item__label">{t("signOut")}</span>
            </DropdownMenuItem>
          </div>

          <p className="wms-account-footer">
            WMS APA Nano · Quyền riêng tư · Điều khoản
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
