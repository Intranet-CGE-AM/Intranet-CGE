import type { VacationRequest } from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
  Textarea,
} from "@cge/ui";
import {
  CalendarPlus,
  CalendarX as CalendarX2,
  Info,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can } from "../lib/permissions";

const statusLabels: Record<
  VacationRequest["status"],
  { label: string; variant: "neutral" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Rascunho", variant: "neutral" },
  submitted: { label: "Aguardando chefia", variant: "warning" },
  supervisor_approved: {
    label: "Aguardando decisão final",
    variant: "warning",
  },
  supervisor_rejected: { label: "Rejeitada pela chefia", variant: "danger" },
  final_approved: { label: "Aprovada", variant: "success" },
  final_rejected: { label: "Rejeitada na decisão final", variant: "danger" },
  cancelled: { label: "Cancelada", variant: "neutral" },
};

type Decision = {
  request: VacationRequest;
  stage: "supervisor" | "final";
};

export function VacationsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<VacationRequest[]>([]);
  const [supervisor, setSupervisor] = useState<VacationRequest[]>([]);
  const [finalReview, setFinalReview] = useState<VacationRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const creates = Boolean(user && can(user, "vacations.create"));
  const reviewsSupervisor = Boolean(
    user && can(user, "vacations.review.supervisor"),
  );
  const reviewsFinal = Boolean(user && can(user, "vacations.review.final"));

  const load = useCallback(async () => {
    try {
      setError("");
      const [mineResult, supervisorResult, finalResult] = await Promise.all([
        creates
          ? api<{ requests: VacationRequest[] }>(
              "/api/vacation-requests?scope=mine",
            )
          : Promise.resolve({ requests: [] }),
        reviewsSupervisor
          ? api<{ requests: VacationRequest[] }>(
              "/api/vacation-requests?scope=supervisor",
            )
          : Promise.resolve({ requests: [] }),
        reviewsFinal
          ? api<{ requests: VacationRequest[] }>(
              "/api/vacation-requests?scope=final",
            )
          : Promise.resolve({ requests: [] }),
      ]);
      setMine(mineResult.requests);
      setSupervisor(supervisorResult.requests);
      setFinalReview(finalResult.requests);
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível carregar as solicitações."));
    } finally {
      setLoading(false);
    }
  }, [creates, reviewsFinal, reviewsSupervisor]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/vacation-requests", {
        method: "POST",
        body: json({
          startDate: data.get("startDate"),
          endDate: data.get("endDate"),
          submit: true,
        }),
      });
      setCreateDialog(false);
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível enviar a solicitação."));
    }
  }

  async function decideRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;
    const data = new FormData(event.currentTarget);
    const route =
      decision.stage === "supervisor" ? "supervisor-decision" : "hr-decision";
    try {
      await api(`/api/vacation-requests/${decision.request.id}/${route}`, {
        method: "POST",
        body: json({
          version: decision.request.version,
          decision: data.get("decision"),
          comment: data.get("comment") || null,
        }),
      });
      setDecision(null);
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível registrar a decisão."));
    }
  }

  async function cancel(request: VacationRequest) {
    if (!window.confirm("Cancelar esta solicitação de férias?")) return;
    try {
      await api(`/api/vacation-requests/${request.id}/cancel`, {
        method: "POST",
        body: json({ version: request.version }),
      });
      await load();
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível cancelar a solicitação."));
    }
  }

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Férias
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Solicitações e decisões internas, sem cálculo de saldo.
          </p>
        </div>
        {creates && user?.employment ? (
          <Button onClick={() => setCreateDialog(true)}>
            <CalendarPlus aria-hidden="true" size={17} />
            Nova solicitação
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert title="A operação não foi concluída">{error}</Alert>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-4 text-sm text-[var(--brand-strong)]">
        <div className="flex gap-3">
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>
            A intranet organiza solicitações e decisões. O registro funcional e
            o saldo oficial permanecem no sistema de pessoal competente.
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </CardContent>
        </Card>
      ) : (
        <>
          {creates ? (
            <RequestTable
              title="Minhas solicitações"
              description="Histórico do seu vínculo funcional ativo"
              requests={mine}
              empty="Você ainda não possui solicitações."
              action={(request) =>
                ["draft", "submitted", "supervisor_approved"].includes(
                  request.status,
                ) ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => void cancel(request)}
                  >
                    Cancelar
                  </Button>
                ) : null
              }
            />
          ) : null}
          {reviewsSupervisor ? (
            <RequestTable
              title="Decisões da chefia"
              description="Solicitações atribuídas à chefia registrada"
              requests={supervisor}
              empty="Nenhuma solicitação aguarda decisão da chefia."
              showRequester
              action={(request) =>
                request.status === "submitted" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setDecision({ request, stage: "supervisor" })
                    }
                  >
                    Decidir
                  </Button>
                ) : null
              }
            />
          ) : null}
          {reviewsFinal ? (
            <RequestTable
              title="Decisão final"
              description="Validação de elegibilidade pela área responsável"
              requests={finalReview}
              empty="Nenhuma solicitação aguarda decisão final."
              showRequester
              action={(request) =>
                request.status === "supervisor_approved" ? (
                  <Button
                    size="sm"
                    onClick={() => setDecision({ request, stage: "final" })}
                  >
                    Decidir
                  </Button>
                ) : null
              }
            />
          ) : null}
        </>
      )}

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent
          title="Nova solicitação"
          description="O período será enviado diretamente para sua chefia."
        >
          <form className="space-y-4" onSubmit={createRequest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="vacationStartDate" label="Data inicial">
                <Input
                  id="vacationStartDate"
                  name="startDate"
                  type="date"
                  required
                />
              </FormField>
              <FormField htmlFor="vacationEndDate" label="Data final">
                <Input
                  id="vacationEndDate"
                  name="endDate"
                  type="date"
                  required
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="quiet"
                onClick={() => setCreateDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Enviar para chefia</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(decision)} onOpenChange={() => setDecision(null)}>
        <DialogContent
          title={
            decision?.stage === "supervisor"
              ? "Decisão da chefia"
              : "Decisão final"
          }
          description={
            decision
              ? `${decision.request.requester.displayName} · ${formatPeriod(decision.request)}`
              : undefined
          }
        >
          <form className="space-y-4" onSubmit={decideRequest}>
            <FormField htmlFor="vacationDecision" label="Decisão">
              <Select
                id="vacationDecision"
                name="decision"
                defaultValue="approve"
              >
                <option value="approve">Aprovar</option>
                <option value="reject">Rejeitar</option>
              </Select>
            </FormField>
            <FormField htmlFor="vacationComment" label="Comentário">
              <Textarea
                id="vacationComment"
                name="comment"
                placeholder="Contexto para o histórico da solicitação"
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="quiet"
                onClick={() => setDecision(null)}
              >
                Cancelar
              </Button>
              <Button type="submit">Registrar decisão</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestTable({
  title,
  description,
  requests,
  empty,
  showRequester = false,
  action,
}: {
  title: string;
  description: string;
  requests: VacationRequest[];
  empty: string;
  showRequester?: boolean;
  action: (request: VacationRequest) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {description}
          </p>
        </div>
      </CardHeader>
      {requests.length ? (
        <Table>
          <thead>
            <tr>
              {showRequester ? <TableHead>Colaborador</TableHead> : null}
              <TableHead>Período</TableHead>
              <TableHead>Etapa atual</TableHead>
              <TableHead>Atualização</TableHead>
              <TableHead>Ação</TableHead>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const status = statusLabels[request.status];
              return (
                <TableRow key={request.id}>
                  {showRequester ? (
                    <TableCell>
                      <p className="font-semibold">
                        {request.requester.displayName}
                      </p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {request.requester.unitName}
                      </p>
                    </TableCell>
                  ) : null}
                  <TableCell className="font-semibold">
                    {formatPeriod(request)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-[var(--text-muted)]">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeZone: "America/Manaus",
                    }).format(new Date(request.updatedAt))}
                  </TableCell>
                  <TableCell>{action(request)}</TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          icon={<CalendarX2 aria-hidden="true" size={20} />}
          title="Fila vazia"
          description={empty}
        />
      )}
    </Card>
  );
}

function formatPeriod(request: VacationRequest) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${request.startDate}T12:00:00Z`))} — ${formatter.format(new Date(`${request.endDate}T12:00:00Z`))}`;
}

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback;
}
