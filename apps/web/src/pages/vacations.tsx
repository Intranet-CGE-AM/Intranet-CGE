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
import { ArrowRight, CalendarPlus, Info } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { manausToday } from "../lib/dates";
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
  const [dialogError, setDialogError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [history, setHistory] = useState<VacationRequest | null>(null);
  const hasCreatePermission = Boolean(user && can(user, "vacations.create"));
  const creates = Boolean(user?.employment && can(user, "vacations.create"));
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const submit =
      submitter instanceof HTMLButtonElement
        ? submitter.value === "submit"
        : true;
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get("startDate"));
    const endDate = String(data.get("endDate"));
    if (endDate < startDate) {
      setDialogError(
        "A data final deve ser igual ou posterior à data inicial.",
      );
      return;
    }
    try {
      setBusy(true);
      setDialogError("");
      setSuccess("");
      await api("/api/vacation-requests", {
        method: "POST",
        body: json({
          startDate,
          endDate,
          submit,
        }),
      });
      setCreateDialog(false);
      await load();
      setSuccess(
        submit
          ? "Solicitação enviada para a chefia."
          : "Rascunho salvo. Envie quando estiver pronto.",
      );
    } catch (cause) {
      setDialogError(
        messageFor(cause, "Não foi possível enviar a solicitação."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft(request: VacationRequest) {
    try {
      setBusy(true);
      setError("");
      setSuccess("");
      await api(`/api/vacation-requests/${request.id}/submit`, {
        method: "POST",
        body: json({ version: request.version }),
      });
      await load();
      setSuccess("Solicitação enviada para a chefia.");
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível enviar a solicitação."));
    } finally {
      setBusy(false);
    }
  }

  async function decideRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;
    const data = new FormData(event.currentTarget);
    const decisionValue = String(data.get("decision"));
    const comment = String(data.get("comment") ?? "").trim();
    if (decisionValue === "reject" && comment.length < 2) {
      setDialogError(
        "Informe o motivo da rejeição para manter o histórico claro.",
      );
      return;
    }
    const route =
      decision.stage === "supervisor" ? "supervisor-decision" : "hr-decision";
    try {
      setBusy(true);
      setDialogError("");
      setSuccess("");
      await api(`/api/vacation-requests/${decision.request.id}/${route}`, {
        method: "POST",
        body: json({
          version: decision.request.version,
          decision: decisionValue,
          comment: comment || null,
        }),
      });
      setDecision(null);
      await load();
      setSuccess("Decisão registrada no histórico.");
    } catch (cause) {
      setDialogError(
        messageFor(cause, "Não foi possível registrar a decisão."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel(request: VacationRequest) {
    if (!window.confirm("Cancelar esta solicitação de férias?")) return;
    try {
      setBusy(true);
      setError("");
      setSuccess("");
      await api(`/api/vacation-requests/${request.id}/cancel`, {
        method: "POST",
        body: json({ version: request.version }),
      });
      await load();
      setSuccess("Solicitação cancelada.");
    } catch (cause) {
      setError(messageFor(cause, "Não foi possível cancelar a solicitação."));
    } finally {
      setBusy(false);
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
        <Alert title="A operação não foi concluída" tone="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Operação concluída" tone="success">
          {success}
        </Alert>
      ) : null}

      <div className="flex gap-3 py-1 text-sm text-[var(--text-muted)]">
        <Info
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--brand)]"
          size={18}
        />
        <p>
          A intranet organiza solicitações e decisões. O registro funcional e o
          saldo oficial permanecem no sistema de pessoal competente.
        </p>
      </div>

      <ol
        aria-label="Etapas do fluxo de férias"
        className="flex flex-wrap items-center gap-2 border-y border-[var(--border)] py-3 text-xs font-semibold text-[var(--text-muted)]"
      >
        {["Envio", "Chefia imediata", "Decisão final da Gestão de Pessoas"].map(
          (step, index) => (
            <li className="flex items-center gap-2" key={step}>
              {step}
              {index < 2 ? (
                <ArrowRight
                  aria-hidden="true"
                  className="text-[var(--text-faint)]"
                  size={14}
                />
              ) : null}
            </li>
          ),
        )}
      </ol>

      {hasCreatePermission && !user?.employment ? (
        <Alert title="Vínculo funcional necessário" tone="warning">
          Sua conta não possui vínculo funcional ativo. Procure a Gestão de
          Pessoas para revisar o cadastro antes de solicitar férias.
        </Alert>
      ) : null}

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
              busy={busy}
              empty="Você ainda não possui solicitações."
              onHistory={setHistory}
              action={(request) => (
                <>
                  {request.status === "draft" ? (
                    <Button
                      disabled={busy}
                      size="sm"
                      onClick={() => void submitDraft(request)}
                    >
                      Enviar para chefia
                    </Button>
                  ) : null}
                  {["draft", "submitted", "supervisor_approved"].includes(
                    request.status,
                  ) ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => void cancel(request)}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </>
              )}
            />
          ) : null}
          {reviewsSupervisor ? (
            <RequestTable
              title="Decisões da chefia"
              description="Solicitações atribuídas à chefia registrada"
              requests={supervisor}
              busy={busy}
              empty="Nenhuma solicitação aguarda decisão da chefia."
              onHistory={setHistory}
              showRequester
              action={(request) =>
                request.status === "submitted" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setDecision({ request, stage: "supervisor" })
                    }
                  >
                    Analisar
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
              busy={busy}
              empty="Nenhuma solicitação aguarda decisão final."
              onHistory={setHistory}
              showRequester
              action={(request) =>
                request.status === "supervisor_approved" ? (
                  <Button
                    size="sm"
                    onClick={() => setDecision({ request, stage: "final" })}
                  >
                    Analisar
                  </Button>
                ) : null
              }
            />
          ) : null}
        </>
      )}

      <Dialog
        open={createDialog}
        onOpenChange={(open) => {
          setCreateDialog(open);
          if (!open) setDialogError("");
        }}
      >
        <DialogContent
          title="Nova solicitação"
          description="Salve como rascunho ou envie o período para análise da chefia."
        >
          <form className="space-y-4" onSubmit={createRequest}>
            {dialogError ? (
              <Alert title="Revise a solicitação" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="vacationStartDate" label="Data inicial">
                <Input
                  id="vacationStartDate"
                  min={manausToday()}
                  name="startDate"
                  type="date"
                  required
                />
              </FormField>
              <FormField htmlFor="vacationEndDate" label="Data final">
                <Input
                  id="vacationEndDate"
                  min={manausToday()}
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
              <Button
                disabled={busy}
                name="intent"
                type="submit"
                value="draft"
                variant="secondary"
              >
                {busy ? "Salvando…" : "Salvar rascunho"}
              </Button>
              <Button
                disabled={busy}
                name="intent"
                type="submit"
                value="submit"
              >
                {busy ? "Enviando…" : "Enviar para chefia"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(decision)}
        onOpenChange={() => {
          setDecision(null);
          setDialogError("");
        }}
      >
        <DialogContent
          title="Analisar solicitação"
          description={
            decision
              ? `${decision.stage === "supervisor" ? "Análise da chefia" : "Análise final"} · ${decision.request.requester.displayName} · ${formatPeriod(decision.request)}`
              : undefined
          }
        >
          <form className="space-y-4" onSubmit={decideRequest}>
            {dialogError ? (
              <Alert title="Revise a decisão" tone="danger">
                {dialogError}
              </Alert>
            ) : null}
            <FormField htmlFor="vacationDecision" label="Decisão">
              <Select
                id="vacationDecision"
                name="decision"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Selecione uma decisão
                </option>
                <option value="approve">Aprovar</option>
                <option value="reject">Rejeitar</option>
              </Select>
            </FormField>
            <FormField
              htmlFor="vacationComment"
              label="Comentário"
              hint="Obrigatório ao rejeitar."
            >
              <Textarea
                id="vacationComment"
                name="comment"
                autoComplete="off"
                placeholder="Contexto para o histórico da solicitação…"
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
              <Button disabled={busy} type="submit">
                {busy ? "Registrando…" : "Confirmar decisão"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(history)}
        onOpenChange={(open) => !open && setHistory(null)}
      >
        <DialogContent
          title="Histórico da solicitação"
          description={history ? formatPeriod(history) : undefined}
        >
          {history?.events.length ? (
            <ol className="border-l border-[var(--border)]">
              {history.events.map((event) => (
                <li className="relative pb-5 pl-5 last:pb-0" key={event.id}>
                  <span className="absolute -left-1 top-1 size-2 rounded-full bg-[var(--brand)]" />
                  <p className="text-sm font-semibold">
                    {eventLabels[event.type] ?? event.type}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Manaus",
                    }).format(new Date(event.createdAt))}
                  </p>
                  {event.comment ? (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {event.comment}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum evento registrado.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestTable({
  title,
  description,
  requests,
  busy,
  empty,
  onHistory,
  showRequester = false,
  action,
}: {
  title: string;
  description: string;
  requests: VacationRequest[];
  busy: boolean;
  empty: string;
  onHistory: (request: VacationRequest) => void;
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
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {action(request)}
                      <Button
                        disabled={busy}
                        size="sm"
                        variant="quiet"
                        onClick={() => onHistory(request)}
                      >
                        Histórico
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="Fila vazia" description={empty} />
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

const eventLabels: Record<string, string> = {
  approved: "Solicitação aprovada",
  cancelled: "Solicitação cancelada",
  created: "Solicitação criada",
  "final-approved": "Aprovada pela área responsável",
  "final-rejected": "Rejeitada pela área responsável",
  rejected: "Solicitação rejeitada",
  "supervisor-approved": "Aprovada pela chefia",
  "supervisor-rejected": "Rejeitada pela chefia",
  submitted: "Enviada para a chefia",
};
