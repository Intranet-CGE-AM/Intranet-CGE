import {
  occurrenceStatuses,
  type Occurrence,
  type OccurrenceDetail,
  type OccurrenceType,
  type FunctionalDocument,
  type DocumentType,
} from "@cge/contracts";
import {
  Alert,
  Button,
  ConfirmDialog,
  DateInput,
  FormField,
  Input,
  Textarea,
} from "@cge/ui";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can, canGlobally } from "../lib/permissions";

// Operate: extensão da intranet institucional. Formulário curto, datas nativas,
// comprovante contextual e acompanhamento em linha; preservar rascunho em falhas.
const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm";
const eventLabels: Record<string, string> = {
  created: "Rascunho criado",
  submitted: "Ocorrência enviada",
  "document-attached": "Comprovante anexado",
  "supervisor-approved": "Aprovada pela chefia",
  "supervisor-rejected": "Rejeitada pela chefia",
  "final-approved": "Aprovação final",
  "final-rejected": "Rejeitada pelo RH",
  cancelled: "Cancelada",
};
const date = (value: string) => value.split("-").reverse().join("/");
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Não foi possível concluir. Tente novamente.";

export function OccurrencesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const occurrenceId = params.get("occurrenceId");
  const creates = Boolean(
    user?.employment &&
    can(user, "occurrences.create", user.employment.unit.id),
  );
  const chief = Boolean(user && can(user, "occurrences.review.supervisor"));
  const final = Boolean(user && can(user, "occurrences.review.final"));
  const [scope, setScope] = useState(() => {
    const requested = params.get("scope");
    return (requested === "supervisor" && chief) ||
      (requested === "final" && final)
      ? requested
      : "mine";
  });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Occurrence[]>([]);
  const [types, setTypes] = useState<OccurrenceType[]>([]);
  const [policies, setPolicies] = useState<DocumentType[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<OccurrenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const selectedType = types.find((type) => type.id === typeId);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    setDetail(null);
    setLoadError("");
    void Promise.all([
      api<{ occurrences: Occurrence[]; hasMore: boolean }>(
        `/api/occurrences?scope=${scope}&page=${page}`,
        { signal },
      ),
      api<{ types: OccurrenceType[]; documentTypes: DocumentType[] }>(
        "/api/occurrence-types",
        { signal },
      ),
      occurrenceId
        ? api<OccurrenceDetail>(
            `/api/occurrences/${encodeURIComponent(occurrenceId)}`,
            { signal },
          )
        : Promise.resolve(null),
    ])
      .then(([list, catalog, selected]) => {
        if (signal.aborted) return;
        setItems(
          selected && !list.occurrences.some((item) => item.id === selected.id)
            ? [selected, ...list.occurrences]
            : list.occurrences,
        );
        setHasMore(list.hasMore);
        setTypes(catalog.types);
        setPolicies(catalog.documentTypes);
        setDetail(selected);
      })
      .catch((cause) => {
        if (!signal.aborted) setLoadError(message(cause));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, page, revision, occurrenceId]);

  async function upload(item: Occurrence, file: File) {
    if (!user || !item.documentTypeId)
      throw new Error("Política documental indisponível");
    const data = new FormData();
    data.set(
      "metadata",
      json({
        personId: user.person.id,
        typeId: item.documentTypeId,
        title: `Comprovante de ${item.typeName}`.slice(0, 180),
        issuedOn: new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Manaus",
        }),
        source: "Enviado pelo titular",
        occurrenceId: item.id,
        occurrenceVersion: item.version,
      }),
    );
    data.set("file", file);
    await api<FunctionalDocument>("/api/documents", {
      method: "POST",
      body: data,
    });
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const draft =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "draft";
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;
    setError("");
    setSuccess("");
    if (!draft && selectedType?.requiresDocument && !hasFile) {
      setError(
        "Selecione o comprovante PDF obrigatório ou salve como rascunho.",
      );
      return;
    }
    setBusy(true);
    let saved: Occurrence | undefined;
    try {
      saved = await api<Occurrence>("/api/occurrences", {
        method: "POST",
        body: json({
          typeId,
          startDate,
          endDate: data.get("endDate"),
          justification: data.get("justification"),
          submit: !draft && !hasFile,
        }),
      });
      form.reset();
      setFormOpen(false);
      setTypeId("");
      setStartDate("");
      if (hasFile) {
        await upload(saved, file);
        if (!draft)
          await api(`/api/occurrences/${saved.id}/transition`, {
            method: "POST",
            body: json({ action: "submit", version: saved.version + 1 }),
          });
      }
      setSuccess(draft ? "Rascunho salvo." : "Ocorrência enviada.");
      refresh();
    } catch (cause) {
      // Keep the saved record reachable when upload or submission fails; never create it again implicitly.
      if (saved) {
        setParams({ occurrenceId: saved.id });
        setSuccess(
          "Rascunho salvo. Abra o acompanhamento para tentar anexar ou enviar novamente.",
        );
      }
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function transition(
    item: Occurrence,
    action: string,
    comment?: string,
  ) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/occurrences/${item.id}/transition`, {
        method: "POST",
        body: json({ action, version: item.version, comment }),
      });
      setParams({});
      setSuccess("Ocorrência atualizada.");
      refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  function changeScope(value: string) {
    setScope(value);
    setPage(1);
    setParams({});
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ocorrências e afastamentos
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Solicite um período e acompanhe a análise. Não há cálculo de
            direitos ou benefícios.
          </p>
        </div>
        {creates && (
          <Button
            disabled={busy || loading}
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? "Fechar formulário" : "Nova ocorrência"}
          </Button>
        )}
      </header>
      {success && <Alert title={success} tone="success" />}
      {(error || loadError) && (
        <Alert title={error || loadError} tone="danger">
          <Button
            variant="secondary"
            disabled={busy || loading}
            onClick={() => {
              setError("");
              refresh();
            }}
          >
            Atualizar dados
          </Button>
        </Alert>
      )}
      {formOpen && (
        <form
          onSubmit={(event) => void create(event)}
          className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <h2 className="text-lg font-bold">Nova ocorrência</h2>
          <FormField label="Tipo de ocorrência" htmlFor="occurrenceType">
            <select
              id="occurrenceType"
              className={selectClass}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
              required
              disabled={busy}
            >
              <option value="">Selecione</option>
              {types
                .filter((type) => type.active)
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data inicial" htmlFor="occurrenceStart">
              <DateInput
                id="occurrenceStart"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                disabled={busy}
              />
            </FormField>
            <FormField label="Data final" htmlFor="occurrenceEnd">
              <DateInput
                id="occurrenceEnd"
                name="endDate"
                min={startDate}
                required
                disabled={busy}
              />
            </FormField>
          </div>
          <FormField
            label="Justificativa"
            htmlFor="occurrenceReason"
            hint="Descreva a solicitação. Informações privadas não são exibidas à chefia."
          >
            <Textarea
              id="occurrenceReason"
              name="justification"
              minLength={10}
              maxLength={2000}
              required
              disabled={busy}
            />
          </FormField>
          {selectedType?.documentTypeId && (
            <FormField
              label="Comprovante PDF"
              htmlFor="occurrenceFile"
              hint={`${selectedType.requiresDocument ? "Obrigatório para enviar." : "Opcional."} PDF de até 5 MB, disponível somente ao titular e à equipe autorizada.`}
            >
              <Input
                id="occurrenceFile"
                name="file"
                type="file"
                accept="application/pdf"
                disabled={busy}
              />
            </FormField>
          )}
          {selectedType && (
            <p className="text-sm text-[var(--text-muted)]">
              {selectedType.requiresSupervisor
                ? "Análise da chefia"
                : "Sem etapa de chefia"}
              {selectedType.requiresRH
                ? " · Análise do RH"
                : " · Sem etapa adicional do RH"}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" value="submit" disabled={busy}>
              Enviar ocorrência
            </Button>
            <Button
              type="submit"
              value="draft"
              variant="secondary"
              disabled={busy}
            >
              Salvar rascunho
            </Button>
          </div>
        </form>
      )}
      <nav aria-label="Filas de ocorrências" className="flex flex-wrap gap-2">
        <Button
          variant={scope === "mine" ? "primary" : "secondary"}
          aria-pressed={scope === "mine"}
          disabled={busy}
          onClick={() => changeScope("mine")}
        >
          Minhas ocorrências
        </Button>
        {chief && (
          <Button
            variant={scope === "supervisor" ? "primary" : "secondary"}
            aria-pressed={scope === "supervisor"}
            disabled={busy}
            onClick={() => changeScope("supervisor")}
          >
            Equipe
          </Button>
        )}
        {final && (
          <Button
            variant={scope === "final" ? "primary" : "secondary"}
            aria-pressed={scope === "final"}
            disabled={busy}
            onClick={() => changeScope("final")}
          >
            Análise do RH
          </Button>
        )}
      </nav>
      {loading ? (
        <p role="status">Carregando ocorrências…</p>
      ) : !error && !loadError && items.length === 0 ? (
        <p className="py-6 text-[var(--text-muted)]">
          Nenhuma ocorrência nesta fila.
        </p>
      ) : null}
      {!loading && (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li key={item.id} className="space-y-3 py-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-bold">
                  {item.typeName}
                  {scope !== "mine" ? ` · ${item.requesterName}` : ""}
                </h2>
                <strong className="text-sm">
                  {occurrenceStatuses[item.status]}
                </strong>
              </div>
              <p className="text-sm">
                {date(item.startDate)} a {date(item.endDate)}
                {item.affectsAvailability
                  ? " · Afeta disponibilidade quando aprovada"
                  : ""}
              </p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setParams({ occurrenceId: item.id })}
              >
                Acompanhar ocorrência
              </Button>
              {detail?.id === item.id && (
                <section
                  aria-label="Acompanhamento da ocorrência"
                  className="space-y-4 pt-2"
                >
                  {detail.justification && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {detail.justification}
                    </p>
                  )}
                  {detail.documentId && (
                    <a
                      className="inline-block py-2 text-sm font-semibold text-[var(--brand)] underline underline-offset-4"
                      href={`/api/documents/${detail.documentId}/file`}
                    >
                      Baixar comprovante
                    </a>
                  )}
                  {!detail.justification && (
                    <p className="text-sm text-[var(--text-muted)]">
                      Visão administrativa. Conteúdo privado e comprovantes
                      ficam restritos ao titular e à equipe autorizada.
                    </p>
                  )}
                  {detail.status === "draft" &&
                    detail.requesterAccountId === user?.account.id &&
                    detail.documentTypeId && (
                      <form
                        className="space-y-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = event.currentTarget;
                          const file = new FormData(form).get("file");
                          if (!(file instanceof File) || !file.size) return;
                          setBusy(true);
                          setError("");
                          setSuccess("");
                          void upload(detail, file)
                            .then(() => {
                              form.reset();
                              setSuccess(
                                "Comprovante anexado. Você já pode enviar a ocorrência.",
                              );
                              refresh();
                            })
                            .catch((cause) => setError(message(cause)))
                            .finally(() => setBusy(false));
                        }}
                      >
                        <FormField
                          label="Anexar comprovante PDF"
                          htmlFor="retryOccurrenceFile"
                        >
                          <Input
                            id="retryOccurrenceFile"
                            name="file"
                            type="file"
                            accept="application/pdf"
                            required
                            disabled={busy}
                          />
                        </FormField>
                        <Button type="submit" disabled={busy}>
                          Anexar comprovante
                        </Button>
                      </form>
                    )}
                  {detail.requiresDocument && !detail.documentId && (
                    <p className="text-sm">
                      Anexe o comprovante obrigatório antes de enviar.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {detail.actions.includes("submit") && (
                      <Button
                        disabled={
                          busy ||
                          (detail.requiresDocument && !detail.documentId)
                        }
                        onClick={() => void transition(detail, "submit")}
                      >
                        Enviar ocorrência
                      </Button>
                    )}
                    {detail.actions.includes("approve") && (
                      <Button
                        disabled={busy}
                        onClick={() => void transition(detail, "approve")}
                      >
                        Aprovar
                      </Button>
                    )}
                    {detail.actions.includes("cancel") && (
                      <ConfirmDialog
                        title="Cancelar ocorrência?"
                        description="O cancelamento será registrado e o período deixará de indicar indisponibilidade."
                        confirmLabel="Cancelar ocorrência"
                        onConfirm={() => transition(detail, "cancel")}
                      >
                        <Button variant="quiet" disabled={busy}>
                          Cancelar ocorrência
                        </Button>
                      </ConfirmDialog>
                    )}
                  </div>
                  {detail.actions.includes("reject") && (
                    <details>
                      <summary className="cursor-pointer py-2 text-sm font-semibold">
                        Rejeitar ocorrência
                      </summary>
                      <form
                        className="space-y-3 pt-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void transition(
                            detail,
                            "reject",
                            String(
                              new FormData(event.currentTarget).get("comment"),
                            ),
                          );
                        }}
                      >
                        <FormField
                          label="Motivo da rejeição"
                          htmlFor="occurrenceRejection"
                        >
                          <Textarea
                            id="occurrenceRejection"
                            name="comment"
                            minLength={2}
                            maxLength={2000}
                            required
                            disabled={busy}
                          />
                        </FormField>
                        <Button variant="danger" type="submit" disabled={busy}>
                          Confirmar rejeição
                        </Button>
                      </form>
                    </details>
                  )}
                  <h3 className="font-semibold">Histórico</h3>
                  <ol className="space-y-3">
                    {detail.events.map((event) => (
                      <li key={event.version} className="text-sm">
                        <strong>
                          {eventLabels[event.type] ?? "Atualização registrada"}
                        </strong>
                        <p className="text-[var(--text-muted)]">
                          {event.actorName} ·{" "}
                          {new Date(event.createdAt).toLocaleString("pt-BR", {
                            timeZone: "America/Manaus",
                          })}
                        </p>
                        {event.comment && (
                          <p className="whitespace-pre-wrap break-words">
                            {event.comment}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || hasMore) && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={busy || loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">Página {page}</span>
          <Button
            variant="secondary"
            disabled={busy || loading || !hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
      {user && canGlobally(user, "occurrences.manage_types") && (
        <OccurrenceCatalog
          types={types}
          policies={policies}
          onSaved={(item) =>
            setTypes((current) =>
              [...current.filter((type) => type.id !== item.id), item].sort(
                (a, b) => a.name.localeCompare(b.name),
              ),
            )
          }
        />
      )}
    </div>
  );
}

function OccurrenceCatalog({
  types,
  policies,
  onSaved,
}: {
  types: OccurrenceType[];
  policies: DocumentType[];
  onSaved: (item: OccurrenceType) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = types.find((type) => type.id === selectedId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const item = await api<OccurrenceType>(
        selected
          ? `/api/occurrence-types/${selected.id}`
          : "/api/occurrence-types",
        {
          method: selected ? "PUT" : "POST",
          body: json({
            name: data.get("name"),
            active: data.has("active"),
            requiresSupervisor: data.has("requiresSupervisor"),
            requiresRH: data.has("requiresRH"),
            requiresDocument: data.has("requiresDocument"),
            affectsAvailability: data.has("affectsAvailability"),
            documentTypeId: data.get("documentTypeId") || null,
          }),
        },
      );
      onSaved(item);
      setSelectedId(item.id);
      setSaved(true);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="border-t border-[var(--border)] pt-5">
      <summary className="cursor-pointer py-2 font-semibold">
        Administrar tipos de ocorrência
      </summary>
      <div className="max-w-2xl space-y-4 pt-4">
        <p className="text-sm text-[var(--text-muted)]">
          As regras são preservadas nas ocorrências já registradas. Desativar
          impede novas solicitações.
        </p>
        {error && <Alert title={error} tone="danger" />}
        {saved && <Alert title="Tipo salvo." tone="success" />}
        <FormField
          label="Tipo para administrar"
          htmlFor="managedOccurrenceType"
        >
          <select
            id="managedOccurrenceType"
            className={selectClass}
            value={selectedId}
            disabled={busy}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setSaved(false);
              setError("");
            }}
          >
            <option value="">Novo tipo</option>
            {types.map((type) => (
              <option value={type.id} key={type.id}>
                {type.name}
                {type.active ? "" : " · Inativo"}
              </option>
            ))}
          </select>
        </FormField>
        <form
          key={selectedId}
          onSubmit={(event) => void save(event)}
          className="space-y-4"
        >
          <FormField
            label="Nome do tipo"
            htmlFor="occurrenceTypeName"
            hint="Use um nome administrativo, sem CID ou diagnóstico."
          >
            <Input
              id="occurrenceTypeName"
              name="name"
              defaultValue={selected?.name}
              minLength={2}
              maxLength={120}
              required
              disabled={busy}
            />
          </FormField>
          <fieldset disabled={busy} className="space-y-1">
            <legend className="mb-2 text-sm font-semibold">
              Regras do fluxo
            </legend>
            {(
              [
                ["active", "Tipo ativo", selected?.active ?? true],
                [
                  "requiresSupervisor",
                  "Exigir análise da chefia",
                  selected?.requiresSupervisor ?? true,
                ],
                [
                  "requiresRH",
                  "Exigir análise do RH",
                  selected?.requiresRH ?? true,
                ],
                [
                  "requiresDocument",
                  "Exigir comprovante",
                  selected?.requiresDocument ?? false,
                ],
                [
                  "affectsAvailability",
                  "Afetar disponibilidade quando aprovada",
                  selected?.affectsAvailability ?? true,
                ],
              ] as const
            ).map(([name, label, checked]) => (
              <label
                key={name}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
              >
                <input
                  className="size-4 accent-[var(--brand)]"
                  type="checkbox"
                  name={name}
                  defaultChecked={checked}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <FormField
            label="Política documental"
            htmlFor="occurrencePolicy"
            hint="Documentos de saúde exigem uma política marcada como sensível. Finalidade e retenção são mantidas no documento publicado."
          >
            <select
              id="occurrencePolicy"
              name="documentTypeId"
              className={selectClass}
              defaultValue={selected?.documentTypeId ?? ""}
              disabled={busy}
            >
              <option value="">Sem anexos</option>
              {policies.map((policy) => (
                <option value={policy.id} key={policy.id}>
                  {policy.name}
                  {policy.sensitive ? " · Sensível" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <p className="text-sm text-[var(--text-muted)]">
            As políticas de finalidade e retenção são cadastradas em Documentos
            pela equipe autorizada.
          </p>
          <Button type="submit" disabled={busy}>
            Salvar tipo
          </Button>
        </form>
      </div>
    </details>
  );
}
