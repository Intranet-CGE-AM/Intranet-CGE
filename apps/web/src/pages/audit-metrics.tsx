import {
  auditDocumentMetricsQuerySchema,
  type AuditDocumentList,
  type AuditDocumentMetrics,
  type AuditDocumentSettings,
  type AuditDocumentSummary,
} from "@cge/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DateRangePicker,
  EmptyState,
  FormField,
  Input,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";
import { FilePdf } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "../auth";
import { FieldSelect } from "../components/field-select";
import { PageHeader } from "../components/page-header";
import { api, json } from "../lib/api";
import { manausToday } from "../lib/dates";
import { can } from "../lib/permissions";
import {
  ageInDays,
  brDate,
  createAuditReport,
  deliveryByTeam,
  formatHours,
  formatRate,
  manausDay,
  type AuditReportKind,
} from "../lib/audit-reports";
import { AUDIT_EYEBROW, errorMessage } from "./audit-documents";

const METRIC_LABEL =
  "text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]";

async function fetchDocuments(unitId: string) {
  const documents: AuditDocumentSummary[] = [];
  // ponytail: pages through the whole list client-side; a report endpoint
  // would replace this once teams hold thousands of documents.
  for (let page = 1; page <= 200; page += 1) {
    const search = new URLSearchParams({ page: String(page) });
    if (unitId) search.set("unitId", unitId);
    const result = await api<AuditDocumentList>(
      `/api/audit-documents?${search}`,
    );
    documents.push(...result.documents);
    if (page * result.pageSize >= result.total) break;
  }
  return documents;
}

export function AuditMetricsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = manausToday();
  const from = params.get("de") ?? `${today.slice(0, 7)}-01`;
  const to = params.get("ate") ?? today;
  const unitId = params.get("equipe") ?? "";
  const [range, setRange] = useState({ from, to });
  const [metrics, setMetrics] = useState<AuditDocumentMetrics | null>(null);
  const [documents, setDocuments] = useState<AuditDocumentSummary[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState<AuditReportKind | null>(null);
  const canReview = Boolean(user && can(user, "audit_documents.review"));
  const canRead = Boolean(user && can(user, "audit_documents.read"));

  useEffect(() => {
    let active = true;
    setMetrics(null);
    setDocuments(null);
    setError("");
    const search = new URLSearchParams({ from, to });
    if (unitId) search.set("unitId", unitId);
    api<AuditDocumentMetrics>(`/api/audit-documents/metrics?${search}`)
      .then((result) => active && setMetrics(result))
      .catch(
        (cause: unknown) =>
          active &&
          setError(
            errorMessage(cause, "Não foi possível consultar os indicadores."),
          ),
      );
    if (canRead)
      fetchDocuments(unitId)
        .then((result) => active && setDocuments(result))
        .catch(() => active && setDocuments([]));
    return () => {
      active = false;
    };
  }, [from, to, unitId, revision, canRead]);

  function apply(event: FormEvent) {
    event.preventDefault();
    if (!auditDocumentMetricsQuerySchema.safeParse(range).success) {
      setError("Informe um período válido de até 366 dias.");
      return;
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("de", range.from);
        next.set("ate", range.to);
        return next;
      },
      { replace: true },
    );
  }

  const unitName = unitId
    ? (metrics?.units.find((unit) => unit.id === unitId)?.name ?? "")
    : "Todas as equipes";
  const delivery = documents ? deliveryByTeam(documents, from, to) : [];

  async function exportPdf(kind: AuditReportKind) {
    if (!metrics) return;
    setExporting(kind);
    try {
      createAuditReport(kind, {
        metrics,
        documents: (documents ?? []).filter((document) => {
          const created = manausDay(document.createdAt);
          return created >= from && created <= to;
        }),
        delivery,
        filters: { from, to, unitName },
      });
    } catch (cause) {
      setError(errorMessage(cause, "Não foi possível gerar o PDF."));
    } finally {
      setExporting(null);
    }
  }

  const empty =
    metrics &&
    !metrics.pending.length &&
    !metrics.period.submitted &&
    !metrics.reads.files;

  return (
    <div className="page-enter space-y-4">
      <PageHeader
        actions={
          <>
            {(
              [
                ["draft", "Resumo em rascunho"],
                ["detailed", "Relatório detalhado"],
                ["analytic", "Relatório analítico"],
              ] as const
            ).map(([kind, label]) => (
              <Button
                disabled={!metrics || exporting !== null}
                key={kind}
                onClick={() => void exportPdf(kind)}
                size="sm"
                variant="secondary"
              >
                <FilePdf aria-hidden="true" size={16} />
                {exporting === kind ? "Gerando…" : label}
              </Button>
            ))}
          </>
        }
        description="Pendências, prazos de resposta e rodadas de correção das equipes de auditoria."
        eyebrow={AUDIT_EYEBROW}
        title="Indicadores de auditoria"
      />

      <Card>
        <CardContent>
          <form
            className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
            onSubmit={apply}
          >
            <FormField htmlFor="metricsRange" label="Período">
              <DateRangePicker
                id="metricsRange"
                onChange={setRange}
                required
                value={range}
              />
            </FormField>
            <FormField htmlFor="metricsUnit" label="Equipe">
              <FieldSelect
                emptyLabel="Todas as equipes"
                id="metricsUnit"
                name="metricsUnit"
                onValueChange={(value) =>
                  setParams(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      if (value) next.set("equipe", value);
                      else next.delete("equipe");
                      return next;
                    },
                    { replace: true },
                  )
                }
                options={(metrics?.units ?? []).map((unit) => ({
                  label: unit.name,
                  value: unit.id,
                }))}
                value={unitId}
              />
            </FormField>
            <Button type="submit" variant="secondary">
              Consultar
            </Button>
          </form>
          <p className="mt-3 text-xs text-[var(--text-faint)]">
            Até 366 dias por consulta, no fuso de Manaus. Pendências mostram a
            situação de hoje; os demais indicadores usam o período.
          </p>
        </CardContent>
      </Card>

      {error ? (
        <Alert title="Consulta não realizada" tone="danger">
          <p>{error}</p>
          <Button
            className="mt-3"
            onClick={() => setRevision((value) => value + 1)}
            size="sm"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      {!metrics && !error ? (
        <div
          aria-label="Consultando indicadores"
          className="space-y-4"
          role="status"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton className="h-28" key={item} />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {metrics && empty ? (
        <Card>
          <EmptyState
            description="Nenhum documento enviado ou pendente no período e na equipe escolhidos."
            title="Sem dados para os filtros"
          />
        </Card>
      ) : null}

      {metrics && !empty ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              detail={`${metrics.period.approved} aprovados · ${metrics.period.cancelled} cancelados`}
              label="Enviados no período"
              value={String(metrics.period.submitted)}
            />
            <Metric
              detail="Enviados no período que já estão aprovados"
              label="Taxa de entrega"
              value={formatRate(metrics.period.deliveryRate)}
            />
            <Metric
              detail={`Mediana ${formatHours(metrics.reviewerResponse.medianHours)} · ${metrics.reviewerResponse.count} análises`}
              label="Resposta da Subcontroladoria"
              value={formatHours(metrics.reviewerResponse.averageHours)}
            />
            <Metric
              detail={`Mediana ${formatHours(metrics.teamResponse.medianHours)} · ${metrics.teamResponse.count} correções`}
              label="Resposta das equipes"
              value={formatHours(metrics.teamResponse.averageHours)}
            />
          </div>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Pendências por equipe</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Situação de hoje: quem está com o documento e há quanto tempo.
                </p>
              </div>
            </CardHeader>
            {metrics.pending.length ? (
              <Table aria-label="Pendências por equipe">
                <thead>
                  <tr>
                    {[
                      "Equipe",
                      "Com a Subcontroladoria",
                      "Mais antigo",
                      "Com a equipe",
                      "Mais antigo",
                    ].map((header, index) => (
                      <TableHead className="whitespace-nowrap" key={index}>
                        {header}
                      </TableHead>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.pending.map((row) => (
                    <TableRow key={row.unitId}>
                      <TableCell className="whitespace-nowrap font-semibold">
                        {row.unitName}
                      </TableCell>
                      <TableCell>{row.withReviewer}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {ageInDays(row.oldestWithReviewerSince)}
                      </TableCell>
                      <TableCell>{row.withTeam}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {ageInDays(row.oldestWithTeamSince)}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                description="Nenhum documento aguardando análise ou correção."
                title="Sem pendências"
              />
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <div>
                  <h2 className="font-bold">Entrega por equipe</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Documentos enviados no período e quantos já foram aprovados.
                  </p>
                </div>
              </CardHeader>
              {documents === null && canRead ? (
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              ) : delivery.length ? (
                <CardContent className="space-y-4">
                  {delivery.map((team) => (
                    <Bar
                      detail={`${team.approved} de ${team.submitted} aprovados`}
                      key={team.unitName}
                      label={team.unitName}
                      share={team.approved / team.submitted}
                    />
                  ))}
                </CardContent>
              ) : (
                <EmptyState
                  description="Nenhum documento enviado no período."
                  title="Sem entregas"
                />
              )}
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <div>
                  <h2 className="font-bold">Confirmação de leitura</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Versões enviadas no período e abertas pela Subcontroladoria.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Bar
                  detail={`${metrics.reads.readByReviewer} de ${metrics.reads.files} versões lidas`}
                  label="Versões lidas"
                  share={metrics.reads.rate ?? 0}
                />
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-[var(--text-muted)]">
                      Tempo médio até a primeira leitura
                    </dt>
                    <dd className="mt-1 text-lg font-bold tabular-nums">
                      {formatHours(metrics.firstRead.averageHours)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Mediana</dt>
                    <dd className="mt-1 text-lg font-bold tabular-nums">
                      {formatHours(metrics.firstRead.medianHours)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <h2 className="font-bold">Rodadas de correção</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Documentos enviados no período com mais devoluções. Gargalo a
                  partir de {metrics.bottleneckRounds}{" "}
                  {metrics.bottleneckRounds === 1 ? "rodada" : "rodadas"}.
                </p>
              </div>
            </CardHeader>
            {metrics.correctionRounds.distribution.length ? (
              <CardContent className="border-b border-[var(--border)]">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {metrics.correctionRounds.distribution.map((row) => (
                    <p key={row.rounds}>
                      <span className="text-[var(--text-muted)]">
                        {row.rounds === 0
                          ? "Sem correção"
                          : row.rounds === 1
                            ? "1 rodada"
                            : `${row.rounds} rodadas`}
                        :
                      </span>{" "}
                      <strong className="tabular-nums">{row.documents}</strong>
                    </p>
                  ))}
                </div>
              </CardContent>
            ) : null}
            {metrics.correctionRounds.top.length ? (
              <Table aria-label="Documentos com mais rodadas de correção">
                <thead>
                  <tr>
                    {["Documento", "Equipe", "Rodadas"].map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.correctionRounds.top.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-48">
                        <Link
                          className="font-semibold hover:text-[var(--brand)] hover:underline"
                          to={`/controle-interno/documentos/${row.id}`}
                        >
                          {row.title}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.unitName}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {row.rounds}
                          {row.bottleneck ? (
                            <Badge variant="danger">Gargalo</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                description="Nenhum documento enviado no período precisou de correção."
                title="Nenhuma devolução"
              />
            )}
          </Card>

          <p className="text-xs text-[var(--text-faint)]">
            Consulta de {brDate(from)} a {brDate(to)} · {unitName}
          </p>
        </>
      ) : null}

      {canReview ? (
        <BottleneckSettings onSaved={() => setRevision((value) => value + 1)} />
      ) : null}
    </div>
  );
}

function Metric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className={METRIC_LABEL}>{label}</p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function Bar({
  detail,
  label,
  share,
}: {
  detail: string;
  label: string;
  share: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-xs font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--text-muted)]">
          {detail} ({formatRate(share)})
        </span>
      </div>
      <div
        aria-hidden="true"
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
      >
        <div
          className="h-full bg-[var(--brand)]"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

function BottleneckSettings({ onSaved }: { onSaved: () => void }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    api<AuditDocumentSettings>("/api/audit-documents/settings")
      .then((settings) => setValue(String(settings.bottleneckRounds)))
      .catch(() => setValue(""));
  }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/audit-documents/settings", {
        body: json({ bottleneckRounds: Number(value) }),
        method: "PUT",
      });
      setMessage({ tone: "success", text: "Limite de gargalo atualizado." });
      onSaved();
    } catch (cause) {
      setMessage({
        tone: "danger",
        text: errorMessage(cause, "Não foi possível salvar o limite."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="font-bold">Limite de gargalo</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Documentos com esse número de rodadas de correção, ou mais, são
            marcados como gargalo.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => void save(event)}
        >
          <FormField
            className="w-44"
            htmlFor="bottleneckRounds"
            label="Rodadas de correção"
          >
            <Input
              id="bottleneckRounds"
              max={20}
              min={1}
              onChange={(event) => setValue(event.target.value)}
              required
              type="number"
              value={value}
            />
          </FormField>
          <Button disabled={busy} type="submit">
            {busy ? "Salvando…" : "Salvar limite"}
          </Button>
        </form>
        {message ? (
          <Alert className="mt-4" title={message.text} tone={message.tone} />
        ) : null}
      </CardContent>
    </Card>
  );
}
