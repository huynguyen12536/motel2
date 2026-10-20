"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { accessApi } from "../api";
import type { PageResult, PermissionRecord, Role } from "../api";
import { usePermissions } from "../use-permissions";
import {
  useAccessAction,
  AccessDialog,
  AccessError,
  QueryState,
  ConfirmAction,
} from "./access-shared";
import { DataTable } from "@/components/shared/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
function RoleEditor({
  role,
  scope,
  onClose,
}: {
  role: Role | null;
  scope: "platform" | "tenant";
  onClose: () => void;
}) {
  const t = useTranslations("access"),
    action = useAccessAction();
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (!dirty || window.confirm(t("discard"))) onClose();
  };
  return (
    <AccessDialog
      title={t(role ? "editRole" : "createRole")}
      description={t("roleScopeHint", { scope })}
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
              accessApi.send(
                `/${scope}/roles${role ? "/" + role.id : ""}`,
                role ? "PATCH" : "POST",
                {
                  ...(role ? {} : { code: f.get("code") }),
                  name: f.get("name"),
                  description: f.get("description"),
                },
              ),
            { onSuccess: onClose },
          );
        }}
      >
        {!role && (
          <div>
            <Label htmlFor="role-code">{t("code")}</Label>
            <Input
              id="role-code"
              name="code"
              required
              pattern="[A-Za-z][A-Za-z0-9_]{1,63}"
              maxLength={64}
            />
          </div>
        )}
        <div>
          <Label htmlFor="role-name">{t("name")}</Label>
          <Input
            id="role-name"
            name="name"
            defaultValue={role?.name}
            required
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="role-description">{t("description")}</Label>
          <Input
            id="role-description"
            name="description"
            defaultValue={role?.description}
            maxLength={500}
          />
        </div>
        {action.error && <AccessError error={action.error} />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("cancel")}
          </Button>
          <Button disabled={action.isPending || !dirty}>
            {t(action.isPending ? "saving" : "save")}
          </Button>
        </DialogFooter>
      </form>
    </AccessDialog>
  );
}
function PermissionMatrix({
  role,
  onClose,
}: {
  role: Role;
  onClose: () => void;
}) {
  const t = useTranslations("access"),
    p = usePermissions(),
    scope = p.scope!,
    action = useAccessAction();
  const catalog = useQuery({
    queryKey: ["access", scope, "catalog"],
    queryFn: () => accessApi.get<PermissionRecord[]>(`/${scope}/permissions`),
    enabled: p.hasPermission(`${scope}.permissions:read`),
  });
  const [selected, setSelected] = useState(() => new Set(role.permissionCodes));
  const writable =
    !role.systemManaged &&
    p.hasPermission(
      scope === "platform"
        ? "platform.permissions:manage"
        : "tenant.permissions:assign",
    );
  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify([...role.permissionCodes].sort());
  const close = () => {
    if (!dirty || window.confirm(t("discard"))) onClose();
  };
  const resources = [...new Set(catalog.data?.map((x) => x.resource) ?? [])],
    actions = [...new Set(catalog.data?.map((x) => x.action) ?? [])];
  const toggle = (code: string, checked: boolean) =>
    setSelected((old) => {
      const next = new Set(old);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  return (
    <AccessDialog
      title={t("permissionMatrix")}
      description={`${role.name} · ${t(scope)}${role.systemManaged ? " · " + t("protected") : ""}`}
      open
      onClose={close}
    >
      <QueryState
        pending={catalog.isPending}
        error={catalog.error}
        retry={catalog.refetch}
      >
        <div
          className="access-matrix"
          tabIndex={0}
          role="region"
          aria-label={t("permissionMatrix")}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">{t("module")}</th>
                {actions.map((a) => (
                  <th scope="col" key={a}>
                    {a}
                  </th>
                ))}
                {writable && <th scope="col">{t("group")}</th>}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource}>
                  <th scope="row">{resource}</th>
                  {actions.map((a) => {
                    const permission = catalog.data?.find(
                      (x) => x.resource === resource && x.action === a,
                    );
                    return (
                      <td key={a}>
                        {permission ? (
                          <Checkbox
                            aria-label={permission.code}
                            title={permission.description}
                            checked={selected.has(permission.code)}
                            disabled={
                              !writable || !p.hasPermission(permission.code)
                            }
                            onCheckedChange={(v) =>
                              toggle(permission.code, v === true)
                            }
                          />
                        ) : (
                          <span aria-label={t("notApplicable")}>—</span>
                        )}
                      </td>
                    );
                  })}
                  {writable && (
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const group = catalog.data!.filter(
                            (x) =>
                              x.resource === resource &&
                              p.hasPermission(x.code),
                          );
                          const all = group.every((x) => selected.has(x.code));
                          setSelected((old) => {
                            const n = new Set(old);
                            group.forEach((x) =>
                              all ? n.delete(x.code) : n.add(x.code),
                            );
                            return n;
                          });
                        }}
                      >
                        {t("selectGroup")}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dirty && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("unsaved")}
          </p>
        )}
        {action.error && <AccessError error={action.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t(writable ? "cancel" : "close")}
          </Button>
          {writable && (
            <Button
              disabled={!dirty || action.isPending}
              onClick={() =>
                action.mutate(
                  () =>
                    accessApi.send(
                      `/${scope}/roles/${role.id}/permissions`,
                      "PUT",
                      { permissions: [...selected] },
                    ),
                  { onSuccess: onClose },
                )
              }
            >
              {t(action.isPending ? "saving" : "savePermissions")}
            </Button>
          )}
        </DialogFooter>
      </QueryState>
    </AccessDialog>
  );
}
export function RolesSettings() {
  const t = useTranslations("access"),
    p = usePermissions(),
    scope = p.scope!;
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState<Role | null | undefined>(),
    [matrix, setMatrix] = useState<Role>(),
    [removing, setRemoving] = useState<Role>();
  const action = useAccessAction(),
    q = useQuery({
      queryKey: ["access", scope, "roles", page, search],
      queryFn: () =>
        accessApi.get<PageResult<Role>>(
          `/${scope}/roles?page=${page}&limit=20${search ? "&search=" + encodeURIComponent(search) : ""}`,
        ),
    });
  const manage = p.hasPermission(`${scope}.roles:manage`);
  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("role"),
        cell: ({ row }) => (
          <div>
            <strong>{row.original.name}</strong>
            <p className="text-xs text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      { accessorKey: "description", header: t("description") },
      { accessorKey: "scope", header: t("scope"), cell: () => t(scope) },
      {
        id: "permissions",
        header: t("permissions"),
        cell: ({ row }) => row.original.permissionCodes.length,
      },
      { accessorKey: "assignedUserCount", header: t("users") },
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => (
          <div className="access-row-actions">
            {row.original.systemManaged && (
              <span className="access-status">{t("protected")}</span>
            )}
            {p.hasPermission(`${scope}.permissions:read`) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMatrix(row.original)}
              >
                {t("permissions")}
              </Button>
            )}
            {manage && !row.original.systemManaged && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditor(row.original)}
                >
                  {t("edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={row.original.assignedUserCount > 0}
                  onClick={() => setRemoving(row.original)}
                >
                  {t("delete")}
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [t, scope, p, manage],
  );
  return (
    <section>
      <div className="access-toolbar">
        <Input
          aria-label={t("searchRoles")}
          placeholder={t("searchRoles")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          maxLength={100}
        />
        {manage && (
          <Button onClick={() => setEditor(null)}>{t("createRole")}</Button>
        )}
      </div>
      <QueryState pending={q.isPending} error={q.error} retry={q.refetch}>
        <DataTable
          label={t("roles")}
          data={q.data?.items ?? []}
          columns={columns}
          page={page}
          pageSize={20}
          total={q.data?.total ?? 0}
          onPageChange={setPage}
        />
      </QueryState>
      {manage && editor !== undefined && (
        <RoleEditor
          role={editor}
          scope={scope}
          onClose={() => setEditor(undefined)}
        />
      )}{" "}
      {matrix && (
        <PermissionMatrix role={matrix} onClose={() => setMatrix(undefined)} />
      )}{" "}
      {manage && removing && (
        <ConfirmAction
          title={t("deleteNamed", { name: removing.name })}
          onClose={() => setRemoving(undefined)}
          pending={action.isPending}
          error={action.error}
          onConfirm={() =>
            action.mutate(
              () => accessApi.send(`/${scope}/roles/${removing.id}`, "DELETE"),
              { onSuccess: () => setRemoving(undefined) },
            )
          }
        />
      )}
    </section>
  );
}
