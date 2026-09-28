// Operação: consultar período/unidade e ler totais verificáveis, sem dados pessoais.
// Extensão institucional: filtros nativos e listas compactas; ausência de acesso não vira zero.
import {
  hrMetricsQuerySchema,
  hrRequestTypes,
  occurrenceStatuses,
  type HrMetrics,
} from "@cge/contracts";
import { Alert, Button, DateInput, FormField } from "@cge/ui";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";

const requestLabels: Record<string, string> = {
  submitted: "Enviada",
  in_analysis: "Em análise",
  completed: "Concluída",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};
const date = (value: string) => value.split("-").reverse().join("/");
function Counts({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[] | null;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {rows === null ? (
        <p className="text-sm text-[var(--text-muted)]">
          Sem acesso a este indicador.
        </p>
      ) : !rows.length ? (
        <p className="text-sm text-[var(--text-muted)]">
          Nenhum registro no período.
        </p>
      ) : (
        <dl className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <dt>{row.label}</dt>
              <dd className="font-bold tabular-nums">
                {row.count.toLocaleString("pt-BR")}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function MetricsPage() {
  const [filters, setFilters] = useState(() => {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Manaus",
    });
    return { startDate: `${today.slice(0, 7)}-01`, endDate: today, unitId: "" };
  });
  const [query, setQuery] = useState(filters);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<HrMetrics | null>(null);
  const [units, setUnits] = useState<HrMetrics["units"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRetryable(false);
    setData(null);
    const params = new URLSearchParams({
      startDate: query.startDate,
      endDate: query.endDate,
    });
    if (query.unitId) params.set("unitId", query.unitId);
    void api<HrMetrics>(`/api/hr-metrics?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setUnits(result.units);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setRetryable(true);
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível consultar os indicadores. Tente novamente.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision]);
  function consult(event: FormEvent) {
    event.preventDefault();
    if (
      !hrMetricsQuerySchema.safeParse({
        ...filters,
        unitId: filters.unitId || undefined,
      }).success
    ) {
      setError("Informe um período válido de até 366 dias.");
      setRetryable(false);
      return;
    }
    setQuery({ ...filters });
  }
  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Indicadores de Gestão de Pessoas
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Acompanhe o volume de trabalho e os prazos dentro das suas unidades
          autorizadas.
        </p>
      </header>
      <form
        onSubmit={consult}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Data inicial" htmlFor="metricsStart">
            <DateInput
              id="metricsStart"
              required
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Data final" htmlFor="metricsEnd">
            <DateInput
              id="metricsEnd"
              required
              min={filters.startDate}
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Unidade" htmlFor="metricsUnit">
            <select
              id="metricsUnit"
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={filters.unitId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  unitId: event.target.value,
                }))
              }
            >
              <option value="">Todas as unidades autorizadas</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <Button type="submit" disabled={loading}>
          Consultar indicadores
        </Button>
        <p className="text-xs text-[var(--text-muted)]">
          Até 366 dias por consulta, no fuso de Manaus. Cada indicador respeita
          sua permissão específica.
        </p>
      </form>
      {error && (
        <Alert title="Consulta não realizada" tone="danger">
          <p>{error}</p>
          {retryable && (
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Tentar novamente
            </Button>
          )}
        </Alert>
      )}
      {loading && <p role="status">Consultando indicadores…</p>}
      {data && (
        <div className="space-y-8">
          <div>
            <p className="font-semibold">
              Período consultado: {date(query.startDate)} a{" "}
              {date(query.endDate)}
            </p>
            <p className="mt-1 text-sm">
              Unidade consultada:{" "}
              {query.unitId
                ? data.units.find((unit) => unit.id === query.unitId)?.name
                : "Todas as unidades autorizadas"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Contagens usam a data de criação e a situação atual do registro,
              salvo as regras de prazo médio e divergências abaixo.
            </p>
          </div>
          <Counts
            title="Solicitações por tipo e situação"
            rows={
              data.requests?.map((row) => ({
                label: `${hrRequestTypes[row.type as keyof typeof hrRequestTypes]} · ${requestLabels[row.status]}`,
                count: row.count,
              })) ?? null
            }
          />
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Prazo médio de atendimento</h2>
            <p className="text-sm text-[var(--text-muted)]">
              A média considera solicitações concluídas no período, desde o
              envio até a conclusão.
            </p>
            {data.completion === null ? (
              <p className="text-sm">Sem acesso a este indicador.</p>
            ) : data.completion.averageHours === null ? (
              <p className="text-sm">
                Nenhuma solicitação concluída no período.
              </p>
            ) : (
              <p className="text-sm">
                <strong className="tabular-nums">
                  {data.completion.averageHours.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  horas corridas
                </strong>{" "}
                em {data.completion.count} solicitações concluídas.
              </p>
            )}
          </section>
          <div className="grid gap-8 lg:grid-cols-2">
            <Counts
              title="Ocorrências por situação"
              rows={
                data.occurrences?.map((row) => ({
                  label:
                    occurrenceStatuses[
                      row.status as keyof typeof occurrenceStatuses
                    ],
                  count: row.count,
                })) ?? null
              }
            />
            <Counts
              title="Férias pendentes por etapa"
              rows={
                data.vacations?.map((row) => ({
                  label:
                    row.status === "submitted"
                      ? "Aguardando chefia"
                      : "Aguardando decisão final",
                  count: row.count,
                })) ?? null
              }
            />
          </div>
          <Counts
            title="Capacitações"
            rows={
              data.trainingPending === null
                ? null
                : [
                    {
                      label: "Aguardando validação",
                      count: data.trainingPending,
                    },
                  ]
            }
          />
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Divergências cadastrais</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Campos de vínculos ativos cujo valor local difere da última fonte
              importada, atualizados no período. Contagem de campos, não de
              pessoas.
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {data.divergences === null
                ? "Sem acesso a este indicador."
                : `${data.divergences.toLocaleString("pt-BR")} campos divergentes`}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
