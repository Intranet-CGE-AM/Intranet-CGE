import type { AssetStatus } from "@cge/contracts";
import { Button, Skeleton } from "@cge/ui";
import { ArrowLeft } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { useAuth } from "../../auth";
import { can } from "../../lib/permissions";

export type OrganizationUnitType = "department" | "sector" | "subsector";

export type OrganizationUnit = {
  id: string;
  code: string;
  name: string;
  type: OrganizationUnitType | null;
  parentId: string | null;
  active: boolean;
};

export type OrganizationUnitsResponse = {
  units: OrganizationUnit[];
};

export const assetStatusMeta: Record<
  AssetStatus,
  { label: string; variant: "neutral" | "success" | "warning" }
> = {
  active: { label: "Em uso", variant: "success" },
  maintenance: { label: "Em manutenção", variant: "warning" },
  disposed: { label: "Baixado", variant: "neutral" },
};

export const conservationOptions = [
  "Ótimo",
  "Bom",
  "Regular",
  "Ruim",
  "Inservível",
].map((value) => ({ label: value, value }));

// Radix Select does not accept "" as an item value; filters use this sentinel for "all".
export const ALL = "__all__";

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isNaN(number) ? "—" : currency.format(number);
}

export function optionalString(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function unitOptions(units: OrganizationUnit[]) {
  return units.map((unit) => ({
    label: `${unit.code} - ${unit.name}`,
    value: unit.id,
  }));
}

export function useCanManageAssets() {
  const { user } = useAuth();
  return Boolean(user && can(user, "assets.manage"));
}

export function PageHeader({
  actions,
  backTo,
  backLabel = "Voltar",
  description,
  title,
}: {
  actions?: ReactNode;
  backLabel?: string;
  backTo?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {backTo ? (
          <Button asChild className="-ml-2 mb-2" size="sm" variant="quiet">
            <Link to={backTo}>
              <ArrowLeft aria-hidden="true" size={16} />
              {backLabel}
            </Link>
          </Button>
        ) : null}
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Controle de patrimônio
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="page-enter space-y-4" role="status">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
