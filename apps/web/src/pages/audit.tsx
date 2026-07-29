import type { AuditEvent, AuditOutcome, AuditPage } from "@cge/contracts";
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
  SearchableMultiSelect,
  TableSkeleton,
  type ColumnDef,
} from "@cge/ui";
import {
  DownloadSimple,
  MagnifyingGlass,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth";
import { api, ApiError } from "../lib/api";
import { canGlobally } from "../lib/permissions";

const actionLabels: Record<string, string> = {
  "account.created": "Conta criada",
  "account.deactivated": "Conta desativada",
  "account.password-reset": "Senha redefinida",
  "auth.login": "Entrada na intranet",
  "auth.logout": "Saída da intranet",
  "auth.password-change": "Senha alterada",
  "people-import.apply": "Importação aplicada",
  "people-import.preview": "Importação validada",
  "person.avatar-deleted": "Foto removida",
  "person.avatar-updated": "Foto atualizada",
  "person.created": "Pessoa cadastrada",
  "person.deactivated": "Pessoa desativada",
  "person.updated": "Pessoa atualizada",
  "permission-override.created": "Ajuste individual aplicado",
  "permission-override.deleted": "Ajuste individual removido",
  "platform-admin.bootstrapped": "Administrador inicial criado",
  "role-assignment.created": "Perfil atribuído",
  "role-assignment.deleted": "Perfil removido",
  "role.created": "Perfil criado",
  "role.updated": "Perfil atualizado",
  "vacation.cancelled": "Férias canceladas",
  "vacation.final-approved": "Férias aprovadas",
  "vacation.final-rejected": "Férias rejeitadas",
  "vacation.submitted": "Férias solicitadas",
  "vacation.supervisor-approved": "Chefia aprovou férias",
  "vacation.supervisor-rejected": "Chefia rejeitou férias",
};

const objectLabels: Record<string, string> = {
  account: "Conta de acesso",
  "homolog-fixture": "Cenário de homologação",
  "import-run": "Importação de pessoas",
  person: "Pessoa",
  "permission-override": "Ajuste individual",
  role: "Perfil de acesso",
  "role-assignment": "Perfil atribuído",
  "vacation-request": "Solicitação de férias",
};

const outcomeLabels: Record<AuditOutcome, string> = {
  success: "Sucesso",
  failure: "Falha",
  denied: "Negado",
};

export function AuditPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [outcomes, setOutcomes] = useState<AuditOutcome[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canExport = Boolean(user && canGlobally(user, "audit.export"));

  const filters = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) filters.set("query", search);
  if (outcomes.length) filters.set("outcome", outcomes.join(","));
  if (actions.length) filters.set("action", actions.join(","));
  if (objectTypes.length) filters.set("objectType", objectTypes.join(","));
  if (from) filters.set("from", from);
  if (to) filters.set("to", to);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError("");
        const result = await api<AuditPage>(`/api/audit-events?${filters}`, {
          signal,
        });
        if (
          result.pagination.totalPages &&
          page > result.pagination.totalPages
        ) {
          setPage(result.pagination.totalPages);
          return;
        }
        setEvents(result.events);
        setTotal(result.pagination.total);
      } catch (cause) {
        if (isAbortError(cause)) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível consultar os eventos de auditoria.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [actions, from, objectTypes, outcomes, page, pageSize, search, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (query.trim() === search) return;
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(query.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, search]);

  const columns: ColumnDef<AuditEvent>[] = [
    {
      header: "Evento",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold">
            {actionLabels[row.original.action] ?? row.original.action}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-faint)]">
            {row.original.action}
          </p>
        </div>
      ),
    },
    {
      header: "Responsável",
      cell: ({ row }) =>
        row.original.actor ? (
          <div>
            <p className="font-semibold">{row.original.actor.displayName}</p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              {row.original.actor.email}
            </p>
          </div>
        ) : (
          <span className="text-[var(--text-muted)]">Sistema</span>
        ),
    },
    {
      header: "Objeto",
      cell: ({ row }) => (
        <div>
          <p>
            {objectLabels[row.original.objectType] ?? row.original.objectType}
          </p>
          {row.original.objectId ? (
            <p className="mt-0.5 max-w-44 truncate font-mono text-[10px] text-[var(--text-faint)]">
              {row.original.objectId}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Resultado",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.outcome === "success"
              ? "success"
              : row.original.outcome === "denied"
                ? "warning"
                : "danger"
          }
        >
          {outcomeLabels[row.original.outcome]}
        </Badge>
      ),
    },
    {
      header: "Data",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-[var(--text-muted)]">
          {new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Manaus",
          }).format(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: "details",
      header: "Detalhes",
      cell: ({ row }) => (
        <Button
          aria-label={`Ver detalhes de ${actionLabels[row.original.action] ?? row.original.action}`}
          onClick={() => setSelected(row.original)}
          size="sm"
          variant="quiet"
        >
          Ver detalhes
        </Button>
      ),
    },
  ];

  const exportFilters = new URLSearchParams(filters);
  exportFilters.delete("page");
  exportFilters.delete("pageSize");

  function clearFilters() {
    setQuery("");
    setSearch("");
    setOutcomes([]);
    setActions([]);
    setObjectTypes([]);
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Plataforma
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Auditoria
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Pesquise ações, responsáveis e objetos registrados pela plataforma.
          </p>
        </div>
        {canExport ? (
          <Button asChild size="sm" variant="secondary">
            <a href={`/api/audit-events/export?${exportFilters}`} download>
              <DownloadSimple aria-hidden="true" size={16} />
              Exportar resultado
            </a>
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert title="Auditoria indisponível" tone="danger">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="items-start">
          <div>
            <h2 className="font-bold">Eventos registrados</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Os filtros também são aplicados ao arquivo exportado.
            </p>
          </div>
          <Button onClick={clearFilters} size="sm" variant="quiet">
            <SlidersHorizontal aria-hidden="true" size={16} />
            Limpar filtros
          </Button>
        </CardHeader>
        <CardContent className="border-b border-[var(--border)] py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <FormField
              className="md:col-span-2 xl:col-span-2"
              htmlFor="auditSearch"
              label="Buscar nos registros"
            >
              <div className="relative">
                <MagnifyingGlass
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                  size={16}
                />
                <Input
                  autoComplete="off"
                  className="pl-9"
                  id="auditSearch"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ação, pessoa, e-mail ou metadados"
                  type="search"
                  value={query}
                />
              </div>
            </FormField>
            <FormField htmlFor="auditOutcome" label="Resultado">
              <SearchableMultiSelect
                id="auditOutcome"
                name="auditOutcome"
                onValuesChange={(values) => {
                  setPage(1);
                  setOutcomes(values as AuditOutcome[]);
                }}
                options={[
                  { label: "Sucesso", value: "success" },
                  { label: "Falha", value: "failure" },
                  { label: "Negado", value: "denied" },
                ]}
                placeholder="Todos"
                searchPlaceholder="Pesquisar resultado…"
                values={outcomes}
              />
            </FormField>
            <FormField htmlFor="auditObject" label="Área">
              <SearchableMultiSelect
                id="auditObject"
                name="auditObject"
                onValuesChange={(values) => {
                  setPage(1);
                  setObjectTypes(values);
                }}
                options={Object.entries(objectLabels).map(([value, label]) => ({
                  label,
                  value,
                }))}
                placeholder="Todas"
                searchPlaceholder="Pesquisar área…"
                values={objectTypes}
              />
            </FormField>
            <FormField htmlFor="auditAction" label="Evento">
              <SearchableMultiSelect
                id="auditAction"
                name="auditAction"
                onValuesChange={(values) => {
                  setPage(1);
                  setActions(values);
                }}
                options={Object.entries(actionLabels)
                  .sort(([, left], [, right]) =>
                    left.localeCompare(right, "pt-BR"),
                  )
                  .map(([value, label]) => ({ label, value }))}
                placeholder="Todos"
                searchPlaceholder="Pesquisar evento…"
                values={actions}
              />
            </FormField>
            <FormField htmlFor="auditFrom" label="A partir de">
              <Input
                id="auditFrom"
                max={to || undefined}
                onChange={(event) => {
                  setPage(1);
                  setFrom(event.target.value);
                }}
                type="date"
                value={from}
              />
            </FormField>
            <FormField htmlFor="auditTo" label="Até">
              <Input
                id="auditTo"
                min={from || undefined}
                onChange={(event) => {
                  setPage(1);
                  setTo(event.target.value);
                }}
                type="date"
                value={to}
              />
            </FormField>
          </div>
        </CardContent>
        {loading ? (
          <TableSkeleton
            ariaLabel="Carregando eventos de auditoria"
            headers={[
              "Evento",
              "Responsável",
              "Objeto",
              "Resultado",
              "Data",
              "Detalhes",
            ]}
            rows={Math.min(pageSize, 8)}
          />
        ) : total ? (
          <DataTable
            ariaLabel="Eventos de auditoria"
            columns={columns}
            data={events}
            getRowId={(event) => event.id}
            itemLabel="eventos"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            total={total}
          />
        ) : (
          <EmptyState
            title="Nenhum evento encontrado"
            description="Ajuste ou limpe os filtros para ampliar a consulta."
          />
        )}
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          title={
            selected
              ? (actionLabels[selected.action] ?? selected.action)
              : "Detalhes do evento"
          }
          description="Identificadores e metadados técnicos do registro imutável."
        >
          {selected ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Ação" value={selected.action} />
              <Detail
                label="Resultado"
                value={outcomeLabels[selected.outcome]}
              />
              <Detail
                label="Responsável"
                value={
                  selected.actor
                    ? `${selected.actor.displayName} · ${selected.actor.email}`
                    : "Sistema"
                }
              />
              <Detail
                label="Data"
                value={new Date(selected.createdAt).toLocaleString("pt-BR", {
                  timeZone: "America/Manaus",
                })}
              />
              <Detail
                label="Objeto"
                value={`${selected.objectType}${selected.objectId ? ` · ${selected.objectId}` : ""}`}
              />
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-[var(--text-faint)]">
                  Metadados
                </dt>
                <dd>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-[10px] bg-[var(--surface-subtle)] p-3 font-mono text-xs leading-5">
                    {JSON.stringify(selected.metadata ?? {}, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === "AbortError";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--text-faint)]">
        {label}
      </dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
