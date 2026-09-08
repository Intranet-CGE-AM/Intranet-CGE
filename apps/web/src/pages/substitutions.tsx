// Operate: cobertura temporária explícita, sem alterar perfis permanentes.
// Extensão do RH institucional: lista com origem/destino/período; formulário em linha,
// datas nativas e seleção dos fluxos. Sem modal nem nova identidade visual.
import {
  substitutionInputSchema,
  type Substitution,
  type SubstitutionInput,
  type SubstitutionList,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  DateInput,
  FormField,
  Input,
  Textarea,
} from "@cge/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, json } from "../lib/api";

const flows: Record<SubstitutionInput["flows"][number], string> = {
  "vacations.review.supervisor": "Férias — análise da chefia",
  "vacations.review.final": "Férias — decisão final",
  "hr_requests.manage": "Atendimento e correções cadastrais",
  "occurrences.review.supervisor": "Ocorrências — análise da chefia",
  "occurrences.review.final": "Ocorrências — decisão final",
  "training.review": "Validação de capacitações",
  "onboarding.manage": "Gestão de checklists da unidade",
  "checklist.assignment": "Itens de checklist atribuídos ao responsável",
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(
    new Date(),
  );
const date = (value: string) => value.split("-").reverse().join("/");
const message = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
type Account = { id: string; name: string };

function AccountChoice({
  label,
  id,
  unitId,
  value,
  onChange,
}: {
  label: string;
  id: string;
  unitId: string;
  value: Account;
  onChange: (value: Account) => void;
}) {
  const [result, setResult] = useState<{
    accounts: Account[];
    hasMore: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");
    if (unitId && !value.id && value.name.trim().length >= 2) {
      const query = new URLSearchParams({ unitId, query: value.name });
      void api<{ accounts: Account[]; hasMore: boolean }>(
        `/api/substitution-accounts?${query}`,
        { signal: controller.signal },
      )
        .then((response) => {
          if (!controller.signal.aborted) setResult(response);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(message(cause));
        });
    }
    return () => controller.abort();
  }, [unitId, value.id, value.name, revision]);
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={
        value.id
          ? "Pessoa selecionada. Para trocar, altere o nome."
          : "Digite pelo menos duas letras e selecione uma pessoa."
      }
    >
      <Input
        ref={inputRef}
        id={id}
        required
        disabled={!unitId}
        maxLength={100}
        autoComplete="off"
        value={value.name}
        onChange={(event) => onChange({ id: "", name: event.target.value })}
      />
      {error ? (
        <div role="alert" className="text-sm">
          <p>{error}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRevision((current) => current + 1)}
          >
            Repetir busca
          </Button>
        </div>
      ) : (
        !value.id &&
        unitId &&
        value.name.trim().length >= 2 &&
        (!result ? (
          <p role="status" className="text-sm">
            Buscando pessoas…
          </p>
        ) : (
          <>
            {result.accounts.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {result.accounts.map((account) => (
                  <li key={account.id}>
                    <Button
                      className="min-h-11 w-full justify-start whitespace-normal text-left"
                      variant="quiet"
                      type="button"
                      aria-label={`Selecionar ${account.name}`}
                      onClick={() => {
                        onChange(account);
                        inputRef.current?.focus();
                      }}
                    >
                      {account.name}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-sm">
                Nenhuma conta ativa encontrada.
              </p>
            )}
            {result.hasMore && (
              <p className="text-sm">
                Há mais resultados. Digite um nome mais específico.
              </p>
            )}
          </>
        ))
      )}
    </FormField>
  );
}

function SubstitutionForm({
  initial,
  units,
  onSaved,
  onClose,
}: {
  initial: Substitution | null;
  units: SubstitutionList["units"];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState<SubstitutionInput>(() =>
    initial
      ? {
          originalAccountId: initial.originalAccountId,
          substituteAccountId: initial.substituteAccountId,
          unitId: initial.unitId,
          startsOn: initial.startsOn,
          endsOn: initial.endsOn,
          reason: initial.reason,
          flows: initial.flows,
        }
      : {
          originalAccountId: "",
          substituteAccountId: "",
          unitId: "",
          startsOn: today(),
          endsOn: today(),
          reason: "",
          flows: [],
        },
  );
  const [original, setOriginal] = useState<Account>({
    id: initial?.originalAccountId ?? "",
    name: initial?.originalName ?? "",
  });
  const [substitute, setSubstitute] = useState<Account>({
    id: initial?.substituteAccountId ?? "",
    name: initial?.substituteName ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const unitRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    unitRef.current?.focus();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = substitutionInputSchema.safeParse({
      ...input,
      originalAccountId: original.id,
      substituteAccountId: substitute.id,
    });
    if (!parsed.success) {
      setError(
        "Selecione duas pessoas diferentes, a unidade, um período válido, ao menos um fluxo e um motivo com pelo menos 10 caracteres.",
      );
      return;
    }
    setPending(true);
    try {
      await api(
        initial ? `/api/substitutions/${initial.id}` : "/api/substitutions",
        {
          method: initial ? "PUT" : "POST",
          body: json({
            ...parsed.data,
            ...(initial ? { version: initial.version } : {}),
          }),
        },
      );
      onSaved();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={save}
      aria-label={initial ? "Editar substituição" : "Nova substituição"}
      className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h2 className="text-lg font-bold">
        {initial ? "Editar substituição" : "Nova substituição"}
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        A cobertura vale somente nos fluxos e no período selecionados.
        Permissões de documentos sigilosos não são transferidas.
      </p>
      <fieldset disabled={pending} className="space-y-4">
        <FormField label="Unidade da substituição" htmlFor="sub-unit">
          <select
            ref={unitRef}
            id="sub-unit"
            required
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            value={input.unitId}
            onChange={(event) => {
              setInput({ ...input, unitId: event.target.value });
              setOriginal({ id: "", name: "" });
              setSubstitute({ id: "", name: "" });
            }}
          >
            <option value="">Selecione a unidade</option>
            {units
              .filter((unit) => unit.active || unit.id === input.unitId)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountChoice
            label="Responsável original"
            id="sub-original"
            unitId={input.unitId}
            value={original}
            onChange={setOriginal}
          />
          <AccountChoice
            label="Substituto"
            id="sub-recipient"
            unitId={input.unitId}
            value={substitute}
            onChange={setSubstitute}
          />
          <FormField label="Início da substituição" htmlFor="sub-start">
            <DateInput
              id="sub-start"
              required
              value={input.startsOn}
              onChange={(event) =>
                setInput({ ...input, startsOn: event.target.value })
              }
            />
          </FormField>
          <FormField label="Fim da substituição" htmlFor="sub-end">
            <DateInput
              id="sub-end"
              required
              min={input.startsOn}
              value={input.endsOn}
              onChange={(event) =>
                setInput({ ...input, endsOn: event.target.value })
              }
            />
          </FormField>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Fluxos que serão cobertos
          </legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {Object.entries(flows).map(([key, label]) => (
              <label
                key={key}
                className="flex min-h-11 items-center gap-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--brand)]"
                  checked={input.flows.includes(
                    key as SubstitutionInput["flows"][number],
                  )}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      flows: event.target.checked
                        ? [
                            ...input.flows,
                            key as SubstitutionInput["flows"][number],
                          ]
                        : input.flows.filter((flow) => flow !== key),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="Motivo" htmlFor="sub-reason">
          <Textarea
            id="sub-reason"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={input.reason}
            onChange={(event) =>
              setInput({ ...input, reason: event.target.value })
            }
          />
        </FormField>
      </fieldset>
      {error && (
        <Alert title="Substituição não salva" tone="danger">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} type="submit">
          {pending ? "Salvando…" : "Salvar substituição"}
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          type="button"
          onClick={onClose}
        >
          Fechar formulário
        </Button>
      </div>
    </form>
  );
}

export function SubstitutionsPage() {
  const [data, setData] = useState<SubstitutionList | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Substitution | null | undefined>();
  const [cancelId, setCancelId] = useState("");
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const newButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    void api<SubstitutionList>(`/api/substitutions?page=${page}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(message(cause));
      });
    return () => controller.abort();
  }, [page, revision]);
  function close() {
    setEditor(undefined);
    newButton.current?.focus();
  }
  async function cancel(record: Substitution) {
    setPending(true);
    setMutationError("");
    setNotice("");
    try {
      await api(`/api/substitutions/${record.id}/cancel`, {
        method: "POST",
        body: json({ version: record.version }),
      });
      setCancelId("");
      setNotice(
        "Substituição cancelada. As pendências voltaram ao responsável original.",
      );
      setRevision((current) => current + 1);
      newButton.current?.focus();
    } catch (cause) {
      setMutationError(message(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Substituições temporárias
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Mantenha os atendimentos em andamento durante ausências.
          </p>
        </div>
        <Button
          ref={newButton}
          disabled={!data || pending || editor !== undefined}
          onClick={() => {
            setCancelId("");
            setMutationError("");
            setEditor(null);
            setNotice("");
          }}
        >
          Nova substituição
        </Button>
      </header>
      {notice && (
        <p role="status" className="text-sm font-semibold">
          {notice}
        </p>
      )}
      {editor !== undefined && data && (
        <SubstitutionForm
          key={editor?.id ?? "new"}
          initial={editor}
          units={data.units}
          onClose={close}
          onSaved={() => {
            close();
            setNotice("Substituição salva.");
            setPage(1);
            setRevision((current) => current + 1);
          }}
        />
      )}
      <section aria-label="Substituições cadastradas" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Substituições cadastradas</h2>
          <Button
            variant="secondary"
            disabled={pending || editor !== undefined}
            onClick={() => {
              setCancelId("");
              setMutationError("");
              setRevision((current) => current + 1);
            }}
          >
            Atualizar lista
          </Button>
        </div>
        {error ? (
          <Alert title="Lista indisponível" tone="danger">
            <p>{error}</p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => setRevision((current) => current + 1)}
            >
              Tentar novamente
            </Button>
          </Alert>
        ) : !data ? (
          <p role="status">Carregando substituições…</p>
        ) : (
          <>
            {mutationError && (
              <Alert title="Cancelamento não realizado" tone="danger">
                {mutationError}
              </Alert>
            )}
            {data.substitutions.length ? (
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {data.substitutions.map((record) => (
                  <li key={record.id} className="space-y-3 py-5 break-words">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">
                        {record.substituteName} substitui {record.originalName}
                      </h3>
                      <Badge>
                        {record.cancelledAt
                          ? "Cancelada"
                          : record.startsOn > today()
                            ? "Programada"
                            : record.endsOn < today()
                              ? "Encerrada"
                              : "Vigente"}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      {record.unitName} · {date(record.startsOn)} a{" "}
                      {date(record.endsOn)}
                    </p>
                    <p className="text-sm">
                      {record.flows.map((flow) => flows[flow]).join(" · ")}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {record.reason}
                    </p>
                    {!record.cancelledAt && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={pending || editor !== undefined}
                          onClick={() => {
                            setEditor(record);
                            setCancelId("");
                            setNotice("");
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="quiet"
                          disabled={pending || editor !== undefined}
                          onClick={() => {
                            setCancelId(record.id);
                            setMutationError("");
                          }}
                        >
                          Cancelar substituição
                        </Button>
                      </div>
                    )}
                    {cancelId === record.id && (
                      <div className="space-y-3">
                        <p className="text-sm">
                          O substituto perderá esta cobertura e as pendências
                          retornarão ao responsável original.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="danger"
                            disabled={pending || editor !== undefined}
                            onClick={() => void cancel(record)}
                          >
                            Confirmar cancelamento
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={pending}
                            onClick={() => setCancelId("")}
                          >
                            Manter substituição
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma substituição cadastrada no seu escopo.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={page === 1 || pending || editor !== undefined}
                onClick={() => setPage((current) => current - 1)}
              >
                Página anterior
              </Button>
              <span className="text-sm">Página {page}</span>
              <Button
                variant="secondary"
                disabled={!data.hasMore || pending || editor !== undefined}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima página
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
