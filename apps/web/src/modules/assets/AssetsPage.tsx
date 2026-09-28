import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DashboardBanner,
  EmptyState,
  Skeleton,
} from "@cge/ui";

import { ArrowRight } from "@phosphor-icons/react";

import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router";

import { api, ApiError } from "../../lib/api";

import {
  assetStatusMeta,
  formatCurrency,
  formatDate,
  PageHeader,
} from "./shared";

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
    path: string | null;
  } | null;

  toUnit: {
    id: string;
    code: string;
    name: string;
    path: string | null;
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
    assetsWithValueCount: number;
    averageValue: number;
  };

  byUnit: DashboardUnit[];
  byConservation: DashboardConservation[];
  recentMovements: DashboardMovement[];
  recentDisposals: DashboardDisposal[];
};

export function AssetsPage() {
  const [dashboard, setDashboard] = useState<AssetsDashboardResponse | null>(
    null,
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await api<AssetsDashboardResponse>(
        "/api/assets/dashboard",
      );

      setDashboard(result);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar o painel de patrimônio.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const total = dashboard?.summary.total ?? 0;

  const active = dashboard?.summary.active ?? 0;

  const maintenance = dashboard?.summary.maintenance ?? 0;

  const disposed = dashboard?.summary.disposed ?? 0;

  const totalValue = dashboard?.summary.totalValue ?? 0;

  const assetsWithValueCount = dashboard?.summary.assetsWithValueCount ?? 0;

  const averageValue = dashboard?.summary.averageValue ?? 0;

  const activePercentage = total > 0 ? Math.round((active / total) * 100) : 0;

  const maintenancePercentage =
    total > 0 ? Math.round((maintenance / total) * 100) : 0;

  const disposedPercentage =
    total > 0 ? Math.round((disposed / total) * 100) : 0;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/patrimonio/bens/novo">Novo bem</Link>
          </Button>
        }
        description="Acompanhe bens, valores, conservação e movimentações."
        title="Visão geral do patrimônio"
      />

      {error ? (
        <Alert title="Painel indisponível" tone="danger">
          <p>{error}</p>
          <Button
            className="mt-3"
            onClick={() => void loadDashboard()}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      {/* BANNER */}

      <DashboardBanner
        action={
          <Button asChild size="sm" variant="quiet">
            <Link to="/patrimonio/bens">
              Consultar bens
              <ArrowRight aria-hidden="true" size={16} />
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
            `${total} ${total === 1 ? "bem cadastrado" : "bens cadastrados"}`
          )
        }
      />

      {/* CONTEÚDO PRINCIPAL */}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* COLUNA ESQUERDA */}

        <div className="space-y-5">
          {/* SITUAÇÃO DOS BENS */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Situação dos bens</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Distribuição atual dos bens patrimoniais
                </p>
              </div>
            </CardHeader>

            {!loading && total > 0 ? (
              <div className="px-5 pb-2">
                <div className="flex h-9 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div
                    className="flex min-w-0 items-center justify-center overflow-hidden px-1 text-center text-[11px] font-semibold text-white"
                    style={{
                      width: `${activePercentage}%`,
                      backgroundColor: "var(--brand)",
                    }}
                    title={`${assetStatusMeta.active.label}: ${activePercentage}%`}
                  >
                    <span className="truncate">
                      {assetStatusMeta.active.label} {activePercentage}%
                    </span>
                  </div>

                  <div
                    className="flex min-w-0 items-center justify-center overflow-hidden px-1 text-center text-[11px] font-semibold text-white"
                    style={{
                      width: `${maintenancePercentage}%`,
                      backgroundColor: "var(--warning-strong)",
                    }}
                    title={`${assetStatusMeta.maintenance.label}: ${maintenancePercentage}%`}
                  >
                    <span className="truncate">
                      Manut. {maintenancePercentage}%
                    </span>
                  </div>

                  <div
                    className="flex min-w-0 items-center justify-center overflow-hidden px-1 text-center text-[11px] font-semibold text-white"
                    style={{
                      width: `${disposedPercentage}%`,
                      backgroundColor: "var(--danger)",
                    }}
                    title={`Baixados: ${disposedPercentage}%`}
                  >
                    <span className="truncate">
                      Baix. {disposedPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <CardContent className="divide-y divide-[var(--border)] p-0">
              <Link
                to="/patrimonio/bens"
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Total de bens</p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Todos os bens cadastrados
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <div className="flex items-center gap-2">
                    <strong className="text-2xl font-extrabold tabular-nums">
                      {total}
                    </strong>

                    <ArrowRight
                      aria-hidden="true"
                      size={15}
                      className="text-[var(--text-faint)]"
                    />
                  </div>
                )}
              </Link>

              {/* Filtro de "Em uso"  */}
              <Link
                to="/patrimonio/bens?status=active"
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {assetStatusMeta.active.label}
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Bens ativos em utilização
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <strong className="block text-2xl font-extrabold tabular-nums">
                        {active}
                      </strong>

                      <span className="text-xs font-semibold text-[var(--text-faint)]">
                        {activePercentage}%
                      </span>
                    </div>

                    <ArrowRight
                      aria-hidden="true"
                      size={15}
                      className="text-[var(--text-faint)]"
                    />
                  </div>
                )}
              </Link>

              {/* Filtro de "Em manutenção"      */}
              <Link
                to="/patrimonio/bens?status=maintenance"
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {assetStatusMeta.maintenance.label}
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Bens temporariamente indisponíveis
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <strong className="block text-2xl font-extrabold tabular-nums">
                        {maintenance}
                      </strong>

                      <span className="text-xs font-semibold text-[var(--text-faint)]">
                        {maintenancePercentage}%
                      </span>
                    </div>

                    <ArrowRight
                      aria-hidden="true"
                      size={15}
                      className="text-[var(--text-faint)]"
                    />
                  </div>
                )}
              </Link>

              {/* Filtro de "Baixados" */}
              <Link
                to="/patrimonio/bens?status=disposed"
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Baixados</p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Bens com baixa patrimonial
                  </p>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <strong className="block text-2xl font-extrabold tabular-nums">
                        {disposed}
                      </strong>

                      <span className="text-xs font-semibold text-[var(--text-faint)]">
                        {disposedPercentage}%
                      </span>
                    </div>

                    <ArrowRight
                      aria-hidden="true"
                      size={15}
                      className="text-[var(--text-faint)]"
                    />
                  </div>
                )}
              </Link>
            </CardContent>
          </Card>

          {/* BENS POR SETOR */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Bens por setor</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Distribuição dos bens por setor, incluindo seus subsetores
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
              ) : dashboard && dashboard.byUnit.length ? (
                <div className="space-y-1">
                  {dashboard.byUnit.map((unit) => {
                    const maxTotal = Math.max(
                      ...dashboard.byUnit.map((item) => item.total),
                      1,
                    );

                    const percentage = (unit.total / maxTotal) * 100;

                    return (
                      <Link
                        key={unit.unitId}
                        to={`/patrimonio/bens?unitId=${unit.unitId}`}
                        className="block rounded-md py-3 transition hover:bg-[var(--surface-subtle)] first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">
                              {unit.code || unit.name || "Unidade"}
                            </p>

                            {unit.code && unit.name ? (
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
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

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  description="Nenhum bem vinculado à estrutura organizacional."
                  title="Nenhum bem por setor"
                />
              )}
            </CardContent>
          </Card>

          {/* ACESSO RÁPIDO */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Acesso rápido</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Ações frequentes do patrimônio
                </p>
              </div>
            </CardHeader>

            <CardContent className="divide-y divide-[var(--border)] p-0">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Consultar bens</p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Visualize o patrimônio cadastrado
                  </p>
                </div>

                <Button asChild size="sm" variant="secondary">
                  <Link to="/patrimonio/bens">Abrir</Link>
                </Button>
              </div>

              <div className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Cadastrar novo bem</p>

                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Adicione um bem ao patrimônio
                  </p>
                </div>

                <Button asChild size="sm" variant="secondary">
                  <Link to="/patrimonio/bens/novo">Cadastrar</Link>
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
                <h2 className="font-bold">Valor patrimonial</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Valor total dos bens cadastrados
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  {loading ? (
                    <Skeleton className="h-10 w-48" />
                  ) : (
                    <p className="text-2xl font-extrabold tabular-nums">
                      {formatCurrency(totalValue)}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Valor total cadastrado
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Bens com valor informado
                  </p>

                  {loading ? (
                    <Skeleton className="mt-2 h-7 w-12" />
                  ) : (
                    <p className="mt-1 text-xl font-extrabold tabular-nums">
                      {assetsWithValueCount}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Valor médio por bem
                  </p>

                  {loading ? (
                    <Skeleton className="mt-2 h-7 w-28" />
                  ) : (
                    <p className="mt-1 text-xl font-extrabold tabular-nums">
                      {formatCurrency(averageValue)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CONSERVAÇÃO */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Conservação</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Estado de conservação dos bens
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
              ) : dashboard && dashboard.byConservation.length ? (
                <div className="space-y-1">
                  {dashboard.byConservation.map((conservation) => {
                    const maxTotal = Math.max(
                      ...dashboard.byConservation.map((item) => item.total),
                      1,
                    );

                    const percentage = (conservation.total / maxTotal) * 100;

                    return (
                      <Link
                        key={conservation.status}
                        to={`/patrimonio/bens?conservationStatus=${encodeURIComponent(
                          conservation.status,
                        )}`}
                        className="block rounded-md py-3 transition hover:bg-[var(--surface-subtle)] first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-semibold">
                            {conservation.status}
                          </span>

                          <div className="flex items-center gap-2">
                            <strong className="text-lg font-extrabold tabular-nums">
                              {conservation.total}
                            </strong>

                            <ArrowRight
                              aria-hidden="true"
                              size={14}
                              className="text-[var(--text-faint)]"
                            />
                          </div>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  description="Nenhuma informação de conservação cadastrada."
                  title="Sem dados de conservação"
                />
              )}
            </CardContent>
          </Card>

          {/* MOVIMENTAÇÕES */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Movimentações recentes</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Últimas transferências entre unidades organizacionais
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
              ) : dashboard && dashboard.recentMovements.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {dashboard.recentMovements.map((movement) => (
                    <Link
                      key={movement.id}
                      to={`/patrimonio/bens/${movement.assetId}`}
                      className="flex items-center gap-3 rounded-md py-3 transition hover:bg-[var(--surface-subtle)] first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {movement.patrimonyNumber || "Sem patrimônio"}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {movement.fromUnit?.path ||
                            movement.fromUnit?.code ||
                            "Sem localização"}
                          {" → "}
                          {movement.toUnit?.path ||
                            movement.toUnit?.code ||
                            "Sem localização"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-[var(--text-faint)]">
                          {formatDate(movement.movementDate)}
                        </span>

                        <ArrowRight
                          aria-hidden="true"
                          size={14}
                          className="text-[var(--text-faint)]"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Nenhuma movimentação registrada."
                  title="Nenhuma movimentação"
                />
              )}
            </CardContent>
          </Card>

          {/* BAIXAS */}

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Baixas recentes</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Últimas baixas patrimoniais realizadas
                </p>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : dashboard && dashboard.recentDisposals.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {dashboard.recentDisposals.map((disposal) => (
                    <Link
                      key={disposal.id}
                      to={`/patrimonio/bens/${disposal.assetId}`}
                      className="flex items-start gap-3 rounded-md py-3 transition hover:bg-[var(--surface-subtle)] first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {disposal.patrimonyNumber || "Sem patrimônio"}
                        </p>

                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {disposal.reason}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-[var(--text-faint)]">
                          {formatDate(disposal.disposalDate)}
                        </span>

                        <ArrowRight
                          aria-hidden="true"
                          size={14}
                          className="text-[var(--text-faint)]"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Nenhuma baixa patrimonial registrada."
                  title="Nenhuma baixa"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
