"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/auth/hooks/use-session";
import { usePermissions } from "../use-permissions";
import { RolesSettings } from "./roles-settings";
import { UsersSettings } from "./users-settings";
import { TenantDetails, TenantsSettings } from "./tenants-settings";
import { OperationsSettings, MigrationsSettings } from "./operations-settings";
import { PageHeader } from "@/components/shared/page-header/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { LoadingState } from "@/components/shared/loading/loading-state";
import { Button } from "@/components/ui/button";
import "./authorization-settings.css";
export type SettingsSection =
  "general" | "roles" | "users" | "tenants" | "migrations" | "operations";
export function AuthorizationSettings({
  section = "general",
  tenantId,
}: {
  section?: SettingsSection;
  tenantId?: string;
}) {
  const t = useTranslations("access"),
    p = usePermissions(),
    session = useSession(),
    scope = p.scope;
  if (p.status === "loading") return <LoadingState />;
  if (!scope) return <PermissionDenied />;
  const entries: { id: SettingsSection; label: string; allowed: boolean }[] = [
    { id: "general", label: t("general"), allowed: p.permissions.length > 0 },
    {
      id: "users",
      label: t("users"),
      allowed: p.hasPermission(`${scope}.users:read`),
    },
    {
      id: "roles",
      label: t("rolesPermissions"),
      allowed: p.hasPermission(`${scope}.roles:read`),
    },
    {
      id: "tenants",
      label: t("tenants"),
      allowed: scope === "platform" && p.hasPermission("platform.tenants:read"),
    },
    {
      id: "migrations",
      label: t("migrations"),
      allowed:
        scope === "platform" &&
        p.hasAnyPermission([
          "platform.migrations:read",
          "platform.migrations:manage",
        ]),
    },
    {
      id: "operations",
      label: t("operations"),
      allowed: scope === "platform" && p.hasPermission("platform.metrics:read"),
    },
  ];
  const allowed =
    p.status === "authenticated" &&
    entries.find((x) => x.id === section)?.allowed;
  return (
    <div className="access-settings">
      <PageHeader
        title={t("settings")}
        description={t(
          scope === "platform" ? "platformSettingsHint" : "tenantSettingsHint",
        )}
      />
      <div className="access-settings-layout">
        <nav
          aria-label={t("settingsNavigation")}
          className="access-settings-nav"
        >
          {entries
            .filter((e) => e.allowed)
            .map((e) => (
              <Link
                key={e.id}
                href={e.id === "general" ? "/settings" : "/settings/" + e.id}
                aria-current={section === e.id ? "page" : undefined}
              >
                {e.label}
              </Link>
            ))}
        </nav>
        <div
          className={
            section === "general"
              ? "access-settings-main access-settings-main--general"
              : "access-settings-main"
          }
        >
          {!allowed ? (
            <PermissionDenied />
          ) : section === "roles" ? (
            <RolesSettings />
          ) : section === "users" ? (
            <UsersSettings />
          ) : section === "tenants" ? (
            tenantId ? (
              <TenantDetails id={tenantId} />
            ) : (
              <TenantsSettings />
            )
          ) : section === "operations" ? (
            <OperationsSettings />
          ) : section === "migrations" ? (
            <MigrationsSettings />
          ) : (
            <section>
              <h2 className="mb-5 text-lg font-semibold">{t("general")}</h2>
              <dl className="access-details">
                <div>
                  <dt>{t("email")}</dt>
                  <dd>{session.data?.email}</dd>
                </div>
                <div>
                  <dt>{t("scope")}</dt>
                  <dd>{t(scope)}</dd>
                </div>
                {p.tenantId && (
                  <div>
                    <dt>{t("tenantId")}</dt>
                    <dd>{p.tenantId}</dd>
                  </div>
                )}
                <div>
                  <dt>{t("roles")}</dt>
                  <dd>{session.data?.role || t("noRoles")}</dd>
                </div>
                <div>
                  <dt>{t("policyVersion")}</dt>
                  <dd>{p.policyVersion}</dd>
                </div>
              </dl>
              <Button variant="outline" onClick={() => p.refresh()}>
                {t("refreshPermissions")}
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
