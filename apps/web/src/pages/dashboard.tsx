import type { Birthday, Person, VacationRequest } from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import {
  ArrowRight,
  CakeSlice,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  supervisor_approved: { label: "Decisão final", tone: "brand" },
  supervisor_rejected: { label: "Rejeitada pela chefia", tone: "danger" },
  final_approved: { label: "Aprovada", tone: "success" },
  final_rejected: { label: "Rejeitada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

const date = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DashboardPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
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
            ? api<{ people: Person[] }>("/api/people")
            : Promise.resolve({ people: [] }),
          can(user!, "birthdays.read")
            ? api<{ birthdays: Birthday[] }>("/api/birthdays?days=30")
            : Promise.resolve({ birthdays: [] }),
          can(user!, "vacations.create")
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
        setPeople(results[0].people);
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

  const pending = requests.filter((request) =>
    ["submitted", "supervisor_approved"].includes(request.status),
  );
  const approved = requests.filter(
    (request) => request.status === "final_approved",
  );
  const firstName = user.person.displayName.split(/\s+/)[0];

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Visão operacional
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
            Olá, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe o que exige atenção hoje.
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

      {error ? <Alert title="Painel indisponível">{error}</Alert> : null}

      <section className="hero-pattern overflow-hidden rounded-2xl bg-[var(--brand)] text-white">
        <div className="grid min-h-[170px] gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-white/65">
              Fila de trabalho
            </p>
            {loading ? (
              <Skeleton className="mt-3 h-10 w-52 bg-white/10" />
            ) : (
              <p className="mt-2 text-3xl font-extrabold tracking-[-0.045em]">
                {pending.length
                  ? `${pending.length} ${
                      pending.length === 1 ? "ação pendente" : "ações pendentes"
                    }`
                  : "Nenhuma pendência aberta"}
              </p>
            )}
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
              Solicitações seguem a chefia registrada e uma decisão final
              atribuída por permissão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(user, "vacations.create") ? (
              <Button asChild>
                <Link to="/ferias">
                  <CalendarCheck2 aria-hidden="true" size={17} />
                  Solicitar férias
                </Link>
              </Button>
            ) : null}
            {can(user, "people.read") ? (
              <Button
                asChild
                className="border-white/15 bg-white/10 text-white hover:bg-white/15"
                variant="secondary"
              >
                <Link to="/pessoas">
                  <UsersRound aria-hidden="true" size={17} />
                  Abrir diretório
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            label: "Pessoas ativas visíveis",
            value: people.length,
            detail: "dentro do seu escopo",
            icon: UsersRound,
          },
          {
            label: "Aniversários em 30 dias",
            value: birthdays.length,
            detail: "com autorização de exibição",
            icon: CakeSlice,
          },
          {
            label: "Solicitações aprovadas",
            value: approved.length,
            detail: "na sua visão atual",
            icon: CheckCircle2,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div className="p-5" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {label}
              </p>
              <Icon
                aria-hidden="true"
                className="text-[var(--brand)]"
                size={17}
              />
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-8 w-16" />
            ) : (
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">
                {value}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--text-faint)]">{detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,0.7fr)]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Fluxo de férias</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Solicitações visíveis para a sua conta
              </p>
            </div>
            <Button asChild variant="quiet" size="sm">
              <Link to="/ferias">
                Ver fluxo
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </Button>
          </CardHeader>
          {loading ? (
            <CardContent className="space-y-3">
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
              icon={<CalendarClock aria-hidden="true" size={20} />}
              title="Nenhuma solicitação visível"
              description="Novas solicitações e decisões aparecerão aqui conforme o seu escopo."
            />
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CakeSlice
                aria-hidden="true"
                className="text-[var(--brand)]"
                size={18}
              />
              <h2 className="font-bold">Próximos aniversários</h2>
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
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-xs font-extrabold text-[var(--brand)]">
                      {birthday.displayName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {birthday.displayName}
                      </p>
                      <p className="truncate text-xs text-[var(--text-faint)]">
                        {birthday.unit.name}
                      </p>
                    </div>
                    <Badge
                      variant={birthday.daysUntil === 0 ? "success" : "neutral"}
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
            <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--text-faint)]">
              Apenas nome, dia e mês de pessoas que autorizaram a exibição.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
