// Read/Operate: comunicados vigentes, leitura e ciência; edição institucional em linha.
// Extensão code-led do sistema existente, sem editor visual ou nova identidade.
import type {
  Communication,
  CommunicationInput,
  CommunicationList,
  PublicationAudience,
} from "@cge/contracts";
import { Alert, Badge, Button, FormField, Input, Textarea } from "@cge/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can } from "../lib/permissions";

const labels = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado / encerrado",
};
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Manaus",
});
const messageOf = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]";
const localDate = (value: string) =>
  new Date(Date.parse(value) - 4 * 3600000).toISOString().slice(0, 16);
type Options = {
  units: { id: string; name: string }[];
  categories: { id: string; name: string }[];
};

export function CommunicationsPanel({
  compact = true,
  management = false,
  revision = 0,
}: {
  compact?: boolean;
  management?: boolean;
  revision?: number;
}) {
  const { user } = useAuth();
  const [result, setResult] = useState<CommunicationList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user?.employment && !management) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api<CommunicationList>(
      `/api/hr-communications?manage=${management}&page=${page}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(messageOf(cause));
          setResult(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, management, page, retry, revision]);
  if (!user?.employment && !management) return null;
  return (
    <section
      aria-label={compact ? "Comunicados vigentes" : "Lista de comunicados"}
      className="space-y-4"
    >
      {compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Comunicados</h2>
          <Button asChild variant="quiet" className="min-h-11">
            <Link to="/comunicados">Ver todos</Link>
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status" className="text-sm text-[var(--text-muted)]">
          Carregando comunicados…
        </p>
      ) : error ? (
        <Alert title="Comunicados indisponíveis" tone="danger">
          {error}
          <Button
            className="mt-3 min-h-11"
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : !result?.communications.length ? (
        <p className="py-5 text-sm text-[var(--text-muted)]">
          {management
            ? "Nenhum comunicado cadastrado. Crie um rascunho para começar."
            : "Nenhum comunicado vigente para seu público."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {result.communications.slice(0, compact ? 3 : 50).map((item) => (
            <li key={item.id} className="space-y-2 py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={item.status === "published" ? "success" : "neutral"}
                >
                  {labels[item.status]}
                </Badge>
                {item.requiresAcknowledgment && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {item.acknowledgedAt
                      ? "Ciência confirmada"
                      : "Ciência solicitada"}
                  </span>
                )}
              </div>
              <Link
                className="inline-flex min-h-11 items-center text-base font-bold text-[var(--brand)] underline decoration-transparent underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                to={`/comunicados?id=${item.id}${management ? "&manage=true" : ""}`}
              >
                {item.title}
              </Link>
              <p className="max-w-[70ch] break-words text-sm text-[var(--text-muted)]">
                {item.summary}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Até {date.format(new Date(item.expiresAt))} · Manaus
              </p>
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">Página {page}</span>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={loading || !result?.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}

function CommunicationEditor({
  initial,
  onSaved,
  onCancel,
  onBusy,
}: {
  initial: Communication | null;
  onSaved: (item: Communication) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [reference, setReference] = useState(initial);
  const [input, setInput] = useState(() => ({
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    body: initial?.body ?? "",
    publicationAt: localDate(
      initial?.publicationAt ?? new Date().toISOString(),
    ),
    expiresAt: localDate(
      initial?.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString(),
    ),
    requiresAcknowledgment: initial?.requiresAcknowledgment ?? false,
  }));
  const [audience, setAudience] = useState<PublicationAudience>(
    initial?.audience ?? { type: "all" },
  );
  const [confirmed, setConfirmed] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  useEffect(() => {
    document.getElementById("communication-title")?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setOptionsError("");
    void api<Options>("/api/hr-communications/options", {
      signal: controller.signal,
    })
      .then(setOptions)
      .catch((cause) => {
        if (!controller.signal.aborted) setOptionsError(messageOf(cause));
      });
    return () => controller.abort();
  }, [retry]);
  const busy = (value: boolean) => {
    setSaving(value);
    onBusy(value);
  };
  const audienceChanged =
    reference &&
    (reference.audience.type !== audience.type ||
      (reference.audience.type !== "all" &&
        audience.type !== "all" &&
        [...reference.audience.ids].sort().join() !==
          [...audience.ids].sort().join()));
  const confirmationRequired =
    reference && reference.status !== "draft" && audienceChanged;
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setConflict(false);
    if (audience.type !== "all" && !audience.ids.length) {
      setError("Selecione ao menos uma unidade ou categoria.");
      return;
    }
    busy(true);
    try {
      const payload: CommunicationInput = {
        ...input,
        audience,
        publicationAt: new Date(
          `${input.publicationAt}:00-04:00`,
        ).toISOString(),
        expiresAt: new Date(`${input.expiresAt}:00-04:00`).toISOString(),
      };
      const item = await api<Communication>(
        reference
          ? `/api/hr-communications/${reference.id}`
          : "/api/hr-communications",
        {
          method: reference ? "PUT" : "POST",
          body: json(
            reference
              ? {
                  ...payload,
                  version: reference.version,
                  confirmAudienceChange: confirmed,
                }
              : payload,
          ),
        },
      );
      onSaved(item);
    } catch (cause) {
      setError(messageOf(cause));
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally {
      busy(false);
    }
  }
  async function refreshReference() {
    if (!reference) return;
    busy(true);
    setError("");
    try {
      const current = await api<Communication>(
        `/api/hr-communications/${reference.id}?manage=true`,
      );
      setReference(current);
      setConfirmed(false);
      setConflict(false);
      setRefreshed(true);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      busy(false);
    }
  }
  const selectedOptions =
    audience.type === "all" ? [] : (options?.[audience.type] ?? []);
  return (
    <form onSubmit={save} className="max-w-3xl space-y-5">
      <h2 className="text-lg font-bold">
        {reference ? "Editar comunicado" : "Novo comunicado"}
      </h2>
      {error && (
        <Alert title="Não foi possível salvar" tone="danger">
          {error}
          {conflict && reference && (
            <Button
              className="mt-3 min-h-11"
              variant="secondary"
              disabled={saving}
              onClick={() => void refreshReference()}
            >
              Atualizar dados sem perder edição
            </Button>
          )}
        </Alert>
      )}
      {refreshed && (
        <Alert title="Revise antes de salvar" tone="warning">
          Dados atuais carregados. Seus campos foram preservados; nenhuma
          alteração foi enviada. Versão atual: {reference?.version} —{" "}
          {reference?.title}.
        </Alert>
      )}
      {optionsError && (
        <Alert title="Públicos indisponíveis" tone="danger">
          {optionsError}
          <Button
            className="mt-3 min-h-11"
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Recarregar públicos
          </Button>
        </Alert>
      )}
      <fieldset disabled={saving} className="space-y-5">
        <FormField htmlFor="communication-title" label="Título">
          <Input
            id="communication-title"
            className="min-h-11"
            required
            minLength={3}
            maxLength={160}
            value={input.title}
            onChange={(event) =>
              setInput({ ...input, title: event.target.value })
            }
          />
        </FormField>
        <FormField htmlFor="communication-summary" label="Resumo">
          <Textarea
            id="communication-summary"
            required
            minLength={3}
            maxLength={500}
            rows={2}
            value={input.summary}
            onChange={(event) =>
              setInput({ ...input, summary: event.target.value })
            }
          />
        </FormField>
        <FormField
          htmlFor="communication-body"
          label="Conteúdo em Markdown"
          hint="Use ## para títulos, **texto** para negrito e - para listas. HTML não é executado."
        >
          <Textarea
            id="communication-body"
            required
            maxLength={20000}
            rows={8}
            value={input.body}
            onChange={(event) =>
              setInput({ ...input, body: event.target.value })
            }
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["publicationAt", "Publicação (horário de Manaus)"],
              ["expiresAt", "Expiração (horário de Manaus)"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} htmlFor={`communication-${key}`} label={label}>
              <Input
                id={`communication-${key}`}
                className="min-h-11 min-w-0"
                type="datetime-local"
                required
                value={input[key]}
                onChange={(event) =>
                  setInput({ ...input, [key]: event.target.value })
                }
              />
            </FormField>
          ))}
        </div>
        <FormField htmlFor="communication-audience" label="Público">
          <select
            id="communication-audience"
            className={selectClass}
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
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">
              {audience.type === "units" ? "Unidades" : "Categorias funcionais"}
            </legend>
            {!options ? (
              <p role="status" className="text-sm">
                Carregando públicos…
              </p>
            ) : (
              selectedOptions.map((option) => (
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
            type="checkbox"
            checked={input.requiresAcknowledgment}
            onChange={(event) =>
              setInput({
                ...input,
                requiresAcknowledgment: event.target.checked,
              })
            }
          />
          Solicitar confirmação de ciência
        </label>
        {reference && reference.status !== "draft" && (
          <p className="text-sm text-[var(--text-muted)]">
            Salvar altera o comunicado publicado e solicita nova ciência quando
            exigida.
          </p>
        )}
        {confirmationRequired && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Confirmo a mudança do público. Pessoas removidas perderão acesso.
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            className="min-h-11"
            disabled={!options || reference?.status === "archived"}
          >
            {saving
              ? "Salvando…"
              : reference
                ? "Salvar alterações"
                : "Salvar rascunho"}
          </Button>
          <Button className="min-h-11" variant="secondary" onClick={onCancel}>
            Cancelar edição
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function CommunicationsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useSearchParams();
  const manager = Boolean(user && can(user, "hr_communications.manage"));
  const id = search.get("id");
  const management =
    manager &&
    (id ? search.get("manage") === "true" : search.get("manage") !== "false");
  const [item, setItem] = useState<Communication | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{
    initial: Communication | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"publish" | "archive" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!id) {
      setItem(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setItem(null);
    void api<Communication>(
      `/api/hr-communications/${id}?manage=${management && manager}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setItem(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setLoadError(messageOf(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, management, manager, revision]);
  useEffect(() => {
    if (message) statusRef.current?.focus();
  }, [message]);
  async function transition(kind: "publish" | "archive" | "acknowledgment") {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Communication | { acknowledgedAt: string }>(
        `/api/hr-communications/${item.id}/${kind}`,
        { method: "POST", body: json({ version: item.version }) },
      );
      setItem(
        kind === "acknowledgment"
          ? { ...item, acknowledgedAt: result.acknowledgedAt }
          : (result as Communication),
      );
      setAction(null);
      setMessage(
        kind === "publish"
          ? "Comunicado publicado."
          : kind === "archive"
            ? "Comunicado arquivado."
            : "Ciência registrada.",
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }
  function back() {
    setSearch({ manage: String(management) });
    setEditor(null);
    setAction(null);
    setError("");
    setMessage("");
  }
  return (
    <div className="max-w-5xl space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Comunicados
          </h1>
          <p className="mt-2 max-w-[70ch] text-sm text-[var(--text-muted)]">
            Avisos da instituição, com público e vigência definidos.
          </p>
        </div>
        {manager && (
          <Button
            className="min-h-11"
            disabled={busy || Boolean(editor) || loading}
            onClick={() => {
              setEditor({ initial: null });
              setMessage("");
              setAction(null);
            }}
          >
            Novo comunicado
          </Button>
        )}
      </header>
      {message && (
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="text-sm font-semibold text-[var(--success)]"
        >
          {message}
        </p>
      )}
      {editor ? (
        <CommunicationEditor
          initial={editor.initial}
          onBusy={setBusy}
          onCancel={() => setEditor(null)}
          onSaved={(saved) => {
            setEditor(null);
            setItem(saved);
            setSearch({ id: saved.id, manage: "true" });
            setMessage(
              editor.initial ? "Alterações salvas." : "Rascunho salvo.",
            );
          }}
        />
      ) : (
        <>
          {manager && !id && (
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                variant={management ? "primary" : "secondary"}
                aria-pressed={management}
                onClick={() => setSearch({ manage: "true" })}
              >
                Gerenciar comunicados
              </Button>
              <Button
                className="min-h-11"
                variant={!management ? "primary" : "secondary"}
                aria-pressed={!management}
                onClick={() => setSearch({ manage: "false" })}
              >
                Para meu público
              </Button>
            </div>
          )}
          {id ? (
            <>
              <Button
                className="min-h-11"
                variant="secondary"
                disabled={busy}
                onClick={back}
              >
                Voltar à lista
              </Button>
              {loading ? (
                <p role="status" className="text-sm">
                  Carregando comunicado…
                </p>
              ) : loadError ? (
                <Alert title="Comunicado indisponível" tone="danger">
                  {loadError}
                  <Button
                    className="mt-3 min-h-11"
                    variant="secondary"
                    onClick={() => setRevision((value) => value + 1)}
                  >
                    Tentar novamente
                  </Button>
                </Alert>
              ) : (
                item && (
                  <article className="max-w-[75ch] space-y-5 break-words">
                    <div className="space-y-3">
                      <Badge
                        variant={
                          item.status === "published" ? "success" : "neutral"
                        }
                      >
                        {labels[item.status]}
                      </Badge>
                      <h2 className="text-xl font-bold">{item.title}</h2>
                      <p className="text-sm text-[var(--text-muted)]">
                        {item.summary}
                      </p>
                      <p className="text-xs leading-5 text-[var(--text-muted)]">
                        Por {item.authorName} · Versão {item.version}
                        <br />
                        De {date.format(new Date(item.publicationAt))} até{" "}
                        {date.format(new Date(item.expiresAt))} · Manaus
                      </p>
                    </div>
                    <div
                      className="space-y-4 text-sm leading-7 [overflow-wrap:anywhere] [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-[var(--brand)] [&_a]:underline [&_a]:underline-offset-4 [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
                    />
                    {error && (
                      <Alert title="Ação não concluída" tone="danger">
                        {error}
                        <Button
                          className="mt-3 min-h-11"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setAction(null);
                            setError("");
                            setRevision((value) => value + 1);
                          }}
                        >
                          Atualizar comunicado
                        </Button>
                      </Alert>
                    )}
                    {management && manager ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                          {item.status !== "archived" && (
                            <Button
                              className="min-h-11"
                              variant="secondary"
                              disabled={busy || Boolean(action)}
                              onClick={() => {
                                setEditor({ initial: item });
                                setMessage("");
                              }}
                            >
                              Editar
                            </Button>
                          )}
                          {item.status === "draft" && (
                            <Button
                              className="min-h-11"
                              disabled={busy || Boolean(action)}
                              onClick={() => setAction("publish")}
                            >
                              Publicar
                            </Button>
                          )}
                          {item.status !== "archived" && (
                            <Button
                              className="min-h-11"
                              variant="secondary"
                              disabled={busy || Boolean(action)}
                              onClick={() => setAction("archive")}
                            >
                              Arquivar
                            </Button>
                          )}
                        </div>
                        {action && (
                          <Alert
                            title={
                              action === "publish"
                                ? "Publicar para o público selecionado?"
                                : "Retirar o comunicado de circulação?"
                            }
                            tone="warning"
                          >
                            {action === "publish"
                              ? "O comunicado ficará disponível durante a vigência informada."
                              : "O público deixará de acessar o conteúdo. O registro de auditoria será mantido."}
                            <div className="mt-3 flex flex-wrap gap-3">
                              <Button
                                className="min-h-11"
                                disabled={busy}
                                onClick={() => void transition(action)}
                              >
                                {busy
                                  ? "Aguarde…"
                                  : action === "publish"
                                    ? "Confirmar publicação"
                                    : "Confirmar arquivamento"}
                              </Button>
                              <Button
                                className="min-h-11"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => setAction(null)}
                              >
                                Voltar
                              </Button>
                            </div>
                          </Alert>
                        )}
                      </div>
                    ) : (
                      item.requiresAcknowledgment && (
                        <div className="border-t border-[var(--border)] pt-5">
                          {item.acknowledgedAt ? (
                            <p className="text-sm font-semibold">
                              Ciência confirmada em{" "}
                              {date.format(new Date(item.acknowledgedAt))} ·
                              Manaus
                            </p>
                          ) : (
                            <>
                              <p className="mb-3 text-sm text-[var(--text-muted)]">
                                Confirme após ler esta versão do comunicado.
                              </p>
                              <Button
                                className="min-h-11"
                                disabled={busy}
                                onClick={() =>
                                  void transition("acknowledgment")
                                }
                              >
                                {busy ? "Registrando…" : "Confirmar ciência"}
                              </Button>
                            </>
                          )}
                        </div>
                      )
                    )}
                  </article>
                )
              )}
            </>
          ) : (
            <CommunicationsPanel
              key={String(management)}
              compact={false}
              management={management && manager}
              revision={revision}
            />
          )}
        </>
      )}
    </div>
  );
}
