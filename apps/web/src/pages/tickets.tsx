import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import type { TicketAnalyticsSummary, TicketSummary } from "@cge/contracts";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@cge/ui";
import {
  ArrowClockwise,
  Buildings,
  ChartBar,
  Desktop,
  Eye,
  ListBullets,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Star,
  User,
} from "@phosphor-icons/react";

import { useAuth } from "../auth";
import { TicketDetailModal } from "../components/ticket-detail-modal";
import { api } from "../lib/api";
import { canAccess } from "../lib/permissions";
import { TICKET_STATUS, ticketStatus } from "../modules/tickets/ticket-status";

type Tab = "my" | "queue" | "approvals" | "metrics";

const TABLE_HEADERS = [
  "Protocolo / data",
  "Solicitante",
  "Categoria / serviço",
  "Modalidade",
  "Técnico ATEC",
  "Status / SLA",
  "Ação",
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  ...Object.entries(TICKET_STATUS).map(([value, { label }]) => ({
    value,
    label,
  })),
];

const AREA_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "sistemas", label: "Sistemas" },
  { value: "redes", label: "Redes" },
  { value: "manutencao", label: "Manutenção" },
];

const METRIC_LABEL =
  "text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]";

export function TicketsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isStaff = user
    ? canAccess(user, { anyOf: ["tickets.attend", "tickets.manage"] })
    : false;
  const canApprove = user
    ? canAccess(user, { anyOf: ["tickets.approve", "tickets.manage"] })
    : false;

  const allowedTabs: Tab[] = [
    "my",
    ...(isStaff ? (["queue"] as const) : []),
    ...(canApprove ? (["approvals"] as const) : []),
    ...(isStaff ? (["metrics"] as const) : []),
  ];
  const requestedTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab =
    requestedTab && allowedTabs.includes(requestedTab)
      ? requestedTab
      : isStaff
        ? "queue"
        : "my";

  // Filters live in the URL so reloading or sharing keeps them.
  const searchTerm = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const areaFilter = searchParams.get("area") ?? "all";

  const updateParams = (changes: Record<string, string | null>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === "" || value === "all") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      },
      { replace: true },
    );
  };

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<TicketAnalyticsSummary | null>(
    null,
  );
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError(null);

        if (activeTab === "my") {
          const data = await api<{ tickets: TicketSummary[] }>(
            "/api/tickets/my",
          );
          setTickets(data.tickets);
        } else if (activeTab === "queue") {
          const params = new URLSearchParams();
          if (statusFilter !== "all") params.append("status", statusFilter);
          if (areaFilter !== "all") params.append("area", areaFilter);
          const url = `/api/tickets/queue${params.toString() ? `?${params.toString()}` : ""}`;
          const data = await api<{ tickets: TicketSummary[] }>(url);
          setTickets(data.tickets);
        } else if (activeTab === "approvals") {
          const data = await api<{ tickets: TicketSummary[] }>(
            "/api/tickets/approvals",
          );
          setTickets(data.tickets);
        } else if (activeTab === "metrics") {
          if (!silent) setLoadingAnalytics(true);
          const data = await api<TicketAnalyticsSummary>(
            "/api/tickets/analytics",
          );
          setAnalytics(data);
          if (!silent) setLoadingAnalytics(false);
        }
      } catch (err: unknown) {
        if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os chamados.",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeTab, statusFilter, areaFilter],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!user) {
    return null;
  }

  const handleTabChange = (tab: Tab) => {
    updateParams({ tab });
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const cleanTicketNumber = t.ticketNumber.replace(/^#+/, "");
    return (
      cleanTicketNumber.toLowerCase().includes(term) ||
      t.ticketNumber.toLowerCase().includes(term) ||
      t.requesterName.toLowerCase().includes(term) ||
      t.categoryName.toLowerCase().includes(term) ||
      (t.subcategoryName && t.subcategoryName.toLowerCase().includes(term)) ||
      (t.unitName && t.unitName.toLowerCase().includes(term))
    );
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const dateA = new Date(a.openedAt).getTime();
    const dateB = new Date(b.openedAt).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return b.ticketNumber.localeCompare(a.ticketNumber);
  });

  const hasFilters =
    searchTerm.trim() !== "" ||
    (activeTab === "queue" && (statusFilter !== "all" || areaFilter !== "all"));

  const tabs: Array<{ key: Tab; label: string; icon: typeof User }> = [
    { key: "my", label: "Meus chamados", icon: User },
    { key: "queue", label: "Fila da ATEC", icon: ListBullets },
    { key: "approvals", label: "Aprovações pendentes", icon: ShieldCheck },
    { key: "metrics", label: "Métricas e SLA", icon: ChartBar },
  ];

  const emptyCopy = hasFilters
    ? {
        title: "Nenhum resultado",
        description: "Tente outro termo de busca ou ajuste os filtros.",
      }
    : activeTab === "my"
      ? {
          title: "Nenhum chamado ainda",
          description:
            "Quando precisar de suporte de informática, internet, sistemas ou equipamentos, abra um chamado.",
        }
      : activeTab === "approvals"
        ? {
            title: "Nenhuma aprovação pendente",
            description:
              "Os chamados que dependem da sua aprovação aparecem aqui.",
          }
        : {
            title: "Nenhum chamado na fila",
            description: "Os chamados abertos para a ATEC aparecem aqui.",
          };

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Suporte
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Suporte e chamados de TI
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Atendimento técnico da Assessoria Técnica (ATEC).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="quiet"
            size="icon"
            aria-label="Atualizar lista"
            onClick={() => void loadData()}
          >
            <ArrowClockwise aria-hidden="true" size={16} />
          </Button>
          <Button asChild>
            <Link to="/suporte/novo">
              <Plus aria-hidden="true" size={16} />
              Novo chamado
            </Link>
          </Button>
        </div>
      </div>

      <nav aria-label="Visões de chamados" className="flex flex-wrap gap-2">
        {tabs
          .filter((tab) => allowedTabs.includes(tab.key))
          .map(({ key, label, icon: TabIcon }) => (
            <Button
              key={key}
              variant={activeTab === key ? "primary" : "secondary"}
              aria-pressed={activeTab === key}
              onClick={() => handleTabChange(key)}
            >
              <TabIcon aria-hidden="true" size={16} />
              {label}
            </Button>
          ))}
      </nav>

      {error && (
        <Alert tone="danger" title="Não foi possível carregar os dados">
          <p>{error}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => void loadData()}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}

      {activeTab === "metrics" && (
        <div className="space-y-4">
          {loadingAnalytics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-[14px]" />
              ))}
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent>
                    <p className={METRIC_LABEL}>Total de chamados</p>
                    <p className="mt-2 text-3xl font-extrabold tabular-nums">
                      {analytics.total}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {analytics.open} em aberto • {analytics.inService} em
                      atendimento
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <p className={METRIC_LABEL}>Concluídos</p>
                    <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--success-strong)]">
                      {analytics.completed}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {analytics.cancelled}{" "}
                      {analytics.cancelled === 1 ? "cancelado" : "cancelados"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <p className={METRIC_LABEL}>Cumprimento de SLA</p>
                    <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--brand)]">
                      {analytics.slaCompliancePercentage}%
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {analytics.slaBreachedCount} com SLA expirado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <p className={METRIC_LABEL}>Satisfação dos usuários</p>
                    <p className="mt-2 flex items-center gap-2 text-3xl font-extrabold tabular-nums text-[var(--warning-strong)]">
                      {analytics.averageRating ?? "—"}
                      <Star aria-hidden="true" size={24} weight="fill" />
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {analytics.totalFeedbacks === 1
                        ? "1 avaliação registrada"
                        : `${analytics.totalFeedbacks} avaliações registradas`}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DistributionCard
                  title="Chamados por categoria"
                  total={analytics.total}
                  barClassName="bg-[var(--brand)]"
                  rows={analytics.byCategory.map((cat) => ({
                    key: cat.categoryId,
                    label: cat.categoryName,
                    count: cat.count,
                    showPercentage: true,
                  }))}
                />
                <DistributionCard
                  title="Chamados por unidade solicitante"
                  total={analytics.total}
                  barClassName="bg-[var(--success)]"
                  rows={analytics.byUnit.map((unit) => ({
                    key: unit.unitName,
                    label: unit.unitName,
                    count: unit.count,
                    showPercentage: false,
                  }))}
                />
              </div>
            </>
          ) : !error ? (
            <Card>
              <EmptyState
                title="Sem métricas"
                description="Ainda não há dados de chamados para calcular os indicadores."
              />
            </Card>
          ) : null}
        </div>
      )}

      {activeTab !== "metrics" && (
        <Card>
          <CardContent className="border-b border-[var(--border)] py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                htmlFor="ticketSearch"
                label="Buscar chamados"
                className="sm:col-span-2"
              >
                <div className="relative">
                  <MagnifyingGlass
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                    size={16}
                  />
                  <Input
                    id="ticketSearch"
                    type="search"
                    autoComplete="off"
                    className="pl-9"
                    placeholder="Protocolo, solicitante ou categoria…"
                    value={searchTerm}
                    onChange={(e) => updateParams({ q: e.target.value })}
                  />
                </div>
              </FormField>

              {activeTab === "queue" && (
                <>
                  <FormField htmlFor="ticketStatus" label="Situação">
                    <Select
                      id="ticketStatus"
                      name="ticketStatus"
                      options={STATUS_OPTIONS}
                      value={statusFilter}
                      onValueChange={(value) => updateParams({ status: value })}
                    />
                  </FormField>
                  <FormField htmlFor="ticketArea" label="Área">
                    <Select
                      id="ticketArea"
                      name="ticketArea"
                      options={AREA_OPTIONS}
                      value={areaFilter}
                      onValueChange={(value) => updateParams({ area: value })}
                    />
                  </FormField>
                </>
              )}
            </div>
          </CardContent>

          {loading ? (
            <TableSkeleton
              ariaLabel="Carregando chamados"
              headers={TABLE_HEADERS}
              rows={5}
            />
          ) : sortedTickets.length === 0 ? (
            <EmptyState
              title={emptyCopy.title}
              description={emptyCopy.description}
              action={
                activeTab === "my" && !hasFilters ? (
                  <Button asChild>
                    <Link to="/suporte/novo">
                      <Plus aria-hidden="true" size={16} />
                      Novo chamado
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table aria-label="Chamados">
              <thead>
                <tr>
                  {TABLE_HEADERS.map((header) => (
                    <TableHead key={header} className="whitespace-nowrap">
                      {header}
                    </TableHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTickets.map((t) => {
                  const statusConf = ticketStatus(t.status);
                  const cleanProtocol = t.ticketNumber.replace(/^#+/, "");

                  let isSlaBreached = false;
                  if (
                    t.slaDeadline &&
                    !["completed", "cancelled"].includes(t.status)
                  ) {
                    isSlaBreached = new Date(t.slaDeadline) < new Date();
                  }

                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedTicketId(t.id)}
                    >
                      <TableCell>
                        <p className="font-mono text-xs font-semibold text-[var(--brand)]">
                          #{cleanProtocol}
                        </p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {new Date(t.openedAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={t.requesterName} size="sm" />
                          <div className="min-w-0">
                            <p
                              className="truncate font-semibold"
                              title={t.requesterName}
                            >
                              {t.requesterName}
                            </p>
                            {t.unitName && (
                              <p
                                className="truncate text-xs text-[var(--text-faint)]"
                                title={t.unitName}
                              >
                                {t.unitName}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <p className="font-medium">{t.categoryName}</p>
                        {t.subcategoryName && (
                          <p className="text-xs text-[var(--text-faint)]">
                            {t.subcategoryName}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={t.isRemote ? "brand" : "neutral"}
                          className="gap-1.5 whitespace-nowrap"
                        >
                          {t.isRemote ? (
                            <Desktop aria-hidden="true" size={14} />
                          ) : (
                            <Buildings aria-hidden="true" size={14} />
                          )}
                          {t.isRemote ? "Remoto" : "Presencial"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {t.technicianName ? (
                          <p className="font-medium">{t.technicianName}</p>
                        ) : (
                          <p className="text-[var(--text-muted)]">
                            Não atribuído
                          </p>
                        )}
                        {t.areaResponsavel && (
                          <p className="text-xs capitalize text-[var(--text-faint)]">
                            {t.areaResponsavel}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant={statusConf.variant}
                            className="whitespace-nowrap"
                          >
                            {statusConf.label}
                          </Badge>
                          {t.approvalStatus === "pending" && (
                            <Badge
                              variant="warning"
                              className="whitespace-nowrap"
                            >
                              Aguardando chefia
                            </Badge>
                          )}
                          {isSlaBreached && (
                            <Badge
                              variant="danger"
                              className="whitespace-nowrap"
                            >
                              SLA expirado
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="quiet"
                          size="icon"
                          aria-label={`Ver detalhes do chamado ${cleanProtocol}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(t.id);
                          }}
                        >
                          <Eye aria-hidden="true" size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          currentUser={user}
          onClose={() => setSelectedTicketId(null)}
          onUpdated={() => void loadData(true)}
        />
      )}
    </div>
  );
}

function DistributionCard({
  title,
  total,
  rows,
  barClassName,
}: {
  title: string;
  total: number;
  rows: Array<{
    key: string;
    label: string;
    count: number;
    showPercentage: boolean;
  }>;
  barClassName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-bold">{title}</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum chamado registrado.
          </p>
        ) : (
          rows.map((row) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between gap-3 text-xs font-medium">
                  <span>{row.label}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {row.count}
                    {row.showPercentage ? ` (${Math.round(share)}%)` : ""}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
                >
                  <div
                    className={`h-full ${barClassName}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
