import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type {
  TicketAnalyticsSummary,
  TicketStatus,
  TicketSummary,
} from "@cge/contracts";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
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
  Headset,
  ListBullets,
  MagnifyingGlass,
  PlusCircle,
  ShieldCheck,
  Star,
  User,
} from "@phosphor-icons/react";

import { useAuth } from "../auth";
import { TicketDetailModal } from "../components/ticket-detail-modal";
import { api } from "../lib/api";
import { canAccess } from "../lib/permissions";

const STATUS_CONFIG: Record<
  TicketStatus,
  {
    label: string;
    dataStatus: "open" | "prog" | "pause" | "done" | "danger";
  }
> = {
  open: { label: "Aberto", dataStatus: "open" },
  viewed: { label: "Visualizado", dataStatus: "prog" },
  en_route: { label: "A Caminho", dataStatus: "prog" },
  in_service: { label: "Em Atendimento", dataStatus: "prog" },
  paused: { label: "Pausado", dataStatus: "pause" },
  maintenance: { label: "Manutenção", dataStatus: "pause" },
  completed: { label: "Concluído", dataStatus: "done" },
  cancelled: { label: "Cancelado", dataStatus: "danger" },
};

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.substring(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  const fChar = first[0] ?? "";
  const lChar = last[0] ?? "";
  return (fChar + lChar).toUpperCase() || "?";
}

export function TicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!user) {
    return null;
  }

  const isStaff = canAccess(user, {
    anyOf: ["tickets.attend", "tickets.manage"],
  });
  const canApprove = canAccess(user, {
    anyOf: ["tickets.approve", "tickets.manage"],
  });

  // Tab State: "my" | "queue" | "approvals" | "metrics"
  const defaultTab = searchParams.get("tab") || (isStaff ? "queue" : "my");
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Tickets list
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  // Analytics
  const [analytics, setAnalytics] = useState<TicketAnalyticsSummary | null>(
    null,
  );
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Modal Detail
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
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

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-sm">
            <Headset className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Suporte e Chamados TI
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Atendimento técnico da Assessoria Técnica (ATEC)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => void loadData()}
            title="Atualizar lista"
          >
            <ArrowClockwise className="h-4 w-4" />
          </Button>
          <Button variant="primary" onClick={() => navigate("/suporte/novo")}>
            <PlusCircle className="mr-1.5 h-4 w-4" /> Abrir Novo Chamado
          </Button>
        </div>
      </div>

      {/* ── Tabs Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-1">
        <button
          type="button"
          onClick={() => handleTabChange("my")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "my"
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
          }`}
        >
          <User className="h-4 w-4" /> Meus Chamados
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => handleTabChange("queue")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "queue"
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ListBullets className="h-4 w-4" /> Fila de Atendimento ATEC
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            onClick={() => handleTabChange("approvals")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "approvals"
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ShieldCheck className="h-4 w-4" /> Aprovações Pendentes
          </button>
        )}

        {isStaff && (
          <button
            type="button"
            onClick={() => handleTabChange("metrics")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "metrics"
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ChartBar className="h-4 w-4" /> Métricas e SLA
          </button>
        )}
      </div>

      {error && (
        <Alert tone="danger" title="Erro ao carregar dados">
          {error}
        </Alert>
      )}

      {/* ── Visualização: Métricas e Analytics ────────────────────────── */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-[var(--bg-page)]"
                />
              ))}
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-[var(--border)]">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Total de Chamados
                    </span>
                    <div className="mt-2 text-3xl font-black text-[var(--text-primary)]">
                      {analytics.total}
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      {analytics.open} em aberto • {analytics.inService} em
                      atendimento
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[var(--border)]">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Concluídos
                    </span>
                    <div className="mt-2 text-3xl font-black text-[#047857]">
                      {analytics.completed}
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      {analytics.cancelled} cancelados
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[var(--border)]">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Cumprimento de SLA
                    </span>
                    <div className="mt-2 text-3xl font-black text-[#1D4ED8]">
                      {analytics.slaCompliancePercentage}%
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      {analytics.slaBreachedCount} com SLA expirado
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[var(--border)]">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Satisfação dos Usuários
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-3xl font-black text-amber-500">
                        {analytics.averageRating ?? "—"}
                      </span>
                      <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      {analytics.totalFeedbacks} avaliações registradas
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos / Distribuições */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="border-b border-[var(--border)]">
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      Chamados por Categoria
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {analytics.byCategory.map((cat) => (
                      <div key={cat.categoryId} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[var(--text-primary)]">
                            {cat.categoryName}
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            {cat.count} (
                            {analytics.total > 0
                              ? Math.round((cat.count / analytics.total) * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-page)]">
                          <div
                            className="h-full bg-[var(--brand)]"
                            style={{
                              width: `${analytics.total > 0 ? (cat.count / analytics.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b border-[var(--border)]">
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      Chamados por Unidade Solicitante
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {analytics.byUnit.map((unit) => (
                      <div key={unit.unitName} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[var(--text-primary)]">{unit.unitName}</span>
                          <span className="text-[var(--text-secondary)]">
                            {unit.count}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-page)]">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${analytics.total > 0 ? (unit.count / analytics.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Visualização: Listagens (Meus Chamados, Fila, Aprovações) ──────── */}
      {activeTab !== "metrics" && (
        <Card className="overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
            <div className="relative min-w-[260px] flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Buscar por protocolo, solicitante, categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>

            {activeTab === "queue" && (
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                >
                  <option value="all">Todos os Status</option>
                  <option value="open">Abertos</option>
                  <option value="viewed">Visualizados</option>
                  <option value="in_service">Em Atendimento</option>
                  <option value="paused">Pausados</option>
                  <option value="completed">Concluídos</option>
                  <option value="cancelled">Cancelados</option>
                </select>

                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                >
                  <option value="all">Todas as Áreas</option>
                  <option value="sistemas">Sistemas</option>
                  <option value="redes">Redes</option>
                  <option value="manutencao">Manutenção</option>
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-4">
              <TableSkeleton
                ariaLabel="Carregando chamados"
                headers={[
                  "Protocolo / Data",
                  "Solicitante",
                  "Categoria / Serviço",
                  "Modalidade",
                  "Técnico ATEC",
                  "Status / SLA",
                  "Ação",
                ]}
                rows={5}
              />
            </div>
          ) : sortedTickets.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Headset size={44} className="mx-auto text-[var(--text-secondary)]" />}
                title={
                  activeTab === "my"
                    ? "Você não possui chamados abertos"
                    : activeTab === "approvals"
                      ? "Nenhuma aprovação pendente no momento"
                      : "Nenhum chamado encontrado"
                }
                description={
                  activeTab === "my"
                    ? "Quando precisar de suporte de informática, internet, sistemas ou equipamentos, clique no botão abaixo."
                    : "Todos os chamados foram atendidos ou não correspondem aos filtros selecionados."
                }
                action={
                  activeTab === "my" ? (
                    <Button
                      variant="primary"
                      onClick={() => navigate("/suporte/novo")}
                    >
                      <PlusCircle className="mr-1.5 h-4 w-4" /> Abrir Meu
                      Primeiro Chamado
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-card)]">
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Protocolo / Data
                    </TableHead>
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Solicitante
                    </TableHead>
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Categoria / Serviço
                    </TableHead>
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Modalidade
                    </TableHead>
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Técnico ATEC
                    </TableHead>
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Status / SLA
                    </TableHead>
                    <TableHead className="sticky top-0 bg-[var(--bg-card)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
                      Ação
                    </TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedTickets.map((t) => {
                    const statusConf = STATUS_CONFIG[t.status] || {
                      label: t.status,
                      dataStatus: "open",
                    };
                    const cleanProtocol = t.ticketNumber.replace(/^#+/, "");

                    // Cálculo SLA simples para amostragem/exibição
                    let isSlaBreached = false;
                    if (t.slaDeadline && !["completed", "cancelled"].includes(t.status)) {
                      isSlaBreached = new Date(t.slaDeadline) < new Date();
                    }

                    return (
                      <TableRow
                        key={t.id}
                        className="ticket-row-hover group cursor-pointer"
                        onClick={() => setSelectedTicketId(t.id)}
                      >
                        {/* Protocolo / Data */}
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-[var(--brand)]">
                            #{cleanProtocol}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {new Date(t.openedAt).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                        </TableCell>

                        {/* Solicitante */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {getInitials(t.requesterName)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-[var(--text-primary)]" title={t.requesterName}>
                                {t.requesterName}
                              </div>
                              {t.unitName && (
                                <div className="truncate text-[11px] text-[var(--text-secondary)]" title={t.unitName}>
                                  {t.unitName}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Categoria / Serviço */}
                        <TableCell>
                          <div className="text-xs font-medium text-[var(--text-primary)]">
                            {t.categoryName}
                          </div>
                          {t.subcategoryName && (
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {t.subcategoryName}
                            </div>
                          )}
                        </TableCell>

                        {/* Modalidade */}
                        <TableCell>
                          {t.isRemote ? (
                            <span
                              className="tag-modalidade"
                              data-modalidade="remote"
                            >
                              <Desktop className="h-3.5 w-3.5" aria-hidden="true" />
                              Remoto
                            </span>
                          ) : (
                            <span
                              className="tag-modalidade"
                              data-modalidade="onsite"
                            >
                              <Buildings className="h-3.5 w-3.5" aria-hidden="true" />
                              Presencial
                            </span>
                          )}
                        </TableCell>

                        {/* Técnico ATEC */}
                        <TableCell>
                          {t.technicianName ? (
                            <div className="text-xs font-medium text-[var(--text-primary)]">
                              {t.technicianName}
                            </div>
                          ) : (
                            <div className="text-xs italic text-[var(--text-secondary)]">
                              Não atribuído
                            </div>
                          )}
                          {t.areaResponsavel && (
                            <div className="text-[11px] capitalize text-[var(--text-secondary)]">
                              {t.areaResponsavel}
                            </div>
                          )}
                        </TableCell>

                        {/* Status / SLA */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className="badge-status"
                              data-status={statusConf.dataStatus}
                            >
                              {statusConf.label}
                            </span>
                            {t.approvalStatus === "pending" && (
                              <span
                                className="badge-status"
                                data-status="prog"
                              >
                                Aguardando Chefia
                              </span>
                            )}
                            {/* SLA status badge */}
                            {isSlaBreached && (
                              <span className="inline-block text-[10px] font-semibold text-red-600 dark:text-red-400">
                                SLA Expirado
                              </span>
                            )}
                            {/* TODO: exibir indicador avançado de SLA (ex.: tempo restante / contagem regressiva) */}
                          </div>
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="text-left">
                          <Button
                            variant="quiet"
                            size="sm"
                            className="hover:bg-[var(--bg-page)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicketId(t.id);
                            }}
                            title="Ver detalhes"
                            aria-label="Ver detalhes do chamado"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* ── Modal de Detalhes do Chamado ────────────────────────────────── */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          currentUser={user}
          onClose={() => setSelectedTicketId(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
