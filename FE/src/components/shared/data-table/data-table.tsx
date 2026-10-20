"use client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state/empty-state";
import { useUiStore } from "@/stores/ui.store";
export function DataTable<T>({
  data,
  columns,
  page,
  pageSize,
  total,
  onPageChange,
  pending,
  label,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  pending?: boolean;
  label?:string;
}) {
  "use no memo";
  const t = useTranslations();
  const access=useTranslations("access");
  const compact = useUiStore((state) => state.compact);
  // TanStack Table v8 exposes mutable table methods; this component opts out of compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  return (
    <div
      data-slot="data-table"
      className="overflow-hidden rounded-xl border bg-card"
      aria-busy={pending}
    >
      <Table aria-label={label??t("allUsers")}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-muted/50">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="px-5 text-xs font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={compact ? "px-4 py-2" : "px-4 py-3"}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data.length && (
        <EmptyState
          title={label?access("noRecords"):t("noUsers")}
          description={label?access("emptyHint"):t("noUsersDescription")}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          {(label?access:t)("pagination", {
            page,
            pages: Math.max(1, Math.ceil(total / pageSize)),
            total,
          })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || pending}
            onClick={() => onPageChange(page - 1)}
            aria-label={t("previous")}
          >
            <ChevronLeft className="size-4" />
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total || pending}
            onClick={() => onPageChange(page + 1)}
            aria-label={t("next")}
          >
            {t("next")}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
