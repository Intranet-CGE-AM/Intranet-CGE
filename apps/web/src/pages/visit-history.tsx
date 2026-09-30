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
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  FormField,
  Input,
  Select,
  TableSkeleton,
  type ColumnDef,
} from "@cge/ui";

import { MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react";

import { useCallback, useEffect, useState } from "react";

import { VisitDetail } from "../components/visit-ui";
import { api } from "../lib/api";
import {
  formatVisitDate,
  formatVisitDateTime,
  formatVisitTime,
  visitErrorMessage,
  visitStatusLabels,
  visitStatusMeta,
  visitTypeLabels,
} from "../lib/visit-labels";

const eventLabels: Record<string, string> = {
  "visit.created": "Visita cadastrada",

  "visit.updated": "Dados atualizados",

  "visit.approved": "Visita aprovada",

  "visit.rejected": "Visita recusada",

  "visit.released_reception": "Liberada para recepção",

  "visit.started": "Atendimento iniciado",

  "visit.completed": "Atendimento concluído",

  "visit.cancelled": "Visita cancelada",
};

// Radix Select does not accept an empty value, so "all" stands for no filter.
const ALL = "all";

const typeOptions = [
  { value: ALL, label: "Todos os tipos" },
  ...Object.entries(visitTypeLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

const statusOptions = [
  { value: ALL, label: "Todas as situações" },
  ...Object.entries(visitStatusLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

const tableHeaders = [
  "Protocolo",
  "Data",
  "Tipo",
  "Motivo",
  "Órgão",
  "Sala",
  "Situação",
  "Ações",
];

export function VisitHistoryPage() {
  const [visits, setVisits] = useState<VisitSummary[]>([]);

  const [query, setQuery] = useState("");

  const [search, setSearch] = useState("");

  const [type, setType] = useState<VisitType | "">("");

  const [status, setStatus] = useState<VisitStatus | "">("");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [total, setTotal] = useState(0);

  const [detail, setDetail] = useState<Visit | null>(null);

  const [loading, setLoading] = useState(true);

  const [detailLoading, setDetailLoading] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [error, setError] = useState("");

  const hasFilters = Boolean(query.trim() || type || status);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const params = new URLSearchParams({
        page: String(page),

        pageSize: String(pageSize),
      });

      if (search) {
        params.set("query", search);
      }

      if (type) {
        params.set("type", type);
      }

      if (status) {
        params.set("status", status);
      }

      const result = await api<VisitPageResult>(
        `/api/visits?${params.toString()}`,
      );

      setVisits(result.visits);

      setTotal(result.pagination.total);
    } catch (cause) {
      setLoadError(
        visitErrorMessage(cause, "Não foi possível carregar o histórico."),
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, type, status]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Debounce the free-text search.
  useEffect(() => {
    const normalized = query.trim();

    if (normalized === search) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(normalized);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query, search]);

  async function openDetail(id: string) {
    try {
      setDetailLoading(true);
      setError("");

      const visit = await api<Visit>(`/api/visits/${id}`);

      setDetail(visit);
    } catch (cause) {
      setError(
        visitErrorMessage(
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

  const columns: ColumnDef<VisitSummary>[] = [
    {
      header: "Protocolo",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-semibold">
          {row.original.protocol}
        </span>
      ),
    },
    {
      header: "Data",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatVisitDate(row.original.scheduledDate)}
        </span>
      ),
    },
    {
      header: "Tipo",
      cell: ({ row }) => visitTypeLabels[row.original.type],
    },
    {
      header: "Motivo",
      cell: ({ row }) => (
        <span className="line-clamp-2 min-w-48">{row.original.subject}</span>
      ),
    },
    {
      header: "Órgão",
      cell: ({ row }) => row.original.organization,
    },
    {
      header: "Sala",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{row.original.location}</span>
      ),
    },
    {
      header: "Situação",
      cell: ({ row }) => (
        <Badge
          className="whitespace-nowrap"
          variant={visitStatusMeta[row.original.status].variant}
        >
          {visitStatusMeta[row.original.status].label}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Ações</span>,
      cell: ({ row }) => (
        <div className="flex justify-end whitespace-nowrap">
          <Button
            type="button"
            size="sm"
            variant="quiet"
            disabled={detailLoading}
            onClick={() => void openDetail(row.original.id)}
          >
            Ver detalhes
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Agendamento de Visitas
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Histórico
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Consulte agendamentos e acompanhe os eventos registrados em cada
            visita.
          </p>
        </div>
      </div>

      {error ? (
        <Alert title="A consulta não foi concluída" tone="danger">
          {error}
        </Alert>
      ) : null}

      {loadError ? (
        <Alert title="Não foi possível carregar o histórico" tone="danger">
          <p>{loadError}</p>
          <Button
            className="mt-3"
            onClick={() => void loadHistory()}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="items-start">
          <div>
            <h2 className="font-bold">Registros</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {loading
                ? "Consultando registros…"
                : `${total} ${total === 1 ? "visita encontrada" : "visitas encontradas"}`}
            </p>
          </div>

          {hasFilters ? (
            <Button
              type="button"
              size="sm"
              variant="quiet"
              onClick={clearFilters}
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              Limpar filtros
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="border-b border-[var(--border)] py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <FormField
              className="sm:col-span-2 lg:col-span-1"
              htmlFor="history-search"
              label="Buscar"
            >
              <div className="relative">
                <MagnifyingGlass
                  aria-hidden="true"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                />

                <Input
                  autoComplete="off"
                  className="pl-9"
                  id="history-search"
                  placeholder="Protocolo, órgão ou motivo"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </FormField>

            <FormField htmlFor="history-type" label="Tipo da visita">
              <Select
                id="history-type"
                name="type"
                options={typeOptions}
                value={type || ALL}
                onValueChange={(value) => {
                  setType(value === ALL ? "" : (value as VisitType));

                  setPage(1);
                }}
              />
            </FormField>

            <FormField htmlFor="history-status" label="Situação">
              <Select
                id="history-status"
                name="status"
                options={statusOptions}
                value={status || ALL}
                onValueChange={(value) => {
                  setStatus(value === ALL ? "" : (value as VisitStatus));

                  setPage(1);
                }}
              />
            </FormField>
          </div>
        </CardContent>

        {loading ? (
          <TableSkeleton
            ariaLabel="Carregando histórico de visitas"
            headers={tableHeaders}
            rows={Math.min(pageSize, 6)}
          />
        ) : total ? (
          <DataTable
            ariaLabel="Histórico de visitas"
            columns={columns}
            data={visits}
            getRowId={(visit) => visit.id}
            itemLabel="visitas"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50]}
            total={total}
          />
        ) : hasFilters ? (
          <EmptyState
            title="Nenhum resultado para os filtros"
            description="Ajuste ou limpe os filtros para ampliar a consulta."
          />
        ) : (
          <EmptyState
            title="Nenhuma visita registrada"
            description="Os agendamentos cadastrados aparecerão aqui."
          />
        )}
      </Card>

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
      >
        <DialogContent
          className="max-w-2xl"
          title="Histórico da visita"
          description={detail?.protocol}
        >
          {detail ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <VisitDetail label="Motivo">{detail.subject}</VisitDetail>

                <VisitDetail label="Tipo">
                  {visitTypeLabels[detail.type]}
                </VisitDetail>

                <VisitDetail label="Órgão">{detail.organization}</VisitDetail>

                <VisitDetail label="Sala">{detail.location}</VisitDetail>

                <VisitDetail label="Data">
                  {formatVisitDate(detail.scheduledDate)}
                </VisitDetail>

                <VisitDetail label="Horário">
                  {formatVisitTime(detail.startTime, detail.endTime)}
                </VisitDetail>

                <VisitDetail label="Situação atual">
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

              <section className="mt-6 border-t border-[var(--border)] pt-5">
                <h3 className="font-bold">Linha do tempo</h3>

                {detail.events.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Nenhum evento registrado.
                  </p>
                ) : (
                  <ol className="mt-4 border-l border-[var(--border)]">
                    {detail.events.map((event) => (
                      <li
                        className="relative pb-5 pl-5 last:pb-0"
                        key={event.id}
                      >
                        <span className="absolute -left-1 top-1 size-2 rounded-full bg-[var(--brand)]" />

                        <p className="text-sm font-semibold">
                          {eventLabels[event.type] ?? event.type}
                        </p>

                        <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                          {formatVisitDateTime(event.createdAt)}
                        </p>

                        {event.comment ? (
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            {event.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
