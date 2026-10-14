import type { Visit, VisitDashboard, VisitSummary } from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@cge/ui";

import { useCallback, useEffect, useState } from "react";

import { VisitDetail, VisitStats } from "../components/visit-ui";
import { api, json } from "../lib/api";
import {
  formatVisitDate,
  formatVisitTime,
  visitErrorMessage,
  visitStatusMeta,
  visitTypeLabels,
} from "../lib/visit-labels";

const cancellable: VisitSummary["status"][] = [
  "pending",
  "approved",
  "scheduled",
];

const sectionHeaders = ["Data e hora", "Visita", "Situação", "Ações"];

export function VisitAgendaPage() {
  const [dashboard, setDashboard] = useState<VisitDashboard | null>(null);

  const [detail, setDetail] = useState<Visit | null>(null);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      setLoadError("");

      const result = await api<VisitDashboard>("/api/visits/dashboard");

      setDashboard(result);
    } catch (cause) {
      setLoadError(
        visitErrorMessage(cause, "Não foi possível carregar a agenda."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function viewVisit(id: string) {
    try {
      const result = await api<Visit>(`/api/visits/${id}`);

      setDetail(result);
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível consultar a visita."),
      );
    }
  }

  async function startVisit(id: string) {
    try {
      setBusy(true);

      setError("");

      await api(`/api/visits/${id}/start`, {
        method: "POST",
      });

      setSuccess("Atendimento iniciado.");

      await loadDashboard();
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível iniciar o atendimento."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeVisit(id: string) {
    try {
      setBusy(true);

      setError("");

      await api(`/api/visits/${id}/complete`, {
        method: "POST",
      });

      setSuccess("Atendimento concluído.");

      await loadDashboard();
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível concluir o atendimento."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelVisit(id: string) {
    try {
      setBusy(true);

      await api(`/api/visits/${id}/cancel`, {
        method: "POST",

        body: json({
          comment: "Agendamento cancelado.",
        }),
      });

      setSuccess("Visita cancelada.");

      await loadDashboard();
    } catch (cause) {
      setError(visitErrorMessage(cause, "Não foi possível cancelar a visita."));
    } finally {
      setBusy(false);
    }
  }

  const sectionProps = {
    busy,
    onView: viewVisit,
    onStart: startVisit,
    onComplete: completeVisit,
    onCancel: cancelVisit,
  };

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Agendamento de Visitas
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Agenda
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe as visitas liberadas e o atendimento realizado pela
            recepção.
          </p>
        </div>
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

      {loadError ? (
        <Alert title="Não foi possível carregar a agenda" tone="danger">
          <p>{loadError}</p>
          <Button
            className="mt-3"
            onClick={() => void loadDashboard()}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : loading && !dashboard ? (
        <>
          <VisitStats
            items={[
              { label: "Hoje", value: 0 },
              { label: "Amanhã", value: 0 },
              { label: "Em atendimento", value: 0 },
            ]}
            label="Resumo da agenda"
            loading
          />

          <Card>
            <CardHeader>
              <h2 className="font-bold">Visitas de hoje</h2>
            </CardHeader>

            <TableSkeleton
              ariaLabel="Carregando agenda"
              headers={sectionHeaders}
              rows={3}
            />
          </Card>
        </>
      ) : dashboard ? (
        <>
          <VisitStats
            items={[
              { label: "Hoje", value: dashboard.counters.today },
              { label: "Amanhã", value: dashboard.counters.tomorrow },
              { label: "Em atendimento", value: dashboard.counters.inProgress },
            ]}
            label="Resumo da agenda"
          />

          <AgendaSection
            title="Visitas de hoje"
            description="Compromissos previstos para hoje"
            emptyDescription="Nenhum compromisso previsto para hoje."
            visits={dashboard.today}
            {...sectionProps}
          />

          <AgendaSection
            title="Visitas de amanhã"
            description="Compromissos previstos para amanhã"
            emptyDescription="Nenhum compromisso registrado para amanhã."
            visits={dashboard.tomorrow}
            {...sectionProps}
          />

          <AgendaSection
            title="Próximas visitas"
            description="Agendamentos dos próximos dias"
            emptyDescription="Os próximos agendamentos aparecerão aqui."
            visits={dashboard.upcoming}
            {...sectionProps}
          />
        </>
      ) : null}

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
      >
        <DialogContent
          className="max-w-2xl"
          title={detail?.subject ?? "Detalhes da visita"}
          description={detail?.protocol}
        >
          {detail ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <VisitDetail label="Órgão">{detail.organization}</VisitDetail>

                <VisitDetail label="Local">{detail.location}</VisitDetail>

                <VisitDetail label="Data">
                  {formatVisitDate(detail.scheduledDate)}
                </VisitDetail>

                <VisitDetail label="Horário">
                  {formatVisitTime(detail.startTime, detail.endTime)}
                </VisitDetail>

                <VisitDetail label="Tipo">
                  {visitTypeLabels[detail.type]}
                </VisitDetail>

                <VisitDetail label="Situação">
                  <Badge
                    className="whitespace-nowrap"
                    variant={visitStatusMeta[detail.status].variant}
                  >
                    {visitStatusMeta[detail.status].label}
                  </Badge>
                </VisitDetail>
              </dl>

              <section className="mt-6 border-t border-[var(--border)] pt-5">
                <h3 className="font-bold">Visitantes</h3>

                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {detail.visitors.map((visitor) => (
                    <li className="py-3 first:pt-0 last:pb-0" key={visitor.id}>
                      <p className="text-sm font-semibold">{visitor.name}</p>

                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {visitor.organization}
                        {visitor.position ? ` · ${visitor.position}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgendaSection({
  title,
  description,
  emptyDescription,
  visits,
  busy,
  onView,
  onStart,
  onComplete,
  onCancel,
}: {
  title: string;

  description: string;

  emptyDescription: string;

  visits: VisitSummary[];

  busy: boolean;

  onView: (id: string) => Promise<void>;

  onStart: (id: string) => Promise<void>;

  onComplete: (id: string) => Promise<void>;

  onCancel: (id: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="font-bold">{title}</h2>

          <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
        </div>
      </CardHeader>

      {visits.length === 0 ? (
        <EmptyState title="Nenhuma visita" description={emptyDescription} />
      ) : (
        <Table>
          <thead>
            <tr>
              {sectionHeaders.map((header) => (
                <TableHead
                  className={header === "Ações" ? "text-right" : undefined}
                  key={header}
                >
                  {header}
                </TableHead>
              ))}
            </tr>
          </thead>

          <tbody>
            {visits.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="whitespace-nowrap">
                  <p className="font-semibold">
                    {formatVisitDate(visit.scheduledDate)}
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                    {formatVisitTime(visit.startTime, visit.endTime)}
                  </p>
                </TableCell>

                <TableCell className="min-w-56">
                  <p className="font-semibold">{visit.subject}</p>

                  <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                    {visit.organization} · {visit.location}
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

                <TableCell>
                  <div className="flex justify-end gap-1 whitespace-nowrap">
                    {visit.status === "scheduled" ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void onStart(visit.id)}
                      >
                        Iniciar
                      </Button>
                    ) : null}

                    {visit.status === "in_progress" ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void onComplete(visit.id)}
                      >
                        Concluir
                      </Button>
                    ) : null}

                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => void onView(visit.id)}
                    >
                      Ver detalhes
                    </Button>

                    {cancellable.includes(visit.status) ? (
                      <ConfirmDialog
                        busyLabel="Cancelando…"
                        cancelLabel="Voltar"
                        confirmLabel="Cancelar visita"
                        description={`"${visit.subject}" sairá da agenda e ficará no histórico como cancelada.`}
                        onConfirm={() => onCancel(visit.id)}
                        title="Cancelar visita?"
                      >
                        <Button disabled={busy} size="sm" variant="quiet">
                          Cancelar
                        </Button>
                      </ConfirmDialog>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
