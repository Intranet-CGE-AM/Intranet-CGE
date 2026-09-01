import type {
  Visit,
  VisitPageResult,
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
  EmptyState,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import {
  Eye,
  MagnifyingGlass,
  X,
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
} from "../lib/api";

import {
  visitStatusLabels,
  visitTypeLabels,
} from "../lib/visit-labels";

/* =========================================================
 * CONSTANTES
 * ======================================================= */

const eventLabels: Record<string, string> = {
  "visit.created":
    "Visita cadastrada",

  "visit.updated":
    "Dados atualizados",

  "visit.approved":
    "Visita aprovada",

  "visit.rejected":
    "Visita recusada",

  "visit.released_reception":
    "Liberada para recepção",

  "visit.started":
    "Atendimento iniciado",

  "visit.completed":
    "Atendimento concluído",

  "visit.cancelled":
    "Visita cancelada",
};

/* =========================================================
 * PÁGINA
 * ======================================================= */

export function VisitHistoryPage() {
  const [
    visits,
    setVisits,
  ] = useState<VisitSummary[]>([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    type,
    setType,
  ] = useState<VisitType | "">("");

  const [
    status,
    setStatus,
  ] = useState<VisitStatus | "">("");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    detail,
    setDetail,
  ] = useState<Visit | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const pageSize = 10;

  /* =======================================================
   * CARREGAR HISTÓRICO
   * ===================================================== */

  const loadHistory =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams({
            page:
              String(page),

            pageSize:
              String(pageSize),
          });

        if (search) {
          params.set(
            "query",
            search,
          );
        }

        if (type) {
          params.set(
            "type",
            type,
          );
        }

        if (status) {
          params.set(
            "status",
            status,
          );
        }

        const result =
          await api<VisitPageResult>(
            `/api/visits?${params.toString()}`,
          );

        setVisits(
          result.visits,
        );

        setTotal(
          result.pagination.total,
        );

        setTotalPages(
          result.pagination.totalPages,
        );
      } catch (cause) {
        setError(
          getErrorMessage(
            cause,
            "Não foi possível carregar o histórico.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [
      page,
      search,
      type,
      status,
    ]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /* =======================================================
   * PESQUISA COM DELAY
   * ===================================================== */

  useEffect(() => {
    const normalized =
      query.trim();

    if (
      normalized ===
      search
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setPage(1);
          setSearch(normalized);
        },
        300,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [
    query,
    search,
  ]);

  /* =======================================================
   * DETALHES
   * ===================================================== */

  async function openDetail(
    id: string,
  ) {
    try {
      setDetailLoading(true);
      setError("");

      const visit =
        await api<Visit>(
          `/api/visits/${id}`,
        );

      setDetail(visit);
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          "Não foi possível consultar o histórico da visita.",
        ),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setSearch("");
    setType("");
    setStatus("");
    setPage(1);
  }

  /* =======================================================
   * RENDER
   * ===================================================== */

  return (
    <div className="page-enter space-y-5 pb-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Agendamento de Visitas
        </p>

        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
          Histórico
        </h1>

        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Consulte agendamentos e acompanhe
          os eventos registrados em cada visita.
        </p>
      </div>

      {error ? (
        <Alert
          title="Não foi possível concluir a operação"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      {/* FILTROS */}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">
              Consultar histórico
            </h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Pesquise por protocolo, órgão,
              motivo, tipo ou situação.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <MagnifyingGlass
                aria-hidden="true"
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />

              <Input
                className="pl-9"
                placeholder="Protocolo, órgão ou motivo"
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
              />
            </div>

            <select
              aria-label="Tipo da visita"
              className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={type}
              onChange={(event) => {
                setType(
                  event.target.value as
                    | VisitType
                    | "",
                );

                setPage(1);
              }}
            >
              <option value="">
                Todos os tipos
              </option>

              {Object.entries(
                visitTypeLabels,
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>

            <select
              aria-label="Situação da visita"
              className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value as
                    | VisitStatus
                    | "",
                );

                setPage(1);
              }}
            >
              <option value="">
                Todas as situações
              </option>

              {Object.entries(
                visitStatusLabels,
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={
                clearFilters
              }
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TABELA */}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">
              Registros
            </h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {total} visita(s) encontrada(s).
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              Carregando histórico...
            </p>
          ) : visits.length ===
            0 ? (
            <EmptyState
              title="Nenhum registro encontrado"
              description="Altere os filtros para consultar outros agendamentos."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <TableHead>
                        Protocolo
                      </TableHead>

                      <TableHead>
                        Data
                      </TableHead>

                      <TableHead>
                        Tipo
                      </TableHead>

                      <TableHead>
                        Motivo
                      </TableHead>

                      <TableHead>
                        Órgão
                      </TableHead>

                      <TableHead>
                        Sala
                      </TableHead>

                      <TableHead>
                        Situação
                      </TableHead>

                      <TableHead>
                        Ações
                      </TableHead>
                    </tr>
                  </thead>

                  <tbody>
                    {visits.map(
                      (visit) => (
                        <TableRow
                          key={visit.id}
                        >
                          <TableCell>
                            <strong>
                              {visit.protocol}
                            </strong>
                          </TableCell>

                          <TableCell>
                            {formatDate(
                              visit.scheduledDate,
                            )}
                          </TableCell>

                          <TableCell>
                            {
                              visitTypeLabels[
                                visit.type
                              ]
                            }
                          </TableCell>

                          <TableCell>
                            {visit.subject}
                          </TableCell>

                          <TableCell>
                            {visit.organization}
                          </TableCell>

                          <TableCell>
                            {visit.location}
                          </TableCell>

                          <TableCell>
                            <Badge variant="neutral">
                              {
                                visitStatusLabels[
                                  visit.status
                                ]
                              }
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={
                                detailLoading
                              }
                              onClick={() =>
                                void openDetail(
                                  visit.id,
                                )
                              }
                            >
                              <Eye size={15} />
                              Visualizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </tbody>
                </Table>
              </div>

              {/* PAGINAÇÃO */}

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-[var(--text-muted)]">
                  Página {page} de{" "}
                  {Math.max(
                    totalPages,
                    1,
                  )}
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      page <= 1
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1,
                          ),
                      )
                    }
                  >
                    Anterior
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      page >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current + 1,
                      )
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* MODAL */}

      {detail ? (
        <ModalOverlay>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[14px] bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  Histórico da visita
                </p>

                <h2 className="mt-1 text-xl font-extrabold">
                  {detail.protocol}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setDetail(null)
                }
              >
                <X size={21} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailItem
                label="Motivo"
                value={detail.subject}
              />

              <DetailItem
                label="Tipo"
                value={
                  visitTypeLabels[
                    detail.type
                  ]
                }
              />

              <DetailItem
                label="Órgão"
                value={
                  detail.organization
                }
              />

              <DetailItem
                label="Sala"
                value={
                  detail.location
                }
              />

              <DetailItem
                label="Data"
                value={
                  formatDate(
                    detail.scheduledDate,
                  )
                }
              />

              <DetailItem
                label="Horário"
                value={`${detail.startTime.slice(
                  0,
                  5,
                )} - ${detail.endTime.slice(
                  0,
                  5,
                )}`}
              />

              <DetailItem
                label="Situação atual"
                value={
                  visitStatusLabels[
                    detail.status
                  ]
                }
              />
            </div>

            {/* VISITANTES */}

            <div className="mt-7 border-t border-[var(--border)] pt-5">
              <h3 className="font-extrabold">
                Visitantes
              </h3>

              <div className="mt-3 space-y-3">
                {detail.visitors.map(
                  (visitor) => (
                    <div
                      key={visitor.id}
                      className="rounded-[10px] border border-[var(--border)] p-4"
                    >
                      <strong>
                        {visitor.name}
                      </strong>

                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {visitor.organization}

                        {visitor.position
                          ? ` • ${visitor.position}`
                          : ""}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* LINHA DO TEMPO */}

            <div className="mt-7 border-t border-[var(--border)] pt-5">
              <h3 className="font-extrabold">
                Linha do tempo
              </h3>

              {detail.events.length ===
              0 ? (
                <p className="mt-4 text-sm text-[var(--text-muted)]">
                  Nenhum evento registrado.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.events.map(
                    (event) => (
                      <div
                        key={event.id}
                        className="rounded-[10px] border border-[var(--border)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <strong className="text-sm">
                            {eventLabels[
                              event.type
                            ] ??
                              event.type}
                          </strong>

                          <span className="text-xs text-[var(--text-muted)]">
                            {formatDateTime(
                              event.createdAt,
                            )}
                          </span>
                        </div>

                        {event.comment ? (
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            {event.comment}
                          </p>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

/* =========================================================
 * COMPONENTES
 * ======================================================= */

function ModalOverlay({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {children}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </p>

      <p className="mt-1 text-sm">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
 * HELPERS
 * ======================================================= */

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

function formatDateTime(
  value:
    | Date
    | string,
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone:
        "America/Manaus",
    },
  ).format(date);
}

function getErrorMessage(
  cause: unknown,
  fallback: string,
) {
  return cause instanceof
    ApiError
    ? cause.message
    : fallback;
}