"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { sessionRequest } from "../session-client";
import { getCurrentUser } from "@/features/auth/api/get-current-user";
import { AUTH_QUERY_KEY } from "@/features/auth/constants";
import { token } from "@/lib/auth/token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/config/env";
export function PlatformSignIn() {
  const t = useTranslations("access"),
    router = useRouter(),
    client = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (env.demoMode)
    return (
      <div className="login-panel">
        <h1 className="login-title">{t("platformLogin")}</h1>
        <p role="status">{t("demoUnavailable")}</p>
        <Link href="/auth/sign-in">{t("tenantLogin")}</Link>
      </div>
    );
  return (
    <div className="login-panel">
      <div className="login-heading">
        <h1 className="login-title">{t("platformLogin")}</h1>
        <p className="login-subtitle">{t("platformLoginHint")}</p>
      </div>
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            token.clear();
            await client.cancelQueries();
            client.clear();
            const pair = await sessionRequest("login", {
              scope: "platform",
              email: data.get("email"),
              password: data.get("password"),
            });
            token.set(pair.accessToken);
            const user = await getCurrentUser(true);
            client.setQueryData(AUTH_QUERY_KEY, user);
            router.replace("/settings");
          } catch {
            token.clear();
            setError(t("loginError"));
          } finally {
            setPending(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="platform-email">{t("email")}</Label>
          <Input
            id="platform-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform-password">{t("password")}</Label>
          <Input
            id="platform-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {t(pending ? "signingIn" : "signIn")}
        </Button>
        <Link href="/auth/sign-in" className="text-sm underline">
          {t("tenantLogin")}
        </Link>
      </form>
    </div>
  );
}
