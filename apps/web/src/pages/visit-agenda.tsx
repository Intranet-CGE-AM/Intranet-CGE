import type {
  Visit,
  VisitDashboard,
  VisitStatus,
  VisitSummary,
} from "@cge/contracts";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
} from "@cge/ui";

import {
  CheckCircle,
  Eye,
  Play,
  X,
  XCircle,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  ApiError,
  json,
} from "../lib/api";

const statusLabels:
  Record<
    VisitStatus,
    string
  > = {
  pending:
    "Pendente",

  approved:
    "Aprovada",

  scheduled:
    "Liberada para recepção",

  in_progress:
    "Em atendimento",

  completed:
    "Concluída",

  cancelled:
    "Cancelada",

  rejected:
    "Recusada",
};

function statusVariant(
  status: VisitStatus,
):
  | "neutral"
  | "warning"
  | "success"
  | "danger"
  | "brand" {
  switch (status) {
    case "pending":
    case "in_progress":
      return "warning";

    case "approved":
    case "scheduled":
      return "brand";

    case "completed":
      return "success";

    case "rejected":
      return "danger";

    default:
      return "neutral";
  }
}

export function VisitAgendaPage() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      VisitDashboard | null
    >(null);

  const [
    detail,
    setDetail,
  ] =
    useState<
      Visit | null
    >(null);

  const [
    cancelId,
    setCancelId,
  ] =
    useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const loadDashboard =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          setError("");

          const result =
            await api<VisitDashboard>(
              "/api/visits/dashboard",
            );

          setDashboard(
            result,
          );
        } catch (
          cause
        ) {
          setError(
            getError(
              cause,
              "Não foi possível carregar a agenda.",
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function viewVisit(
    id: string,
  ) {
    try {
      const result =
        await api<Visit>(
          `/api/visits/${id}`,
        );

      setDetail(
        result,
      );
    } catch (
      cause
    ) {
      setError(
        getError(
          cause,
          "Não foi possível consultar a visita.",
        ),
      );
    }
  }

  async function startVisit(
    id: string,
  ) {
    try {
      setBusy(true);

      setError("");

      await api(
        `/api/visits/${id}/start`,
        {
          method:
            "POST",
        },
      );

      setSuccess(
        "Atendimento iniciado.",
      );

      await loadDashboard();
    } catch (
      cause
    ) {
      setError(
        getError(
          cause,
          "Não foi possível iniciar o atendimento.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeVisit(
    id: string,
  ) {
    try {
      setBusy(true);

      setError("");

      await api(
        `/api/visits/${id}/complete`,
        {
          method:
            "POST",
        },
      );

      setSuccess(
        "Atendimento concluído.",
      );

      await loadDashboard();
    } catch (
      cause
    ) {
      setError(
        getError(
          cause,
          "Não foi possível concluir o atendimento.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelVisit() {
    if (!cancelId) {
      return;
    }

    try {
      setBusy(true);

      await api(
        `/api/visits/${cancelId}/cancel`,
        {
          method:
            "POST",

          body:
            json({
              comment:
                "Agendamento cancelado.",
            }),
        },
      );

      setCancelId(
        null,
      );

      setSuccess(
        "Visita cancelada.",
      );

      await loadDashboard();
    } catch (
      cause
    ) {
      setError(
        getError(
          cause,
          "Não foi possível cancelar a visita.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-enter space-y-5 pb-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Agendamento de Visitas
        </p>

        <h1 className="mt-1 text-2xl font-extrabold md:text-[30px]">
          Agenda
        </h1>

        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Acompanhe as visitas liberadas e o atendimento
          realizado pela recepção.
        </p>
      </div>

      {error ? (
        <Alert
          title="Erro"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert
          title="Operação concluída"
          tone="success"
        >
          {success}
        </Alert>
      ) : null}

      {loading ? (
        <Card>
          <CardContent>
            <p className="py-10 text-center">
              Carregando agenda...
            </p>
          </CardContent>
        </Card>
      ) : dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Counter
              title="Hoje"
              value={
                dashboard.counters.today
              }
            />

            <Counter
              title="Amanhã"
              value={
                dashboard.counters.tomorrow
              }
            />

            <Counter
              title="Em atendimento"
              value={
                dashboard.counters.inProgress
              }
            />
          </div>

          <AgendaSection
            title="Visitas de hoje"
            visits={
              dashboard.today
            }
            busy={
              busy
            }
            onView={
              viewVisit
            }
            onStart={
              startVisit
            }
            onComplete={
              completeVisit
            }
            onCancel={
              setCancelId
            }
          />

          <AgendaSection
            title="Visitas de amanhã"
            visits={
              dashboard.tomorrow
            }
            busy={
              busy
            }
            onView={
              viewVisit
            }
            onStart={
              startVisit
            }
            onComplete={
              completeVisit
            }
            onCancel={
              setCancelId
            }
          />

          <AgendaSection
            title="Próximas visitas"
            visits={
              dashboard.upcoming
            }
            busy={
              busy
            }
            onView={
              viewVisit
            }
            onStart={
              startVisit
            }
            onComplete={
              completeVisit
            }
            onCancel={
              setCancelId
            }
          />
        </>
      ) : null}

      {cancelId ? (
        <ModalOverlay>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold">
              Cancelar visita?
            </h2>

            <p className="mt-2 text-sm text-[var(--text-muted)]">
              O registro será mantido no histórico como cancelado.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setCancelId(
                    null,
                  )
                }
              >
                Voltar
              </Button>

              <Button
                variant="danger"
                disabled={
                  busy
                }
                onClick={() =>
                  void cancelVisit()
                }
              >
                <XCircle
                  size={16}
                />

                Cancelar
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {detail ? (
        <ModalOverlay>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-extrabold">
                  {detail.subject}
                </h2>

                <p className="text-sm text-[var(--text-muted)]">
                  {detail.protocol}
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setDetail(
                    null,
                  )
                }
              >
                <X
                  size={20}
                />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail
                label="Órgão"
                value={
                  detail.organization
                }
              />

              <Detail
                label="Local"
                value={
                  detail.location
                }
              />

              <Detail
                label="Data"
                value={
                  formatDate(
                    detail.scheduledDate,
                  )
                }
              />

              <Detail
                label="Status"
                value={
                  statusLabels[
                    detail.status
                  ]
                }
              />
            </div>

            <div className="mt-6">
              <h3 className="font-bold">
                Visitantes
              </h3>

              {detail.visitors.map(
                (visitor) => (
                  <div
                    key={
                      visitor.id
                    }
                    className="mt-2 rounded-xl border p-3"
                  >
                    <strong>
                      {visitor.name}
                    </strong>

                    <p className="text-sm text-[var(--text-muted)]">
                      {
                        visitor.organization
                      }
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function AgendaSection({
  title,
  visits,
  busy,
  onView,
  onStart,
  onComplete,
  onCancel,
}: {
  title: string;

  visits:
    VisitSummary[];

  busy:
    boolean;

  onView:
    (id: string) =>
      Promise<void>;

  onStart:
    (id: string) =>
      Promise<void>;

  onComplete:
    (id: string) =>
      Promise<void>;

  onCancel:
    (id: string) =>
      void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-extrabold">
          {title}
        </h2>
      </CardHeader>

      <CardContent>
        {visits.length ===
        0 ? (
          <EmptyState
            title="Nenhuma visita"
            description="Não existem agendamentos nesta categoria."
          />
        ) : (
          <div className="space-y-3">
            {visits.map(
              (visit) => (
                <div
                  key={
                    visit.id
                  }
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--border)] p-4 lg:flex-row lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <strong>
                        {
                          visit.subject
                        }
                      </strong>

                      <Badge
                        variant={
                          statusVariant(
                            visit.status,
                          )
                        }
                      >
                        {
                          statusLabels[
                            visit.status
                          ]
                        }
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {
                        visit.organization
                      }
                    </p>

                    <p className="mt-1 text-xs">
                      {formatDate(
                        visit.scheduledDate,
                      )}
                      {" · "}
                      {
                        visit.startTime
                      }
                      {" às "}
                      {
                        visit.endTime
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void onView(
                          visit.id,
                        )
                      }
                    >
                      <Eye
                        size={15}
                      />

                      Consultar
                    </Button>

                    {visit.status ===
                    "scheduled" ? (
                      <Button
                        size="sm"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void onStart(
                            visit.id,
                          )
                        }
                      >
                        <Play
                          size={15}
                        />

                        Iniciar
                      </Button>
                    ) : null}

                    {visit.status ===
                    "in_progress" ? (
                      <Button
                        size="sm"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void onComplete(
                            visit.id,
                          )
                        }
                      >
                        <CheckCircle
                          size={15}
                        />

                        Concluir
                      </Button>
                    ) : null}

                    {[
                      "pending",
                      "approved",
                      "scheduled",
                    ].includes(
                      visit.status,
                    ) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          onCancel(
                            visit.id,
                          )
                        }
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Counter({
  title,
  value,
}: {
  title: string;

  value: number;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-bold uppercase text-[var(--text-faint)]">
          {title}
        </p>

        <p className="mt-2 text-3xl font-extrabold">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ModalOverlay({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {children}
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-[var(--text-faint)]">
        {label}
      </p>

      <p className="mt-1 text-sm">
        {value}
      </p>
    </div>
  );
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

function getError(
  cause: unknown,
  fallback: string,
) {
  return cause instanceof
    ApiError
    ? cause.message
    : fallback;
}