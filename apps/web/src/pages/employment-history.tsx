import { movementLabels, type EmploymentHistory } from "@cge/contracts";
import {
  Alert,
  Button,
  Card,
  DateInput,
  EmptyState,
  FormField,
  Input,
  SearchableSelect,
  Textarea,
} from "@cge/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { FieldSelect } from "../components/field-select";
import { LoadingState } from "../components/loading-state";
import { PageHeader } from "../components/page-header";
import { api, ApiError, json } from "../lib/api";

type Option = { id: string; name: string };
const date = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/")
    : value || "Não informado";
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Não foi possível carregar o histórico. Tente novamente.";

export function EmploymentHistoryPage() {
  const [params, setParams] = useSearchParams();
  const personId = params.get("personId") ?? "";
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Option[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<{ people: Option[] }>(
        `/api/employment-people?query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then((value) => setPeople(value.people))
        .catch((cause) => {
          if (!controller.signal.aborted) setError(message(cause));
        });
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="page-enter max-w-4xl space-y-5">
      <PageHeader
        title="Histórico funcional"
        description="Registre movimentações com justificativa, preservando os dados anteriores."
      />
      {error ? (
        <Alert title="Não foi possível buscar" tone="danger">
          {error}
        </Alert>
      ) : null}
      <FormField htmlFor="historyPersonQuery" label="Buscar colaborador">
        <Input
          id="historyPersonQuery"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setParams({});
            setError("");
          }}
        />
      </FormField>
      <FormField htmlFor="historyPerson" label="Colaborador">
        <SearchableSelect
          id="historyPerson"
          name="historyPerson"
          placeholder="Selecione uma pessoa"
          value={personId}
          onValueChange={(value) => setParams(value ? { personId: value } : {})}
          options={[
            { label: "Selecione uma pessoa", value: "" },
            ...(personId && !people.some((person) => person.id === personId)
              ? [
                  {
                    label: "Colaborador selecionado pelo link",
                    value: personId,
                  },
                ]
              : []),
            ...people.map((person) => ({
              label: person.name,
              value: person.id,
            })),
          ]}
        />
      </FormField>
      {personId ? (
        <EmploymentHistorySection key={personId} personId={personId} manage />
      ) : (
        <Card>
          <EmptyState
            title="Nenhum colaborador selecionado"
            description="Selecione um colaborador para consultar o histórico."
          />
        </Card>
      )}
    </div>
  );
}

export function EmploymentHistorySection({
  personId,
  manage = false,
}: {
  personId?: string;
  manage?: boolean;
}) {
  const [data, setData] = useState<EmploymentHistory | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedButStale, setSavedButStale] = useState(false);
  const [field, setField] =
    useState<Exclude<keyof typeof movementLabels, "admission">>("jobTitle");
  const [options, setOptions] = useState<{
    units: Option[];
    categories: Option[];
    supervisors: Option[];
  }>({ units: [], categories: [], supervisors: [] });
  const [supervisorQuery, setSupervisorQuery] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const loadOptions = useCallback(
    async (signal?: AbortSignal) => {
      setOptionsError("");
      try {
        setOptions(
          await api<typeof options>(
            `/api/employment-options?query=${encodeURIComponent(supervisorQuery)}`,
            { signal },
          ),
        );
      } catch (cause) {
        if (!signal?.aborted) setOptionsError(message(cause));
      }
    },
    [supervisorQuery],
  );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError("");
      try {
        setData(
          await api<EmploymentHistory>(
            personId
              ? `/api/people/${personId}/employment-history`
              : "/api/me/employment-history",
            { signal },
          ),
        );
        setSavedButStale(false);
        return true;
      } catch (cause) {
        if (!signal?.aborted) setError(message(cause));
        return false;
      }
    },
    [personId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (!manage) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadOptions(controller.signal);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [manage, loadOptions]);
  const current = data?.employments.find((item) => !item.endDate);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personId || !data?.version) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const value =
      field === "endDate" ? values.get("effectiveOn") : values.get("value");
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/people/${personId}/movements`, {
        method: "POST",
        body: json({
          expectedVersion: data.version,
          effectiveOn: values.get("effectiveOn"),
          reason: values.get("reason"),
          changes: { [field]: value === "none" ? null : value },
          confirmTermination: values.get("confirmTermination") === "on",
        }),
      });
      if (await load()) setSuccess("Movimentação registrada.");
      else setSavedButStale(true);
      const details = form.closest("details");
      if (details) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Histórico funcional">
      <h2 className="text-lg font-bold">
        {manage
          ? data?.personName || "Movimentações registradas"
          : "Histórico funcional"}
      </h2>
      {error ? (
        <Alert
          title={
            savedButStale
              ? "Registro salvo; não foi possível atualizar o histórico."
              : "Não foi possível concluir"
          }
          tone={savedButStale ? "warning" : "danger"}
        >
          {error}
          <Button
            variant="secondary"
            onClick={async () => {
              if (await load()) setSuccess("Histórico atualizado.");
            }}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}
      {success ? <Alert tone="success" title={success} /> : null}
      {optionsError ? (
        <Alert title="Não foi possível carregar as opções" tone="danger">
          {optionsError}
          <Button variant="secondary" onClick={() => void loadOptions()}>
            Tentar carregar opções
          </Button>
        </Alert>
      ) : null}
      {!data && !error ? <LoadingState label="Carregando histórico…" /> : null}
      {manage && current && !savedButStale ? (
        <details open className="border-y border-[var(--border)] py-3">
          <summary className="cursor-pointer py-2 font-semibold">
            Registrar movimentação
          </summary>
          <form onSubmit={submit} className="mt-3 max-w-2xl space-y-4">
            <FormField htmlFor="movementType" label="Tipo de movimentação">
              <FieldSelect
                id="movementType"
                value={field}
                onValueChange={(value) => setField(value as typeof field)}
                options={Object.entries(movementLabels)
                  .filter(([key]) => key !== "admission")
                  .map(([key, label]) => ({ value: key, label }))}
              />
            </FormField>
            {field === "unitId" || field === "categoryId" ? (
              <FormField
                htmlFor="movementValue"
                label={field === "unitId" ? "Nova unidade" : "Nova categoria"}
              >
                <FieldSelect
                  key={field}
                  id="movementValue"
                  name="value"
                  required
                  placeholder="Selecione"
                  defaultValue=""
                  options={(field === "unitId"
                    ? options.units
                    : options.categories
                  ).map((option) => ({
                    value: option.id,
                    label: option.name,
                  }))}
                />
              </FormField>
            ) : field === "supervisorRelationshipId" ? (
              <FormField htmlFor="movementSupervisor" label="Nova chefia">
                <SearchableSelect
                  id="movementSupervisor"
                  name="value"
                  defaultValue="none"
                  onSearchChange={setSupervisorQuery}
                  options={[
                    { label: "Sem chefia direta", value: "none" },
                    ...options.supervisors
                      .filter((option) => option.id !== current.id)
                      .map((option) => ({
                        label: option.name,
                        value: option.id,
                      })),
                  ]}
                />
              </FormField>
            ) : field === "startDate" ? (
              <FormField htmlFor="movementStart" label="Novo início do vínculo">
                <DateInput id="movementStart" name="value" required />
              </FormField>
            ) : field !== "endDate" ? (
              <FormField
                htmlFor="movementValue"
                label={field === "jobTitle" ? "Novo cargo" : "Nova matrícula"}
              >
                <Input
                  key={field}
                  id="movementValue"
                  name="value"
                  required
                  maxLength={field === "jobTitle" ? 160 : 50}
                />
              </FormField>
            ) : null}
            <FormField
              htmlFor="movementEffective"
              label="Vigência"
              hint="Data em que a alteração passou a valer."
            >
              <DateInput
                id="movementEffective"
                name="effectiveOn"
                required
                min={current.startDate}
                max={new Date().toLocaleDateString("en-CA", {
                  timeZone: "America/Manaus",
                })}
              />
            </FormField>
            <FormField htmlFor="movementReason" label="Justificativa">
              <Textarea
                id="movementReason"
                name="reason"
                minLength={10}
                maxLength={2000}
                required
              />
            </FormField>
            {field === "endDate" ? (
              <>
                {data && data.pendingChecklistCount > 0 && (
                  <Alert
                    title="Checklist com providências pendentes"
                    tone="warning"
                  >
                    Há {data.pendingChecklistCount} checklist(s) em aberto.
                    Essas providências não impedem registrar o desligamento e
                    podem ser concluídas depois.
                  </Alert>
                )}
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input type="checkbox" name="confirmTermination" required />
                  Confirmo o desligamento, a desativação da conta e o
                  encerramento das sessões.
                </label>
              </>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Registrando…" : "Registrar movimentação"}
            </Button>
          </form>
        </details>
      ) : null}
      {data && !current ? (
        <p>
          Vínculo encerrado. O histórico permanece disponível para consulta.
        </p>
      ) : null}
      {data && !data.movements.length ? (
        <EmptyState
          title="Nenhuma movimentação"
          description="Nenhuma movimentação registrada. Alterações anteriores à implantação desta trilha não são reconstruídas."
        />
      ) : null}
      <ol className="divide-y divide-[var(--border)]">
        {data?.movements.map((item) => (
          <li key={item.id} className="space-y-2 py-4">
            <h3 className="font-semibold">
              {movementLabels[item.type]} · {date(item.effectiveOn)}
            </h3>
            <p className="break-words">
              {date(item.previousLabel)} → {date(item.nextLabel)}
            </p>
            <p className="break-words text-sm">{item.reason}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {item.actorName || "Autor não registrado"} ·{" "}
              {new Date(item.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Manaus",
              })}{" "}
              · {item.source === "import" ? "Importação" : "Registro manual"}
            </p>
          </li>
        ))}
      </ol>
      {data?.provenance.length ? (
        <details>
          <summary className="cursor-pointer py-2 font-semibold">
            Origem e atualização dos campos
          </summary>
          <ul className="divide-y divide-[var(--border)]">
            {data.provenance.map((item) => (
              <li className="space-y-1 py-3 text-sm" key={item.field}>
                <p className="font-semibold">
                  {movementLabels[
                    item.field.replace(
                      "employment.",
                      "",
                    ) as keyof typeof movementLabels
                  ] ||
                    (
                      {
                        fullName: "Nome",
                        preferredName: "Nome preferido",
                        birthDate: "Nascimento",
                        birthdayVisible: "Aniversário visível",
                      } as Record<string, string>
                    )[item.field] ||
                    item.field}
                </p>
                <p>
                  {item.source === "import"
                    ? "Importação"
                    : item.source === "legacy"
                      ? "Cadastro legado (data do cadastro)"
                      : "Alteração manual"}{" "}
                  ·{" "}
                  {new Date(item.updatedAt).toLocaleString("pt-BR", {
                    timeZone: "America/Manaus",
                  })}
                </p>
                <p>
                  Local: {date(item.localLabel)}
                  <br />
                  Importado:{" "}
                  {item.syncedAt ? date(item.externalLabel) : "Indisponível"}
                </p>
                <p>
                  {
                    {
                      synchronized: "Sincronizado",
                      divergent: "Divergente",
                      pending: "Correção pendente de análise",
                      unavailable: "Sem importação disponível para comparar",
                    }[item.state]
                  }
                </p>
                {item.syncedAt &&
                item.source === "manual" &&
                item.value !== item.externalValue ? (
                  <p className="text-[var(--warning-strong)]">
                    Divergência com a última importação. O valor manual foi
                    preservado; solicite conferência ao RH.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
