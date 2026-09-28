import type { DocumentType, FunctionalDocument } from "@cge/contracts";
import {
  Alert,
  Button,
  ConfirmDialog,
  DateInput,
  FormField,
  Input,
} from "@cge/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can, canGlobally } from "../lib/permissions";

const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm";

export function DocumentsSection({
  personId,
  manage = false,
}: {
  personId?: string;
  manage?: boolean;
}) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<FunctionalDocument[] | null>(null);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      setDocuments(
        (
          await api<{ documents: FunctionalDocument[] }>(
            personId
              ? `/api/documents?personId=${encodeURIComponent(personId)}`
              : "/api/me/documents",
          )
        ).documents,
      );
      if (manage)
        setTypes(
          (await api<{ types: DocumentType[] }>("/api/document-types")).types,
        );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar os documentos. Tente novamente.",
      );
    }
  }, [personId, manage]);
  useEffect(() => {
    setDocuments(null);
    void load();
  }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File)) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("O PDF deve ter no máximo 5 MB.");
      return;
    }
    const body = new FormData();
    body.append(
      "metadata",
      json({
        personId,
        typeId: data.get("typeId"),
        title: data.get("title"),
        issuedOn: data.get("issuedOn"),
        validUntil: data.get("validUntil") || null,
        source: data.get("source"),
        requiresAcknowledgment: data.has("requiresAcknowledgment"),
      }),
    );
    body.append("file", file);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/api/documents", { method: "POST", body });
      form.reset();
      await load();
      setSuccess("Documento publicado no dossiê.");
      const details = form.closest("details");
      if (details) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível publicar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function acknowledge(id: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ acknowledgedAt: string }>(
        `/api/documents/${id}/acknowledgment`,
        { method: "POST" },
      );
      setDocuments(
        (current) =>
          current?.map((item) =>
            item.id === id
              ? {
                  ...item,
                  acknowledgedAt: new Date(result.acknowledgedAt),
                  acknowledgedByAccountId: user!.account.id,
                }
              : item,
          ) ?? null,
      );
      setSuccess("Ciência registrada.");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível registrar ciência. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/documents/${id}/archive`, { method: "POST" });
      await load();
      setSuccess("Documento arquivado. O arquivo não foi eliminado.");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível arquivar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Documentos funcionais" className="space-y-4">
      <h2 className="text-lg font-bold">Documentos funcionais</h2>
      {error ? (
        <Alert title="Não foi possível concluir" tone="danger">
          {error}
          <Button variant="quiet" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : null}
      {success ? <p role="status">{success}</p> : null}
      {manage ? (
        <details className="border-b border-[var(--border)] pb-4">
          <summary className="cursor-pointer py-2 font-semibold">
            Publicar documento
          </summary>
          {!types.length ? (
            <p className="my-3">
              Cadastre um tipo com finalidade e retenção antes de publicar.
            </p>
          ) : (
            <form onSubmit={upload} className="mt-4 max-w-2xl space-y-4">
              <FormField htmlFor="documentType" label="Tipo de documento">
                <select
                  id="documentType"
                  name="typeId"
                  className={selectClass}
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione um tipo
                  </option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                      {type.sensitive ? " · Sensível" : ""}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField htmlFor="documentTitle" label="Título">
                <Input
                  id="documentTitle"
                  name="title"
                  required
                  minLength={2}
                  maxLength={180}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField htmlFor="documentIssued" label="Data de emissão">
                  <DateInput id="documentIssued" name="issuedOn" required />
                </FormField>
                <FormField
                  htmlFor="documentValid"
                  label="Válido até (opcional)"
                >
                  <DateInput id="documentValid" name="validUntil" />
                </FormField>
              </div>
              <FormField
                htmlFor="documentSource"
                label="Fonte / área responsável"
              >
                <Input
                  id="documentSource"
                  name="source"
                  required
                  minLength={2}
                  maxLength={180}
                />
              </FormField>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="requiresAcknowledgment" />
                Solicitar ciência do titular
              </label>
              <FormField
                htmlFor="documentFile"
                label="Arquivo PDF"
                hint="Até 5 MB. Download privado; a chefia não recebe acesso automático."
              >
                <Input
                  id="documentFile"
                  name="file"
                  type="file"
                  accept="application/pdf"
                  required
                />
              </FormField>
              <Button type="submit" disabled={busy}>
                {busy ? "Publicando…" : "Publicar documento"}
              </Button>
            </form>
          )}
        </details>
      ) : null}
      {documents === null && !error ? (
        <p role="status">Carregando documentos…</p>
      ) : !documents?.length ? (
        <p className="text-sm text-[var(--text-muted)]">
          Nenhum documento disponível.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {documents.map((item) => (
            <li key={item.id} className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="break-words font-semibold">
                  {item.title}
                  {item.archivedAt ? " · Arquivado" : ""}
                </h3>
                {!item.archivedAt ? (
                  <a
                    className="text-sm font-semibold underline underline-offset-4"
                    href={`/api/documents/${item.id}/file`}
                    aria-label={`Baixar ${item.title}`}
                  >
                    Baixar PDF
                  </a>
                ) : null}
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {item.typeName} · Emissão:{" "}
                {item.issuedOn.split("-").reverse().join("/")} ·{" "}
                {Math.ceil(item.size / 1024)} KB
              </p>
              <details>
                <summary className="cursor-pointer py-2 text-sm">
                  Fonte, finalidade e retenção
                </summary>
                <dl className="grid gap-3 py-3 text-sm sm:grid-cols-2">
                  {[
                    ["Fonte", item.source],
                    ["Publicado por", item.authorName],
                    ["Finalidade", item.purpose],
                    ["Política de retenção", item.policyReference],
                    [
                      "Retenção prevista até",
                      new Date(item.retainedUntil).toLocaleDateString("pt-BR", {
                        timeZone: "America/Manaus",
                      }),
                    ],
                    [
                      "Vigência até",
                      item.validUntil?.split("-").reverse().join("/") ||
                        "Não informada",
                    ],
                    [
                      "Acesso",
                      item.sensitive
                        ? "Titular e RH com permissão específica"
                        : "Titular e RH autorizado",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[var(--text-muted)]">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm">
                  Arquivamento não elimina o arquivo. Eliminação depende da
                  política aprovada.
                </p>
              </details>
              {item.requiresAcknowledgment &&
                (item.acknowledgedAt ? (
                  <p className="text-sm">
                    Ciência confirmada em{" "}
                    {new Date(item.acknowledgedAt).toLocaleString("pt-BR", {
                      timeZone: "America/Manaus",
                    })}{" "}
                    · Manaus
                  </p>
                ) : !item.archivedAt && item.personId === user?.person.id ? (
                  <Button
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => void acknowledge(item.id)}
                  >
                    Confirmar ciência
                  </Button>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    Ciência pendente do titular.
                  </p>
                ))}
              {manage && !item.archivedAt ? (
                <ConfirmDialog
                  title="Arquivar documento?"
                  description="O documento deixará de estar disponível para download. Arquivo e metadados serão preservados."
                  confirmLabel="Arquivar documento"
                  onConfirm={() => archive(item.id)}
                >
                  <Button variant="quiet" disabled={busy}>
                    Arquivar
                  </Button>
                </ConfirmDialog>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DocumentsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [personId, setPersonId] = useState("");
  const [typesVersion, setTypesVersion] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api<{ people: typeof people }>(
        `/api/document-people?query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then((result) => setPeople(result.people))
        .catch(() => {
          if (!controller.signal.aborted)
            setError("Não foi possível buscar os titulares. Tente novamente.");
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="max-w-4xl space-y-6 pb-8">
      <h1 className="text-2xl font-extrabold">Documentos privados</h1>
      <p className="text-sm text-[var(--text-muted)]">
        Publique documentos no dossiê do titular, respeitando as permissões da
        unidade.
      </p>
      {user && canGlobally(user, "documents.manage") ? (
        <DocumentTypeForm
          onCreated={() => setTypesVersion((value) => value + 1)}
        />
      ) : null}
      {error ? (
        <Alert title="Não foi possível carregar" tone="danger">
          {error}
        </Alert>
      ) : null}
      <FormField htmlFor="documentPersonQuery" label="Buscar titular">
        <Input
          id="documentPersonQuery"
          type="search"
          value={query}
          onChange={(event) => {
            setError("");
            setPersonId("");
            setQuery(event.target.value);
          }}
        />
      </FormField>
      <FormField htmlFor="documentPerson" label="Titular">
        <select
          id="documentPerson"
          className={selectClass}
          value={personId}
          onChange={(event) => setPersonId(event.target.value)}
        >
          <option value="">Selecione uma pessoa</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </FormField>
      {personId ? (
        <DocumentsSection
          key={`${personId}:${typesVersion}`}
          personId={personId}
          manage={Boolean(user && can(user, "documents.manage"))}
        />
      ) : (
        <p className="text-sm">
          Selecione o titular para consultar ou publicar documentos.
        </p>
      )}
    </div>
  );
}

function DocumentTypeForm({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {success ? <p role="status">{success}</p> : null}
      <details className="border-b border-[var(--border)] pb-4">
        <summary className="cursor-pointer py-2 font-semibold">
          Cadastrar tipo e política documental
        </summary>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setError("");
            setSuccess("");
            try {
              await api("/api/document-types", {
                method: "POST",
                body: json({
                  name: data.get("name"),
                  purpose: data.get("purpose"),
                  policyReference: data.get("policyReference"),
                  retentionDays: Number(data.get("retentionDays")),
                  sensitive: data.get("sensitive") === "on",
                }),
              });
              form.reset();
              setSuccess("Tipo cadastrado.");
              onCreated();
              const details = form.closest("details");
              if (details) {
                details.open = false;
                details.querySelector("summary")?.focus();
              }
            } catch (cause) {
              setError(
                cause instanceof ApiError
                  ? cause.message
                  : "Não foi possível cadastrar o tipo.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {error ? (
            <Alert title="Não foi possível cadastrar" tone="danger">
              {error}
            </Alert>
          ) : null}
          <FormField htmlFor="typeName" label="Nome do tipo">
            <Input
              id="typeName"
              name="name"
              required
              minLength={2}
              maxLength={120}
            />
          </FormField>
          <FormField htmlFor="typePurpose" label="Finalidade">
            <Input
              id="typePurpose"
              name="purpose"
              required
              minLength={10}
              maxLength={500}
            />
          </FormField>
          <FormField
            htmlFor="typePolicy"
            label="Referência da política aprovada"
          >
            <Input
              id="typePolicy"
              name="policyReference"
              required
              minLength={5}
              maxLength={240}
            />
          </FormField>
          <FormField
            htmlFor="typeRetention"
            label="Retenção em dias desde a publicação"
          >
            <Input
              id="typeRetention"
              name="retentionDays"
              type="number"
              required
              min={1}
              max={36500}
            />
          </FormField>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="sensitive" />
            Documento sensível — exige autorização específica além do acesso
            documental
          </label>
          <p className="text-sm text-[var(--text-muted)]">
            A política é preservada em cada publicação. Para uma nova política,
            cadastre outro tipo.
          </p>
          <Button type="submit" disabled={busy}>
            Cadastrar tipo
          </Button>
        </form>
      </details>
    </div>
  );
}
