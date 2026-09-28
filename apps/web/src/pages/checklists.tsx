// Operação: iniciar a partir de um modelo e resolver providências em uma lista.
// Extensão institucional: formulários nativos, configuração recolhida e progresso textual.
import { type Checklist, type OnboardingTemplate } from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  SearchableSelect,
  Textarea,
} from "@cge/ui";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { FieldSelect } from "../components/field-select";
import { LoadingState } from "../components/loading-state";
import { PageHeader } from "../components/page-header";
import { Pagination } from "../components/pagination";
import { api, ApiError, json } from "../lib/api";
import { can, canGlobally } from "../lib/permissions";

const itemStatus = {
  pending: { label: "Pendente", variant: "warning" },
  completed: { label: "Concluído", variant: "success" },
  waived: { label: "Dispensado", variant: "neutral" },
} as const;
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
const emptyItem = () => ({ title: "", area: "", required: true, active: true });
const emptyModel = () => ({
  name: "",
  kind: "entry" as "entry" | "exit",
  active: true,
  items: [emptyItem()],
});
type ModelInput = ReturnType<typeof emptyModel>;
type PersonOption = {
  personId: string;
  employmentId: string;
  name: string;
  unitName: string;
  endDate: string | null;
};
type Assignee = { id: string; name: string; unitName: string | null };

function TemplateEditor({
  templates,
  onSaved,
}: {
  templates: OnboardingTemplate[];
  onSaved: (model: OnboardingTemplate) => void;
}) {
  const [draft, setDraft] = useState<ModelInput>(emptyModel);
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  function changeItem(
    index: number,
    change: Partial<ModelInput["items"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, ...change } : item,
      ),
    }));
  }
  function move(index: number, direction: number) {
    setDraft((current) => {
      const items = [...current.items];
      [items[index], items[index + direction]] = [
        items[index + direction]!,
        items[index]!,
      ];
      return { ...current, items };
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api<OnboardingTemplate>(
        editing
          ? `/api/onboarding-templates/${editing.id}`
          : "/api/onboarding-templates",
        {
          method: editing ? "PUT" : "POST",
          body: json({
            ...draft,
            ...(editing ? { version: editing.version } : {}),
          }),
        },
      );
      onSaved(result);
      setEditing(result);
      setSuccess("Modelo salvo.");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="border-y border-[var(--border)] py-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        Gerenciar modelos
      </summary>
      <div className="space-y-4 py-3">
        <p className="max-w-prose text-sm text-[var(--text-muted)]">
          Alterações valem apenas para novas execuções. Os checklists já
          iniciados preservam o modelo original.
        </p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setEditing(null);
            setDraft(emptyModel());
            setOpen(true);
            setError("");
            setSuccess("");
          }}
        >
          Novo modelo
        </Button>
        <ul className="divide-y divide-[var(--border)]">
          {templates.map((model) => (
            <li
              key={model.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <span>
                {model.name} ·{" "}
                {model.kind === "entry" ? "Ingresso" : "Desligamento"}
                {!model.active && " · Inativo"}
              </span>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => {
                  setEditing(model);
                  setDraft({
                    name: model.name,
                    kind: model.kind,
                    active: model.active,
                    items: model.items,
                  });
                  setOpen(true);
                  setError("");
                  setSuccess("");
                }}
              >
                Editar {model.name}
              </Button>
            </li>
          ))}
        </ul>
        {open && (
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4">
              <legend className="mb-3 text-lg font-bold">
                {editing ? "Editar modelo" : "Novo modelo de checklist"}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nome do modelo" htmlFor="modelName">
                  <Input
                    id="modelName"
                    required
                    minLength={2}
                    maxLength={180}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Tipo do checklist" htmlFor="modelKind">
                  <FieldSelect
                    id="modelKind"
                    options={[
                      { value: "entry", label: "Ingresso" },
                      { value: "exit", label: "Desligamento" },
                    ]}
                    value={draft.kind}
                    onValueChange={(kind) =>
                      setDraft({ ...draft, kind: kind as ModelInput["kind"] })
                    }
                  />
                </FormField>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />
                Modelo ativo
              </label>
              <ol className="divide-y divide-[var(--border)]">
                {draft.items.map((item, index) => (
                  <li key={index} className="space-y-3 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label={`Título do item ${index + 1}`}
                        htmlFor={`itemTitle${index}`}
                      >
                        <Input
                          id={`itemTitle${index}`}
                          required
                          minLength={2}
                          maxLength={180}
                          value={item.title}
                          onChange={(e) =>
                            changeItem(index, { title: e.target.value })
                          }
                        />
                      </FormField>
                      <FormField
                        label={`Área responsável ${index + 1}`}
                        htmlFor={`itemArea${index}`}
                      >
                        <Input
                          id={`itemArea${index}`}
                          required
                          minLength={2}
                          maxLength={120}
                          value={item.area}
                          onChange={(e) =>
                            changeItem(index, { area: e.target.value })
                          }
                        />
                      </FormField>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) =>
                            changeItem(index, { required: e.target.checked })
                          }
                        />
                        Obrigatório{" "}
                        <span className="sr-only">item {index + 1}</span>
                      </label>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={(e) =>
                            changeItem(index, { active: e.target.checked })
                          }
                        />
                        Ativo <span className="sr-only">item {index + 1}</span>
                      </label>
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Subir item ${index + 1}`}
                      >
                        Subir
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={index === draft.items.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Descer item ${index + 1}`}
                      >
                        Descer
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={draft.items.length === 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            items: draft.items.filter((_, i) => i !== index),
                          })
                        }
                        aria-label={`Remover item ${index + 1}`}
                      >
                        Remover
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                type="button"
                variant="secondary"
                disabled={draft.items.length >= 100}
                onClick={() =>
                  setDraft({ ...draft, items: [...draft.items, emptyItem()] })
                }
              >
                Adicionar item
              </Button>
              <div>
                <Button type="submit">
                  {busy ? "Salvando…" : "Salvar modelo"}
                </Button>
              </div>
            </fieldset>
          </form>
        )}
        {error && (
          <Alert tone="danger" title="Modelo não salvo">
            {error}
          </Alert>
        )}
        {success && <Alert tone="success" title={success} />}
      </div>
    </details>
  );
}

function StartChecklist({
  templates,
  onCreated,
}: {
  templates: OnboardingTemplate[];
  onCreated: (record: Checklist) => void;
}) {
  const [query, setQuery] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [accounts, setAccounts] = useState<Assignee[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Assignee[]>([]);
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLookupError("");
    setPeople([]);
    setAccounts([]);
    void Promise.all([
      api<{ people: PersonOption[] }>(
        `/api/checklist-people?query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      ),
      api<{ accounts: Assignee[] }>(
        `/api/checklist-assignees?query=${encodeURIComponent(assigneeQuery)}`,
        { signal: controller.signal },
      ),
    ])
      .then(([persons, assignees]) => {
        if (!controller.signal.aborted) {
          setPeople(persons.people);
          setAccounts(assignees.accounts);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setLookupError(message(cause));
      });
    return () => controller.abort();
  }, [query, assigneeQuery, revision]);
  const model = templates.find((item) => item.id === templateId);
  const options = [
    ...accounts,
    ...selectedAccounts.filter(
      (item) => !accounts.some((account) => account.id === item.id),
    ),
  ];
  async function start(event: FormEvent) {
    event.preventDefault();
    if (!person || !model) return;
    setBusy(true);
    setError("");
    try {
      const record = await api<Checklist>("/api/checklists", {
        method: "POST",
        body: json({
          personId: person.personId,
          employmentId: person.employmentId,
          templateId,
          assignments: model.items.flatMap((item, itemIndex) =>
            item.active
              ? [{ itemIndex, accountId: assignments[itemIndex] }]
              : [],
          ),
        }),
      });
      onCreated(record);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent>
        <form onSubmit={start} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <legend className="mb-3 text-lg font-bold">Iniciar execução</legend>
            <FormField
              label="Buscar colaborador"
              htmlFor="checklistSearch"
              hint="Até 50 vínculos por busca, nas suas unidades autorizadas."
            >
              <Input
                id="checklistSearch"
                maxLength={120}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </FormField>
            <FormField label="Colaborador" htmlFor="checklistPerson">
              <SearchableSelect
                id="checklistPerson"
                name="checklistPerson"
                required
                placeholder="Selecione o vínculo"
                options={[
                  ...people,
                  ...(person &&
                  !people.some(
                    (item) => item.employmentId === person.employmentId,
                  )
                    ? [person]
                    : []),
                ].map((item) => ({
                  value: item.employmentId,
                  label: `${item.name} · ${item.unitName}${item.endDate ? " · Encerrado" : ""}`,
                }))}
                value={person?.employmentId ?? ""}
                onValueChange={(employmentId) =>
                  setPerson(
                    people.find((item) => item.employmentId === employmentId) ??
                      null,
                  )
                }
              />
            </FormField>
            <FormField label="Modelo" htmlFor="checklistModel">
              <FieldSelect
                id="checklistModel"
                required
                placeholder="Selecione o modelo"
                options={templates
                  .filter(
                    (item) =>
                      item.active && item.items.some((entry) => entry.active),
                  )
                  .map((item) => ({ value: item.id, label: item.name }))}
                value={templateId}
                onValueChange={(id) => {
                  setTemplateId(id);
                  setAssignments({});
                }}
              />
            </FormField>
            {model && (
              <>
                <FormField
                  label="Buscar responsável"
                  htmlFor="assigneeSearch"
                  hint="Busque pelo nome caso o responsável não apareça nas primeiras 50 opções."
                >
                  <Input
                    id="assigneeSearch"
                    maxLength={120}
                    value={assigneeQuery}
                    onChange={(e) => setAssigneeQuery(e.target.value)}
                  />
                </FormField>
                {model.items.map(
                  (item, index) =>
                    item.active && (
                      <FormField
                        key={index}
                        label={`Responsável por: ${item.title}`}
                        htmlFor={`assignee${index}`}
                        hint={`${item.area} · ${item.required ? "Obrigatório" : "Opcional"}`}
                      >
                        <SearchableSelect
                          id={`assignee${index}`}
                          name={`assignee${index}`}
                          required
                          placeholder="Selecione o responsável"
                          options={options.map((account) => ({
                            value: account.id,
                            label: `${account.name}${account.unitName ? ` · ${account.unitName}` : ""}`,
                          }))}
                          value={assignments[index] ?? ""}
                          onValueChange={(accountId) => {
                            setAssignments({
                              ...assignments,
                              [index]: accountId,
                            });
                            const account = options.find(
                              (option) => option.id === accountId,
                            );
                            if (account)
                              setSelectedAccounts((current) =>
                                current.some((value) => value.id === account.id)
                                  ? current
                                  : [...current, account],
                              );
                          }}
                        />
                      </FormField>
                    ),
                )}
              </>
            )}
            <Button
              type="submit"
              disabled={!person || !model || Boolean(lookupError)}
            >
              {busy ? "Iniciando…" : "Iniciar execução"}
            </Button>
          </fieldset>
          {lookupError && (
            <Alert tone="danger" title="Opções indisponíveis">
              <p>{lookupError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                Tentar novamente
              </Button>
            </Alert>
          )}
          {error && (
            <Alert tone="danger" title="Checklist não iniciado">
              {error}
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function ChecklistsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const checklistId = params.get("checklistId");
  const manages = Boolean(user && can(user, "onboarding.manage"));
  const editsTemplates = Boolean(
    user && canGlobally(user, "onboarding.manage_templates"),
  );
  const [scope, setScope] = useState("mine");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [records, setRecords] = useState<Checklist[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<Checklist | null>(null);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [templateError, setTemplateError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRecords([]);
    void api<{ checklists: Checklist[]; hasMore: boolean }>(
      `/api/checklists?scope=${scope}&page=${page}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setRecords(result.checklists);
          setHasMore(result.hasMore);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(message(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, page, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    setDetailLoading(Boolean(checklistId));
    if (checklistId)
      void api<Checklist>(
        `/api/checklists/${encodeURIComponent(checklistId)}`,
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) setDetail(result);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setDetailError(message(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    return () => controller.abort();
  }, [checklistId, revision]);
  useEffect(() => {
    if (!manages && !editsTemplates) return;
    const controller = new AbortController();
    setTemplateError("");
    void api<{ templates: OnboardingTemplate[] }>("/api/onboarding-templates", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setTemplates(result.templates);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setTemplateError(message(cause));
      });
    return () => controller.abort();
  }, [manages, editsTemplates, revision]);
  async function act(
    itemId: string,
    action: "complete" | "waive",
    comment?: string,
  ) {
    if (!detail) return;
    setBusy(true);
    setDetailError("");
    setSuccess("");
    try {
      const result = await api<Checklist>(
        `/api/checklists/${detail.id}/items/${itemId}`,
        {
          method: "POST",
          body: json({
            action,
            version: detail.version,
            ...(comment?.trim() ? { comment } : {}),
          }),
        },
      );
      setDetail((current) => (current?.id === result.id ? result : current));
      setRecords((current) =>
        current.map((record) => (record.id === result.id ? result : record)),
      );
      setSuccess(
        action === "complete"
          ? "Providência concluída."
          : "Dispensa registrada.",
      );
    } catch (cause) {
      setDetailError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  const visibleRecords =
    detail && !records.some((record) => record.id === detail.id)
      ? [detail, ...records]
      : records;
  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Checklists de ingresso e desligamento"
        description="Acompanhe as providências, seus responsáveis e o que ainda precisa ser feito."
        actions={
          manages ? (
            <Button
              variant={starting ? "secondary" : "primary"}
              disabled={busy}
              aria-expanded={starting}
              aria-controls="startChecklist"
              onClick={() => setStarting(!starting)}
            >
              {starting ? "Fechar novo checklist" : "Iniciar checklist"}
            </Button>
          ) : null
        }
      />
      {templateError && (
        <Alert tone="danger" title="Modelos indisponíveis">
          <p>{templateError}</p>
          <Button
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}
      {editsTemplates && (
        <TemplateEditor
          templates={templates}
          onSaved={(model) =>
            setTemplates((current) =>
              [...current.filter((item) => item.id !== model.id), model].sort(
                (a, b) => a.name.localeCompare(b.name, "pt-BR"),
              ),
            )
          }
        />
      )}
      {starting && (
        <div id="startChecklist">
          <StartChecklist
            templates={templates}
            onCreated={(record) => {
              setStarting(false);
              setRecords((current) => [record, ...current]);
              setParams({ checklistId: record.id });
              setSuccess("Checklist iniciado.");
            }}
          />
        </div>
      )}
      {success && <Alert tone="success" title={success} />}
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Checklists</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Acompanhamento por colaborador.
            </p>
          </div>
        </CardHeader>
        <div className="grid items-end gap-3 border-b border-[var(--border)] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Exibir checklists" htmlFor="checklistScope">
            <FieldSelect
              id="checklistScope"
              options={[
                { value: "mine", label: "Meus checklists e atribuições" },
                ...(manages
                  ? [{ value: "team", label: "Unidades autorizadas" }]
                  : []),
              ]}
              value={scope}
              disabled={busy}
              onValueChange={(next) => {
                setScope(next);
                setPage(1);
                setParams({});
              }}
            />
          </FormField>
          <Button
            className="justify-self-start"
            variant="secondary"
            disabled={busy || loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            Atualizar
          </Button>
        </div>
        {loading && (
          <div className="p-5">
            <LoadingState label="Carregando checklists…" />
          </div>
        )}
        {error && (
          <div className="p-5">
            <Alert tone="danger" title="Consulta não realizada">
              {error}
            </Alert>
          </div>
        )}
        {!loading && !error && !visibleRecords.length && (
          <EmptyState
            title="Sem resultados para o filtro"
            description="Nenhum checklist neste filtro."
          />
        )}
        <ul className="divide-y divide-[var(--border)]">
          {visibleRecords.map((record) => (
            <li key={record.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{record.name}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span>{record.personName}</span>
                    <Badge variant="neutral">
                      {record.kind === "entry" ? "Ingresso" : "Desligamento"}
                    </Badge>
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  aria-expanded={checklistId === record.id}
                  aria-controls={`checklist-${record.id}`}
                  onClick={() =>
                    setParams(
                      checklistId === record.id
                        ? {}
                        : { checklistId: record.id },
                    )
                  }
                >
                  {checklistId === record.id
                    ? "Recolher acompanhamento"
                    : "Acompanhar checklist"}
                </Button>
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                <Badge
                  variant={record.progress.pending ? "warning" : "success"}
                >
                  {record.progress.completed} de {record.progress.total}{" "}
                  concluídos
                </Badge>
                <span>
                  {record.progress.waived} dispensados ·{" "}
                  {record.progress.pending} pendentes
                </span>
              </p>
              {checklistId === record.id && (
                <div id={`checklist-${record.id}`}>
                  {detailLoading && (
                    <LoadingState label="Carregando acompanhamento…" rows={1} />
                  )}
                  {detail && (
                    <ol className="divide-y divide-[var(--border)]">
                      {detail.items.map((item) => (
                        <li key={item.id} className="space-y-3 py-4">
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="text-sm">
                            {item.area} · Responsável: {item.assigneeName} ·{" "}
                            {item.required ? "Obrigatório" : "Opcional"}
                          </p>
                          <p>
                            <Badge variant={itemStatus[item.status].variant}>
                              {itemStatus[item.status].label}
                            </Badge>
                          </p>
                          {item.completedAt && (
                            <p className="text-sm text-[var(--text-muted)]">
                              Registrado em{" "}
                              {new Date(item.completedAt).toLocaleString(
                                "pt-BR",
                                { timeZone: "America/Manaus" },
                              )}
                            </p>
                          )}
                          {item.comment && (
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {item.comment}
                            </p>
                          )}
                          {item.canAct && (
                            <div className="space-y-3">
                              <Button
                                disabled={busy}
                                onClick={() => void act(item.id, "complete")}
                              >
                                Concluir
                              </Button>
                              <details>
                                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                                  Dispensar item
                                </summary>
                                <form
                                  className="max-w-xl space-y-3 py-3"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void act(
                                      item.id,
                                      "waive",
                                      String(
                                        new FormData(event.currentTarget).get(
                                          "comment",
                                        ) ?? "",
                                      ),
                                    );
                                  }}
                                >
                                  <FormField
                                    label="Justificativa da dispensa"
                                    htmlFor={`waive-${item.id}`}
                                    hint={
                                      item.required
                                        ? "Obrigatória para este item."
                                        : "Opcional para este item."
                                    }
                                  >
                                    <Textarea
                                      id={`waive-${item.id}`}
                                      name="comment"
                                      required={item.required}
                                      minLength={2}
                                      maxLength={2000}
                                      disabled={busy}
                                    />
                                  </FormField>
                                  <Button
                                    type="submit"
                                    variant="secondary"
                                    disabled={busy}
                                  >
                                    Confirmar dispensa
                                  </Button>
                                </form>
                              </details>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {detailLoading &&
        !records.some((record) => record.id === checklistId) && (
          <LoadingState label="Carregando acompanhamento…" rows={1} />
        )}
      {detailError && (
        <Alert tone="danger" title="Acompanhamento não atualizado">
          <p>{detailError}</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            Atualizar acompanhamento
          </Button>
        </Alert>
      )}
      <Pagination
        label="Páginas de checklists"
        page={page}
        hasMore={hasMore}
        disabled={busy || loading}
        onPageChange={(next) => {
          setPage(next);
          setParams({});
        }}
      />
    </div>
  );
}
