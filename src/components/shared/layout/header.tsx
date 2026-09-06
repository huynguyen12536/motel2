"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/stores/sidebar.store";
import { useSession } from "@/features/auth/hooks/use-session";
import { signOut } from "@/features/auth/api/sign-out";
import { clearSession } from "@/lib/auth/session";
import { initials } from "@/lib/utils/string";
import { env } from "@/config/env";
import { navigation } from "@/config/navigation";
export function Header() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const toggle = useSidebarStore((state) => state.toggle);
  const { data } = useSession();
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await clearSession(client);
      router.replace("/auth/sign-in");
    },
    onError: () => toast.error(t("logoutError")),
  });
  const title =
    navigation.find((item) => item.href === pathname)?.title ?? "dashboard";
  return (
    <header className="flex h-20 items-center justify-between gap-3 border-b bg-card px-5 md:px-10">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggle}
          aria-label={t("openMenu")}
        >
          <Menu />
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {t("workspace")}
        </span>
        <span
          aria-hidden="true"
          className="hidden text-muted-foreground sm:inline"
        >
          /
        </span>
        <span className="text-sm font-medium">{t(title)}</span>
      </div>
      <div className="flex items-center gap-3">
        {env.demoMode && (
          <span className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-primary">
            {t("demo")}
          </span>
        )}
        <span className="hidden text-sm sm:inline">{data?.name}</span>
        <span
          className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold"
          aria-hidden="true"
        >
          {initials(data?.name ?? "")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label={t("signOut")}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
