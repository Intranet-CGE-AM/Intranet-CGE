import type {
  VisitLocation,
  VisitPageResult,
  VisitStatus,
  VisitSummary,
  VisitType,
} from "@cge/contracts";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  DateRangePicker,
  EmptyState,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@cge/ui";

import {
  ChartBar,
  DownloadSimple,
  FilePdf,
  FunnelSimple,
} from "@phosphor-icons/react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  utils,
  writeFileXLSX,
} from "xlsx";

import {
  jsPDF,
} from "jspdf";

import {
  autoTable,
} from "jspdf-autotable";

import {
  api,
  ApiError,
} from "../lib/api";

import {
  visitLocationOptions,
  visitStatusLabels,
  visitTypeLabels,
} from "../lib/visit-labels";

/* =========================================================
 * TIPOS
 * ======================================================= */

type ReportKind =
  | "general"
  | "type"
  | "status"
  | "location"
  | "organization";

type DateRangeValue = {
  from: string;
  to: string;
};

type ReportFilters = {
  dateRange: DateRangeValue;

  type:
    | VisitType
    | "";

  location:
    | VisitLocation
    | "";

  status:
    | VisitStatus
    | "";

  subject: string;

  organization: string;
};

type GroupedRow = {
  label: string;
  total: number;
  percentage: number;
};

/* =========================================================
 * ESTADO INICIAL
 * ======================================================= */

const initialFilters: ReportFilters = {
  dateRange: {
    from: "",
    to: "",
  },

  type: "",

  location: "",

  status: "",

  subject: "",

  organization: "",
};

/* =========================================================
 * PÁGINA
 * ======================================================= */

export function VisitReportsPage() {
  const [
    reportKind,
    setReportKind,
  ] = useState<ReportKind>("general");

  const [
    filters,
    setFilters,
  ] = useState<ReportFilters>(
    initialFilters,
  );

  const [
    appliedFilters,
    setAppliedFilters,
  ] = useState<ReportFilters>({
    ...initialFilters,
    dateRange: {
      ...initialFilters.dateRange,
    },
  });

  const [
    reportIssued,
    setReportIssued,
  ] = useState(false);

  const [
    visits,
    setVisits,
  ] = useState<VisitSummary[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    exportingXlsx,
    setExportingXlsx,
  ] = useState(false);

  const [
    exportingPdf,
    setExportingPdf,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
   * CARREGAR RELATÓRIO
   * ===================================================== */

  const loadReport =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const result =
          await fetchAllVisits(
            appliedFilters,
          );

        setVisits(result);
      } catch (cause) {
        setError(
          getErrorMessage(
            cause,
            "Não foi possível carregar o relatório.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [appliedFilters]);

  useEffect(() => {
    if (!reportIssued) {
      setLoading(false);
      return;
    }

    void loadReport();
  }, [loadReport, reportIssued]);

  /* =======================================================
   * AGRUPAMENTOS
   * ===================================================== */

  const groupedByType =
    useMemo(
      () =>
        aggregateVisits(
          visits,
          (visit) =>
            visitTypeLabels[
              visit.type
            ],
        ),
      [visits],
    );

  const groupedByStatus =
    useMemo(
      () =>
        aggregateVisits(
          visits,
          (visit) =>
            visitStatusLabels[
              visit.status
            ],
        ),
      [visits],
    );

  const groupedByLocation =
    useMemo(
      () =>
        aggregateVisits(
          visits,
          (visit) =>
            visitLocationOptions.find(
              (option) =>
                option.value ===
                visit.location,
            )?.label ??
            visit.location,
        ),
      [visits],
    );

  const groupedByOrganization =
    useMemo(
      () =>
        aggregateVisits(
          visits,
          (visit) =>
            visit.organization ||
            "Não informado",
        ),
      [visits],
    );

  /* =======================================================
   * FILTROS
   * ===================================================== */

  function updateFilter<
    K extends keyof ReportFilters,
  >(
    key: K,
    value: ReportFilters[K],
  ) {
    setFilters(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function clearFilters() {
    const cleared: ReportFilters = {
      ...initialFilters,
      dateRange: {
        from: "",
        to: "",
      },
    };

    setFilters(cleared);
    setAppliedFilters(cleared);
    setVisits([]);
    setReportIssued(false);
    setError("");
  }

  function emitReport() {
    if (
      filters.dateRange.from &&
      filters.dateRange.to &&
      filters.dateRange.from >
        filters.dateRange.to
    ) {
      setError(
        "A data inicial não pode ser posterior à data final.",
      );
      return;
    }

    setError("");
    setAppliedFilters({
      ...filters,
      dateRange: {
        ...filters.dateRange,
      },
    });
    setReportIssued(true);
  }

  /* =======================================================
   * XLSX
   * ===================================================== */

  function exportXlsx() {
    if (
      visits.length === 0
    ) {
      setError(
        "Não existem registros para exportação.",
      );
      return;
    }

    try {
      setExportingXlsx(true);
      setError("");

      if (reportKind === "general") {
        createGeneralXlsx(
          visits,
          appliedFilters,
        );
        return;
      }

      const grouped =
        getGroupedReportData(
          reportKind,
          {
            type: groupedByType,
            status: groupedByStatus,
            location: groupedByLocation,
            organization: groupedByOrganization,
          },
        );

      createGroupedXlsx(
        grouped.rows,
        appliedFilters,
        grouped.title,
      );
    } catch {
      setError(
        "Não foi possível gerar o relatório XLSX.",
      );
    } finally {
      setExportingXlsx(false);
    }
  }

  /* =======================================================
   * PDF
   * ===================================================== */

  function exportPdf() {
    if (
      visits.length === 0
    ) {
      setError(
        "Não existem registros para exportação.",
      );
      return;
    }

    try {
      setExportingPdf(true);
      setError("");

      if (reportKind === "general") {
        createGeneralPdf(
          visits,
          appliedFilters,
        );
        return;
      }

      const grouped =
        getGroupedReportData(
          reportKind,
          {
            type: groupedByType,
            status: groupedByStatus,
            location: groupedByLocation,
            organization: groupedByOrganization,
          },
        );

      createGroupedPdf(
        grouped.rows,
        appliedFilters,
        grouped.title,
      );
    } catch {
      setError(
        "Não foi possível gerar o relatório PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  /* =======================================================
   * RENDER
   * ===================================================== */

  return (
    <div className="page-enter space-y-5 pb-6">
      {/* CABEÇALHO */}

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Agendamento de Visitas
        </p>

        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] md:text-[30px]">
          Relatórios
        </h1>

        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Consulte indicadores dos
          agendamentos e exporte os
          resultados em Excel ou PDF.
        </p>
      </div>

      {error ? (
        <Alert
          title="Não foi possível concluir a operação"
          tone="danger"
        >
          {error}
        </Alert>
      ) : null}

      {/* TIPOS DE RELATÓRIO */}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">
              Tipo de relatório
            </h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Selecione uma forma de
              visualização dos agendamentos.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ReportOption
              active={
                reportKind ===
                "general"
              }
              title="Relatório Geral"
              description="Relação detalhada dos agendamentos."
              onClick={() =>
                setReportKind(
                  "general",
                )
              }
            />

            <ReportOption
              active={
                reportKind ===
                "type"
              }
              title="Por Tipo de Visita"
              description="Distribuição dos agendamentos por categoria."
              onClick={() =>
                setReportKind(
                  "type",
                )
              }
            />

            <ReportOption
              active={
                reportKind ===
                "status"
              }
              title="Por Situação"
              description="Distribuição por status do agendamento."
              onClick={() =>
                setReportKind(
                  "status",
                )
              }
            />

            <ReportOption
              active={
                reportKind ===
                "location"
              }
              title="Por Sala"
              description="Utilização das salas de reunião e auditório."
              onClick={() =>
                setReportKind(
                  "location",
                )
              }
            />

            <ReportOption
              active={
                reportKind ===
                "organization"
              }
              title="Por Órgão / Instituição"
              description="Distribuição das visitas por instituição de origem."
              onClick={() =>
                setReportKind(
                  "organization",
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* FILTROS */}

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <FunnelSimple
                size={20}
                aria-hidden="true"
              />

              <h2 className="font-extrabold">
                Filtros
              </h2>
            </div>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Combine período, tipo,
              sala, situação, motivo e
              instituição.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* PERÍODO */}

            <div>
              <label
                className="mb-1.5 block text-sm font-semibold"
                htmlFor="report-period"
              >
                Período
              </label>

              <DateRangePicker
                id="report-period"
                value={
                  filters.dateRange
                }
                onChange={(value) =>
                  updateFilter(
                    "dateRange",
                    value,
                  )
                }
                placeholder="Selecione o período"
              />
            </div>

            {/* TIPO */}

            <SelectField
              id="report-type"
              label="Tipo de visita"
              value={
                filters.type
              }
              onChange={(value) =>
                updateFilter(
                  "type",
                  value as
                    | VisitType
                    | "",
                )
              }
            >
              <option value="">
                Todos os tipos
              </option>

              {Object.entries(
                visitTypeLabels,
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </SelectField>

            {/* SALA */}

            <SelectField
              id="report-location"
              label="Sala da visita"
              value={
                filters.location
              }
              onChange={(value) =>
                updateFilter(
                  "location",
                  value as
                    | VisitLocation
                    | "",
                )
              }
            >
              <option value="">
                Todas as salas
              </option>

              {visitLocationOptions.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                ),
              )}
            </SelectField>

            {/* STATUS */}

            <SelectField
              id="report-status"
              label="Situação"
              value={
                filters.status
              }
              onChange={(value) =>
                updateFilter(
                  "status",
                  value as
                    | VisitStatus
                    | "",
                )
              }
            >
              <option value="">
                Todas as situações
              </option>

              {Object.entries(
                visitStatusLabels,
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </SelectField>

            {/* MOTIVO */}

            <div>
              <label
                className="mb-1.5 block text-sm font-semibold"
                htmlFor="report-subject"
              >
                Motivo da visita
              </label>

              <Input
                id="report-subject"
                placeholder="Ex.: apoio técnico"
                value={
                  filters.subject
                }
                onChange={(event) =>
                  updateFilter(
                    "subject",
                    event.target.value,
                  )
                }
              />
            </div>

            {/* ORGANIZAÇÃO */}

            <div>
              <label
                className="mb-1.5 block text-sm font-semibold"
                htmlFor="report-organization"
              >
                Órgão / instituição
              </label>

              <Input
                id="report-organization"
                placeholder="Ex.: SEFAZ-AM"
                value={
                  filters.organization
                }
                onChange={(event) =>
                  updateFilter(
                    "organization",
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          {/* AÇÕES */}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={clearFilters}
              disabled={loading}
            >
              Limpar filtros
            </Button>

            <Button
              type="button"
              onClick={emitReport}
              disabled={loading}
            >
              <ChartBar
                size={17}
                aria-hidden="true"
              />

              {loading
                ? "Emitindo relatório..."
                : "Emitir relatório"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={
                exportingXlsx ||
                exportingPdf ||
                loading ||
                visits.length === 0
              }
              onClick={exportXlsx}
            >
              <DownloadSimple
                size={17}
                aria-hidden="true"
              />

              {exportingXlsx
                ? "Gerando XLSX..."
                : "Exportar XLSX"}
            </Button>

            <Button
              type="button"
              disabled={
                exportingPdf ||
                exportingXlsx ||
                loading ||
                visits.length === 0
              }
              onClick={exportPdf}
            >
              <FilePdf
                size={17}
                aria-hidden="true"
              />

              {exportingPdf
                ? "Gerando PDF..."
                : "Exportar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* INDICADORES */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total de agendamentos"
          value={
            visits.length
          }
        />

        <MetricCard
          label="Pendentes"
          value={
            visits.filter(
              (visit) =>
                visit.status ===
                "pending",
            ).length
          }
        />

        <MetricCard
          label="Aprovadas"
          value={
            visits.filter(
              (visit) =>
                visit.status ===
                "approved",
            ).length
          }
        />

        <MetricCard
          label="Concluídas"
          value={
            visits.filter(
              (visit) =>
                visit.status ===
                "completed",
            ).length
          }
        />

        <MetricCard
          label="Liberadas para recepção"
          value={
            visits.filter(
              (visit) =>
                visit.status ===
                "scheduled",
            ).length
          }
        />
      </div>

      {/* RESULTADOS */}

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <ChartBar
                size={20}
                aria-hidden="true"
              />

              <h2 className="font-extrabold">
                {getReportTitle(
                  reportKind,
                )}
              </h2>
            </div>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {visits.length} registro(s)
              encontrado(s).
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {!reportIssued ? (
            <EmptyState
              title="Relatório ainda não emitido"
              description="Defina os filtros desejados e clique em Emitir relatório."
            />
          ) : loading ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              Emitindo relatório...
            </p>
          ) : visits.length === 0 ? (
            <EmptyState
              title="Nenhum resultado"
              description="Nenhum agendamento corresponde aos filtros selecionados."
            />
          ) : reportKind === "general" ? (
            <GeneralTable
              visits={visits}
            />
          ) : (
            <GroupedTable
              rows={
                getGroupedReportData(
                  reportKind,
                  {
                    type: groupedByType,
                    status: groupedByStatus,
                    location: groupedByLocation,
                    organization: groupedByOrganization,
                  },
                ).rows
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================================================
 * SELECT
 * ======================================================= */

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;

  label: string;

  value: string;

  onChange:
    (value: string) => void;

  children:
    ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

/* =========================================================
 * OPÇÃO DE RELATÓRIO
 * ======================================================= */

function ReportOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;

  title: string;

  description: string;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border p-4 text-left transition ${
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]"
      }`}
    >
      <strong>
        {title}
      </strong>

      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {description}
      </p>
    </button>
  );
}

/* =========================================================
 * MÉTRICAS
 * ======================================================= */

function MetricCard({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-semibold text-[var(--text-muted)]">
          {label}
        </p>

        <p className="mt-2 text-3xl font-extrabold">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/* =========================================================
 * RELATÓRIO GERAL
 * ======================================================= */

function GeneralTable({
  visits,
}: {
  visits:
    VisitSummary[];
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <TableHead>
              Protocolo
            </TableHead>

            <TableHead>
              Data
            </TableHead>

            <TableHead>
              Horário
            </TableHead>

            <TableHead>
              Tipo
            </TableHead>

            <TableHead>
              Motivo
            </TableHead>

            <TableHead>
              Órgão
            </TableHead>

            <TableHead>
              Sala
            </TableHead>

            <TableHead>
              Situação
            </TableHead>
          </tr>
        </thead>

        <tbody>
          {visits.map(
            (visit) => (
              <TableRow
                key={visit.id}
              >
                <TableCell>
                  <strong>
                    {visit.protocol}
                  </strong>
                </TableCell>

                <TableCell>
                  {formatDate(
                    visit.scheduledDate,
                  )}
                </TableCell>

                <TableCell>
                  {normalizeTime(
                    visit.startTime,
                  )}
                  {" - "}
                  {normalizeTime(
                    visit.endTime,
                  )}
                </TableCell>

                <TableCell>
                  {
                    visitTypeLabels[
                      visit.type
                    ]
                  }
                </TableCell>

                <TableCell>
                  {visit.subject}
                </TableCell>

                <TableCell>
                  {
                    visit.organization
                  }
                </TableCell>

                <TableCell>
                  {visit.location}
                </TableCell>

                <TableCell>
                  {
                    visitStatusLabels[
                      visit.status
                    ]
                  }
                </TableCell>
              </TableRow>
            ),
          )}
        </tbody>
      </Table>
    </div>
  );
}

/* =========================================================
 * RELATÓRIOS AGRUPADOS
 * ======================================================= */

function GroupedTable({
  rows,
}: {
  rows:
    GroupedRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <TableHead>
              Categoria
            </TableHead>

            <TableHead>
              Quantidade
            </TableHead>

            <TableHead>
              Percentual
            </TableHead>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row) => (
              <TableRow
                key={row.label}
              >
                <TableCell>
                  <strong>
                    {row.label}
                  </strong>
                </TableCell>

                <TableCell>
                  {row.total}
                </TableCell>

                <TableCell>
                  {row.percentage.toFixed(
                    1,
                  )}
                  %
                </TableCell>
              </TableRow>
            ),
          )}
        </tbody>
      </Table>
    </div>
  );
}

/* =========================================================
 * API
 *
 * CORRIGIDO:
 * não existe mais variável totalPages.
 * ======================================================= */

async function fetchAllVisits(
  filters:
    ReportFilters,
) {
  const result:
    VisitSummary[] = [];

  let page = 1;

  while (true) {
    const params =
      new URLSearchParams({
        page:
          String(page),

        pageSize:
          "100",
      });

    if (
      filters.dateRange.from
    ) {
      params.set(
        "dateFrom",
        filters.dateRange.from,
      );
    }

    if (
      filters.dateRange.to
    ) {
      params.set(
        "dateTo",
        filters.dateRange.to,
      );
    }

    if (
      filters.type
    ) {
      params.set(
        "type",
        filters.type,
      );
    }

    if (
      filters.location
    ) {
      params.set(
        "location",
        filters.location,
      );
    }

    if (
      filters.status
    ) {
      params.set(
        "status",
        filters.status,
      );
    }

    if (
      filters.subject.trim()
    ) {
      params.set(
        "subject",
        filters.subject.trim(),
      );
    }

    if (
      filters.organization.trim()
    ) {
      params.set(
        "organization",
        filters.organization.trim(),
      );
    }

    const response =
      await api<VisitPageResult>(
        `/api/visits?${params.toString()}`,
      );

    result.push(
      ...response.visits,
    );

    /*
     * A própria resposta informa se
     * chegamos à última página.
     *
     * Isso elimina o erro:
     * no-useless-assignment.
     */
    if (
      page >=
      response.pagination.totalPages
    ) {
      break;
    }

    page += 1;
  }

  return result;
}

/* =========================================================
 * AGRUPAMENTO
 * ======================================================= */

function aggregateVisits(
  visits:
    VisitSummary[],

  selector:
    (
      visit:
        VisitSummary,
    ) => string,
): GroupedRow[] {
  const map =
    new Map<
      string,
      number
    >();

  for (
    const visit of visits
  ) {
    const key =
      selector(visit);

    map.set(
      key,
      (map.get(key) ??
        0) + 1,
    );
  }

  return Array.from(
    map.entries(),
  )
    .map(
      ([
        label,
        total,
      ]) => ({
        label,

        total,

        percentage:
          visits.length ===
          0
            ? 0
            : (total /
                visits.length) *
              100,
      }),
    )
    .sort(
      (a, b) =>
        b.total -
        a.total,
    );
}

/* =========================================================
 * XLSX - RELATÓRIO GERAL
 * ======================================================= */

function createGeneralXlsx(
  visits:
    VisitSummary[],

  filters:
    ReportFilters,
) {
  const workbook =
    utils.book_new();

  const summary =
    utils.aoa_to_sheet([
      [
        "RELATÓRIO GERAL DE AGENDAMENTOS DE VISITAS",
      ],

      [
        "Controladoria-Geral do Estado do Amazonas",
      ],

      [],

      [
        "Emitido em",
        formatDateTime(
          new Date(),
        ),
      ],

      [
        "Total de registros",
        visits.length,
      ],

      [],

      [
        "Filtros",
        buildFilterDescription(
          filters,
        ),
      ],
    ]);

  summary["!cols"] = [
    {
      wch: 25,
    },

    {
      wch: 80,
    },
  ];

  utils.book_append_sheet(
    workbook,
    summary,
    "Resumo",
  );

  const worksheet =
    utils.json_to_sheet(
      visits.map(
        (visit) => ({
          Protocolo:
            visit.protocol,

          Data:
            formatDate(
              visit.scheduledDate,
            ),

          "Hora inicial":
            normalizeTime(
              visit.startTime,
            ),

          "Hora final":
            normalizeTime(
              visit.endTime,
            ),

          Tipo:
            visitTypeLabels[
              visit.type
            ],

          Motivo:
            visit.subject,

          Órgão:
            visit.organization,

          Setor:
            visit.sector ??
            "",

          Sala:
            visit.location,

          Situação:
            visitStatusLabels[
              visit.status
            ],
        }),
      ),
    );

  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 13 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 40 },
    { wch: 30 },
    { wch: 25 },
    { wch: 32 },
    { wch: 27 },
  ];

  if (
    worksheet["!ref"]
  ) {
    worksheet[
      "!autofilter"
    ] = {
      ref:
        worksheet["!ref"],
    };
  }

  utils.book_append_sheet(
    workbook,
    worksheet,
    "Agendamentos",
  );

  writeFileXLSX(
    workbook,
    `relatorio-geral-visitas-${fileDate()}.xlsx`,
    {
      compression:
        true,
    },
  );
}

/* =========================================================
 * XLSX - RELATÓRIO AGRUPADO
 * ======================================================= */

function createGroupedXlsx(
  rows:
    GroupedRow[],

  filters:
    ReportFilters,

  title:
    string,
) {
  const workbook =
    utils.book_new();

  const summary =
    utils.aoa_to_sheet([
      [
        title.toUpperCase(),
      ],

      [
        "Controladoria-Geral do Estado do Amazonas",
      ],

      [],

      [
        "Emitido em",
        formatDateTime(
          new Date(),
        ),
      ],

      [
        "Filtros",
        buildFilterDescription(
          filters,
        ),
      ],
    ]);

  summary["!cols"] = [
    {
      wch: 25,
    },

    {
      wch: 80,
    },
  ];

  utils.book_append_sheet(
    workbook,
    summary,
    "Resumo",
  );

  const worksheet =
    utils.json_to_sheet(
      rows.map(
        (row) => ({
          Categoria:
            row.label,

          Quantidade:
            row.total,

          Percentual:
            `${row.percentage.toFixed(
              1,
            )}%`,
        }),
      ),
    );

  worksheet["!cols"] = [
    { wch: 45 },
    { wch: 15 },
    { wch: 15 },
  ];

  utils.book_append_sheet(
    workbook,
    worksheet,
    "Dados",
  );

  writeFileXLSX(
    workbook,
    `${slug(
      title,
    )}-${fileDate()}.xlsx`,
    {
      compression:
        true,
    },
  );
}

/* =========================================================
 * PDF - RELATÓRIO GERAL
 * ======================================================= */

function createGeneralPdf(
  visits:
    VisitSummary[],

  filters:
    ReportFilters,
) {
  const document =
    new jsPDF({
      orientation:
        "landscape",

      unit:
        "mm",

      format:
        "a4",
    });

  const pageWidth =
    document.internal
      .pageSize
      .getWidth();

  const pageHeight =
    document.internal
      .pageSize
      .getHeight();

  document.setFont(
    "helvetica",
    "bold",
  );

  document.setFontSize(15);

  document.text(
    "RELATÓRIO GERAL DE AGENDAMENTOS DE VISITAS",
    14,
    15,
  );

  document.setFont(
    "helvetica",
    "normal",
  );

  document.setFontSize(9);

  document.text(
    "Controladoria-Geral do Estado do Amazonas",
    14,
    21,
  );

  document.text(
    `Total de registros: ${visits.length}`,
    pageWidth - 14,
    15,
    {
      align: "right",
    },
  );

  document.text(
    `Emitido em: ${formatDateTime(
      new Date(),
    )}`,
    pageWidth - 14,
    21,
    {
      align: "right",
    },
  );

  const filtersText =
    document.splitTextToSize(
      `Filtros: ${buildFilterDescription(
        filters,
      )}`,
      pageWidth - 28,
    );

  document.setFontSize(8);

  document.text(
    filtersText,
    14,
    28,
  );

  const startY =
    34 +
    filtersText.length * 3;

  autoTable(
    document,
    {
      startY,

      theme:
        "grid",

      head: [[
        "Protocolo",
        "Data",
        "Horário",
        "Tipo",
        "Motivo",
        "Órgão",
        "Sala",
        "Situação",
      ]],

      body:
        visits.map(
          (visit) => [
            visit.protocol,

            formatDate(
              visit.scheduledDate,
            ),

            `${normalizeTime(
              visit.startTime,
            )} - ${normalizeTime(
              visit.endTime,
            )}`,

            visitTypeLabels[
              visit.type
            ],

            visit.subject,

            visit.organization,

            visit.location,

            visitStatusLabels[
              visit.status
            ],
          ],
        ),

      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow:
          "linebreak",
        valign:
          "top",
      },

      headStyles: {
        fontStyle:
          "bold",
      },

      margin: {
        left: 10,
        right: 10,
        bottom: 14,
      },

      didDrawPage: () => {
        document.setFontSize(
          7,
        );

        document.text(
          "CGE-AM - Agendamento de Visitas",
          14,
          pageHeight - 7,
        );

        document.text(
          `Página ${document.getNumberOfPages()}`,
          pageWidth - 14,
          pageHeight - 7,
          {
            align: "right",
          },
        );
      },
    },
  );

  document.save(
    `relatorio-geral-visitas-${fileDate()}.pdf`,
  );
}

/* =========================================================
 * PDF - RELATÓRIO AGRUPADO
 * ======================================================= */

function createGroupedPdf(
  rows:
    GroupedRow[],

  filters:
    ReportFilters,

  title:
    string,
) {
  const document =
    new jsPDF({
      orientation:
        "portrait",

      unit:
        "mm",

      format:
        "a4",
    });

  document.setFont(
    "helvetica",
    "bold",
  );

  document.setFontSize(15);

  document.text(
    title.toUpperCase(),
    14,
    15,
  );

  document.setFont(
    "helvetica",
    "normal",
  );

  document.setFontSize(9);

  document.text(
    "Controladoria-Geral do Estado do Amazonas",
    14,
    21,
  );

  const filtersText =
    document.splitTextToSize(
      `Filtros: ${buildFilterDescription(
        filters,
      )}`,
      180,
    );

  document.setFontSize(8);

  document.text(
    filtersText,
    14,
    28,
  );

  const startY =
    34 +
    filtersText.length * 3;

  autoTable(
    document,
    {
      startY,

      theme:
        "grid",

      head: [[
        "Categoria",
        "Quantidade",
        "Percentual",
      ]],

      body:
        rows.map(
          (row) => [
            row.label,

            String(
              row.total,
            ),

            `${row.percentage.toFixed(
              1,
            )}%`,
          ],
        ),

      styles: {
        fontSize: 9,
        cellPadding: 2,
      },

      headStyles: {
        fontStyle:
          "bold",
      },
    },
  );

  document.save(
    `${slug(
      title,
    )}-${fileDate()}.pdf`,
  );
}

/* =========================================================
 * DADOS DO RELATÓRIO AGRUPADO
 * ======================================================= */

function getGroupedReportData(
  kind: ReportKind,
  groups: {
    type: GroupedRow[];
    status: GroupedRow[];
    location: GroupedRow[];
    organization: GroupedRow[];
  },
) {
  switch (kind) {
    case "type":
      return {
        rows: groups.type,
        title: "Relatório por Tipo de Visita",
      };

    case "status":
      return {
        rows: groups.status,
        title: "Relatório por Situação",
      };

    case "organization":
      return {
        rows: groups.organization,
        title: "Relatório por Órgão ou Instituição",
      };

    case "location":
    default:
      return {
        rows: groups.location,
        title: "Relatório por Sala",
      };
  }
}

/* =========================================================
 * TITULO
 * ======================================================= */

function getReportTitle(
  kind:
    ReportKind,
) {
  switch (kind) {
    case "type":
      return "Relatório por tipo de visita";

    case "status":
      return "Relatório por situação";

    case "location":
      return "Relatório por sala";

    case "organization":
      return "Relatório por órgão / instituição";

    case "general":
    default:
      return "Relatório geral de agendamentos";
  }
}

/* =========================================================
 * DESCRIÇÃO DOS FILTROS
 * ======================================================= */

function buildFilterDescription(
  filters:
    ReportFilters,
) {
  const parts:
    string[] = [];

  if (
    filters.dateRange.from
  ) {
    parts.push(
      `De ${formatDate(
        filters.dateRange.from,
      )}`,
    );
  }

  if (
    filters.dateRange.to
  ) {
    parts.push(
      `Até ${formatDate(
        filters.dateRange.to,
      )}`,
    );
  }

  if (
    filters.type
  ) {
    parts.push(
      `Tipo: ${
        visitTypeLabels[
          filters.type
        ]
      }`,
    );
  }

  if (
    filters.location
  ) {
    parts.push(
      `Sala: ${filters.location}`,
    );
  }

  if (
    filters.status
  ) {
    parts.push(
      `Situação: ${
        visitStatusLabels[
          filters.status
        ]
      }`,
    );
  }

  if (
    filters.subject.trim()
  ) {
    parts.push(
      `Motivo: ${filters.subject.trim()}`,
    );
  }

  if (
    filters.organization.trim()
  ) {
    parts.push(
      `Órgão: ${filters.organization.trim()}`,
    );
  }

  return parts.length >
    0
    ? parts.join(
        " | ",
      )
    : "Todos os registros";
}

/* =========================================================
 * DATAS
 * ======================================================= */

function formatDate(
  value:
    string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}

function formatDateTime(
  value:
    Date,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",

      timeZone:
        "America/Manaus",
    },
  ).format(value);
}

function fileDate() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Manaus",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year",
    )?.value ??
    "0000";

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month",
    )?.value ??
    "00";

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day",
    )?.value ??
    "00";

  return `${year}-${month}-${day}`;
}

function normalizeTime(
  value:
    string,
) {
  return value.slice(
    0,
    5,
  );
}

/* =========================================================
 * SLUG
 * ======================================================= */

function slug(
  value:
    string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-|-$/g,
      "",
    );
}

/* =========================================================
 * ERRO
 * ======================================================= */

function getErrorMessage(
  cause:
    unknown,

  fallback:
    string,
) {
  return cause instanceof
    ApiError
    ? cause.message
    : fallback;
}