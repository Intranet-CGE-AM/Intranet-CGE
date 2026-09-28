import type { VisitDashboard, VisitSummary } from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DashboardBanner,
  EmptyState,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import { ArrowRight, CalendarCheck, Clock } from "@phosphor-icons/react";

import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router";

import { useAuth } from "../auth";

import { VisitStats } from "../components/visit-ui";
import { api } from "../lib/api";
import { manausGreeting } from "../lib/dates";
import {
  formatVisitTime,
  visitErrorMessage,
  visitStatusMeta,
  visitTypeLabels,
} from "../lib/visit-labels";

export function VisitsPage() {
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<VisitDashboard | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await api<VisitDashboard>("/api/visits/dashboard");

      setDashboard(result);
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível carregar os agendamentos."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadDashboard();
  }, [loadDashboard, user]);

  if (!user) {
    return null;
  }

  const firstName = user.person.displayName.split(/\s+/)[0];

  const counters = dashboard?.counters ?? {
    today: 0,
    tomorrow: 0,
    month: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  };

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Agendamento de Visitas
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            {manausGreeting()}, {firstName}
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Reuniões, visitas institucionais e atendimentos técnicos da CGE.
          </p>
        </div>

        <p className="text-xs font-semibold capitalize text-[var(--text-faint)]">
          {new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            timeZone: "America/Manaus",
          }).format(new Date())}
        </p>
      </div>

      {error ? (
        <Alert title="Não foi possível carregar o painel" tone="danger">
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
      ) : (
        <DashboardContent
          counters={counters}
          dashboard={dashboard}
          loading={loading}
        />
      )}
    </div>
  );
}

function DashboardContent({
  counters,
  dashboard,
  loading,
}: {
  counters: VisitDashboard["counters"];
  dashboard: VisitDashboard | null;
  loading: boolean;
}) {
  return (
    <>
      <DashboardBanner
        action={
          <Button asChild size="sm" variant="quiet">
            <Link
              className="!min-h-0 !justify-start !p-0 text-[var(--brand)] hover:!bg-transparent"
              to="/visitas/agenda"
            >
              Abrir agenda
              <ArrowRight aria-hidden="true" size={15} weight="bold" />
            </Link>
          </Button>
        }
        description={
          counters.today
            ? "Consulte os visitantes, horários e compromissos previstos para hoje."
            : counters.pending
              ? "Existem agendamentos que precisam de acompanhamento."
              : "Consulte reuniões, visitantes e compromissos programados."
        }
        eyebrow="Sua rotina de visitas"
        title={
          loading ? (
            <Skeleton className="h-8 w-64" />
          ) : counters.today ? (
            `${counters.today} ${
              counters.today === 1
                ? "visita prevista para hoje"
                : "visitas previstas para hoje"
            }`
          ) : counters.pending ? (
            `${counters.pending} ${
              counters.pending === 1
                ? "agendamento pendente"
                : "agendamentos pendentes"
            }`
          ) : (
            "Nenhuma pendência aberta"
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <VisitListCard
          description="Compromissos previstos para hoje"
          emptyDescription="Os compromissos previstos para hoje aparecerão aqui."
          emptyTitle="Nenhuma visita agendada"
          loading={loading}
          title="Visitas de hoje"
          visits={dashboard?.today ?? []}
        />

        <VisitListCard
          description="Compromissos previstos para amanhã"
          emptyDescription="Não há compromisso registrado para amanhã."
          emptyTitle="Nenhuma visita para amanhã"
          loading={loading}
          title="Visitas de amanhã"
          visits={dashboard?.tomorrow ?? []}
        />

        <VisitListCard
          description="Próximos compromissos institucionais"
          emptyDescription="Os próximos agendamentos aparecerão aqui."
          emptyTitle="Nenhuma visita programada"
          loading={loading}
          title="Próximas visitas"
          visits={dashboard?.upcoming ?? []}
        />

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Minha rotina</h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  O que precisa da sua atenção
                </p>
              </div>
            </CardHeader>

            <CardContent className="divide-y divide-[var(--border)] p-0">
              <RoutineItem
                icon={CalendarCheck}
                title={
                  counters.pending
                    ? `${counters.pending} ${
                        counters.pending === 1
                          ? "agendamento pendente"
                          : "agendamentos pendentes"
                      }`
                    : "Nenhuma aprovação pendente"
                }
                description={
                  counters.pending
                    ? "Existem solicitações aguardando acompanhamento."
                    : "Solicitações para análise aparecerão aqui."
                }
              />

              <RoutineItem
                icon={Clock}
                title={
                  counters.inProgress
                    ? `${counters.inProgress} ${
                        counters.inProgress === 1
                          ? "atendimento em andamento"
                          : "atendimentos em andamento"
                      }`
                    : "Nenhum atendimento em andamento"
                }
                description="Visitas que já registraram atendimento."
              />
            </CardContent>
          </Card>

          <VisitStats
            items={[
              { label: "No mês", value: counters.month },
              { label: "Pendentes", value: counters.pending },
              { label: "Concluídas", value: counters.completed },
            ]}
            label="Indicadores dos agendamentos"
            loading={loading}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-bold">Últimas visitas técnicas</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Histórico recente de visitas técnicas concluídas
            </p>
          </div>

          <Button asChild size="sm" variant="quiet">
            <Link to="/visitas/historico">
              Ver histórico
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </CardHeader>

        {loading ? (
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        ) : dashboard?.recentTechnicalVisits.length ? (
          <VisitsTable visits={dashboard.recentTechnicalVisits} />
        ) : (
          <EmptyState
            title="Nenhuma visita técnica concluída"
            description="As últimas visitas técnicas finalizadas aparecerão aqui."
          />
        )}
      </Card>
    </>
  );
}

function VisitListCard({
  title,
  description,
  visits,
  loading,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  visits: VisitSummary[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <h2 className="font-bold">{title}</h2>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {description}
            {loading
              ? null
              : ` · ${visits.length} ${visits.length === 1 ? "agendamento" : "agendamentos"}`}
          </p>
        </div>

        <Button asChild size="sm" variant="quiet">
          <Link to="/visitas/agenda">
            Ver agenda
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </Button>
      </CardHeader>

      {loading ? (
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      ) : visits.length ? (
        <VisitsTable visits={visits} />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </Card>
  );
}

function VisitsTable({ visits }: { visits: VisitSummary[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <TableHead>Data e hora</TableHead>

          <TableHead>Visita</TableHead>

          <TableHead>Situação</TableHead>
        </tr>
      </thead>

      <tbody>
        {visits.map((visit) => (
          <TableRow key={visit.id}>
            <TableCell className="whitespace-nowrap">
              <p className="font-semibold">{formatDate(visit.scheduledDate)}</p>

              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                {formatVisitTime(visit.startTime, visit.endTime)}
              </p>
            </TableCell>

            <TableCell className="min-w-48">
              <p className="line-clamp-2 font-semibold">{visit.subject}</p>

              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                {visit.organization} · {visitTypeLabels[visit.type]}
              </p>
            </TableCell>

            <TableCell>
              <Badge
                className="whitespace-nowrap"
                variant={visitStatusMeta[visit.status].variant}
              >
                {visitStatusMeta[visit.status].label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

function RoutineItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
        <Icon aria-hidden="true" size={18} />
      </span>

      <div>
        <p className="text-sm font-bold">{title}</p>

        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
