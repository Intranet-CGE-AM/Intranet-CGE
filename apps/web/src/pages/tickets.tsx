import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type {
  TicketAnalyticsSummary,
  TicketStatus,
  TicketSummary,
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
  TableSkeleton,
} from "@cge/ui";
import {
  ArrowClockwise,
  ArrowRight,
  ChartBar,
  Desktop,
  Headset,
  ListBullets,
  MagnifyingGlass,
  MonitorArrowUp,
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
    variant: "neutral" | "success" | "warning" | "danger" | "brand";
  }
> = {
  open: { label: "Aberto", variant: "brand" },
  viewed: { label: "Visualizado", variant: "brand" },
  en_route: { label: "A Caminho", variant: "warning" },
  in_service: { label: "Em Atendimento", variant: "warning" },
  paused: { label: "Pausado", variant: "neutral" },
  maintenance: { label: "Manutenção", variant: "neutral" },
  completed: { label: "Concluído", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === "my") {
        const data = await api<{ tickets: TicketSummary[] }>("/api/tickets/my");
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
        setLoadingAnalytics(true);
        const data = await api<TicketAnalyticsSummary>(
          "/api/tickets/analytics",
        );
        setAnalytics(data);
        setLoadingAnalytics(false);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os chamados.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeTab, statusFilter, areaFilter]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.ticketNumber.toLowerCase().includes(term) ||
      t.requesterName.toLowerCase().includes(term) ||
      t.categoryName.toLowerCase().includes(term) ||
      (t.subcategoryName && t.subcategoryName.toLowerCase().includes(term)) ||
      (t.unitName && t.unitName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--action) text-white shadow-sm">
            <Headset className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-(--text)">
              Suporte e Chamados TI
            </h1>
            <p className="text-sm text-(--text-muted)">
              Atendimento técnico da Assessoria Técnica
              (ATEC)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            size="sm"
            onClick={loadData}
            title="Atualizar lista"
          >
            <ArrowClockwise className="h-4 w-4" />
          </Button>
          <Button variant="primary" onClick={() => navigate("/suporte/novo")}>
            <PlusCircle className="mr-1.5 h-4 w-4" /> Abrir Novo Chamado
          </Button>
        </div>
      </div>

      {/* ── Tabs Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-(--border) pb-1">
        <button
          type="button"
          onClick={() => handleTabChange("my")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "my"
            ? "bg-(--action) text-white shadow-sm"
            : "text-(--text-muted) hover:bg-(--surface-subtle) hover:text-(--text)"
            }`}
        >
          <User className="h-4 w-4" /> Meus Chamados
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => handleTabChange("queue")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "queue"
              ? "bg-(--action) text-white shadow-sm"
              : "text-(--text-muted) hover:bg-(--surface-subtle) hover:text-(--text)"
              }`}
          >
            <ListBullets className="h-4 w-4" /> Fila de Atendimento ATEC
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            onClick={() => handleTabChange("approvals")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "approvals"
              ? "bg-(--action) text-white shadow-sm"
              : "text-(--text-muted) hover:bg-(--surface-subtle) hover:text-(--text)"
              }`}
          >
            <ShieldCheck className="h-4 w-4" /> Aprovações Pendentes
          </button>
        )}

        {isStaff && (
          <button
            type="button"
            onClick={() => handleTabChange("metrics")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "metrics"
              ? "bg-(--action) text-white shadow-sm"
              : "text-(--text-muted) hover:bg-(--surface-subtle) hover:text-(--text)"
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

      {/* ── Visualização: Métricas e Analytics ────────────────────────────── */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-(--surface-subtle)"
                />
              ))}
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-(--border)">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                      Total de Chamados
                    </span>
                    <div className="mt-2 text-3xl font-black text-(--text)">
                      {analytics.total}
                    </div>
                    <div className="mt-2 text-xs text-(--text-muted)">
                      {analytics.open} em aberto • {analytics.inService} em
                      atendimento
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-(--border)">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                      Concluídos
                    </span>
                    <div className="mt-2 text-3xl font-black text-emerald-600">
                      {analytics.completed}
                    </div>
                    <div className="mt-2 text-xs text-(--text-muted)">
                      {analytics.cancelled} cancelados
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-(--border)">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                      Cumprimento de SLA
                    </span>
                    <div className="mt-2 text-3xl font-black text-indigo-600">
                      {analytics.slaCompliancePercentage}%
                    </div>
                    <div className="mt-2 text-xs text-(--text-muted)">
                      {analytics.slaBreachedCount} estouraram o prazo
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-(--border)">
                  <CardContent className="p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
                      Satisfação dos Usuários
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-3xl font-black text-amber-500">
                        {analytics.averageRating ?? "—"}
                      </span>
                      <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
                    </div>
                    <div className="mt-2 text-xs text-(--text-muted)">
                      {analytics.totalFeedbacks} avaliações registradas
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos / Distribuições */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="border-b border-(--border)">
                    <h3 className="font-semibold text-(--text)">
                      Chamados por Categoria
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {analytics.byCategory.map((cat) => (
                      <div key={cat.categoryId} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-(--text)">
                            {cat.categoryName}
                          </span>
                          <span className="text-(--text-muted)">
                            {cat.count} (
                            {analytics.total > 0
                              ? Math.round((cat.count / analytics.total) * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-subtle)">
                          <div
                            className="h-full bg-(--brand)"
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
                  <CardHeader className="border-b border-(--border)">
                    <h3 className="font-semibold text-(--text)">
                      Chamados por Unidade Solicitante
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {analytics.byUnit.map((unit) => (
                      <div key={unit.unitName} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-(--text)">
                            {unit.unitName}
                          </span>
                          <span className="text-(--text-muted)">
                            {unit.count}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-subtle)">
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
        <Card>
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) p-4">
            <div className="relative min-w-260px flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
              <input
                type="text"
                placeholder="Buscar por protocolo, solicitante, categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]"
              />
            </div>

            {activeTab === "queue" && (
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none"
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
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none"
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
          ) : filteredTickets.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Headset size={44} className="mx-auto" />}
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
                  <tr>
                    <TableHead>Protocolo / Data</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Categoria / Serviço</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Técnico ATEC</TableHead>
                    <TableHead>Status / SLA</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => {
                    const statusConf = STATUS_CONFIG[t.status];
                    return (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer transition hover:bg-[var(--surface-subtle)]"
                        onClick={() => setSelectedTicketId(t.id)}
                      >
                        <TableCell>
                          <div className="font-mono text-xs font-bold text-[var(--brand)]">
                            #{t.ticketNumber}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {new Date(t.openedAt).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-[var(--text)]">
                            {t.requesterName}
                          </div>
                          {t.unitName && (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {t.unitName}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-[var(--text)]">
                            {t.categoryName}
                          </div>
                          {t.subcategoryName && (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {t.subcategoryName}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          {t.isRemote ? (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                              <MonitorArrowUp className="h-3 w-3" /> Remoto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Desktop className="h-3 w-3" /> Presencial
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs text-[var(--text)]">
                            {t.technicianName || "—"}
                          </div>
                          {t.areaResponsavel && (
                            <div className="text-[11px] capitalize text-[var(--text-muted)]">
                              {t.areaResponsavel}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={statusConf.variant}>
                              {statusConf.label}
                            </Badge>
                            {t.approvalStatus === "pending" && (
                              <Badge variant="warning">Aguardando Chefia</Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicketId(t.id);
                            }}
                          >
                            Ver <ArrowRight className="ml-1 h-3.5 w-3.5" />
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

      {/* ── Modal de Detalhes do Chamado ──────────────────────────────────── */}
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
