// Operação: registrar em um formulário curto; certificado e registro enviados juntos.
// Extensão institucional: acompanhamento progressivo e somente validações no dossiê.
import {
  trainingStatusLabels,
  type Training,
  type TrainingDetail,
  type TrainingSettings,
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
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { api, ApiError, json } from "../lib/api";
import { can, canGlobally } from "../lib/permissions";

const date = (value: string) => value.split("-").reverse().join("/");
const message = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
const eventLabels: Record<string, string> = {
  submitted: "Capacitação enviada",
  validated: "Capacitação validada",
  rejected: "Capacitação rejeitada",
  archived: "Capacitação arquivada",
};

function TrainingFacts({ record }: { record: Training }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-[var(--text-muted)]">
        {record.institution} ·{" "}
        {new Intl.NumberFormat("pt-BR").format(record.hours)} h
      </p>
      <p>
        {date(record.startDate)} a {date(record.endDate)}
      </p>
      {record.certificateId ? (
        <a
          className="inline-block py-2 font-semibold text-[var(--brand)] underline underline-offset-4"
          href={`/api/documents/${record.certificateId}/file`}
        >
          Baixar certificado
        </a>
      ) : record.hasCertificate ? (
        <p className="text-[var(--text-muted)]">
          Certificado restrito ou arquivado. Consulte o RH para verificar o
          acesso.
        </p>
      ) : null}
    </div>
  );
}

export function TrainingPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const trainingId = params.get("trainingId");
  const creates = Boolean(
    user?.employment && can(user, "training.create", user.employment.unit.id),
  );
  const reviews = Boolean(user && can(user, "training.review"));
  const [scope, setScope] = useState(() =>
    reviews && params.get("scope") === "review" ? "review" : "mine",
  );
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Training[]>([]);
  const [detail, setDetail] = useState<TrainingDetail | null>(null);
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    void Promise.all([
      api<{ records: Training[]; hasMore: boolean }>(
        `/api/training?scope=${scope}&page=${page}`,
        { signal: controller.signal },
      ),
      api<TrainingSettings>("/api/training-settings", {
        signal: controller.signal,
      }),
    ])
      .then(([list, configuration]) => {
        if (controller.signal.aborted) return;
        setItems(list.records);
        setHasMore(list.hasMore);
        setSettings(configuration);
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
    setDetailLoading(Boolean(trainingId));
    if (trainingId) {
      setError("");
      void api<TrainingDetail>(
        `/api/training/${encodeURIComponent(trainingId)}`,
        { signal: controller.signal },
      )
        .then((selected) => {
          if (!controller.signal.aborted) setDetail(selected);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(message(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    }
    return () => controller.abort();
  }, [trainingId, scope, page, revision]);
  const visibleItems =
    detail && !items.some((item) => item.id === detail.id)
      ? [detail, ...items]
      : items;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const input = {
      title: fields.get("title"),
      institution: fields.get("institution"),
      startDate: fields.get("startDate"),
      endDate: fields.get("endDate"),
      hours: Number(fields.get("hours")),
    };
    const file = fields.get("certificate");
    if (file instanceof File && file.size > 5 * 1024 * 1024) {
      setError(
        "O certificado deve ser um PDF de até 5 MB. Seus dados foram preservados.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      let body: string | FormData = json(input);
      if (file instanceof File && file.size) {
        body = new FormData();
        body.set("metadata", json(input));
        body.set("file", file);
      }
      const record = await api<Training>("/api/training", {
        method: "POST",
        body,
      });
      form.reset();
      setStartDate("");
      setFormOpen(false);
      setSuccess("Capacitação enviada para validação.");
      setParams({ trainingId: record.id });
      refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function transition(record: Training, action: string, reason?: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/training/${record.id}/transition`, {
        method: "POST",
        body: json({ action, version: record.version, reason }),
      });
      setSuccess("Capacitação atualizada.");
      refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Capacitações
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Registre sua formação e acompanhe a validação pela Gestão de
            Pessoas.
          </p>
        </div>
        {creates && (
          <Button
            disabled={busy || loading}
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? "Fechar formulário" : "Registrar capacitação"}
          </Button>
        )}
      </header>
      {error && (
        <Alert title="Operação não concluída" tone="danger">
          <p>{error}</p>
          {!formOpen && (
            <Button className="mt-2" variant="secondary" onClick={refresh}>
              Tentar novamente
            </Button>
          )}
        </Alert>
      )}
      {success && (
        <Alert title="Operação concluída" tone="success">
          {success}
        </Alert>
      )}
      {formOpen && creates && (
        <form
          onSubmit={create}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <fieldset disabled={busy} className="space-y-4">
            <legend className="mb-4 text-lg font-bold">Nova capacitação</legend>
            <FormField label="Título da capacitação" htmlFor="trainingTitle">
              <Input
                id="trainingTitle"
                name="title"
                required
                minLength={2}
                maxLength={180}
              />
            </FormField>
            <FormField label="Instituição" htmlFor="trainingInstitution">
              <Input
                id="trainingInstitution"
                name="institution"
                required
                minLength={2}
                maxLength={180}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Data inicial" htmlFor="trainingStart">
                <DateInput
                  id="trainingStart"
                  name="startDate"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </FormField>
              <FormField label="Data final" htmlFor="trainingEnd">
                <DateInput
                  id="trainingEnd"
                  name="endDate"
                  required
                  min={startDate}
                />
              </FormField>
              <FormField label="Carga horária (horas)" htmlFor="trainingHours">
                <Input
                  id="trainingHours"
                  name="hours"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max="999999.99"
                />
              </FormField>
            </div>
            <FormField
              label="Certificado PDF"
              htmlFor="trainingCertificate"
              hint={
                settings?.certificateType
                  ? "Opcional. PDF de até 5 MB, com acesso restrito pelas permissões documentais."
                  : "Envio de certificados ainda não configurado pelo RH. Você pode registrar a capacitação sem arquivo."
              }
            >
              <Input
                id="trainingCertificate"
                name="certificate"
                type="file"
                accept="application/pdf"
                disabled={!settings?.certificateType || busy}
              />
            </FormField>
            <Button type="submit">
              {busy ? "Enviando…" : "Enviar capacitação"}
            </Button>
          </fieldset>
        </form>
      )}
      {settings && user && canGlobally(user, "training.review") && (
        <CertificateSettings settings={settings} onSaved={setSettings} />
      )}
      <div className="flex flex-wrap gap-2" aria-label="Visão de capacitações">
        <Button
          aria-pressed={scope === "mine"}
          variant={scope === "mine" ? "primary" : "secondary"}
          disabled={busy}
          onClick={() => {
            setScope("mine");
            setPage(1);
            setParams({});
          }}
        >
          Minhas capacitações
        </Button>
        {reviews && (
          <Button
            aria-pressed={scope === "review"}
            variant={scope === "review" ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => {
              setScope("review");
              setPage(1);
              setParams({});
            }}
          >
            Analisar capacitações
          </Button>
        )}
      </div>
      {loading ? (
        <p role="status">Carregando capacitações…</p>
      ) : (
        <>
          {!visibleItems.length && !error && !detailLoading && (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhuma capacitação nesta consulta.
            </p>
          )}
          <div className="divide-y divide-[var(--border)]">
            {visibleItems.map((record) => (
              <article key={record.id} className="space-y-3 py-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-bold">{record.title}</h2>
                  <span className="text-sm font-semibold">
                    {trainingStatusLabels[record.status]}
                  </span>
                </div>
                {scope === "review" && (
                  <p className="text-sm text-[var(--text-muted)]">
                    {record.requesterName}
                  </p>
                )}
                <TrainingFacts record={record} />
                <Button
                  variant="secondary"
                  disabled={busy}
                  aria-expanded={detail?.id === record.id}
                  aria-controls={
                    detail?.id === record.id
                      ? `training-detail-${record.id}`
                      : undefined
                  }
                  onClick={() =>
                    setParams(
                      trainingId === record.id ? {} : { trainingId: record.id },
                    )
                  }
                >
                  Acompanhar capacitação
                </Button>
                {detailLoading && trainingId === record.id && (
                  <p role="status">Carregando acompanhamento…</p>
                )}
                {detail?.id === record.id && (
                  <section
                    id={`training-detail-${record.id}`}
                    aria-label="Acompanhamento da capacitação"
                    className="space-y-4 pt-2"
                  >
                    <div className="flex flex-wrap gap-2">
                      {detail.actions.includes("validate") && (
                        <Button
                          disabled={busy}
                          onClick={() => void transition(detail, "validate")}
                        >
                          Validar
                        </Button>
                      )}
                      {detail.actions.includes("archive") && (
                        <ConfirmDialog
                          title="Arquivar capacitação?"
                          description="Ela deixará de aparecer entre as capacitações validadas do dossiê. O histórico será preservado."
                          confirmLabel="Arquivar"
                          onConfirm={() => transition(detail, "archive")}
                        >
                          <Button variant="quiet" disabled={busy}>
                            Arquivar
                          </Button>
                        </ConfirmDialog>
                      )}
                    </div>
                    {detail.actions.includes("reject") && (
                      <details>
                        <summary className="cursor-pointer py-2 text-sm font-semibold">
                          Rejeitar capacitação
                        </summary>
                        <form
                          className="mt-3 space-y-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void transition(
                              detail,
                              "reject",
                              String(
                                new FormData(event.currentTarget).get("reason"),
                              ),
                            );
                          }}
                        >
                          <FormField
                            label="Justificativa da rejeição"
                            htmlFor="trainingReason"
                          >
                            <Textarea
                              id="trainingReason"
                              name="reason"
                              required
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
                            Confirmar rejeição
                          </Button>
                        </form>
                      </details>
                    )}
                    <h3 className="font-semibold">Histórico</h3>
                    <ol className="space-y-3 text-sm">
                      {detail.events.map((event) => (
                        <li key={event.version}>
                          <p className="font-semibold">
                            {eventLabels[event.type] ?? event.type}
                          </p>
                          <p className="text-[var(--text-muted)]">
                            {event.actorName} ·{" "}
                            {new Date(event.createdAt).toLocaleString("pt-BR")}
                          </p>
                          {event.reason && (
                            <p className="mt-1 whitespace-pre-wrap break-words">
                              {event.reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </article>
            ))}
          </div>
          {(page > 1 || hasMore) && (
            <nav
              aria-label="Páginas de capacitações"
              className="flex items-center gap-3"
            >
              <Button
                variant="secondary"
                disabled={busy || page === 1}
                onClick={() => {
                  setPage((value) => value - 1);
                  setParams({});
                }}
              >
                Anterior
              </Button>
              <span className="text-sm">Página {page}</span>
              <Button
                variant="secondary"
                disabled={busy || !hasMore}
                onClick={() => {
                  setPage((value) => value + 1);
                  setParams({});
                }}
              >
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function CertificateSettings({
  settings,
  onSaved,
}: {
  settings: TrainingSettings;
  onSaved: (settings: TrainingSettings) => void;
}) {
  const [typeId, setTypeId] = useState(settings.certificateType?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(
    () => setTypeId(settings.certificateType?.id ?? ""),
    [settings.certificateType?.id],
  );
  return (
    <details className="border-y border-[var(--border)] py-3">
      <summary className="cursor-pointer py-2 font-semibold">
        Configurar certificados
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setSuccess("");
          void api("/api/training-settings", {
            method: "PUT",
            body: json({ certificateTypeId: typeId || null }),
          })
            .then(() => {
              onSaved({
                ...settings,
                certificateType:
                  settings.documentTypes.find((type) => type.id === typeId) ??
                  null,
              });
              setSuccess("Configuração salva.");
            })
            .catch((cause) => setError(message(cause)))
            .finally(() => setBusy(false));
        }}
      >
        <FormField
          label="Política documental dos certificados"
          htmlFor="certificatePolicy"
          hint="Define finalidade e retenção dos próximos arquivos. Não altera certificados já enviados."
        >
          <select
            id="certificatePolicy"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            value={typeId}
            disabled={busy}
            onChange={(event) => setTypeId(event.target.value)}
          >
            <option value="">Não receber certificados por enquanto</option>
            {settings.documentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            Salvar configuração
          </Button>
          <Link
            className="py-2 text-sm underline underline-offset-4"
            to="/rh/documentos"
          >
            Gerenciar políticas documentais
          </Link>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm">
            {success}
          </p>
        )}
      </form>
    </details>
  );
}

export function TrainingSection() {
  const [result, setResult] = useState<{
    records: Training[];
    hasMore: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");
    void api<{ records: Training[]; hasMore: boolean }>(
      "/api/training?scope=validated",
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(message(cause));
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <section aria-labelledby="validatedTraining" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="validatedTraining" className="text-lg font-bold">
          Capacitações validadas
        </h2>
        <Link
          className="py-2 text-sm font-semibold underline underline-offset-4"
          to="/rh/capacitacoes"
        >
          Consultar capacitações
        </Link>
      </div>
      {error ? (
        <Alert title="Capacitações indisponíveis" tone="danger">
          <p>{error}</p>
          <Button
            className="mt-2"
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : !result ? (
        <p role="status">Carregando capacitações…</p>
      ) : (
        <>
          {!result.records.length ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhuma capacitação validada até o momento.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {result.records.map((record) => (
                <li key={record.id} className="space-y-2 py-4">
                  <h3 className="font-semibold">{record.title}</h3>
                  <TrainingFacts record={record} />
                </li>
              ))}
            </ul>
          )}
          {result.hasMore && (
            <p className="text-sm text-[var(--text-muted)]">
              Mostrando as 50 mais recentes. Consulte a página de capacitações
              para ver os demais registros.
            </p>
          )}
        </>
      )}
    </section>
  );
}
