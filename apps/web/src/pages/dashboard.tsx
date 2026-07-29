import type {
  Birthday,
  PeoplePageResult,
  VacationRequest,
} from "@cge/contracts";
import {
  Alert,
  Avatar,
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
import { ArrowRight, CalendarCheck, CalendarDots } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "../auth";
import { api, ApiError } from "../lib/api";
import { can } from "../lib/permissions";

const status: Record<
  VacationRequest["status"],
  {
    label: string;
    tone: "neutral" | "warning" | "success" | "danger" | "brand";
  }
> = {
  draft: { label: "Rascunho", tone: "neutral" },
  submitted: { label: "Aguardando chefia", tone: "warning" },
  supervisor_approved: { label: "Aguardando decisão final", tone: "brand" },
  supervisor_rejected: { label: "Rejeitada pela chefia", tone: "danger" },
  final_approved: { label: "Aprovada", tone: "success" },
  final_rejected: { label: "Rejeitada na decisão final", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

const date = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DashboardPage() {
  const { user } = useAuth();
  const [peopleCount, setPeopleCount] = useState(0);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    async function load() {
      try {
        const results = await Promise.all([
          can(user!, "people.read")
            ? api<PeoplePageResult>("/api/people?pageSize=1")
            : Promise.resolve({
                people: [],
                pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
              }),
          can(user!, "birthdays.read")
            ? api<{ birthdays: Birthday[] }>("/api/birthdays?days=30")
            : Promise.resolve({ birthdays: [] }),
          user!.employment &&
          can(user!, "vacations.create", user!.employment.unit.id)
            ? api<{ requests: VacationRequest[] }>(
                "/api/vacation-requests?scope=mine",
              )
            : Promise.resolve({ requests: [] }),
          can(user!, "vacations.review.supervisor")
            ? api<{ requests: VacationRequest[] }>(
                "/api/vacation-requests?scope=supervisor",
              )
            : Promise.resolve({ requests: [] }),
          can(user!, "vacations.review.final")
            ? api<{ requests: VacationRequest[] }>(
                "/api/vacation-requests?scope=final",
              )
            : Promise.resolve({ requests: [] }),
        ]);
        if (!active) {
          return;
        }
        setPeopleCount(results[0].pagination.total);
        setBirthdays(results[1].birthdays);
        setRequests([
          ...new Map(
            [
              ...results[2].requests,
              ...results[3].requests,
              ...results[4].requests,
            ].map((request) => [request.id, request]),
          ).values(),
        ]);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar o painel.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return null;
  }

  const reviewPending = requests.filter(
    (request) =>
      (request.status === "submitted" &&
        can(user, "vacations.review.supervisor")) ||
      (request.status === "supervisor_approved" &&
        can(user, "vacations.review.final")),
  );
  const mineInProgress = requests.filter(
    (request) =>
      request.requester.personId === user.person.id &&
      ["submitted", "supervisor_approved"].includes(request.status),
  );
  const approved = requests.filter(
    (request) => request.status === "final_approved",
  );
  const firstName = user.person.displayName.split(/\s+/)[0];

  return (
    <div className="page-enter space-y-5 pb-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
            Bom dia, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Pessoas, solicitações e datas importantes do seu escopo.
          </p>
        </div>
        <p className="text-xs font-semibold capitalize text-[var(--text-faint)]">
          {new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          }).format(new Date())}
        </p>
      </div>

      {error ? (
        <Alert title="Painel indisponível" tone="danger">
          {error}
        </Alert>
      ) : null}

      <DashboardBanner
        action={
          <Button asChild size="sm" variant="quiet">
            <Link
              className="!min-h-0 !justify-start !p-0 text-[var(--brand)] hover:!bg-transparent"
              to="/rh/ferias"
            >
              Abrir fluxo de férias
              <ArrowRight aria-hidden="true" size={15} weight="bold" />
            </Link>
          </Button>
        }
        artwork={
          <img
            alt=""
            className="h-full w-full origin-right scale-[1.3] object-contain object-right"
            fetchPriority="high"
            src="/assets/dashboard/hr-workspace.webp"
          />
        }
        description={
          reviewPending.length
            ? "Abra a fila para registrar as decisões sob sua responsabilidade."
            : mineInProgress.length
              ? "Acompanhe a etapa atual das suas solicitações no fluxo de férias."
              : "Consulte pessoas, datas importantes e solicitações do seu escopo."
        }
        eyebrow="Sua rotina no RH"
        title={
          loading ? (
            <Skeleton className="h-8 w-64" />
          ) : reviewPending.length ? (
            `${reviewPending.length} ${
              reviewPending.length === 1
                ? "solicitação para analisar"
                : "solicitações para analisar"
            }`
          ) : mineInProgress.length ? (
            `${mineInProgress.length} ${
              mineInProgress.length === 1
                ? "solicitação em andamento"
                : "solicitações em andamento"
            }`
          ) : (
            "Nenhuma pendência aberta"
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader className="px-5 sm:px-6">
              <div>
                <h2 className="font-extrabold">Férias</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Solicitações visíveis para a sua conta
                </p>
              </div>
              <Button asChild variant="quiet" size="sm">
                <Link to="/rh/ferias">
                  Ver fluxo
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </Button>
            </CardHeader>
            {loading ? (
              <CardContent className="space-y-3 px-5 sm:px-6">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </CardContent>
            ) : requests.length ? (
              <Table>
                <thead>
                  <tr>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Etapa</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 6).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <p className="font-semibold">
                          {request.requester.displayName}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                          {request.requester.unitName}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[var(--text-muted)]">
                        {date.format(new Date(`${request.startDate}T12:00:00`))}
                        {" – "}
                        {date.format(new Date(`${request.endDate}T12:00:00`))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status[request.status].tone}>
                          {status[request.status].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                title="Nenhuma solicitação visível"
                description="Novas solicitações e decisões aparecerão aqui conforme o seu escopo."
              />
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] px-5 py-4 text-xs text-[var(--text-muted)] sm:px-6">
              <span>
                <strong className="text-[var(--text)]">
                  {requests.length}
                </strong>{" "}
                visíveis
              </span>
              <span>
                <strong className="text-[var(--text)]">
                  {approved.length}
                </strong>{" "}
                aprovadas
              </span>
            </div>
          </Card>

          {can(user, "people.read") ? (
            <Card>
              <CardHeader>
                <div>
                  <h2 className="font-extrabold">Diretório de pessoas</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Pessoas ativas dentro do seu escopo
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                {loading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  <p className="text-3xl font-extrabold tabular-nums tracking-[-0.04em]">
                    {peopleCount}
                  </p>
                )}
                <p className="min-w-0 flex-1 text-sm text-[var(--text-muted)]">
                  colaboradores visíveis
                </p>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/rh/colaboradores">Abrir</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">
                  Minha rotina
                  {reviewPending.length + mineInProgress.length
                    ? ` (${reviewPending.length + mineInProgress.length})`
                    : ""}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  O que precisa da sua atenção
                </p>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--border)] p-0">
              {reviewPending.length ? (
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    <CalendarCheck aria-hidden="true" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {reviewPending.length}{" "}
                      {reviewPending.length === 1
                        ? "decisão pendente"
                        : "decisões pendentes"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Solicitações aguardando sua análise
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/rh/ferias">Revisar</Link>
                  </Button>
                </div>
              ) : null}
              {mineInProgress.length ? (
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    <CalendarDots aria-hidden="true" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Acompanhar solicitações</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {mineInProgress.length}{" "}
                      {mineInProgress.length === 1
                        ? "período em tramitação"
                        : "períodos em tramitação"}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/rh/ferias">Acompanhar</Link>
                  </Button>
                </div>
              ) : null}
              {user.employment &&
              can(user, "vacations.create", user.employment.unit.id) ? (
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    <CalendarCheck aria-hidden="true" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Planejar novo período</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Envie uma solicitação para a sua chefia
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/rh/ferias">Solicitar</Link>
                  </Button>
                </div>
              ) : null}
              {!reviewPending.length &&
              !mineInProgress.length &&
              !(
                user.employment &&
                can(user, "vacations.create", user.employment.unit.id)
              ) ? (
                <p className="px-5 py-8 text-sm text-[var(--text-muted)]">
                  Nenhuma ação está disponível no momento.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-extrabold">Próximos aniversários</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Pessoas que autorizaram a exibição
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ) : birthdays.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {birthdays.slice(0, 5).map((birthday) => (
                    <div
                      className="flex items-center gap-3 py-3 first:pt-0"
                      key={birthday.personId}
                    >
                      <Avatar
                        name={birthday.displayName}
                        src={birthday.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {birthday.displayName}
                        </p>
                        <p className="truncate text-xs text-[var(--text-faint)]">
                          {birthday.unit.name}
                        </p>
                      </div>
                      <Badge
                        variant={
                          birthday.daysUntil === 0 ? "success" : "neutral"
                        }
                      >
                        {birthday.daysUntil === 0
                          ? "Hoje"
                          : `${String(birthday.day).padStart(2, "0")}/${String(
                              birthday.month,
                            ).padStart(2, "0")}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhum aniversário autorizado nos próximos 30 dias.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
