// Read/Operate: biblioteca institucional; formulários nativos e versões imutáveis.
import type {
  PublicationAudience,
  Resource,
  ResourceList,
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
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can } from "../lib/permissions";

const types = {
  policy: "Política",
  manual: "Manual",
  form: "Formulário",
  external_link: "Link externo",
};
const statuses = {
  published: "Publicado",
  superseded: "Substituído",
  archived: "Arquivado",
};
const control =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]";
const linkClass =
  "inline-flex min-h-11 items-center break-words font-semibold text-[var(--brand)] underline underline-offset-4";
const date = (value: string) => value.split("-").reverse().join("/");
const timestamp = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Manaus",
});
const messageOf = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
type Options = {
  units: { id: string; name: string }[];
  categories: { id: string; name: string }[];
};

function ResourceEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Resource | null;
  onSave: (item: Resource) => void;
  onCancel: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState(initial);
  const [source, setSource] = useState(initial?.externalUrl ? "url" : "file");
  const [type, setType] = useState<Resource["type"]>(initial?.type ?? "policy");
  const [audience, setAudience] = useState<PublicationAudience>(
    initial?.audience ?? { type: "all" },
  );
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setOptionsError("");
    void api<Options>("/api/hr-resources/options", {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setOptions(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setOptionsError(messageOf(cause));
      });
    return () => controller.abort();
  }, [retry]);
  async function refresh() {
    if (!reference) return;
    setBusy(true);
    try {
      const result = await api<ResourceList>(
        `/api/hr-resources/${reference.id}/versions`,
      );
      setReference(result.resources[0] ?? reference);
      setConfirmed(false);
      setConflict(false);
      setRefreshed(true);
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const input = {
      title: String(fields.get("title")),
      summary: String(fields.get("summary")),
      category: String(fields.get("category")),
      responsibleName: String(fields.get("responsibleName")),
      validFrom: String(fields.get("validFrom")),
      validUntil: String(fields.get("validUntil")),
      type,
      audience,
      requiresAcknowledgment: fields.has("requiresAcknowledgment"),
      externalUrl: source === "url" ? String(fields.get("externalUrl")) : null,
      ...(reference ? { version: reference.version } : {}),
    };
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("metadata", json(input));
      if (source === "file") body.set("file", fields.get("file") as File);
      onSave(
        await api<Resource>(
          `/api/hr-resources${reference ? `/${reference.id}/versions` : ""}`,
          { method: "POST", body: source === "file" ? body : json(input) },
        ),
      );
    } catch (cause) {
      setError(messageOf(cause));
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="max-w-3xl space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <h2 className="text-lg font-bold">
        {initial ? "Nova versão" : "Publicar recurso"}
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        A publicação é definitiva. Correções geram uma nova versão, sem apagar o
        histórico.
      </p>
      {error && (
        <Alert title="Publicação não concluída" tone="danger">
          {error}
          {conflict && (
            <Button
              className="mt-3 min-h-11"
              disabled={busy}
              variant="secondary"
              onClick={() => void refresh()}
            >
              Atualizar dados sem perder edição
            </Button>
          )}
        </Alert>
      )}
      {refreshed && (
        <Alert title="Revise antes de publicar" tone="warning">
          Seus campos foram preservados. Versão atual: {reference?.version} —{" "}
          {reference?.title}.{" "}
          {reference?.status === "archived"
            ? "O recurso foi arquivado e não aceita novas versões."
            : "Confirme novamente para publicar."}
        </Alert>
      )}
      {optionsError && (
        <Alert title="Públicos indisponíveis" tone="danger">
          {optionsError}
          <Button
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Recarregar públicos
          </Button>
        </Alert>
      )}
      <fieldset disabled={busy} className="space-y-5">
        <FormField htmlFor="resource-title" label="Título do recurso">
          <Input
            ref={titleRef}
            id="resource-title"
            name="title"
            required
            minLength={3}
            maxLength={160}
            defaultValue={initial?.title}
          />
        </FormField>
        <FormField htmlFor="resource-summary" label="Resumo">
          <Textarea
            id="resource-summary"
            name="summary"
            required
            minLength={3}
            maxLength={500}
            rows={3}
            defaultValue={initial?.summary}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField htmlFor="resource-type" label="Tipo">
            <select
              id="resource-type"
              className={control}
              value={type}
              onChange={(event) => {
                const next = event.target.value as Resource["type"];
                setType(next);
                if (next === "external_link") setSource("url");
              }}
            >
              {Object.entries(types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="resource-category" label="Categoria">
            <Input
              id="resource-category"
              name="category"
              required
              minLength={2}
              maxLength={80}
              defaultValue={initial?.category}
            />
          </FormField>
        </div>
        <FormField htmlFor="resource-responsible" label="Responsável">
          <Input
            id="resource-responsible"
            name="responsibleName"
            required
            minLength={3}
            maxLength={160}
            defaultValue={initial?.responsibleName}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["validFrom", "Início da vigência"],
              ["validUntil", "Fim da vigência"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} htmlFor={`resource-${key}`} label={label}>
              <DateInput
                className={control}
                id={`resource-${key}`}
                name={key}
                required
                defaultValue={initial?.[key]}
              />
            </FormField>
          ))}
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">
            Conteúdo desta versão
          </legend>
          <div className="flex flex-wrap gap-5">
            {[
              ["file", "Documento PDF"],
              ["url", "Endereço HTTPS"],
            ].map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="source"
                  value={value}
                  checked={source === value}
                  disabled={value === "file" && type === "external_link"}
                  onChange={() => setSource(value!)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div hidden={source !== "file"}>
          <FormField
            htmlFor="resource-file"
            label="Arquivo PDF"
            hint="Até 10 MB. Cada versão mantém seu próprio arquivo."
          >
            <input
              className={`${control} py-2`}
              id="resource-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required={source === "file"}
              disabled={source !== "file"}
            />
          </FormField>
        </div>
        <div hidden={source !== "url"}>
          <FormField htmlFor="resource-url" label="URL do recurso">
            <Input
              id="resource-url"
              name="externalUrl"
              type="url"
              pattern="https://.*"
              maxLength={2000}
              required={source === "url"}
              disabled={source !== "url"}
              defaultValue={initial?.externalUrl ?? ""}
            />
          </FormField>
        </div>
        <FormField htmlFor="resource-audience" label="Público">
          <select
            id="resource-audience"
            className={control}
            value={audience.type}
            onChange={(event) => {
              setAudience(
                event.target.value === "all"
                  ? { type: "all" }
                  : {
                      type: event.target.value as "units" | "categories",
                      ids: [],
                    },
              );
              setConfirmed(false);
            }}
          >
            <option value="all">Toda a CGE</option>
            <option value="units">Unidades selecionadas</option>
            <option value="categories">
              Categorias funcionais selecionadas
            </option>
          </select>
        </FormField>
        {audience.type !== "all" && (
          <fieldset>
            <legend className="text-sm font-semibold">
              {audience.type === "units" ? "Unidades" : "Categorias funcionais"}
            </legend>
            {!options ? (
              <p role="status">Carregando públicos…</p>
            ) : (
              options[audience.type].map((option) => (
                <label
                  key={option.id}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={audience.ids.includes(option.id)}
                    onChange={(event) => {
                      setAudience({
                        ...audience,
                        ids: event.target.checked
                          ? [...audience.ids, option.id]
                          : audience.ids.filter((id) => id !== option.id),
                      });
                      setConfirmed(false);
                    }}
                  />
                  {option.name}
                </label>
              ))
            )}
          </fieldset>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            name="requiresAcknowledgment"
            type="checkbox"
            defaultChecked={initial?.requiresAcknowledgment}
          />
          Solicitar confirmação de ciência
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Confirmo a publicação desta versão.
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            className="min-h-11"
            disabled={
              !options ||
              reference?.status === "archived" ||
              (audience.type !== "all" && !audience.ids.length)
            }
          >
            {busy ? "Publicando…" : "Confirmar publicação"}
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={onCancel}>
            Cancelar edição
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ResourcesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useSearchParams();
  const id = search.get("id");
  const manager = Boolean(user && can(user, "hr_resources.manage"));
  const management =
    manager &&
    (id ? search.get("manage") === "true" : search.get("manage") !== "false");
  const page = Math.max(1, Number(search.get("page")) || 1);
  const query = search.get("query") ?? "";
  const type = search.get("type") ?? "";
  const [result, setResult] = useState<ResourceList | null>(null);
  const [item, setItem] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{ initial: Resource | null } | null>(
    null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<ResourceList | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) statusRef.current?.focus();
  }, [message]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setItem(null);
    setResult(null);
    const parameters = new URLSearchParams({
      manage: String(management),
      page: String(page),
      query,
      ...(type ? { type } : {}),
    });
    void (
      id
        ? api<Resource>(`/api/hr-resources/${id}?manage=${management}`, {
            signal: controller.signal,
          }).then((value) => {
            if (!controller.signal.aborted) setItem(value);
          })
        : api<ResourceList>(`/api/hr-resources?${parameters}`, {
            signal: controller.signal,
          }).then((value) => {
            if (!controller.signal.aborted) setResult(value);
          })
    )
      .catch((cause) => {
        if (!controller.signal.aborted) setLoadError(messageOf(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, management, page, query, type, retry]);
  useEffect(() => {
    setHistory(null);
    setHistoryError("");
    if (!historyOpen || !id || !management) return;
    const controller = new AbortController();
    void api<ResourceList>(
      `/api/hr-resources/${id}/versions?page=${historyPage}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setHistory(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setHistoryError(messageOf(cause));
      });
    return () => controller.abort();
  }, [historyOpen, id, management, historyPage, retry]);
  function navigate(values: Record<string, string>) {
    setSearch(values);
    setEditor(null);
    setHistoryOpen(false);
    setHistoryPage(1);
    setArchive(false);
    setError("");
    setMessage("");
  }
  function location(resourceId?: string) {
    const values = new URLSearchParams({
      manage: String(management),
      page: String(page),
      query,
      ...(type ? { type } : {}),
      ...(resourceId ? { id: resourceId } : {}),
    });
    return `/biblioteca?${values}`;
  }
  async function transition(kind: "archive" | "acknowledgment") {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      const value = await api<Resource | { acknowledgedAt: string }>(
        `/api/hr-resources/${item.id}/${kind}`,
        { method: "POST", body: json({ version: item.version }) },
      );
      setItem(
        kind === "archive"
          ? (value as Resource)
          : { ...item, acknowledgedAt: value.acknowledgedAt },
      );
      setArchive(false);
      setMessage(
        kind === "archive" ? "Recurso arquivado." : "Ciência registrada.",
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-5xl space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Políticas e formulários
          </h1>
          <p className="mt-2 max-w-[70ch] text-sm text-[var(--text-muted)]">
            Normas, manuais e serviços da instituição, com versão e vigência
            definidas.
          </p>
        </div>
        {manager && (
          <Button
            className="min-h-11"
            disabled={Boolean(editor) || busy}
            onClick={() => {
              setEditor({ initial: null });
              setMessage("");
              setArchive(false);
            }}
          >
            Publicar recurso
          </Button>
        )}
      </header>
      {message && (
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="text-sm font-semibold text-[var(--brand)]"
        >
          {message}
        </p>
      )}
      {editor ? (
        <ResourceEditor
          initial={editor.initial}
          onCancel={() => setEditor(null)}
          onSave={(value) => {
            const revised = Boolean(editor.initial);
            setEditor(null);
            setSearch({ id: value.id, manage: "true" });
            setItem(value);
            setHistoryOpen(false);
            setMessage(
              revised ? "Nova versão publicada." : "Recurso publicado.",
            );
          }}
        />
      ) : (
        <>
          {id ? (
            <Button asChild variant="quiet" className="min-h-11">
              <Link to={location()}>Voltar à biblioteca</Link>
            </Button>
          ) : (
            <>
              {manager && (
                <Button
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => navigate({ manage: String(!management) })}
                >
                  {management ? "Ver como leitor" : "Gerenciar biblioteca"}
                </Button>
              )}
              <form
                key={`${query}:${type}`}
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  navigate({
                    manage: String(management),
                    query: String(data.get("query")),
                    ...(data.get("type")
                      ? { type: String(data.get("type")) }
                      : {}),
                  });
                }}
              >
                <div className="min-w-0 flex-1 basis-64">
                  <FormField
                    htmlFor="resource-search"
                    label="Buscar na biblioteca"
                  >
                    <Input
                      id="resource-search"
                      name="query"
                      maxLength={120}
                      defaultValue={query}
                      placeholder="Título, resumo ou categoria"
                    />
                  </FormField>
                </div>
                <FormField htmlFor="resource-filter" label="Filtrar por tipo">
                  <select
                    className={control}
                    id="resource-filter"
                    name="type"
                    defaultValue={type}
                  >
                    <option value="">Todos os tipos</option>
                    {Object.entries(types).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <Button type="submit" className="min-h-11">
                  Buscar
                </Button>
              </form>
            </>
          )}
          {loading ? (
            <p role="status">Carregando biblioteca…</p>
          ) : loadError ? (
            <Alert title="Biblioteca indisponível" tone="danger">
              {loadError}
              <Button
                className="mt-3 min-h-11"
                variant="secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Tentar novamente
              </Button>
            </Alert>
          ) : item ? (
            <article className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={item.status === "published" ? "success" : "neutral"}
                >
                  {statuses[item.status]}
                </Badge>
                <span className="text-sm">
                  {types[item.type]} · Versão {item.version}
                </span>
              </div>
              <h2 className="break-words text-xl font-bold">{item.title}</h2>
              <p className="max-w-[70ch] break-words text-sm">{item.summary}</p>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--text-muted)]">Categoria</dt>
                  <dd className="break-words font-semibold">{item.category}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Responsável</dt>
                  <dd className="break-words font-semibold">
                    {item.responsibleName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Vigência</dt>
                  <dd>
                    {date(item.validFrom)} a {date(item.validUntil)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Publicado por</dt>
                  <dd className="break-words">{item.authorName}</dd>
                </div>
              </dl>
              {item.supersededById && (
                <p className="text-sm">
                  Esta versão foi substituída.{" "}
                  <Link
                    className={linkClass}
                    to={location(item.supersededById)}
                  >
                    Consultar versão substituta
                  </Link>
                </p>
              )}
              {item.externalUrl ? (
                <div>
                  <a
                    className={linkClass}
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir link externo
                  </a>
                  <p className="text-xs text-[var(--text-muted)]">
                    Abre em uma nova aba.
                  </p>
                </div>
              ) : (
                <a
                  className={linkClass}
                  href={`/api/hr-resources/${item.id}/file?manage=${management}`}
                >
                  Baixar PDF
                </a>
              )}
              {error && (
                <Alert title="Ação não concluída" tone="danger">
                  {error}
                </Alert>
              )}
              {!management &&
                item.requiresAcknowledgment &&
                (item.acknowledgedAt ? (
                  <p className="text-sm">
                    Ciência confirmada em{" "}
                    {timestamp.format(new Date(item.acknowledgedAt))} · Manaus
                  </p>
                ) : (
                  <Button
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => void transition("acknowledgment")}
                  >
                    Confirmar ciência
                  </Button>
                ))}
              {management && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    {item.status === "published" && (
                      <>
                        <Button
                          className="min-h-11"
                          disabled={busy}
                          onClick={() => {
                            setEditor({ initial: item });
                            setMessage("");
                            setArchive(false);
                          }}
                        >
                          Nova versão
                        </Button>
                        <Button
                          variant="secondary"
                          className="min-h-11"
                          disabled={busy}
                          onClick={() => setArchive(true)}
                        >
                          Arquivar
                        </Button>
                      </>
                    )}
                    <Button
                      variant="quiet"
                      className="min-h-11"
                      aria-expanded={historyOpen}
                      aria-controls="resource-history"
                      onClick={() => setHistoryOpen(!historyOpen)}
                    >
                      Ver histórico
                    </Button>
                  </div>
                  {archive && (
                    <Alert title="Arquivar esta versão?" tone="warning">
                      O histórico será preservado, mas esta versão não ficará
                      disponível para leitura.
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Button
                          disabled={busy}
                          onClick={() => void transition("archive")}
                        >
                          Confirmar arquivamento
                        </Button>
                        <Button
                          disabled={busy}
                          variant="secondary"
                          onClick={() => setArchive(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </Alert>
                  )}
                  {historyOpen && (
                    <section
                      id="resource-history"
                      className="space-y-3 border-t border-[var(--border)] pt-5"
                    >
                      <h3 className="font-bold">Histórico de versões</h3>
                      {historyError ? (
                        <Alert title="Histórico indisponível" tone="danger">
                          {historyError}
                          <Button
                            variant="secondary"
                            onClick={() => setRetry((value) => value + 1)}
                          >
                            Recarregar histórico
                          </Button>
                        </Alert>
                      ) : !history ? (
                        <p role="status">Carregando histórico…</p>
                      ) : (
                        <>
                          <ul className="divide-y divide-[var(--border)]">
                            {history.resources.map((version) => (
                              <li key={version.id} className="py-2">
                                <Link
                                  className={linkClass}
                                  to={location(version.id)}
                                >
                                  Versão {version.version} — {version.title}
                                </Link>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {statuses[version.status]} ·{" "}
                                  {date(version.validFrom)} a{" "}
                                  {date(version.validUntil)}
                                </p>
                              </li>
                            ))}
                          </ul>
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              variant="secondary"
                              disabled={historyPage === 1}
                              onClick={() => setHistoryPage(historyPage - 1)}
                            >
                              Versões anteriores à página
                            </Button>
                            <span className="text-sm">
                              Página {historyPage}
                            </span>
                            <Button
                              variant="secondary"
                              disabled={!history.hasMore}
                              onClick={() => setHistoryPage(historyPage + 1)}
                            >
                              Mais versões
                            </Button>
                          </div>
                        </>
                      )}
                    </section>
                  )}
                </div>
              )}
            </article>
          ) : (
            <section aria-label="Recursos encontrados">
              <ul className="divide-y divide-[var(--border)]">
                {result?.resources.map((resource) => (
                  <li key={resource.id} className="space-y-1 py-4">
                    <Link className={linkClass} to={location(resource.id)}>
                      {resource.title}
                    </Link>
                    <p className="max-w-[70ch] break-words text-sm text-[var(--text-muted)]">
                      {resource.summary}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {types[resource.type]} · {resource.category} · Versão{" "}
                      {resource.version}
                      {management ? ` · ${statuses[resource.status]}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              {!result?.resources.length && (
                <p className="py-5 text-sm">
                  Nenhum recurso encontrado para esta consulta.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() =>
                    setSearch({
                      manage: String(management),
                      page: String(page - 1),
                      query,
                      ...(type ? { type } : {}),
                    })
                  }
                >
                  Anterior
                </Button>
                <span className="text-sm">Página {page}</span>
                <Button
                  variant="secondary"
                  disabled={!result?.hasMore}
                  onClick={() =>
                    setSearch({
                      manage: String(management),
                      page: String(page + 1),
                      query,
                      ...(type ? { type } : {}),
                    })
                  }
                >
                  Próxima
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
