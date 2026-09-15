import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DashboardBanner,
  Skeleton,
} from "@cge/ui";

import {
  ArrowRight,
  ArrowsLeftRight,
  CurrencyDollar,
  Package,
  PlusCircle,
  Wrench,
  XCircle,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Link } from "react-router";

import {
  api,
  ApiError,
} from "../../lib/api";

type DashboardUnit = {
  unitId: string;
  code: string | null;
  name: string | null;
  total: number;
};

type DashboardConservation = {
  status: string;
  total: number;
};

type DashboardMovement = {
  id: string;
  assetId: string;
  patrimonyNumber: string | null;
  movementDate: string;

  fromUnit: {
    id: string;
    code: string;
    name: string;
  } | null;

  toUnit: {
    id: string;
    code: string;
    name: string;
  } | null;
};

type DashboardDisposal = {
  id: string;
  assetId: string;
  patrimonyNumber: string | null;
  disposalDate: string;
  reason: string;
};

type AssetsDashboardResponse = {
  summary: {
    total: number;
    active: number;
    maintenance: number;
    disposed: number;
    totalValue: number;
  };

  byUnit: DashboardUnit[];
  byConservation: DashboardConservation[];
  recentMovements: DashboardMovement[];
  recentDisposals: DashboardDisposal[];
};

function formatCurrency(
  value: number,
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(value);
}

function formatDate(
  value: string,
) {
  if (!value) {
    return "-";
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

export function AssetsPage() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<AssetsDashboardResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadDashboard =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const result =
            await api<AssetsDashboardResponse>(
              "/api/assets/dashboard",
            );

          setDashboard(result);
        } catch (cause) {
          setError(
            cause instanceof
              ApiError
              ? cause.message
              : "Não foi possível carregar o painel de patrimônio.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const total =
    dashboard?.summary.total ??
    0;

  const active =
    dashboard?.summary.active ??
    0;

  const maintenance =
    dashboard?.summary
      .maintenance ?? 0;

  const disposed =
    dashboard?.summary
      .disposed ?? 0;

  const totalValue =
    dashboard?.summary
      .totalValue ?? 0;

  return (
    <div className="page-enter space-y-5 pb-6">
      {/* CABEÇALHO */}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Controle de Patrimônio
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
            Visão geral do patrimônio
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe bens, valores,
            conservação e movimentações.
          </p>
        </div>

        <p className="text-xs font-semibold capitalize text-[var(--text-faint)]">
          {new Intl.DateTimeFormat(
            "pt-BR",
            {
              weekday: "long",
              day: "2-digit",
              month: "long",
            },
          ).format(
            new Date(),
          )}
        </p>
      </div>

      {/* ERRO */}

      {error ? (
        <Alert
          title="Painel indisponível"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      {/* BANNER */}

      <DashboardBanner
        action={
          <Button
            asChild
            size="sm"
            variant="quiet"
          >
            <Link
              className="!min-h-0 !justify-start !p-0 text-[var(--brand)] hover:!bg-transparent"
              to="/patrimonio/bens"
            >
              Consultar bens

              <ArrowRight
                aria-hidden="true"
                size={15}
                weight="bold"
              />
            </Link>
          </Button>
        }
        artwork={
          <img
            alt=""
            className="h-full w-full origin-right scale-[1.28] object-contain object-right"
            src="/assets/dashboard/patrimonio-workspace.webp"
          />
        }
        description={
          loading
            ? "Carregando informações do patrimônio."
            : `${formatCurrency(
                totalValue,
              )} em patrimônio cadastrado na instituição.`
        }
        eyebrow="Resumo patrimonial"
        title={
          loading ? (
            <Skeleton className="h-8 w-56" />
          ) : (
            `${total} ${
              total === 1
                ? "bem cadastrado"
                : "bens cadastrados"
            }`
          )
        }
      />

      {/* CONTEÚDO PRINCIPAL */}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* COLUNA ESQUERDA */}

        <div className="space-y-5">
          {/* SITUAÇÃO DOS BENS */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Situação dos bens
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Distribuição atual dos
                  bens patrimoniais
                </p>
              </div>

              <Button
                asChild
                size="sm"
                variant="quiet"
              >
                <Link to="/patrimonio/bens">
                  Ver bens

                  <ArrowRight
                    aria-hidden="true"
                    size={15}
                  />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="divide-y divide-[var(--border)] p-0">
              <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  <Package
                    aria-hidden="true"
                    size={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Total de bens
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Todos os bens
                    cadastrados
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <strong className="text-2xl font-extrabold tabular-nums">
                    {total}
                  </strong>
                )}
              </div>

              <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  <Package
                    aria-hidden="true"
                    size={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Em uso
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Bens ativos em
                    utilização
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <strong className="text-2xl font-extrabold tabular-nums">
                    {active}
                  </strong>
                )}
              </div>

              <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  <Wrench
                    aria-hidden="true"
                    size={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Em manutenção
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Bens temporariamente
                    indisponíveis
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <strong className="text-2xl font-extrabold tabular-nums">
                    {maintenance}
                  </strong>
                )}
              </div>

              <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  <XCircle
                    aria-hidden="true"
                    size={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Baixados
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Bens com baixa
                    patrimonial
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <strong className="text-2xl font-extrabold tabular-nums">
                    {disposed}
                  </strong>
                )}
              </div>
            </CardContent>
          </Card>

          {/* BENS POR SETOR */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Bens por setor
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Distribuição dos bens
                  por unidade
                </p>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : dashboard &&
                dashboard.byUnit
                  .length ? (
                <div className="space-y-1">
                  {dashboard.byUnit.map(
                  (unit) => {
                    const maxTotal =
                      Math.max(
                        ...dashboard.byUnit.map(
                          (item) =>
                            item.total,
                        ),
                        1,
                      );

                    const percentage =
                      (unit.total /
                        maxTotal) *
                      100;

                    return (
                      <Link
                        key={unit.unitId}
                        to={`/patrimonio/bens?unitId=${unit.unitId}`}
                        className="block rounded-md py-3 transition hover:bg-[var(--surface-muted)] first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">
                              {unit.code ||
                                unit.name ||
                                "Setor"}
                            </p>

                            {unit.code &&
                            unit.name ? (
                              <p className="mt-0.5 truncate text-xs text-[var(--text-faint)]">
                                {unit.name}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <strong className="text-lg font-extrabold tabular-nums">
                              {unit.total}
                            </strong>

                            <ArrowRight
                              aria-hidden="true"
                              size={14}
                              className="text-[var(--text-faint)]"
                            />
                          </div>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </Link>
                    );
                  },
                )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhum bem vinculado
                  a setor.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ACESSO RÁPIDO */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Acesso rápido
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Ações frequentes do
                  patrimônio
                </p>
              </div>
            </CardHeader>

            <CardContent className="divide-y divide-[var(--border)] p-0">
              <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  <Package
                    aria-hidden="true"
                    size={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Consultar bens
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Visualize o patrimônio
                    cadastrado
                  </p>
                </div>

                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                >
                  <Link to="/patrimonio/bens">
                    Abrir
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  <PlusCircle
                    aria-hidden="true"
                    size={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Cadastrar novo bem
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Adicione um bem ao
                    patrimônio
                  </p>
                </div>

                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                >
                  <Link to="/patrimonio/bens/novo">
                    Cadastrar
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA */}

        <div className="space-y-5">
          {/* VALOR PATRIMONIAL */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Valor patrimonial
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Valor total dos bens
                  cadastrados
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                <CurrencyDollar
                  aria-hidden="true"
                  size={20}
                />
              </span>

              {loading ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <p className="text-3xl font-extrabold tabular-nums tracking-[-0.04em]">
                  {formatCurrency(
                    totalValue,
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* CONSERVAÇÃO */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Conservação
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Estado de conservação
                  dos bens
                </p>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : dashboard &&
                dashboard
                  .byConservation
                  .length ? (
                <div className="space-y-1">
                  {dashboard.byConservation.map(
                  (
                    conservation,
                  ) => {
                    const maxTotal =
                      Math.max(
                        ...dashboard.byConservation.map(
                          (item) =>
                            item.total,
                        ),
                        1,
                      );

                    const percentage =
                      (conservation.total /
                        maxTotal) *
                      100;

                    return (
                      <Link
                        key={
                          conservation.status
                        }
                        to={`/patrimonio/bens?conservationStatus=${encodeURIComponent(
                          conservation.status,
                        )}`}
                        className="block rounded-md py-3 transition hover:bg-[var(--surface-muted)] first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-semibold">
                            {
                              conservation.status
                            }
                          </span>

                          <div className="flex items-center gap-2">
                            <strong className="text-lg font-extrabold tabular-nums">
                              {
                                conservation.total
                              }
                            </strong>

                            <ArrowRight
                              aria-hidden="true"
                              size={14}
                              className="text-[var(--text-faint)]"
                            />
                          </div>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </Link>
                    );
                  },
                )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhuma informação de
                  conservação cadastrada.
                </p>
              )}
            </CardContent>
          </Card>

          {/* MOVIMENTAÇÕES */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Movimentações recentes
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Últimas transferências
                  entre setores
                </p>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : dashboard &&
                dashboard
                  .recentMovements
                  .length ? (
                <div className="divide-y divide-[var(--border)]">
                  {dashboard.recentMovements.map(
                    (
                      movement,
                    ) => (
                      <div
                        key={
                          movement.id
                        }
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                          <ArrowsLeftRight
                            aria-hidden="true"
                            size={
                              18
                            }
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {movement.patrimonyNumber ||
                              "Sem patrimônio"}
                          </p>

                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {movement
                              .fromUnit
                              ?.code ||
                              "Sem setor"}
                            {" → "}
                            {movement
                              .toUnit
                              ?.code ||
                              "Sem setor"}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs text-[var(--text-faint)]">
                          {formatDate(
                            movement.movementDate,
                          )}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhuma movimentação
                  registrada.
                </p>
              )}
            </CardContent>
          </Card>

          {/* BAIXAS */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Baixas recentes
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Últimas baixas
                  patrimoniais realizadas
                </p>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : dashboard &&
                dashboard
                  .recentDisposals
                  .length ? (
                <div className="divide-y divide-[var(--border)]">
                  {dashboard.recentDisposals.map(
                    (
                      disposal,
                    ) => (
                      <div
                        key={
                          disposal.id
                        }
                        className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                          <XCircle
                            aria-hidden="true"
                            size={
                              18
                            }
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {disposal.patrimonyNumber ||
                              "Sem patrimônio"}
                          </p>

                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {
                              disposal.reason
                            }
                          </p>
                        </div>

                        <span className="shrink-0 text-xs text-[var(--text-faint)]">
                          {formatDate(
                            disposal.disposalDate,
                          )}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhuma baixa
                  patrimonial registrada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}