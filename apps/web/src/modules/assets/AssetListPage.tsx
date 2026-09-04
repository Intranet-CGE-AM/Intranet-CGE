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
              Bens cadastrados
            </h2>

            <p className="text-xs text-[var(--text-muted)]">
              {assets.length} bem(ns)
              encontrado(s).
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              Carregando bens...
            </p>
          ) : assets.length ===
            0 ? (
            <EmptyState
              description="Ainda não existem bens patrimoniais cadastrados."
              title="Nenhum bem cadastrado"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <TableHead>
                      Tombo
                    </TableHead>

                    <TableHead>
                      Material
                    </TableHead>

                    <TableHead>
                      Setor
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
                      Valor
                    </TableHead>

                    <TableHead>
                      Situação
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {assets.map(
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