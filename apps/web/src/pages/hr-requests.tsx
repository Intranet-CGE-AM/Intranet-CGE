import {
  hrRequestTypes,
  type HrRequest,
  type HrRequestDetail,
  type Dossier,
  type CorrectionSnapshot,
  correctionInputSchema,
} from "@cge/contracts";
import {
  Alert,
  Button,
  ConfirmDialog,
  DateInput,
  FormField,
  Input,
  SearchableSelect,
  Textarea,
} from "@cge/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useSearchParams } from "react-router";
import { api, ApiError, json } from "../lib/api";
import { can, canGlobally } from "../lib/permissions";

const labels = {
  submitted: "Enviada",
  in_analysis: "Em análise",
  completed: "Concluída",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};
const eventLabels: Record<string, string> = {
  submitted: "Solicitação enviada",
  start: "Análise iniciada",
  complete: "Solicitação concluída",
  reject: "Solicitação rejeitada",
  cancel: "Solicitação cancelada",
  request_information: "Complemento solicitado",
  provide_information: "Complemento enviado",
};
const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm";

export function HrRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const { user } = useAuth();
  const manages = Boolean(user && can(user, "hr_requests.manage"));
  const creates = Boolean(
    user?.employment &&
    can(user, "hr_requests.create", user.employment.unit.id),
  );
  const [scope, setScope] = useState<"mine" | "team">(() =>
    manages && searchParams.get("scope") === "team" ? "team" : "mine",
  );
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<HrRequest[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<HrRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requestType, setRequestType] = useState("declaration");
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [dossierError, setDossierError] = useState("");
  const loadDossier = useCallback(async (signal?: AbortSignal) => {
    setDossierError("");
    setDossier(null);
    try {
      const result = await api<Dossier>("/api/me/dossier", { signal });
      if (!signal?.aborted) setDossier(result);
    } catch (cause) {
      if (!signal?.aborted)
        setDossierError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar o cadastro.",
        );
    }
  }, []);
  useEffect(() => {
    if (requestType !== "correction") return;
    const controller = new AbortController();
    void loadDossier(controller.signal);
    return () => controller.abort();
  }, [requestType, loadDossier]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    void api<{ requests: HrRequest[]; hasMore: boolean }>(
      `/api/hr-requests?scope=${scope}&page=${page}${status ? `&status=${status}` : ""}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.requests);
          setHasMore(result.hasMore);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar. Tente novamente.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, page, status, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(Boolean(requestId));
    if (requestId)
      void api<HrRequestDetail>(
        `/api/hr-requests/${encodeURIComponent(requestId)}`,
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) setDetail(result);
        })
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof ApiError
                ? cause.message
                : "Não foi possível abrir a solicitação.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    return () => controller.abort();
  }, [requestId, revision]);
  const visibleItems =
    detail && !items.some((item) => item.id === detail.id)
      ? [detail, ...items]
      : items;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      let correction;
      if (requestType === "correction") {
        if (!dossier?.employment) throw new Error("Cadastro indisponível");
        const proposed: Record<string, unknown> = {};
        for (const field of [
          "fullName",
          "preferredName",
          "birthDate",
        ] as const) {
          const value = String(data.get(field) ?? "").trim() || null;
          if (value !== dossier[field]) proposed[field] = value;
        }
        const employment: Record<string, unknown> = {};
        for (const field of [
          "jobTitle",
          "categoryId",
          "unitId",
          "supervisorRelationshipId",
        ] as const) {
          const value = String(data.get(field) ?? "").trim() || null;
          if (value !== dossier.employment[field]) employment[field] = value;
        }
        if (Object.keys(employment).length) proposed.employment = employment;
        correction = correctionInputSchema.parse(proposed);
      }
      const item = await api<HrRequest>("/api/hr-requests", {
        method: "POST",
        body: json({
          type: data.get("type"),
          description: data.get("description"),
          correction,
        }),
      });
      form.reset();
      setRequestType("declaration");
      setDossier(null);
      setSuccess(`Solicitação enviada. Protocolo ${item.protocol}`);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível enviar. Seu texto foi preservado.",
      );
    } finally {
      setBusy(false);
    }
  }
  function open(id: string) {
    setError("");
    setSearchParams(requestId === id ? {} : { requestId: id });
  }
  async function transition(
    item: HrRequest,
    action: string,
    message?: string,
    deadline?: string,
  ) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/hr-requests/${item.id}/transition`, {
        method: "POST",
        body: json({ version: item.version, action, message, deadline }),
      });
      setRevision((value) => value + 1);
      setSuccess("Solicitação atualizada.");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível atualizar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-5xl space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
          {scope === "mine"
            ? "Minhas solicitações"
            : "Fila da Gestão de Pessoas"}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Abra uma demanda e acompanhe a resposta do RH.
        </p>
      </header>
      {manages ? (
        <div className="flex flex-wrap gap-2" aria-label="Área de atendimento">
          <Button
            disabled={busy}
            variant={scope === "mine" ? "primary" : "secondary"}
            onClick={() => {
              setScope("mine");
              setPage(1);
              setSearchParams({});
            }}
          >
            Minhas solicitações
          </Button>
          <Button
            disabled={busy}
            variant={scope === "team" ? "primary" : "secondary"}
            onClick={() => {
              setScope("team");
              setPage(1);
              setSearchParams({});
            }}
          >
            Fila da Gestão de Pessoas
          </Button>
        </div>
      ) : null}
      {scope === "team" && user && canGlobally(user, "hr_requests.manage") ? (
        <RequestSettings />
      ) : null}
      {error ? (
        <Alert title="A operação não foi concluída" tone="danger">
          {error}
          <Button
            variant="quiet"
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar
          </Button>
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Operação concluída" tone="success">
          {success}
        </Alert>
      ) : null}
      {scope === "mine" && creates ? (
        <form
          className="max-w-2xl space-y-4 border-b border-[var(--border)] pb-6"
          onSubmit={create}
        >
          <FormField htmlFor="requestType" label="Tipo de solicitação">
            <select
              className={selectClass}
              id="requestType"
              name="type"
              value={requestType}
              onChange={(event) => setRequestType(event.target.value)}
            >
              {Object.entries(hrRequestTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          {requestType === "correction" ? (
            dossier?.employment ? (
              <CorrectionFields dossier={dossier} />
            ) : dossierError ? (
              <Alert title="Cadastro indisponível" tone="danger">
                {dossierError}
                <Button variant="quiet" onClick={() => void loadDossier()}>
                  Tentar carregar cadastro
                </Button>
              </Alert>
            ) : (
              <p role="status">Carregando cadastro…</p>
            )
          ) : null}
          <FormField
            htmlFor="requestDescription"
            label="Como podemos ajudar?"
            hint="De 10 a 2.000 caracteres. Não inclua informações médicas ou outros dados sensíveis."
          >
            <Textarea
              id="requestDescription"
              name="description"
              minLength={10}
              maxLength={2000}
              required
            />
          </FormField>
          <Button
            type="submit"
            disabled={
              busy || (requestType === "correction" && !dossier?.employment)
            }
          >
            {busy ? "Enviando…" : "Enviar solicitação"}
          </Button>
        </form>
      ) : null}
      <FormField htmlFor="requestStatus" label="Filtrar por situação">
        <select
          id="requestStatus"
          className={selectClass}
          value={status}
          disabled={busy}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
            setSearchParams({});
          }}
        >
          <option value="">Todas as situações</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      {detailLoading && <p role="status">Carregando acompanhamento…</p>}
      {loading ? (
        <p role="status">Carregando solicitações…</p>
      ) : !visibleItems.length ? (
        <p>Nenhuma solicitação nesta consulta.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {visibleItems.map((item) => (
            <li key={item.id} className="space-y-3 py-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-bold">
                  {hrRequestTypes[item.type]}
                  {scope === "team" ? ` · ${item.requesterName}` : ""}
                </h2>
                <span className="text-sm font-semibold">
                  {labels[item.status]}
                </span>
              </div>
              <p className="break-words text-xs text-[var(--text-muted)]">
                {item.protocol}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Previsão de retorno:{" "}
                {new Date(item.dueAt).toLocaleDateString("pt-BR", {
                  timeZone: "America/Manaus",
                })}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {item.description}
              </p>
              {item.correction ? (
                <CorrectionComparison
                  correction={item.correction}
                  requestId={item.id}
                />
              ) : null}
              {item.informationMessage ? (
                <Alert title="Informações necessárias" tone="warning">
                  {item.informationMessage}
                  <p>
                    Envie até{" "}
                    {item.informationDeadline?.split("-").reverse().join("/")}.
                  </p>
                </Alert>
              ) : null}
              {item.response ? (
                <p className="whitespace-pre-wrap break-words text-sm">
                  <strong>Resposta do RH: </strong>
                  {item.response}
                </p>
              ) : null}
              {scope === "team" &&
              !["completed", "rejected", "cancelled"].includes(item.status) ? (
                <p className="text-sm">
                  {item.assigneeAccountId
                    ? "Com responsável"
                    : "Sem responsável"}
                  {new Date(item.dueAt) < new Date()
                    ? " · Fora da previsão"
                    : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  aria-expanded={requestId === item.id}
                  aria-controls={`request-history-${item.id}`}
                  onClick={() => void open(item.id)}
                >
                  Acompanhar solicitação
                </Button>
                {item.requesterAccountId === user?.account.id &&
                item.status === "submitted" ? (
                  <ConfirmDialog
                    title="Cancelar solicitação?"
                    description="O cancelamento será registrado no histórico."
                    confirmLabel="Cancelar solicitação"
                    onConfirm={() => transition(item, "cancel")}
                  >
                    <Button variant="quiet" disabled={busy}>
                      Cancelar
                    </Button>
                  </ConfirmDialog>
                ) : null}
                {scope === "team" && item.status === "submitted" ? (
                  <Button
                    disabled={busy}
                    onClick={() => void transition(item, "start")}
                  >
                    Assumir análise
                  </Button>
                ) : null}
              </div>
              {detail?.id === item.id ? (
                <section
                  id={`request-history-${item.id}`}
                  aria-label="Histórico da solicitação"
                  className="space-y-4 pt-3"
                >
                  <h3 className="font-semibold">Histórico</h3>
                  {detail.requesterAccountId === user?.account.id &&
                  detail.informationDeadline ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void transition(
                          detail,
                          "provide_information",
                          String(
                            new FormData(event.currentTarget).get(
                              "information",
                            ),
                          ),
                        );
                      }}
                    >
                      <FormField
                        htmlFor="requestInformation"
                        label="Informações complementares"
                      >
                        <Textarea
                          name="information"
                          id="requestInformation"
                          minLength={2}
                          maxLength={2000}
                          required
                        />
                      </FormField>
                      <Button type="submit" disabled={busy}>
                        Enviar complemento
                      </Button>
                    </form>
                  ) : null}
                  <ol className="space-y-3">
                    {detail.events.map((event) => (
                      <li key={event.id} className="text-sm">
                        <strong>{eventLabels[event.type] ?? event.type}</strong>{" "}
                        · {event.actorName} ·{" "}
                        {new Date(event.createdAt).toLocaleString("pt-BR", {
                          timeZone: "America/Manaus",
                        })}
                        {event.message ? (
                          <p className="whitespace-pre-wrap break-words">
                            {event.message}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {scope === "team" && detail.status === "in_analysis" ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        const submitter = (event.nativeEvent as SubmitEvent)
                          .submitter as HTMLButtonElement;
                        void transition(
                          detail,
                          submitter.value,
                          String(data.get("response")),
                          String(data.get("deadline") || "") || undefined,
                        );
                      }}
                    >
                      <FormField
                        htmlFor="requestResponse"
                        label="Resposta ao servidor"
                      >
                        <Textarea
                          id="requestResponse"
                          name="response"
                          required
                          minLength={2}
                          maxLength={2000}
                        />
                      </FormField>
                      <FormField
                        htmlFor="informationDeadline"
                        label="Prazo para complemento (somente ao solicitar informações)"
                      >
                        <DateInput
                          className={selectClass}
                          id="informationDeadline"
                          name="deadline"
                        />
                      </FormField>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" value="complete" disabled={busy}>
                          Concluir solicitação
                        </Button>
                        <Button
                          type="submit"
                          value="reject"
                          variant="secondary"
                          disabled={busy}
                        >
                          Rejeitar com justificativa
                        </Button>
                        <Button
                          type="submit"
                          value="request_information"
                          variant="secondary"
                          disabled={busy}
                        >
                          Solicitar complemento
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </section>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {page > 1 || hasMore ? (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={busy || page === 1 || loading}
            onClick={() => {
              setPage(page - 1);
              setSearchParams({});
            }}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            variant="secondary"
            disabled={busy || !hasMore || loading}
            onClick={() => {
              setPage(page + 1);
              setSearchParams({});
            }}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const correctionLabels: Record<string, string> = {
  fullName: "Nome",
  preferredName: "Nome preferido",
  birthDate: "Nascimento",
  jobTitle: "Cargo",
  unitId: "Unidade",
  categoryId: "Categoria",
  supervisorRelationshipId: "Chefia",
};

function CorrectionComparison({
  correction,
  requestId,
}: {
  correction: CorrectionSnapshot;
  requestId: string;
}) {
  const previous = {
    ...correction.previous,
    ...correction.previous.employment,
  };
  const proposed = {
    ...correction.proposed,
    ...correction.proposed.employment,
  };
  const format = (field: string, value: unknown) =>
    !value
      ? "Não informado"
      : field === "birthDate"
        ? String(value).split("-").reverse().join("/")
        : String(value);
  return (
    <section
      className="space-y-2 text-sm"
      aria-label={`Comparação cadastral da solicitação ${requestId}`}
    >
      <h3 className="font-semibold">Alterações propostas</h3>
      <dl className="space-y-2">
        {Object.entries(proposed)
          .filter(([field]) => field !== "employment")
          .map(([field, value]) => (
            <div key={field}>
              <dt className="font-semibold">{correctionLabels[field]}</dt>
              <dd className="break-words">
                <span className="text-[var(--text-muted)]">
                  Atual:{" "}
                  {correction.display[field]?.previous ??
                    format(field, previous[field as keyof typeof previous])}
                </span>
                <br />
                Proposto:{" "}
                <span>
                  {correction.display[field]?.proposed ?? format(field, value)}
                </span>
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

function CorrectionFields({ dossier }: { dossier: Dossier }) {
  const employment = dossier.employment!;
  const [unitId, setUnitId] = useState(employment.unitId);
  const [selectedSupervisor, setSelectedSupervisor] = useState({
    id: employment.supervisorRelationshipId ?? "",
    name: dossier.supervisorName ?? "Chefia atual",
  });
  const supervisorId = selectedSupervisor.id;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{
    units: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    supervisors: { id: string; name: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setError("");
      void api<NonNullable<typeof options>>(
        `/api/employment-options?purpose=correction&unitId=${unitId}&query=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then(setOptions)
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof ApiError
                ? cause.message
                : "Não foi possível carregar as opções.",
            );
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [unitId, query, retry]);
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 font-semibold">Dados propostos</legend>
      <p className="text-sm text-[var(--text-muted)]">
        Altere somente o que precisa de correção. O cadastro só muda após
        aprovação do RH.
      </p>
      <FormField htmlFor="correctionFullName" label="Nome completo proposto">
        <Input
          id="correctionFullName"
          name="fullName"
          defaultValue={dossier.fullName}
          required
          minLength={2}
          maxLength={180}
        />
      </FormField>
      <FormField
        htmlFor="correctionPreferredName"
        label="Nome preferido proposto"
      >
        <Input
          id="correctionPreferredName"
          name="preferredName"
          defaultValue={dossier.preferredName ?? ""}
          maxLength={120}
        />
      </FormField>
      <FormField htmlFor="correctionBirthDate" label="Nascimento proposto">
        <DateInput
          id="correctionBirthDate"
          name="birthDate"
          defaultValue={dossier.birthDate ?? ""}
        />
      </FormField>
      <details>
        <summary className="cursor-pointer py-2 font-semibold">
          Corrigir dados do vínculo
        </summary>
        <div className="space-y-4 pt-3">
          <FormField htmlFor="correctionJob" label="Cargo proposto">
            <Input
              id="correctionJob"
              name="jobTitle"
              defaultValue={employment.jobTitle ?? ""}
              maxLength={160}
            />
          </FormField>
          {error ? (
            <Alert title="Opções indisponíveis" tone="danger">
              {error}
              <Button variant="quiet" onClick={() => setRetry(retry + 1)}>
                Tentar carregar opções
              </Button>
            </Alert>
          ) : null}
          <FormField htmlFor="correctionCategory" label="Categoria proposta">
            <select
              id="correctionCategory"
              name="categoryId"
              className={selectClass}
              defaultValue={employment.categoryId}
            >
              {!options?.categories.some(
                (item) => item.id === employment.categoryId,
              ) ? (
                <option value={employment.categoryId}>
                  {employment.categoryName}
                </option>
              ) : null}
              {options?.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="correctionUnit" label="Unidade proposta">
            <select
              id="correctionUnit"
              name="unitId"
              className={selectClass}
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value);
                setQuery("");
              }}
            >
              {!options?.units.some((item) => item.id === employment.unitId) ? (
                <option value={employment.unitId}>{employment.unitName}</option>
              ) : null}
              {options?.units.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="correctionSupervisor" label="Chefia proposta">
            <SearchableSelect
              id="correctionSupervisor"
              name="supervisorChoice"
              value={supervisorId || "none"}
              onValueChange={(value) =>
                setSelectedSupervisor({
                  id: value === "none" ? "" : value,
                  name:
                    options?.supervisors.find((item) => item.id === value)
                      ?.name ?? selectedSupervisor.name,
                })
              }
              onSearchChange={setQuery}
              options={[
                { value: "none", label: "Sem chefia" },
                ...(supervisorId &&
                !options?.supervisors.some((item) => item.id === supervisorId)
                  ? [
                      {
                        value: supervisorId,
                        label: selectedSupervisor.name,
                      },
                    ]
                  : []),
                ...(options?.supervisors ?? [])
                  .filter((item) => item.id !== employment.id)
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </FormField>
          <input
            type="hidden"
            name="supervisorRelationshipId"
            value={supervisorId}
          />
        </div>
      </details>
    </fieldset>
  );
}

function RequestSettings() {
  const [settings, setSettings] = useState<
    Array<{ type: keyof typeof hrRequestTypes; days: number }>
  >([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ settings: typeof settings }>("/api/hr-request-settings")
      .then((result) => setSettings(result.settings))
      .catch(() =>
        setError(
          "Não foi possível carregar as previsões. Reabra a fila para tentar novamente.",
        ),
      );
  }, []);
  return (
    <details className="border-b border-[var(--border)] pb-4">
      <summary className="cursor-pointer py-2 font-semibold">
        Configurar previsões de retorno
      </summary>
      <p className="my-3 text-sm text-[var(--text-muted)]">
        Estimativas internas em dias corridos, não prazos legais. Alterações
        valem somente para novas solicitações. Padrão inicial: 5 dias.
      </p>
      {error ? (
        <Alert title="Não foi possível salvar" tone="danger">
          {error}
        </Alert>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <div className="space-y-4">
        {settings.map((setting) => (
          <form
            key={setting.type}
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const days = Number(
                new FormData(event.currentTarget).get("days"),
              );
              setBusy(true);
              setError("");
              setMessage("");
              try {
                await api(`/api/hr-request-settings/${setting.type}`, {
                  method: "PUT",
                  body: json({ days }),
                });
                setMessage("Previsão atualizada.");
              } catch (cause) {
                setError(
                  cause instanceof ApiError
                    ? cause.message
                    : "Tente novamente.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormField
              htmlFor={`days-${setting.type}`}
              label={hrRequestTypes[setting.type]}
            >
              <input
                className={selectClass}
                id={`days-${setting.type}`}
                type="number"
                name="days"
                defaultValue={setting.days}
                min={1}
                max={365}
                required
              />
            </FormField>
            <Button disabled={busy} type="submit" variant="secondary">
              Salvar {hrRequestTypes[setting.type].toLowerCase()}
            </Button>
          </form>
        ))}
      </div>
    </details>
  );
}
