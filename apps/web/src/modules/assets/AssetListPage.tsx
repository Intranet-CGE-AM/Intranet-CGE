import type {
  Asset,
} from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import {
  ArrowClockwise,
  PlusCircle,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router";

import {
  api,
  ApiError,
} from "../../lib/api";

type OrganizationUnit = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  active: boolean;
};

type OrganizationUnitsResponse = {
  units: OrganizationUnit[];
};

const assetStatusLabels = {
  active: "Em uso",
  maintenance: "Em manutenção",
  disposed: "Baixado",
} as const;

export function AssetListPage() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const selectedUnitId =
    searchParams.get(
      "unitId",
    );
  const selectedConservationStatus =
    searchParams.get(
      "conservationStatus",
    );

  const searchTerm =
    searchParams.get(
      "q",
    ) ?? "";

  const [
    assets,
    setAssets,
  ] = useState<Asset[]>([]);

  const [
    units,
    setUnits,
  ] = useState<OrganizationUnit[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const unitsById =
    useMemo(
      () =>
        new Map(
          units.map(
            (unit) => [
              unit.id,
              unit,
            ],
          ),
        ),
      [units],
    );

  const selectedStatus =
    searchParams.get(
      "status",
    );

  const sortBy =
    searchParams.get(
      "sortBy",
    ) ?? "patrimonyNumber";

  const sortDirection =
    searchParams.get(
      "sortDirection",
    ) ?? "asc";
  const currentPage =
    Math.max(
      1,
      Number(
        searchParams.get(
          "page",
        ) ?? "1",
      ),
    );

  const pageSize =
    Math.max(
      1,
      Number(
        searchParams.get(
          "pageSize",
        ) ?? "10",
      ),
    );


  const filteredAssets =
    useMemo(
      () => {
        const normalizedSearch =
          searchTerm
            .trim()
            .toLowerCase();

        return assets.filter(
          (asset) => {
            if (
              normalizedSearch &&
              !asset.patrimonyNumber
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ) &&
              !asset.description
                .toLowerCase()
                .includes(
                  normalizedSearch,
                )
            ) {
              return false;
            }

            if (
              selectedUnitId &&
              asset.unitId !==
              selectedUnitId
            ) {
              return false;
            }

            if (
              selectedConservationStatus &&
              asset.conservationStatus !==
              selectedConservationStatus
            ) {
              return false;
            }

            if (
              selectedStatus &&
              asset.status !==
              selectedStatus
            ) {
              return false;
            }

            return true;
          },
        );
      },
      [
        assets,
        searchTerm,
        selectedUnitId,
        selectedConservationStatus,
        selectedStatus,
      ],
    );

  const sortedAssets =
    useMemo(() => {
      const direction =
        sortDirection ===
          "desc"
          ? -1
          : 1;

      return [
        ...filteredAssets,
      ].sort(
        (
          first,
          second,
        ) => {
          switch (
          sortBy
          ) {
            case "description":
              return (
                first.description.localeCompare(
                  second.description,
                  "pt-BR",
                ) *
                direction
              );

            case "unit": {
              const firstUnit =
                first.unitId
                  ? unitsById.get(
                    first.unitId,
                  )
                  : null;

              const secondUnit =
                second.unitId
                  ? unitsById.get(
                    second.unitId,
                  )
                  : null;

              const firstName =
                firstUnit
                  ? `${firstUnit.code} ${firstUnit.name}`
                  : "";

              const secondName =
                secondUnit
                  ? `${secondUnit.code} ${secondUnit.name}`
                  : "";

              return (
                firstName.localeCompare(
                  secondName,
                  "pt-BR",
                ) *
                direction
              );
            }

            case "value": {
              const firstValue =
                Number(
                  first.acquisitionValue ??
                  0,
                );

              const secondValue =
                Number(
                  second.acquisitionValue ??
                  0,
                );

              return (
                (firstValue -
                  secondValue) *
                direction
              );
            }

            case "patrimonyNumber":
            default:
              return (
                first.patrimonyNumber.localeCompare(
                  second.patrimonyNumber,
                  "pt-BR",
                  {
                    numeric:
                      true,
                  },
                ) *
                direction
              );
          }
        },
      );
    }, [
      filteredAssets,
      sortBy,
      sortDirection,
      unitsById,
    ]);

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          sortedAssets.length /
            pageSize,
        ),
      );

    const safeCurrentPage =
      Math.min(
        currentPage,
        totalPages,
      );

    const paginatedAssets =
      useMemo(() => {
        const start =
          (safeCurrentPage - 1) *
          pageSize;

        const end =
          start +
          pageSize;

        return sortedAssets.slice(
          start,
          end,
        );
      }, [
        sortedAssets,
        safeCurrentPage,
        pageSize,
      ]);

  const selectedStatusLabel =
    selectedStatus
      ? assetStatusLabels[
      selectedStatus as keyof typeof assetStatusLabels
      ] ?? null
      : null;

  const selectedUnit =
    selectedUnitId
      ? unitsById.get(
        selectedUnitId,
      ) ?? null
      : null;

  function updateFilter(
    key: string,
    value: string,
  ) {
    const next =
      new URLSearchParams(
        searchParams,
      );

    if (value) {
      next.set(
        key,
        value,
      );
    } else {
      next.delete(
        key,
      );
    }

    next.set(
      "page",
      "1",
    );

    setSearchParams(
      next,
    );
  }

function changePage(
  page: number,
) {
  const next =
    new URLSearchParams(
      searchParams,
    );

  next.set(
    "page",
    String(page),
  );

  setSearchParams(
    next,
  );
}

  function changePageSize(
    value: string,
  ) {
    const next =
      new URLSearchParams(
        searchParams,
      );

    next.set(
      "pageSize",
      value,
    );

    next.set(
      "page",
      "1",
    );

    setSearchParams(
      next,
    );
  }

  function updateSort(
    field: string,
  ) {
    const next =
      new URLSearchParams(
        searchParams,
      );

    const currentField =
      next.get(
        "sortBy",
      );

    const currentDirection =
      next.get(
        "sortDirection",
      ) ?? "asc";

    if (
      currentField ===
      field
    ) {
      next.set(
        "sortDirection",
        currentDirection ===
          "asc"
          ? "desc"
          : "asc",
      );
    } else {
      next.set(
        "sortBy",
        field,
      );

      next.set(
        "sortDirection",
        "asc",
      );

      next.set(
        "page",
        "1",
      );
    }

    setSearchParams(
      next,
    );
  }

  

  const loadData =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const [
          assetResult,
          unitResult,
        ] =
          await Promise.all([
            api<Asset[]>(
              "/api/assets",
            ),

            api<OrganizationUnitsResponse>(
              "/api/organization-units",
            ),
          ]);

        setAssets(
          assetResult,
        );

        setUnits(
          unitResult.units,
        );
      } catch (cause) {
        if (
          cause instanceof
          ApiError
        ) {
          setError(
            cause.message,
          );
        } else {
          setError(
            "Não foi possível carregar os bens patrimoniais.",
          );
        }
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-extrabold md:text-[30px]">
            Bens Patrimoniais
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            Consulte os bens
            patrimoniais cadastrados.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            disabled={loading}
            onClick={() =>
              void loadData()
            }
            type="button"
            variant="secondary"
          >
            <ArrowClockwise
              size={18}
            />

            Atualizar
          </Button>

          <Button asChild>
            <Link
              to="/patrimonio/bens/novo"
            >
              <PlusCircle
                size={18}
              />

              Novo bem
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="Não foi possível carregar os bens"
        >
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Filtros
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              Localize bens por tombo,
              material, situação ou setor.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
                htmlFor="asset-search"
              >
                Tombo / Material
              </label>

              <Input
                id="asset-search"
                value={
                  searchTerm
                }
                onChange={(
                  event,
                ) =>
                  updateFilter(
                    "q",
                    event.target.value,
                  )
                }
                placeholder="Ex.: 335 ou Notebook"
              />
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
                htmlFor="status-filter"
              >
                Situação
              </label>

              <select
                id="status-filter"
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                value={
                  selectedStatus ?? ""
                }
                onChange={(
                  event,
                ) =>
                  updateFilter(
                    "status",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Todas
                </option>

                <option value="active">
                  Em uso
                </option>

                <option value="maintenance">
                  Em manutenção
                </option>

                <option value="disposed">
                  Baixados
                </option>
              </select>
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
                htmlFor="unit-filter"
              >
                Setor / Localização
              </label>

              <select
                id="unit-filter"
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                value={
                  selectedUnitId ?? ""
                }
                onChange={(
                  event,
                ) =>
                  updateFilter(
                    "unitId",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Todos os setores
                </option>

                {units.map(
                  (unit) => (
                    <option
                      key={
                        unit.id
                      }
                      value={
                        unit.id
                      }
                    >
                      {unit.code} -{" "}
                      {unit.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                type="button"
                variant="secondary"
                onClick={() =>
                  setSearchParams(
                    {},
                  )
                }
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <div>
            <h2 className="font-medium">
              Bens cadastrados
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              {filteredAssets.length}{" "}
              bem(ns) encontrado(s).
            </p>
          </div>

          {selectedUnit ||
            selectedConservationStatus ||
            selectedStatusLabel ? (
            <Button
              onClick={() => {
                setSearchParams({});
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {selectedUnit
                ? selectedUnit.code
                : selectedConservationStatus
                  ? selectedConservationStatus
                  : selectedStatusLabel}

              {" · "}
              Limpar filtro
            </Button>
          ) : null}
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              Carregando bens...
            </p>
          ) : filteredAssets.length ===
            0 ? (
            <EmptyState
              description={
                selectedUnit
                  ? `Não existem bens vinculados ao setor ${selectedUnit.code} - ${selectedUnit.name}.`
                  : selectedConservationStatus
                    ? `Não existem bens com estado de conservação "${selectedConservationStatus}".`
                    : selectedStatusLabel
                      ? `Não existem bens com situação "${selectedStatusLabel}".`
                      : "Ainda não existem bens patrimoniais cadastrados."
              }
              title={
                selectedUnit ||
                  selectedConservationStatus ||
                  selectedStatusLabel
                  ? "Nenhum bem encontrado"
                  : "Nenhum bem cadastrado"
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() =>
                          updateSort(
                            "patrimonyNumber",
                          )
                        }
                      >
                        Tombo

                        {sortBy ===
                          "patrimonyNumber"
                          ? sortDirection ===
                            "asc"
                            ? "↑"
                            : "↓"
                          : null}
                      </button>
                    </TableHead>

                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() =>
                          updateSort(
                            "description",
                          )
                        }
                      >
                        Material

                        {sortBy ===
                          "description"
                          ? sortDirection ===
                            "asc"
                            ? "↑"
                            : "↓"
                          : null}
                      </button>
                    </TableHead>

                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() =>
                          updateSort(
                            "unit",
                          )
                        }
                      >
                        Setor

                        {sortBy ===
                          "unit"
                          ? sortDirection ===
                            "asc"
                            ? "↑"
                            : "↓"
                          : null}
                      </button>
                    </TableHead>

                    <TableHead>
                      Sala
                    </TableHead>

                    <TableHead>
                      Marca / Modelo
                    </TableHead>

                    <TableHead>
                      Nº Série
                    </TableHead>

                    <TableHead>
                      Documento
                    </TableHead>

                    <TableHead>
                      Empenho
                    </TableHead>

                    <TableHead>
                      Conservação
                    </TableHead>

                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() =>
                          updateSort(
                            "value",
                          )
                        }
                      >
                        Valor

                        {sortBy ===
                          "value"
                          ? sortDirection ===
                            "asc"
                            ? "↑"
                            : "↓"
                          : null}
                      </button>
                    </TableHead>

                    <TableHead>
                      Situação
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                 {paginatedAssets.map(
                    (asset) => {
                      const unit =
                        asset.unitId
                          ? unitsById.get(
                            asset.unitId,
                          )
                          : null;

                      return (
                        <TableRow
                          key={
                            asset.id
                          }
                        >
                          {/* <TableCell>
                            <strong>
                              {
                                asset.patrimonyNumber
                              }
                            </strong>
                          </TableCell> */}
                          <TableCell>
                            <Link
                              className="font-semibold underline-offset-4 hover:underline"
                              to={`/patrimonio/bens/${asset.id}`}
                            >
                              {asset.patrimonyNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[320px]">
                              {
                                asset.description
                              }
                            </div>
                          </TableCell>

                          <TableCell>
                            {unit
                              ? `${unit.code} - ${unit.name}`
                              : "—"}
                          </TableCell>

                          <TableCell>
                            {asset.room ??
                              "—"}
                          </TableCell>

                          <TableCell>
                            {formatBrandModel(
                              asset.brand,
                              asset.model,
                            )}
                          </TableCell>

                          <TableCell>
                            {asset.serialNumber ??
                              "—"}
                          </TableCell>

                          <TableCell>
                            {formatDocument(
                              asset.documentNumber,
                              asset.documentDate,
                            )}
                          </TableCell>

                          <TableCell>
                            {asset.commitmentNumber ??
                              "—"}
                          </TableCell>

                          <TableCell>
                            {asset.conservationStatus ??
                              "—"}
                          </TableCell>

                          <TableCell>
                            {formatCurrency(
                              asset.acquisitionValue,
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge variant="neutral">
                              {
                                assetStatusLabels[
                                asset.status
                                ]
                              }
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    },
                  )}
                </tbody>
              </Table>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--text-muted)]">
                Página{" "}
                {safeCurrentPage} de{" "}
                {totalPages}
                {" · "}
                {sortedAssets.length}{" "}
                bem(ns)
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  value={
                    String(
                      pageSize,
                    )
                  }
                  onChange={(
                    event,
                  ) =>
                    changePageSize(
                      event.target.value,
                    )
                  }
                >
                  <option value="10">
                    10 por página
                  </option>

                  <option value="20">
                    20 por página
                  </option>

                  <option value="50">
                    50 por página
                  </option>
                </select>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    safeCurrentPage <=
                    1
                  }
                  onClick={() =>
                    changePage(
                      safeCurrentPage -
                        1,
                    )
                  }
                >
                  Anterior
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    safeCurrentPage >=
                    totalPages
                  }
                  onClick={() =>
                    changePage(
                      safeCurrentPage +
                        1,
                    )
                  }
                >
                  Próxima
                </Button>
              </div>
            </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatBrandModel(
  brand: string | null,
  model: string | null,
) {
  if (
    !brand &&
    !model
  ) {
    return "—";
  }

  if (
    brand &&
    model
  ) {
    return `${brand} / ${model}`;
  }

  return brand ?? model ?? "—";
}

function formatDocument(
  number: string | null,
  date: string | null,
) {
  if (
    !number &&
    !date
  ) {
    return "—";
  }

  if (
    number &&
    date
  ) {
    return `${number} - ${formatDate(
      date,
    )}`;
  }

  return (
    number ??
    formatDate(date)
  );
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const [
    year,
    month,
    day,
  ] = value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatCurrency(
  value:
    | number
    | string
    | null,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number =
    Number(value);

  if (
    Number.isNaN(number)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(number);
}