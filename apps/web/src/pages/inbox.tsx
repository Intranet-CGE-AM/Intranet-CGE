import type { Inbox, InboxItem } from "@cge/contracts";
import { Alert, Badge, Button, FormField } from "@cge/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";

const labels: Record<InboxItem["type"], string> = {
  request: "Solicitações",
  vacation: "Férias",
  occurrence: "Ocorrências",
  training: "Capacitações",
  checklist: "Checklists",
};
const date = (value: Date) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" });
const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm";

// Operate: a mesma consulta alimenta o resumo e a fila; somente ações atuais, sem duplicar tarefas.
export function InboxPanel({ compact = false }: { compact?: boolean }) {
  const { refresh } = useAuth();
  const [type, setType] = useState("");
  const [unitId, setUnitId] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Inbox | null>(null);
  const [units, setUnits] = useState<Inbox["units"]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    const query = new URLSearchParams({
      page: String(page),
      pageSize: compact ? "5" : "50",
    });
    if (type) query.set("type", type);
    if (unitId) query.set("unitId", unitId);
    void Promise.all([
      api<Inbox>(`/api/inbox?${query}`, { signal: controller.signal }),
      revision ? refresh() : Promise.resolve(),
    ])
      .then(([result]) => {
        if (controller.signal.aborted) return;
        setData(result);
        setUnits(result.units);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar as pendências.",
          );
      });
    return () => controller.abort();
  }, [compact, type, unitId, page, revision, refresh]);
  const Heading = compact ? "h2" : "h1";
  return (
    <section aria-label="Caixa de pendências" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading
            className={
              compact
                ? "text-lg font-extrabold"
                : "text-2xl font-extrabold tracking-[-0.03em]"
            }
          >
            Minhas pendências
          </Heading>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            O que precisa da sua ação, começando pelos prazos vencidos.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setRevision((value) => value + 1)}
        >
          Atualizar pendências
        </Button>
      </header>
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Tipo de pendência" htmlFor="inbox-type">
            <select
              id="inbox-type"
              className={selectClass}
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setUnitId("");
                setPage(1);
              }}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Unidade da pendência" htmlFor="inbox-unit">
            <select
              id="inbox-unit"
              className={selectClass}
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as unidades</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      )}
      {error ? (
        <Alert title="Pendências indisponíveis" tone="danger">
          <p>{error}</p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : !data ? (
        <p role="status">Carregando pendências…</p>
      ) : (
        <>
          {!!data.sourcesUnavailable.length && (
            <Alert title="Consulta parcial" tone="warning">
              Não foi possível consultar:{" "}
              {data.sourcesUnavailable
                .map((source) => labels[source])
                .join(", ")}
              . Atualize para tentar novamente; o total considera apenas as
              fontes disponíveis.
            </Alert>
          )}
          <p role="status" className="text-sm font-semibold">
            {data.total} {data.total === 1 ? "pendência" : "pendências"} para
            agir
          </p>
          {data.items.length ? (
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1 break-words">
                    <p className="font-bold">{item.title}</p>
                    {item.delegation && (
                      <p className="text-sm font-semibold text-[var(--brand-strong)]">
                        Por substituição de {item.delegation.originalName}
                      </p>
                    )}
                    <p className="text-sm text-[var(--text-muted)]">
                      {item.context}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {labels[item.type]} · {item.unitName} · Desde{" "}
                      {date(item.createdAt)}
                      {item.dueAt
                        ? ` · Data de referência: ${date(item.dueAt)}`
                        : ""}
                    </p>
                    {item.priority === "urgent" && (
                      <Badge variant="warning">Prazo vencido</Badge>
                    )}
                  </div>
                  <Button asChild variant="secondary" className="shrink-0">
                    <Link
                      to={item.href}
                      aria-label={`Abrir: ${item.title} — ${item.context}`}
                    >
                      Abrir pendência
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-[var(--text-muted)]">
              Nenhuma pendência neste filtro.
            </p>
          )}
          {!compact && (
            <nav
              aria-label="Páginas de pendências"
              className="flex flex-wrap items-center gap-3"
            >
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm">Página {page}</span>
              <Button
                variant="secondary"
                disabled={!data.hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}
      {compact && (
        <Button asChild variant="quiet">
          <Link to="/rh/pendencias">Ver todas as pendências</Link>
        </Button>
      )}
    </section>
  );
}

export function InboxPage() {
  return (
    <div className="max-w-5xl pb-8">
      <InboxPanel />
    </div>
  );
}
