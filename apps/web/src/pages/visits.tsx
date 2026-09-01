import type {
  VisitDashboard,
  VisitStatus,
  VisitSummary,
  VisitType,
} from "@cge/contracts";

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

import {
  ArrowRight,
  CalendarCheck,
  Clock,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Link } from "react-router";

import { useAuth } from "../auth";

import {
  api,
  ApiError,
} from "../lib/api";

const statusLabels: Record<
  VisitStatus,
  {
    label: string;
    variant:
      | "neutral"
      | "warning"
      | "success"
      | "danger"
      | "brand";
  }
> = {
  pending: {
    label: "Pendente",
    variant: "warning",
  },

  approved: {
    label: "Aprovada",
    variant: "brand",
  },

  scheduled: {
    label: "Agendada",
    variant: "brand",
  },

  in_progress: {
    label: "Em atendimento",
    variant: "warning",
  },

  completed: {
    label: "Concluída",
    variant: "success",
  },

  cancelled: {
    label: "Cancelada",
    variant: "neutral",
  },

  rejected: {
    label: "Recusada",
    variant: "danger",
  },
};

const typeLabels: Record<VisitType, string> = {
  institutional_meeting:
    "Reunião institucional",

  technical_support:
    "Apoio técnico",

  technical_visit:
    "Visita técnica",

  alignment_meeting:
    "Reunião de alinhamento",

  presentation:
    "Apresentação",

  audit:
    "Auditoria",

  inspection:
    "Fiscalização",

  training:
    "Capacitação",

  external_service:
    "Atendimento externo",

  other:
    "Outro",
};

export function VisitsPage() {
  const { user } = useAuth();

  const [dashboard, setDashboard] =
    useState<VisitDashboard | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadDashboard =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const result =
          await api<VisitDashboard>(
            "/api/visits/dashboard",
          );

        setDashboard(result);
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar os agendamentos.",
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

  const firstName =
    user.person.displayName.split(/\s+/)[0];

  const counters =
    dashboard?.counters ?? {
      today: 0,
      tomorrow: 0,
      month: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
    };

  return (
    <div className="page-enter space-y-5 pb-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Agendamento de Visitas
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
            Bom dia, {firstName}
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Reuniões, visitas institucionais e
            atendimentos técnicos da CGE.
          </p>
        </div>

        <p className="text-xs font-semibold capitalize text-[var(--text-faint)]">
          {new Intl.DateTimeFormat(
            "pt-BR",
            {
              weekday: "long",
              day: "2-digit",
              month: "long",
              timeZone:
                "America/Manaus",
            },
          ).format(new Date())}
        </p>
      </div>

      {error ? (
        <Alert
          title="Painel indisponível"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      <DashboardBanner
        action={
          <Button
            asChild
            size="sm"
            variant="quiet"
          >
            <Link
              className="!min-h-0 !justify-start !p-0 text-[var(--brand)] hover:!bg-transparent"
              to="/visitas/agenda"
            >
              Abrir agenda

              <ArrowRight
                aria-hidden="true"
                size={15}
                weight="bold"
              />
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
          visits={
            dashboard?.tomorrow ?? []
          }
        />

        <VisitListCard
          description="Próximos compromissos institucionais"
          emptyDescription="Os próximos agendamentos aparecerão aqui."
          emptyTitle="Nenhuma visita programada"
          loading={loading}
          title="Próximas visitas"
          visits={
            dashboard?.upcoming ?? []
          }
        />

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Minha rotina
                </h2>

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
                        counters.pending ===
                        1
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
                        counters.inProgress ===
                        1
                          ? "atendimento em andamento"
                          : "atendimentos em andamento"
                      }`
                    : "Nenhum atendimento em andamento"
                }
                description="Visitas que já registraram atendimento."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Indicadores
                </h2>

                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Resumo dos agendamentos
                </p>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Indicator
                label="No mês"
                value={counters.month}
              />

              <Indicator
                label="Pendentes"
                value={counters.pending}
              />

              <Indicator
                label="Concluídas"
                value={counters.completed}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-extrabold">
              Últimas visitas técnicas
            </h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Histórico recente de visitas
              técnicas concluídas
            </p>
          </div>

          <Button
            asChild
            size="sm"
            variant="quiet"
          >
            <Link to="/visitas/historico">
              Ver histórico

              <ArrowRight
                aria-hidden="true"
                size={15}
              />
            </Link>
          </Button>
        </CardHeader>

        {loading ? (
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        ) : dashboard
            ?.recentTechnicalVisits
            .length ? (
          <VisitsTable
            visits={
              dashboard.recentTechnicalVisits
            }
          />
        ) : (
          <EmptyState
            title="Nenhuma visita técnica concluída"
            description="As últimas visitas técnicas finalizadas aparecerão aqui."
          />
        )}
      </Card>
    </div>
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
          <h2 className="font-extrabold">
            {title}
          </h2>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {description}
          </p>
        </div>

        <Button
          asChild
          size="sm"
          variant="quiet"
        >
          <Link to="/visitas/agenda">
            Ver agenda

            <ArrowRight
              aria-hidden="true"
              size={15}
            />
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
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
        />
      )}

      <div className="border-t border-[var(--border)] px-5 py-4 text-xs text-[var(--text-muted)]">
        <strong className="text-[var(--text)]">
          {visits.length}
        </strong>{" "}
        {visits.length === 1
          ? "agendamento"
          : "agendamentos"}
      </div>
    </Card>
  );
}

function VisitsTable({
  visits,
}: {
  visits: VisitSummary[];
}) {
  return (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-[20%]" />
        <col className="w-[30%]" />
        <col className="w-[30%]" />
        <col className="w-[20%]" />
      </colgroup>

      <thead>
        <tr>
          <TableHead>Data/Hora</TableHead>

          <TableHead>
            Órgão
          </TableHead>

          <TableHead>
            Assunto
          </TableHead>

          <TableHead>
            Situação
          </TableHead>
        </tr>
      </thead>

      <tbody>
        {visits.map((visit) => (
          <TableRow key={visit.id}>
            <TableCell>
              <p className="font-semibold">
                {formatDate(
                  visit.scheduledDate,
                )}
              </p>

              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                {visit.startTime}–
                {visit.endTime}
              </p>
            </TableCell>

            <TableCell>
              <p className="font-semibold">
                {visit.organization}
              </p>

              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                {typeLabels[visit.type]}
              </p>
            </TableCell>

            <TableCell>
              <p className="line-clamp-2">
                {visit.subject}
              </p>

              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                {visit.location}
              </p>
            </TableCell>

            <TableCell>
              <Badge
                variant={
                  statusLabels[
                    visit.status
                  ].variant
                }
              >
                {
                  statusLabels[
                    visit.status
                  ].label
                }
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
        <Icon
          aria-hidden="true"
          size={18}
        />
      </span>

      <div>
        <p className="text-sm font-bold">
          {title}
        </p>

        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function Indicator({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <p className="text-2xl font-extrabold tabular-nums">
        {value}
      </p>

      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(
    `${value}T12:00:00`,
  );

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
    },
  ).format(date);
}