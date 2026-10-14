// Operação: período e ausências confirmadas primeiro; equipe e decisões abaixo.
// Extensão institucional: datas nativas, listas legíveis e nenhum dado clínico.
import { availabilityQuerySchema, type TeamAvailability } from "@cge/contracts";
import { Alert, Button, DateInput, FormField } from "@cge/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../lib/api";

function monthPeriod(value = new Date(), delta = 0) {
  const year = value.getFullYear();
  const month = value.getMonth() + delta;
  return {
    startDate: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    endDate: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  };
}
const date = (value: string) => value.split("-").reverse().join("/");

export function AvailabilityPage() {
  const [filters, setFilters] = useState(() => ({
    ...monthPeriod(),
    unitId: "",
  }));
  const [query, setQuery] = useState(filters);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<TeamAvailability | null>(null);
  const [units, setUnits] = useState<TeamAvailability["units"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    const params = new URLSearchParams({
      startDate: query.startDate,
      endDate: query.endDate,
    });
    if (query.unitId) params.set("unitId", query.unitId);
    void api<TeamAvailability>(`/api/team-availability?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setUnits(result.units);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível consultar a equipe. Tente novamente.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, reload]);
  function consult(event: FormEvent) {
    event.preventDefault();
    const result = availabilityQuerySchema.safeParse({
      ...filters,
      unitId: filters.unitId || undefined,
    });
    if (!result.success) {
      setError(
        "Informe um período de até 92 dias, com fim igual ou posterior ao início.",
      );
      return;
    }
    setQuery({ ...filters });
  }
  function changeMonth(delta: number) {
    const next = {
      ...filters,
      ...monthPeriod(new Date(`${filters.startDate}T12:00:00`), delta),
    };
    setFilters(next);
    setQuery(next);
  }
  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Disponibilidade da equipe
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Planeje o trabalho com as ausências confirmadas e acompanhe sua equipe
          atual.
        </p>
      </header>
      <form
        onSubmit={consult}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Data inicial" htmlFor="availabilityStart">
            <DateInput
              id="availabilityStart"
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
          <FormField label="Data final" htmlFor="availabilityEnd">
            <DateInput
              id="availabilityEnd"
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
          <FormField label="Unidade" htmlFor="availabilityUnit">
            <select
              id="availabilityUnit"
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
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            Consultar período
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || !filters.startDate}
            onClick={() => changeMonth(-1)}
          >
            Mês anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || !filters.startDate}
            onClick={() => changeMonth(1)}
          >
            Próximo mês
          </Button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Até 92 dias por consulta. Pedidos em análise não são ausências
          confirmadas.
        </p>
      </form>
      {error && (
        <Alert title="Consulta não realizada" tone="danger">
          <p>{error}</p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => setReload((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}
      {loading && <p role="status">Consultando disponibilidade…</p>}
      {data && !loading && (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Período consultado: {date(query.startDate)} a {date(query.endDate)}{" "}
            · {data.members.length} integrantes
          </p>
          <section aria-labelledby="availabilityAbsences" className="space-y-3">
            <h2 id="availabilityAbsences" className="text-lg font-bold">
              Ausências confirmadas
            </h2>
            {!data.absences.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma ausência confirmada neste período.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.absences.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col justify-between gap-2 py-4 sm:flex-row"
                  >
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {item.reason}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">
                      {date(item.startDate)} a {date(item.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="availabilityPending" className="space-y-3">
            <h2 id="availabilityPending" className="text-lg font-bold">
              Aguardando sua análise
            </h2>
            {!data.pending.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma decisão da sua equipe neste período.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.pending.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {date(item.startDate)} a {date(item.endDate)}
                      </p>
                    </div>
                    <Button asChild variant="secondary">
                      <Link
                        to={
                          item.kind === "vacation"
                            ? `/rh/ferias?requestId=${item.id}`
                            : `/rh/ocorrencias?occurrenceId=${item.id}&scope=supervisor`
                        }
                      >
                        {item.kind === "vacation"
                          ? "Analisar férias"
                          : "Analisar ocorrência"}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="availabilityMembers" className="space-y-3">
            <h2 id="availabilityMembers" className="text-lg font-bold">
              Integrantes da equipe
            </h2>
            {!data.members.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum vínculo ativo no escopo selecionado.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.members.map((member) => (
                  <li key={member.employmentId} className="space-y-1 py-4">
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {member.jobTitle ?? "Função não informada"} ·{" "}
                      {member.unitName}
                    </p>
                    {member.alerts.length > 0 && (
                      <p className="text-sm text-[var(--text-muted)]">
                        Conferir cadastro: {member.alerts.join("; ")}.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
