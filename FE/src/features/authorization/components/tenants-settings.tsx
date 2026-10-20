"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { accessApi } from "../api";
import type { Operation, PageResult, Tenant } from "../api";
import { usePermissions } from "../use-permissions";
import {
  AccessDialog,
  AccessError,
  QueryState,
  useAccessAction,
  ConfirmAction,
} from "./access-shared";
import { DataTable } from "@/components/shared/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
const statuses = [
  "PENDING_PROVISIONING",
  "PROVISIONING",
  "ACTIVE",
  "SUSPENDED",
  "PROVISIONING_FAILED",
];
function CreateTenant({ onClose }: { onClose: () => void }) {
  const t = useTranslations("access"),
    action = useAccessAction();
  return (
    <AccessDialog
      title={t("createTenant")}
      description={t("createTenantHint")}
      open
      onClose={onClose}
    >
      <form
        className="access-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          action.mutate(
            () =>
              accessApi.send("/admin/tenants", "POST", {
                name: f.get("name"),
                code: f.get("code"),
                slug: f.get("slug"),
              }),
            { onSuccess: onClose },
          );
        }}
      >
        <div>
          <Label htmlFor="tenant-name">{t("name")}</Label>
          <Input id="tenant-name" name="name" required maxLength={200} />
        </div>
        <div>
          <Label htmlFor="tenant-code">{t("code")}</Label>
          <Input
            id="tenant-code"
            name="code"
            required
            pattern="[A-Za-z0-9][A-Za-z0-9_]{0,63}"
            maxLength={64}
          />
        </div>
        <div>
          <Label htmlFor="tenant-slug">{t("slug")}</Label>
          <Input
            id="tenant-slug"
            name="slug"
            required
            maxLength={63}
            pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
          />
        </div>
        {action.error && <AccessError error={action.error} />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={action.isPending}>
            {t(action.isPending ? "saving" : "createTenant")}
          </Button>
        </DialogFooter>
      </form>
    </AccessDialog>
  );
}
export function TenantsSettings() {
  const t = useTranslations("access"),
    locale = useLocale(),
    p = usePermissions();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ["access", "tenants", page, search, status],
    queryFn: () =>
      accessApi.get<PageResult<Tenant>>(
        `/admin/tenants?page=${page}&limit=20${search ? "&search=" + encodeURIComponent(search) : ""}${status ? "&status=" + status : ""}`,
      ),
  });
  return (
    <section>
      <div className="access-toolbar">
        <Input
          aria-label={t("searchTenants")}
          placeholder={t("searchTenants")}
          maxLength={100}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label className="sr-only" htmlFor="tenant-filter">
          {t("status")}
        </label>
        <select
          id="tenant-filter"
          className="access-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {p.hasPermission("platform.tenants:create") && (
          <Button onClick={() => setCreating(true)}>{t("createTenant")}</Button>
        )}
      </div>
      <QueryState pending={q.isPending} error={q.error} retry={q.refetch}>
        <DataTable
          label={t("tenants")}
          data={q.data?.items ?? []}
          columns={[
            {
              accessorKey: "name",
              header: t("name"),
              cell: ({ row }) => (
                <Link
                  href={`/settings/tenants/${row.original.id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {row.original.name}
                </Link>
              ),
            },
            { accessorKey: "code", header: t("code") },
            {
              accessorKey: "status",
              header: t("status"),
              cell: ({ row }) => (
                <span className="access-status">{row.original.status}</span>
              ),
            },
            {
              accessorKey: "createdAt",
              header: t("created"),
              cell: ({ row }) =>
                new Date(row.original.createdAt).toLocaleDateString(locale),
            },
          ]}
          page={page}
          pageSize={20}
          total={q.data?.total ?? 0}
          onPageChange={setPage}
        />
      </QueryState>
      {p.hasPermission("platform.tenants:create") && creating && (
        <CreateTenant onClose={() => setCreating(false)} />
      )}
    </section>
  );
}
export function TenantDetails({ id }: { id: string }) {
  const t = useTranslations("access"),
    locale = useLocale(),
    p = usePermissions(),
    action = useAccessAction();
  const [page, setPage] = useState(1),
    [confirm, setConfirm] = useState<"provision" | "retry">(),
    [accepted, setAccepted] = useState(false);
  const tenant = useQuery({
    queryKey: ["access", "tenant", id],
    queryFn: () => accessApi.get<Tenant>(`/admin/tenants/${id}`),
    refetchInterval: (q) =>
      q.state.data?.status === "PROVISIONING" ? 3000 : false,
  });
  const history = useQuery({
    queryKey: ["access", "history", id, page],
    queryFn: () =>
      accessApi.get<PageResult<Operation>>(
        `/admin/tenants/${id}/provisioning?page=${page}&limit=20`,
      ),
    refetchInterval: (q) =>
      q.state.data?.items.some((o) => ["PENDING", "RUNNING"].includes(o.status))
        ? 3000
        : false,
  });
  const item = tenant.data;
  return (
    <QueryState
      pending={tenant.isPending}
      error={tenant.error}
      retry={tenant.refetch}
    >
      <Link
        href="/settings/tenants"
        className="mb-5 inline-block text-sm underline"
      >
        {t("backTenants")}
      </Link>
      {item && (
        <>
          <div className="access-section-heading">
            <div>
              <h2 className="text-xl font-semibold">{item.name}</h2>
              <p className="text-sm text-muted-foreground">
                {item.code} · {item.slug}
              </p>
            </div>
            <span className="access-status">{item.status}</span>
          </div>
          {p.hasPermission("platform.tenants:update") && (
            <form
              className="access-toolbar"
              key={item.updatedAt ?? item.id}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                action.mutate(() =>
                  accessApi.send(`/admin/tenants/${id}`, "PATCH", {
                    name: f.get("name"),
                  }),
                );
              }}
            >
              <Label htmlFor="edit-tenant-name">{t("name")}</Label>
              <Input
                id="edit-tenant-name"
                name="name"
                defaultValue={item.name}
                maxLength={200}
                required
              />
              <Button variant="outline" disabled={action.isPending}>
                {t("save")}
              </Button>
            </form>
          )}
          <dl className="access-details">
            <div>
              <dt>{t("technicalReadiness")}</dt>
              <dd>{t(item.status === "ACTIVE" ? "ready" : "notReady")}</dd>
            </div>
            <div>
              <dt>{t("database")}</dt>
              <dd>{item.database?.databaseName ?? t("notProvisioned")}</dd>
            </div>
            {item.database && (
              <>
                <div>
                  <dt>{t("provider")}</dt>
                  <dd>{item.database.provider}</dd>
                </div>
                <div>
                  <dt>{t("schema")}</dt>
                  <dd>{item.database.schemaVersion ?? t("notReady")}</dd>
                </div>
                <div>
                  <dt>Neon Project / Branch</dt>
                  <dd>
                    {item.database.neonProjectId ?? "—"} /{" "}
                    {item.database.neonBranchId ?? "—"}
                  </dd>
                </div>
              </>
            )}
          </dl>
          <div className="access-toolbar">
            {item.status === "PENDING_PROVISIONING" &&
              p.hasPermission("platform.tenants:provision") && (
                <Button onClick={() => setConfirm("provision")}>
                  {t("startProvision")}
                </Button>
              )}
            {item.status === "PROVISIONING_FAILED" &&
              p.hasPermission("platform.tenants:retry") && (
                <Button onClick={() => setConfirm("retry")}>
                  {t("retryProvision")}
                </Button>
              )}
            <Button
              variant="outline"
              onClick={() => {
                void tenant.refetch();
                void history.refetch();
              }}
            >
              {t("refresh")}
            </Button>
          </div>
          {action.error && <AccessError error={action.error} />}{" "}
          {accepted && (
            <p role="status" className="access-feedback">
              {t("acceptedHint")}
            </p>
          )}
          <h3 className="mb-4 mt-8 text-base font-semibold">{t("history")}</h3>
          <QueryState
            pending={history.isPending}
            error={history.error}
            retry={history.refetch}
          >
            <DataTable
              label={t("history")}
              data={history.data?.items ?? []}
              page={page}
              pageSize={20}
              total={history.data?.total ?? 0}
              onPageChange={setPage}
              columns={[
                {
                  accessorKey: "createdAt",
                  header: t("created"),
                  cell: ({ row }) =>
                    new Date(row.original.createdAt).toLocaleString(locale),
                },
                { accessorKey: "status", header: t("status") },
                { accessorKey: "progress", header: t("step") },
                { accessorKey: "attemptCount", header: t("attempts") },
                {
                  id: "error",
                  header: t("error"),
                  cell: ({ row }) => (
                    <span>
                      {row.original.errorCode ?? "—"}
                      {row.original.errorSummary && (
                        <small className="block">
                          {row.original.errorSummary}
                        </small>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          </QueryState>
        </>
      )}
      {confirm &&
        p.hasPermission(
          confirm === "provision"
            ? "platform.tenants:provision"
            : "platform.tenants:retry",
        ) && (
          <ConfirmAction
            title={t(
              confirm === "provision" ? "startProvision" : "retryProvision",
            )}
            pending={action.isPending}
            error={action.error}
            onClose={() => setConfirm(undefined)}
            onConfirm={() =>
              action.mutate(
                () =>
                  accessApi.send(
                    `/admin/tenants/${id}/${confirm === "provision" ? "provision" : "provisioning/retry"}`,
                    "POST",
                  ),
                {
                  onSuccess: () => {
                    setAccepted(true);
                    setConfirm(undefined);
                  },
                },
              )
            }
          />
        )}
    </QueryState>
  );
}
