"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { clearSession } from "@/lib/auth/session";
import { normalizeApiError } from "@/lib/api/api-error";
import { LoadingState } from "@/components/shared/loading/loading-state";
import { Button } from "@/components/ui/button";
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const t = useTranslations();
  const setExpired = useAuthStore((state) => state.setExpired);
  const unauthorized =
    session.isError &&
    [401, 403].includes(normalizeApiError(session.error).status);
  useEffect(() => {
    if (unauthorized) router.replace("/auth/sign-in");
  }, [unauthorized, router]);
  useEffect(() => {
    const onExpired = () => {
      setExpired(true);
      void clearSession(client).then(() => router.replace("/auth/sign-in"));
    };
    window.addEventListener("session-expired", onExpired);
    return () => window.removeEventListener("session-expired", onExpired);
  }, [client, router, setExpired]);
  if (session.isPending || unauthorized) return <LoadingState />;
  if (session.isError)
    return (
      <div className="p-8" role="alert">
        <p>{t("sessionError")}</p>
        <Button onClick={() => session.refetch()}>{t("retry")}</Button>
      </div>
    );
  return children;
}
