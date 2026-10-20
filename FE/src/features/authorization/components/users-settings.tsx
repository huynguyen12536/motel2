"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { accessApi } from "../api";
import type { ManagedUser, PageResult, Role } from "../api";
import { usePermissions } from "../use-permissions";
import {
  useAccessAction,
  AccessDialog,
  AccessError,
  ConfirmAction,
  QueryState,
} from "./access-shared";
import { DataTable } from "@/components/shared/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
function UserRoleEditor({
  user,
  onClose,
}: {
  user: ManagedUser;
  onClose: () => void;
}) {
  const t = useTranslations("access"),
    p = usePermissions(),
    scope = p.scope!,
    action = useAccessAction();
  const q = useQuery({
    queryKey: ["access", scope, "allRoles"],
    queryFn: async () => {
      const first = await accessApi.get<PageResult<Role>>(
        `/${scope}/roles?limit=100&page=1`,
      );
      const rows = [...first.items];
      for (let page = 2; rows.length < first.total && page <= 10; page++)
        rows.push(
          ...(
            await accessApi.get<PageResult<Role>>(
              `/${scope}/roles?limit=100&page=${page}`,
            )
          ).items,
        );
      return rows;
    },
    enabled: p.hasPermission(`${scope}.roles:read`),
  });
  const [selected, setSelected] = useState(
      () => new Set(user.roles.map((r) => r.id)),
    ),
    [confirm, setConfirm] = useState(false);
  const writable =
    p.hasPermission(
      scope === "platform" ? "platform.users:manage" : "tenant.users:assign",
    ) && user.status === "ACTIVE";
  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify(user.roles.map((r) => r.id).sort());
  const close = () => {
    if (!dirty || window.confirm(t("discard"))) onClose();
  };
  return (
    <AccessDialog
      title={t("assignRoles")}
      description={`${user.email} · ${t(scope)}`}
      open
      onClose={close}
    >
      <QueryState pending={q.isPending} error={q.error} retry={q.refetch}>
        <fieldset
          className="access-role-options"
          disabled={!writable || confirm}
        >
          <legend className="sr-only">{t("roles")}</legend>
          {q.data?.map((role) => {
            const delegable = role.permissionCodes.every((c) =>
              p.hasPermission(c),
            );
            return (
              <Label key={role.id} className="access-role-option">
                <Checkbox
                  aria-label={role.name}
                  checked={selected.has(role.id)}
                  disabled={!delegable || !writable}
                  onCheckedChange={(v) =>
                    setSelected((old) => {
                      const n = new Set(old);
                      if (v === true) n.add(role.id);
                      else n.delete(role.id);
                      return n;
                    })
                  }
                />
                <span>
                  <strong>{role.name}</strong>
                  <small>
                    {role.code}
                    {role.systemManaged ? " · " + t("protected") : ""}
                  </small>
                </span>
              </Label>
            );
          })}
        </fieldset>
        {dirty && (
          <p role="status">{t(confirm ? "confirmAssignments" : "unsaved")}</p>
        )}
        {action.error && <AccessError error={action.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("cancel")}
          </Button>
          {writable && (
            <Button
              disabled={!dirty || action.isPending}
              onClick={() => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                action.mutate(
                  () =>
                    accessApi.send(`/${scope}/users/${user.id}/roles`, "PUT", {
                      roleIds: [...selected],
                    }),
                  { onSuccess: onClose },
                );
              }}
            >
              {t(
                action.isPending ? "saving" : confirm ? "confirm" : "saveRoles",
              )}
            </Button>
          )}
        </DialogFooter>
      </QueryState>
    </AccessDialog>
  );
}
function CreateUser({ onClose }: { onClose: () => void }) {
  const t = useTranslations("access"),
    p = usePermissions(),
    action = useAccessAction();
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (!dirty || window.confirm(t("discard"))) onClose();
  };
  return (
    <AccessDialog
      title={t("createUser")}
      description={t("newUserHint")}
      open
      onClose={close}
    >
      <form
        className="access-form"
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          action.mutate(
            () =>
              accessApi.send(`/${p.scope}/users`, "POST", {
                email: f.get("email"),
                password: f.get("password"),
                name: f.get("name"),
              }),
            { onSuccess: onClose },
          );
        }}
      >
        <div>
          <Label htmlFor="user-name">{t("name")}</Label>
          <Input id="user-name" name="name" required maxLength={200} />
        </div>
        <div>
          <Label htmlFor="user-email">{t("email")}</Label>
          <Input
            id="user-email"
            name="email"
            type="email"
            required
            maxLength={254}
          />
        </div>
        <div>
          <Label htmlFor="user-password">{t("password")}</Label>
          <Input
            id="user-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
          />
        </div>
        {action.error && <AccessError error={action.error} />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("cancel")}
          </Button>
          <Button disabled={action.isPending}>
            {t(action.isPending ? "saving" : "createUser")}
          </Button>
        </DialogFooter>
      </form>
    </AccessDialog>
  );
}
export function UsersSettings() {
  const t = useTranslations("access"),
    p = usePermissions(),
    scope = p.scope!,
    action = useAccessAction();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<ManagedUser>(),
    [creating, setCreating] = useState(false),
    [changing, setChanging] = useState<ManagedUser>();
  const q = useQuery({
    queryKey: ["access", scope, "users", page, search],
    queryFn: () =>
      accessApi.get<PageResult<ManagedUser>>(
        `/${scope}/users?page=${page}&limit=20${search ? "&search=" + encodeURIComponent(search) : ""}`,
      ),
  });
  const assign =
      p.hasPermission(`${scope}.roles:read`) &&
      p.hasPermission(
        scope === "platform" ? "platform.users:manage" : "tenant.users:assign",
      ),
    canCreate = p.hasPermission(
      scope === "platform" ? "platform.users:manage" : "tenant.users:create",
    ),
    canStatus = p.hasPermission(
      scope === "platform" ? "platform.users:manage" : "tenant.users:update",
    );
  return (
    <section>
      <div className="access-toolbar">
        <Input
          aria-label={t("searchUsers")}
          placeholder={t("searchUsers")}
          value={search}
          maxLength={100}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {canCreate && (
          <Button onClick={() => setCreating(true)}>{t("createUser")}</Button>
        )}
      </div>
      <QueryState pending={q.isPending} error={q.error} retry={q.refetch}>
        <DataTable
          label={t("users")}
          data={q.data?.items ?? []}
          page={page}
          pageSize={20}
          total={q.data?.total ?? 0}
          onPageChange={setPage}
          columns={[
            { accessorKey: "email", header: t("email") },
            { accessorKey: "status", header: t("status") },
            {
              id: "roles",
              header: t("roles"),
              cell: ({ row }) =>
                row.original.roles.map((r) => r.name).join(", ") ||
                t("noRoles"),
            },
            {
              id: "actions",
              header: t("actions"),
              cell: ({ row }) => (
                <div className="access-row-actions">
                  {assign && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={row.original.status !== "ACTIVE"}
                      onClick={() => setSelected(row.original)}
                    >
                      {t("assignRoles")}
                    </Button>
                  )}
                  {canStatus && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChanging(row.original)}
                    >
                      {t(
                        row.original.status === "ACTIVE" ? "disable" : "enable",
                      )}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </QueryState>
      {assign && selected && (
        <UserRoleEditor
          user={selected}
          onClose={() => setSelected(undefined)}
        />
      )}{" "}
      {canCreate && creating && (
        <CreateUser onClose={() => setCreating(false)} />
      )}{" "}
      {canStatus && changing && (
        <ConfirmAction
          title={t(changing.status === "ACTIVE" ? "disable" : "enable")}
          pending={action.isPending}
          error={action.error}
          onClose={() => setChanging(undefined)}
          onConfirm={() =>
            action.mutate(
              () =>
                accessApi.send(`/${scope}/users/${changing.id}`, "PATCH", {
                  status: changing.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                }),
              { onSuccess: () => setChanging(undefined) },
            )
          }
        />
      )}
    </section>
  );
}
