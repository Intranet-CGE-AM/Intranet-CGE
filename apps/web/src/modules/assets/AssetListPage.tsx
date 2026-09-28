import type { Asset } from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  SearchableSelect,
  Select,
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@cge/ui";

import {
  ArrowClockwise,
  CaretDown,
  CaretUp,
  MagnifyingGlass,
  PlusCircle,
  SlidersHorizontal,
} from "@phosphor-icons/react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useSearchParams } from "react-router";

import { api, ApiError } from "../../lib/api";

import {
  ALL,
  assetStatusMeta,
  formatCurrency,
  formatDate,
  PageHeader,
  unitOptions,
  type OrganizationUnit,
  type OrganizationUnitsResponse,
} from "./shared";

type AssetListResponse = {
  assets: Asset[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function AssetListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedUnitId = searchParams.get("unitId");

  const selectedConservationStatus = searchParams.get("conservationStatus");

  const searchTerm = searchParams.get("q") ?? "";

  const [assets, setAssets] = useState<Asset[]>([]);

  const [total, setTotal] = useState(0);

  const [totalPages, setTotalPages] = useState(1);

  const [currentPage, setCurrentPage] = useState(1);

  const [currentPageSize, setCurrentPageSize] = useState(10);

  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const unitsById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units],
  );

  function getAssetLocation(unitId: string | null) {
    if (!unitId) {
      return "—";
    }

    const unit = unitsById.get(unitId);

    if (!unit) {
      return "—";
    }

    if (unit.type === "subsector") {
      const sector = unit.parentId ? unitsById.get(unit.parentId) : null;

      const department = sector?.parentId
        ? unitsById.get(sector.parentId)
        : null;

      return [department?.code, sector?.code, unit.code]
        .filter(Boolean)
        .join(" > ");
    }

    if (unit.type === "sector") {
      const department = unit.parentId ? unitsById.get(unit.parentId) : null;

      return [department?.code, unit.code].filter(Boolean).join(" > ");
    }

    if (unit.type === "department") {
      return unit.code;
    }

    // Compatibilidade com registros antigos
    return `${unit.code} - ${unit.name}`;
  }

  const selectedStatus = searchParams.get("status");

  const sortBy = searchParams.get("sortBy") ?? "patrimonyNumber";

  const sortDirection = searchParams.get("sortDirection") ?? "asc";

  const selectedUnit = selectedUnitId
    ? (unitsById.get(selectedUnitId) ?? null)
    : null;
  const selectedSubsector =
    selectedUnit?.type === "subsector" ? selectedUnit : null;

  const selectedSector =
    selectedUnit?.type === "sector"
      ? selectedUnit
      : selectedSubsector?.parentId
        ? (unitsById.get(selectedSubsector.parentId) ?? null)
        : null;

  const selectedDepartment =
    selectedUnit?.type === "department"
      ? selectedUnit
      : selectedSector?.parentId
        ? (unitsById.get(selectedSector.parentId) ?? null)
        : null;

  const selectedDepartmentId = selectedDepartment?.id ?? "";

  const selectedSectorId = selectedSector?.id ?? "";

  const selectedSubsectorId = selectedSubsector?.id ?? "";

  const departments = units.filter(
    (unit) => unit.active && unit.type === "department",
  );

  const sectors = units.filter(
    (unit) =>
      unit.active &&
      unit.type === "sector" &&
      unit.parentId === selectedDepartmentId,
  );

  const subsectors = units.filter(
    (unit) =>
      unit.active &&
      unit.type === "subsector" &&
      unit.parentId === selectedSectorId,
  );

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    next.set("page", "1");

    setSearchParams(next);
  }

  function changePage(page: number) {
    const next = new URLSearchParams(searchParams);

    next.set("page", String(page));

    setSearchParams(next);
  }

  function changePageSize(value: string) {
    const next = new URLSearchParams(searchParams);

    next.set("pageSize", value);

    next.set("page", "1");

    setSearchParams(next);
  }

  function updateSort(field: string) {
    const next = new URLSearchParams(searchParams);

    const currentField = next.get("sortBy");

    const currentDirection = next.get("sortDirection") ?? "asc";

    if (currentField === field) {
      next.set("sortDirection", currentDirection === "asc" ? "desc" : "asc");
    } else {
      next.set("sortBy", field);

      next.set("sortDirection", "asc");
    }
    next.set("page", "1");

    setSearchParams(next);
  }

  const queryString = searchParams.toString();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const assetUrl = queryString
        ? `/api/assets?${queryString}`
        : "/api/assets";

      const [assetResult, unitResult] = await Promise.all([
        api<AssetListResponse>(assetUrl),

        api<OrganizationUnitsResponse>("/api/organization-units"),
      ]);

      setAssets(assetResult.assets);

      setTotal(assetResult.total);

      setTotalPages(assetResult.totalPages);

      setCurrentPage(assetResult.page);

      setCurrentPageSize(assetResult.pageSize);

      setUnits(unitResult.units);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError("Não foi possível carregar os bens patrimoniais.");
      }
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasFilters = Boolean(
    searchTerm ||
    selectedStatus ||
    selectedUnitId ||
    selectedConservationStatus,
  );

  const itemLabel = total === 1 ? "bem" : "bens";

  const first = total ? (currentPage - 1) * currentPageSize + 1 : 0;

  const last = Math.min(currentPage * currentPageSize, total);

  const statusValue = selectedStatus ?? "";

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        actions={
          <>
            <Button
              disabled={loading}
              onClick={() => void loadData()}
              type="button"
              variant="secondary"
            >
              <ArrowClockwise aria-hidden="true" size={16} />
              Atualizar
            </Button>

            <Button asChild>
              <Link to="/patrimonio/bens/novo">
                <PlusCircle aria-hidden="true" size={16} />
                Novo bem
              </Link>
            </Button>
          </>
        }
        description="Consulte os bens patrimoniais cadastrados."
        title="Bens patrimoniais"
      />

      {error ? (
        <Alert tone="danger" title="Não foi possível carregar os bens">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="items-start">
          <div>
            <h2 className="font-bold">Bens cadastrados</h2>

            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {total} {itemLabel} {total === 1 ? "encontrado" : "encontrados"}.
            </p>
          </div>

          {hasFilters ? (
            <Button
              onClick={() => setSearchParams({})}
              size="sm"
              type="button"
              variant="quiet"
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              Limpar filtros
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="border-b border-[var(--border)] py-4">
          <div className="space-y-3">
            <FormField htmlFor="asset-search" label="Tombo ou material">
              <div className="relative">
                <MagnifyingGlass
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                  size={16}
                />

                <Input
                  autoComplete="off"
                  className="pl-9"
                  id="asset-search"
                  onChange={(event) => updateFilter("q", event.target.value)}
                  placeholder="Ex.: 335 ou Notebook"
                  type="search"
                  value={searchTerm}
                />
              </div>
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FormField htmlFor="status-filter" label="Situação">
                <Select
                  id="status-filter"
                  name="status"
                  onValueChange={(value) =>
                    updateFilter("status", value === ALL ? "" : value)
                  }
                  options={[
                    { label: "Todas", value: ALL },
                    ...Object.entries(assetStatusMeta).map(([value, meta]) => ({
                      label: meta.label,
                      value,
                    })),
                  ]}
                  value={statusValue || ALL}
                />
              </FormField>

              <FormField htmlFor="department-filter" label="Departamento">
                <SearchableSelect
                  id="department-filter"
                  name="department"
                  onValueChange={(value) =>
                    updateFilter("unitId", value === ALL ? "" : value)
                  }
                  options={[
                    { label: "Todos os departamentos", value: ALL },
                    ...unitOptions(departments),
                  ]}
                  searchPlaceholder="Pesquisar departamento…"
                  value={selectedDepartmentId || ALL}
                />
              </FormField>

              <FormField htmlFor="sector-filter" label="Setor">
                <SearchableSelect
                  disabled={!selectedDepartmentId}
                  id="sector-filter"
                  name="sector"
                  onValueChange={(value) =>
                    updateFilter(
                      "unitId",
                      value === ALL ? selectedDepartmentId : value,
                    )
                  }
                  options={[
                    {
                      label: !selectedDepartmentId
                        ? "Selecione primeiro o departamento"
                        : "Todos os setores",
                      value: ALL,
                    },
                    ...unitOptions(sectors),
                  ]}
                  searchPlaceholder="Pesquisar setor…"
                  value={selectedSectorId || ALL}
                />
              </FormField>

              <FormField htmlFor="subsector-filter" label="Subsetor">
                <SearchableSelect
                  disabled={!selectedSectorId || subsectors.length === 0}
                  id="subsector-filter"
                  name="subsector"
                  onValueChange={(value) =>
                    updateFilter(
                      "unitId",
                      value === ALL ? selectedSectorId : value,
                    )
                  }
                  options={[
                    {
                      label: !selectedSectorId
                        ? "Selecione primeiro o setor"
                        : subsectors.length === 0
                          ? "Este setor não possui subsetores"
                          : "Todos os subsetores",
                      value: ALL,
                    },
                    ...unitOptions(subsectors),
                  ]}
                  searchPlaceholder="Pesquisar subsetor…"
                  value={selectedSubsectorId || ALL}
                />
              </FormField>
            </div>
          </div>
        </CardContent>

        {loading ? (
          <TableSkeleton
            ariaLabel="Carregando bens"
            headers={["Tombo", "Material", "Localização", "Valor", "Situação"]}
            rows={Math.min(currentPageSize, 8)}
          />
        ) : assets.length === 0 ? (
          <EmptyState
            description={
              hasFilters
                ? "Ajuste ou limpe os filtros para ampliar a consulta."
                : "Ainda não existem bens patrimoniais cadastrados."
            }
            title={
              hasFilters ? "Nenhum bem encontrado" : "Nenhum bem cadastrado"
            }
          />
        ) : (
          <>
            <Table aria-label="Bens patrimoniais">
              <thead>
                <tr>
                  <SortHead
                    direction={sortDirection}
                    field="patrimonyNumber"
                    label="Tombo"
                    onSort={updateSort}
                    sortBy={sortBy}
                  />
                  <SortHead
                    direction={sortDirection}
                    field="description"
                    label="Material"
                    onSort={updateSort}
                    sortBy={sortBy}
                  />
                  <TableHead>Localização</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Marca / modelo
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Nº série
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Documento
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Empenho
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Conservação
                  </TableHead>
                  <SortHead
                    className="text-right"
                    direction={sortDirection}
                    field="value"
                    label="Valor"
                    onSort={updateSort}
                    sortBy={sortBy}
                  />
                  <TableHead>Situação</TableHead>
                </tr>
              </thead>

              <tbody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link
                        className="font-semibold underline-offset-4 hover:underline"
                        to={`/patrimonio/bens/${asset.id}`}
                      >
                        {asset.patrimonyNumber}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div className="max-w-[320px]">{asset.description}</div>
                    </TableCell>

                    <TableCell>{getAssetLocation(asset.unitId)}</TableCell>

                    <TableCell className="hidden xl:table-cell">
                      {formatBrandModel(asset.brand, asset.model)}
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      {asset.serialNumber ?? "—"}
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      {formatDocument(asset.documentNumber, asset.documentDate)}
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      {asset.commitmentNumber ?? "—"}
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      {asset.conservationStatus ?? "—"}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatCurrency(asset.acquisitionValue)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={assetStatusMeta[asset.status].variant}>
                        {assetStatusMeta[asset.status].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>

            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
              <p aria-live="polite">
                {first}–{last} de {total} {itemLabel}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <label className="font-medium" htmlFor="asset-page-size">
                  Itens por página
                </label>

                <Select
                  className="min-h-9 w-20"
                  id="asset-page-size"
                  name="pageSize"
                  onValueChange={changePageSize}
                  options={["10", "20", "50"].map((size) => ({
                    label: size,
                    value: size,
                  }))}
                  value={String(currentPageSize)}
                />

                <span className="min-w-16 text-center">
                  Página {currentPage} de {totalPages}
                </span>

                <Button
                  aria-label="Página anterior"
                  disabled={currentPage <= 1}
                  onClick={() => changePage(currentPage - 1)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>

                <Button
                  aria-label="Próxima página"
                  disabled={currentPage >= totalPages}
                  onClick={() => changePage(currentPage + 1)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function formatBrandModel(brand: string | null, model: string | null) {
  if (!brand && !model) {
    return "—";
  }

  if (brand && model) {
    return `${brand} / ${model}`;
  }

  return brand ?? model ?? "—";
}

function formatDocument(number: string | null, date: string | null) {
  if (!number && !date) {
    return "—";
  }

  if (number && date) {
    return `${number} - ${formatDate(date)}`;
  }

  return number ?? formatDate(date);
}

function SortHead({
  className,
  direction,
  field,
  label,
  onSort,
  sortBy,
}: {
  className?: string;
  direction: string;
  field: string;
  label: string;
  onSort: (field: string) => void;
  sortBy: string;
}) {
  const active = sortBy === field;

  return (
    <TableHead
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={className}
    >
      <button
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 font-[inherit] uppercase tracking-[inherit] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
        onClick={() => onSort(field)}
        type="button"
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <CaretUp aria-hidden="true" size={12} weight="bold" />
          ) : (
            <CaretDown aria-hidden="true" size={12} weight="bold" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}
