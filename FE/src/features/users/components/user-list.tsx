"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useUsers } from "@/features/users/hooks/use-users";
import { useUserMutations } from "@/features/users/hooks/use-user-mutations";
import { UserForm } from "@/features/users/components/user-form";
import type { User } from "@/features/users/types/user.type";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermission } from "@/hooks/use-permission";
import { PERMISSIONS } from "@/config/permissions";
import { PAGE_SIZE } from "@/constants/app";
import { formatDate } from "@/lib/utils/date";
import { initials } from "@/lib/utils/string";
import { PageHeader } from "@/components/shared/page-header/page-header";
import { DataTable } from "@/components/shared/data-table/data-table";
import { LoadingState } from "@/components/shared/loading/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function UserList() {
  const t = useTranslations();
  const can = usePermission();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const query = useUsers({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
  });
  const mutations = useUserMutations();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const saving = mutations.create.isPending || mutations.update.isPending;
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initials(row.original.name)}
          </span>
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: t("role"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{t(row.original.role)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "secondary" : "outline"}
          className={
            row.original.status === "active" ? "bg-accent text-primary" : ""
          }
        >
          {t(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("dateAdded"),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can(PERMISSIONS.USER.UPDATE) && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("editUser", { name: row.original.name })}
              onClick={() => setEditing(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {can(PERMISSIONS.USER.DELETE) && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("deleteUser", { name: row.original.name })}
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title={t("users")}
        description={t("usersDescription")}
        action={
          can(PERMISSIONS.USER.CREATE) && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              {t("addUser")}
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold">
          {t("allUsers")}{" "}
          <span className="ml-2 rounded-md bg-muted px-2 py-1 text-xs font-medium">
            {query.data?.total ?? "—"}
          </span>
        </h2>
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-3 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="bg-card pl-9"
            aria-label={t("searchUsers")}
            placeholder={t("searchUsers")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-sm">{t("usersError")}</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          data={query.data.data}
          columns={columns}
          page={page}
          pageSize={PAGE_SIZE}
          total={query.data.total}
          onPageChange={setPage}
          pending={query.isFetching}
        />
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {t(editing === "new" ? "addUser" : "editUserTitle")}
            </DialogTitle>
            <DialogDescription>{t("userFormDescription")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <UserForm
              key={editing === "new" ? "new" : editing.id}
              user={editing === "new" ? undefined : editing}
              pending={saving}
              onCancel={() => setEditing(null)}
              onSave={async (values) => {
                if (editing === "new")
                  await mutations.create.mutateAsync(values);
                else
                  await mutations.update.mutateAsync({
                    id: editing.id,
                    values,
                  });
                setEditing(null);
                toast.success(t("userSaved"));
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteUserTitle")}
        description={t("deleteUserDescription", { name: deleting?.name ?? "" })}
        pending={mutations.remove.isPending}
        onConfirm={() => {
          if (deleting)
            mutations.remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                if (query.data?.data.length === 1 && page > 1)
                  setPage(page - 1);
                toast.success(t("userDeleted"));
              },
              onError: () => toast.error(t("deleteError")),
            });
        }}
      />
    </>
  );
}
