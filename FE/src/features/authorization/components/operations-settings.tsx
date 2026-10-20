"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { accessApi } from "../api";
import { usePermissions } from "../use-permissions";
import { AccessError, QueryState, useAccessAction } from "./access-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/shared/data-table/data-table";
type Metric = { status: string; _count: { _all: number } };
type Metrics = {
  at: string;
  tenants: Metric[];
  provisioning: Metric[];
  outbox: Metric[];
  migrations: Metric[];
  expiredProvisioningLeases: number;
  tenantPools: { clients: number; busy: number; totalPoolConnections: number };
};
export function OperationsSettings() {
  const t = useTranslations("access"),
    q = useQuery({
      queryKey: ["access", "metrics"],
      queryFn: () => accessApi.get<Metrics>("/admin/saas/metrics"),
      refetchInterval: 10000,
    });
  return (
    <QueryState pending={q.isPending} error={q.error} retry={q.refetch}>
      <div className="access-toolbar">
        <p className="text-sm text-muted-foreground">{t("metricsHint")}</p>
        <Button variant="outline" onClick={() => q.refetch()}>
          {t("refresh")}
        </Button>
      </div>
      {q.data && (
        <>
          <dl className="access-details">
            <div>
              <dt>{t("expiredLeases")}</dt>
              <dd>{q.data.expiredProvisioningLeases}</dd>
            </div>
            <div>
              <dt>{t("cachedClients")}</dt>
              <dd>{q.data.tenantPools.clients}</dd>
            </div>
            <div>
              <dt>{t("busyClients")}</dt>
              <dd>{q.data.tenantPools.busy}</dd>
            </div>
            <div>
              <dt>{t("connections")}</dt>
              <dd>{q.data.tenantPools.totalPoolConnections}</dd>
            </div>
          </dl>
          {(["tenants", "provisioning", "outbox", "migrations"] as const).map(
            (group) => (
              <section key={group} className="access-metric-group">
                <h3 className="font-semibold">{t(group)}</h3>
                {q.data![group].length ? (
                  <ul>
                    {q.data![group].map((r) => (
                      <li key={r.status}>
                        <span>{r.status}</span>
                        <strong>{r._count._all}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("noRecords")}
                  </p>
                )}
              </section>
            ),
          )}
        </>
      )}
    </QueryState>
  );
}
interface MigrationResult {
  id: string;
  tenantId: string;
  status: string;
  attemptCount: number;
  schemaVersion: string | null;
  lastErrorCode: string | null;
}
export function MigrationsSettings() {
  const t = useTranslations("access"),
    p = usePermissions(),
    action = useAccessAction();
  const [rollout, setRollout] = useState(""),
    [queryId, setQueryId] = useState("");
  const q = useQuery({
    queryKey: ["access", "rollout", queryId],
    queryFn: () =>
      accessApi.get<MigrationResult[]>(`/admin/tenant-migrations/${queryId}`),
    enabled: !!queryId && p.hasPermission("platform.migrations:read"),
    refetchInterval: (query) =>
      query.state.data?.some((x) => ["PENDING", "RUNNING"].includes(x.status))
        ? 5000
        : false,
  });
  return (
    <section>
      <p className="mb-6 text-sm text-muted-foreground">{t("migrationHint")}</p>
      {p.hasPermission("platform.migrations:manage") && (
        <form
          className="access-form mb-8"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate(() =>
              accessApi
                .send("/admin/tenant-migrations", "POST", {
                  authorizationRef: f.get("authorizationRef"),
                  tenantIds: String(f.get("tenantIds"))
                    .split(/[\s,]+/)
                    .filter(Boolean),
                })
                .then((r: { rolloutId: string }) => {
                  setRollout(r.rolloutId);
                  if (p.hasPermission("platform.migrations:read"))
                    setQueryId(r.rolloutId);
                  return r;
                }),
            );
          }}
        >
          <div>
            <Label htmlFor="approval-ref">{t("approvalRef")}</Label>
            <Input
              id="approval-ref"
              name="authorizationRef"
              pattern="[A-Za-z0-9_.:/-]+"
              maxLength={100}
              required
            />
          </div>
          <div>
            <Label htmlFor="migration-tenants">{t("tenantIds")}</Label>
            <Input
              id="migration-tenants"
              name="tenantIds"
              maxLength={37000}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("tenantIdsHint")}
            </p>
          </div>
          {action.error && <AccessError error={action.error} />}
          <Button className="justify-self-start" disabled={action.isPending}>
            {t(action.isPending ? "saving" : "createMigration")}
          </Button>
          {action.isSuccess && (
            <p role="status">
              {t("planAccepted")} <span className="break-all">{rollout}</span>
            </p>
          )}
        </form>
      )}
      {p.hasPermission("platform.migrations:read") && (
        <>
          <form
            className="access-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setQueryId(rollout.trim());
            }}
          >
            <Label htmlFor="rollout-id">{t("rolloutId")}</Label>
            <Input
              id="rollout-id"
              value={rollout}
              onChange={(e) => setRollout(e.target.value)}
              required
              pattern="[0-9a-fA-F-]{36}"
            />
            <Button variant="outline">{t("viewResults")}</Button>
          </form>
          {queryId && (
            <QueryState pending={q.isPending} error={q.error} retry={q.refetch}>
              <DataTable
                label={t("migrations")}
                data={q.data ?? []}
                page={1}
                pageSize={1000}
                total={q.data?.length ?? 0}
                onPageChange={() => {}}
                columns={[
                  { accessorKey: "tenantId", header: t("tenantIds") },
                  { accessorKey: "status", header: t("status") },
                  { accessorKey: "attemptCount", header: t("attempts") },
                  { accessorKey: "schemaVersion", header: t("schema") },
                  { accessorKey: "lastErrorCode", header: t("error") },
                ]}
              />
            </QueryState>
          )}
        </>
      )}
    </section>
  );
}
