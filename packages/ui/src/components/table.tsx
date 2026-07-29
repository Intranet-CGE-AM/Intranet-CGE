import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  useId,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Select } from "./select";

export type { ColumnDef } from "@tanstack/react-table";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div
      className="w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[var(--focus)]"
      tabIndex={0}
    >
      <table
        className={cn(
          "w-full border-collapse text-left text-sm tabular-nums",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-[var(--border)] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-4", className)} {...props} />;
}

type DataTableProps<TData> = {
  ariaLabel: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  total: number;
};

export function DataTable<TData>({
  ariaLabel,
  columns,
  data,
  getRowId,
  itemLabel = "itens",
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [5, 10, 25, 50],
  total,
}: DataTableProps<TData>) {
  const pageSizeId = useId();
  const totalPages = Math.ceil(total / pageSize);
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    rowCount: total,
    state: { pagination: { pageIndex: page - 1, pageSize } },
  });
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <>
      <Table aria-label={ariaLabel}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </tbody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">
          {first}–{last} de {total} {itemLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-medium" htmlFor={pageSizeId}>
            Itens por página
          </label>
          <Select
            className="min-h-9 w-20"
            id={pageSizeId}
            name="dataTablePageSize"
            onValueChange={(value) => onPageSizeChange(Number(value))}
            options={pageSizeOptions.map((size) => ({
              label: String(size),
              value: String(size),
            }))}
            value={String(pageSize)}
          />
          <span className="min-w-16 text-center">
            Página {page} de {totalPages}
          </span>
          <Button
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="sm"
            type="button"
            variant="secondary"
          >
            Anterior
          </Button>
          <Button
            aria-label="Próxima página"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="sm"
            type="button"
            variant="secondary"
          >
            Próxima
          </Button>
        </div>
      </div>
    </>
  );
}
