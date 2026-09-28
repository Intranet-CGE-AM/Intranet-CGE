import type {
  VisitLocation,
  VisitPageResult,
  VisitStatus,
  VisitSummary,
  VisitType,
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
  Select,
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@cge/ui";

import { DownloadSimple, FilePdf } from "@phosphor-icons/react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { utils, writeFileXLSX } from "xlsx";

import { jsPDF } from "jspdf";

import autoTable from "jspdf-autotable";

import { VisitStats } from "../components/visit-ui";
import { api } from "../lib/api";
import {
  visitErrorMessage,
  visitLocationOptions,
  visitStatusLabels,
  visitStatusMeta,
  visitTypeLabels,
} from "../lib/visit-labels";

/* =========================================================
 * TIPOS
 * ======================================================= */

type ReportKind = "general" | "type" | "status" | "location" | "organization";

type DateRangeValue = {
  from: string;
  to: string;
};

type ReportFilters = {
  dateRange: DateRangeValue;

  type: VisitType | "";

  location: VisitLocation | "";

  status: VisitStatus | "";

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
  const [reportKind, setReportKind] = useState<ReportKind>("general");

  const [filters, setFilters] = useState<ReportFilters>(initialFilters);

  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({
    ...initialFilters,
    dateRange: {
      ...initialFilters.dateRange,
    },
  });

  const [reportIssued, setReportIssued] = useState(false);

  const [visits, setVisits] = useState<VisitSummary[]>([]);

  const [loading, setLoading] = useState(false);

  const [exportingXlsx, setExportingXlsx] = useState(false);

  const [exportingPdf, setExportingPdf] = useState(false);

  const [error, setError] = useState("");

  /* =======================================================
   * CARREGAR RELATÓRIO
   * ===================================================== */

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await fetchAllVisits(appliedFilters);

      setVisits(result);
    } catch (cause) {
      setError(
        visitErrorMessage(cause, "Não foi possível carregar o relatório."),
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

  const groupedByType = useMemo(
    () => aggregateVisits(visits, (visit) => visitTypeLabels[visit.type]),
    [visits],
  );

  const groupedByStatus = useMemo(
    () => aggregateVisits(visits, (visit) => visitStatusLabels[visit.status]),
    [visits],
  );

  const groupedByLocation = useMemo(
    () =>
      aggregateVisits(
        visits,
        (visit) =>
          visitLocationOptions.find((option) => option.value === visit.location)
            ?.label ?? visit.location,
      ),
    [visits],
  );

  const groupedByOrganization = useMemo(
    () =>
      aggregateVisits(visits, (visit) => visit.organization || "Não informado"),
    [visits],
  );

  /* =======================================================
   * FILTROS
   * ===================================================== */

  function updateFilter<K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
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
      filters.dateRange.from > filters.dateRange.to
    ) {
      setError("A data inicial não pode ser posterior à data final.");
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
    if (visits.length === 0) {
      setError("Não existem registros para exportação.");
      return;
    }

    try {
      setExportingXlsx(true);
      setError("");

      if (reportKind === "general") {
        createGeneralXlsx(visits, appliedFilters);
        return;
      }

      const grouped = getGroupedReportData(reportKind, {
        type: groupedByType,
        status: groupedByStatus,
        location: groupedByLocation,
        organization: groupedByOrganization,
      });

      createGroupedXlsx(grouped.rows, appliedFilters, grouped.title);
    } catch {
      setError("Não foi possível gerar o relatório XLSX.");
    } finally {
      setExportingXlsx(false);
    }
  }

  /* =======================================================
   * PDF
   * ===================================================== */

  function exportPdf() {
    if (visits.length === 0) {
      setError("Não existem registros para exportação.");
      return;
    }

    try {
      setExportingPdf(true);
      setError("");

      if (reportKind === "general") {
        createGeneralPdf(visits, appliedFilters);
        return;
      }

      const grouped = getGroupedReportData(reportKind, {
        type: groupedByType,
        status: groupedByStatus,
        location: groupedByLocation,
        organization: groupedByOrganization,
      });

      createGroupedPdf(grouped.rows, appliedFilters, grouped.title);
    } catch {
      setError("Não foi possível gerar o relatório PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  const groupedRows =
    reportKind === "general"
      ? []
      : getGroupedReportData(reportKind, {
          type: groupedByType,
          status: groupedByStatus,
          location: groupedByLocation,
          organization: groupedByOrganization,
        }).rows;

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Agendamento de Visitas
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            Relatórios
          </h1>

          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Consulte indicadores dos agendamentos e exporte os resultados em
            Excel ou PDF.
          </p>
        </div>
      </div>

      {error ? (
        <Alert title="A operação não foi concluída" tone="danger">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">Filtros</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Escolha o tipo de relatório e combine período, tipo, sala,
              situação, motivo e instituição.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              htmlFor="report-kind"
              label="Tipo de relatório"
              hint={reportKindOptions.find((o) => o.value === reportKind)?.hint}
            >
              <Select
                id="report-kind"
                name="reportKind"
                options={reportKindOptions}
                value={reportKind}
                onValueChange={(value) => setReportKind(value as ReportKind)}
              />
            </FormField>

            <FormField htmlFor="report-period" label="Período">
              <DateRangePicker
                id="report-period"
                value={filters.dateRange}
                onChange={(value) => updateFilter("dateRange", value)}
                placeholder="Selecione o período"
              />
            </FormField>

            <FormField htmlFor="report-type" label="Tipo de visita">
              <Select
                id="report-type"
                name="type"
                options={typeOptions}
                value={filters.type || ALL}
                onValueChange={(value) =>
                  updateFilter(
                    "type",
                    value === ALL ? "" : (value as VisitType),
                  )
                }
              />
            </FormField>

            <FormField htmlFor="report-location" label="Sala da visita">
              <Select
                id="report-location"
                name="location"
                options={locationOptions}
                value={filters.location || ALL}
                onValueChange={(value) =>
                  updateFilter(
                    "location",
                    value === ALL ? "" : (value as VisitLocation),
                  )
                }
              />
            </FormField>

            <FormField htmlFor="report-status" label="Situação">
              <Select
                id="report-status"
                name="status"
                options={statusOptions}
                value={filters.status || ALL}
                onValueChange={(value) =>
                  updateFilter(
                    "status",
                    value === ALL ? "" : (value as VisitStatus),
                  )
                }
              />
            </FormField>

            <FormField htmlFor="report-subject" label="Motivo da visita">
              <Input
                id="report-subject"
                placeholder="Ex.: apoio técnico"
                value={filters.subject}
                onChange={(event) =>
                  updateFilter("subject", event.target.value)
                }
              />
            </FormField>

            <FormField
              htmlFor="report-organization"
              label="Órgão / instituição"
            >
              <Input
                id="report-organization"
                placeholder="Ex.: SEFAZ-AM"
                value={filters.organization}
                onChange={(event) =>
                  updateFilter("organization", event.target.value)
                }
              />
            </FormField>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="quiet"
              onClick={clearFilters}
              disabled={loading}
            >
              Limpar filtros
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={
                exportingXlsx || exportingPdf || loading || visits.length === 0
              }
              onClick={exportXlsx}
            >
              <DownloadSimple size={16} aria-hidden="true" />

              {exportingXlsx ? "Gerando XLSX…" : "Exportar XLSX"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={
                exportingPdf || exportingXlsx || loading || visits.length === 0
              }
              onClick={exportPdf}
            >
              <FilePdf size={16} aria-hidden="true" />

              {exportingPdf ? "Gerando PDF…" : "Exportar PDF"}
            </Button>

            <Button type="button" onClick={emitReport} disabled={loading}>
              {loading ? "Emitindo relatório…" : "Emitir relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportIssued ? (
        <VisitStats
          className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          items={[
            { label: "Total de agendamentos", value: visits.length },
            {
              label: "Pendentes",
              value: visits.filter((visit) => visit.status === "pending")
                .length,
            },
            {
              label: "Aprovadas",
              value: visits.filter((visit) => visit.status === "approved")
                .length,
            },
            {
              label: "Concluídas",
              value: visits.filter((visit) => visit.status === "completed")
                .length,
            },
            {
              label: "Liberadas para recepção",
              value: visits.filter((visit) => visit.status === "scheduled")
                .length,
            },
          ]}
          label="Indicadores do relatório"
          loading={loading}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-bold">{getReportTitle(reportKind)}</h2>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {!reportIssued
                ? "Emita o relatório para ver os resultados."
                : loading
                  ? "Consultando agendamentos…"
                  : `${visits.length} ${visits.length === 1 ? "registro encontrado" : "registros encontrados"}`}
            </p>
          </div>
        </CardHeader>

        {!reportIssued ? (
          <EmptyState
            title="Relatório ainda não emitido"
            description="Defina os filtros desejados e selecione Emitir relatório."
          />
        ) : loading ? (
          <TableSkeleton
            ariaLabel="Emitindo relatório"
            headers={
              reportKind === "general"
                ? generalHeaders
                : ["Categoria", "Quantidade", "Percentual"]
            }
            rows={5}
          />
        ) : visits.length === 0 ? (
          <EmptyState
            title="Nenhum resultado"
            description="Nenhum agendamento corresponde aos filtros selecionados."
          />
        ) : reportKind === "general" ? (
          <GeneralTable visits={visits} />
        ) : (
          <GroupedTable rows={groupedRows} />
        )}
      </Card>
    </div>
  );
}

const ALL = "all";

const reportKindOptions: Array<{
  value: ReportKind;
  label: string;
  hint: string;
}> = [
  {
    value: "general",
    label: "Relatório geral",
    hint: "Relação detalhada dos agendamentos.",
  },
  {
    value: "type",
    label: "Por tipo de visita",
    hint: "Distribuição dos agendamentos por categoria.",
  },
  {
    value: "status",
    label: "Por situação",
    hint: "Distribuição pela situação do agendamento.",
  },
  {
    value: "location",
    label: "Por sala",
    hint: "Utilização das salas de reunião e do auditório.",
  },
  {
    value: "organization",
    label: "Por órgão ou instituição",
    hint: "Distribuição das visitas por instituição de origem.",
  },
];

const typeOptions = [
  { value: ALL, label: "Todos os tipos" },
  ...Object.entries(visitTypeLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

const locationOptions = [
  { value: ALL, label: "Todas as salas" },
  ...visitLocationOptions,
];

const statusOptions = [
  { value: ALL, label: "Todas as situações" },
  ...Object.entries(visitStatusLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

const generalHeaders = [
  "Protocolo",
  "Data",
  "Horário",
  "Tipo",
  "Motivo",
  "Órgão",
  "Sala",
  "Situação",
];

/* =========================================================
 * RELATÓRIO GERAL
 * ======================================================= */

function GeneralTable({ visits }: { visits: VisitSummary[] }) {
  return (
    <Table>
      <thead>
        <tr>
          {generalHeaders.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </tr>
      </thead>

      <tbody>
        {visits.map((visit) => (
          <TableRow key={visit.id}>
            <TableCell className="whitespace-nowrap font-semibold">
              {visit.protocol}
            </TableCell>

            <TableCell className="whitespace-nowrap">
              {formatDate(visit.scheduledDate)}
            </TableCell>

            <TableCell className="whitespace-nowrap">
              {normalizeTime(visit.startTime)}
              {" às "}
              {normalizeTime(visit.endTime)}
            </TableCell>

            <TableCell>{visitTypeLabels[visit.type]}</TableCell>

            <TableCell className="min-w-48">{visit.subject}</TableCell>

            <TableCell>{visit.organization}</TableCell>

            <TableCell className="whitespace-nowrap">
              {visit.location}
            </TableCell>

            <TableCell>
              <Badge
                className="whitespace-nowrap"
                variant={visitStatusMeta[visit.status].variant}
              >
                {visitStatusMeta[visit.status].label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

/* =========================================================
 * RELATÓRIOS AGRUPADOS
 * ======================================================= */

function GroupedTable({ rows }: { rows: GroupedRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <TableHead>Categoria</TableHead>

          <TableHead className="text-right">Quantidade</TableHead>

          <TableHead className="text-right">Percentual</TableHead>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-semibold">{row.label}</TableCell>

            <TableCell className="text-right">{row.total}</TableCell>

            <TableCell className="text-right">
              {row.percentage.toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

/* =========================================================
 * API
 * ======================================================= */

async function fetchAllVisits(filters: ReportFilters) {
  const result: VisitSummary[] = [];

  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),

      pageSize: "100",
    });

    if (filters.dateRange.from) {
      params.set("dateFrom", filters.dateRange.from);
    }

    if (filters.dateRange.to) {
      params.set("dateTo", filters.dateRange.to);
    }

    if (filters.type) {
      params.set("type", filters.type);
    }

    if (filters.location) {
      params.set("location", filters.location);
    }

    if (filters.status) {
      params.set("status", filters.status);
    }

    if (filters.subject.trim()) {
      params.set("subject", filters.subject.trim());
    }

    if (filters.organization.trim()) {
      params.set("organization", filters.organization.trim());
    }

    const response = await api<VisitPageResult>(
      `/api/visits?${params.toString()}`,
    );

    result.push(...response.visits);

    /*
     * A própria resposta informa se
     * chegamos à última página.
     *
     * Isso elimina o erro:
     * no-useless-assignment.
     */
    if (page >= response.pagination.totalPages) {
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
  visits: VisitSummary[],

  selector: (visit: VisitSummary) => string,
): GroupedRow[] {
  const map = new Map<string, number>();

  for (const visit of visits) {
    const key = selector(visit);

    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([label, total]) => ({
      label,

      total,

      percentage: visits.length === 0 ? 0 : (total / visits.length) * 100,
    }))
    .sort((a, b) => b.total - a.total);
}

/* =========================================================
 * XLSX - RELATÓRIO GERAL
 * ======================================================= */

function createGeneralXlsx(
  visits: VisitSummary[],

  filters: ReportFilters,
) {
  const workbook = utils.book_new();

  const summary = utils.aoa_to_sheet([
    [getReportTitle("general")],

    ["Controladoria-Geral do Estado do Amazonas"],

    [],

    ["Emitido em", formatDateTime(new Date())],

    ["Total de registros", visits.length],

    [],

    ["Filtros", buildFilterDescription(filters)],
  ]);

  summary["!cols"] = [
    {
      wch: 25,
    },

    {
      wch: 80,
    },
  ];

  utils.book_append_sheet(workbook, summary, "Resumo");

  const worksheet = utils.json_to_sheet(
    visits.map((visit) => ({
      Protocolo: visit.protocol,

      Data: formatDate(visit.scheduledDate),

      "Hora inicial": normalizeTime(visit.startTime),

      "Hora final": normalizeTime(visit.endTime),

      Tipo: visitTypeLabels[visit.type],

      Motivo: visit.subject,

      Órgão: visit.organization,

      Setor: visit.sector ?? "",

      Sala: visit.location,

      Situação: visitStatusLabels[visit.status],
    })),
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

  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = {
      ref: worksheet["!ref"],
    };
  }

  utils.book_append_sheet(workbook, worksheet, "Agendamentos");

  writeFileXLSX(workbook, `relatorio-geral-visitas-${fileDate()}.xlsx`, {
    compression: true,
  });
}

/* =========================================================
 * XLSX - RELATÓRIO AGRUPADO
 * ======================================================= */

function createGroupedXlsx(
  rows: GroupedRow[],

  filters: ReportFilters,

  title: string,
) {
  const workbook = utils.book_new();

  const summary = utils.aoa_to_sheet([
    [title],

    ["Controladoria-Geral do Estado do Amazonas"],

    [],

    ["Emitido em", formatDateTime(new Date())],

    ["Filtros", buildFilterDescription(filters)],
  ]);

  summary["!cols"] = [
    {
      wch: 25,
    },

    {
      wch: 80,
    },
  ];

  utils.book_append_sheet(workbook, summary, "Resumo");

  const worksheet = utils.json_to_sheet(
    rows.map((row) => ({
      Categoria: row.label,

      Quantidade: row.total,

      Percentual: `${row.percentage.toFixed(1)}%`,
    })),
  );

  worksheet["!cols"] = [{ wch: 45 }, { wch: 15 }, { wch: 15 }];

  utils.book_append_sheet(workbook, worksheet, "Dados");

  writeFileXLSX(workbook, `${slug(title)}-${fileDate()}.xlsx`, {
    compression: true,
  });
}

/* =========================================================
 * PDF - RELATÓRIO GERAL
 * ======================================================= */

function createGeneralPdf(
  visits: VisitSummary[],

  filters: ReportFilters,
) {
  const document = new jsPDF({
    orientation: "landscape",

    unit: "mm",

    format: "a4",
  });

  const pageWidth = document.internal.pageSize.getWidth();

  const pageHeight = document.internal.pageSize.getHeight();

  document.setFont("helvetica", "bold");

  document.setFontSize(15);

  document.text(getReportTitle("general"), 14, 15);

  document.setFont("helvetica", "normal");

  document.setFontSize(9);

  document.text("Controladoria-Geral do Estado do Amazonas", 14, 21);

  document.text(`Total de registros: ${visits.length}`, pageWidth - 14, 15, {
    align: "right",
  });

  document.text(
    `Emitido em: ${formatDateTime(new Date())}`,
    pageWidth - 14,
    21,
    {
      align: "right",
    },
  );

  const filtersText = document.splitTextToSize(
    `Filtros: ${buildFilterDescription(filters)}`,
    pageWidth - 28,
  );

  document.setFontSize(8);

  document.text(filtersText, 14, 28);

  const startY = 34 + filtersText.length * 3;

  autoTable(document, {
    startY,

    theme: "grid",

    head: [
      [
        "Protocolo",
        "Data",
        "Horário",
        "Tipo",
        "Motivo",
        "Órgão",
        "Sala",
        "Situação",
      ],
    ],

    body: visits.map((visit) => [
      visit.protocol,

      formatDate(visit.scheduledDate),

      `${normalizeTime(visit.startTime)} - ${normalizeTime(visit.endTime)}`,

      visitTypeLabels[visit.type],

      visit.subject,

      visit.organization,

      visit.location,

      visitStatusLabels[visit.status],
    ]),

    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },

    headStyles: {
      fontStyle: "bold",
    },

    margin: {
      left: 10,
      right: 10,
      bottom: 14,
    },

    didDrawPage: () => {
      document.setFontSize(7);

      document.text("CGE-AM - Agendamento de Visitas", 14, pageHeight - 7);

      document.text(
        `Página ${document.getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 7,
        {
          align: "right",
        },
      );
    },
  });

  document.save(`relatorio-geral-visitas-${fileDate()}.pdf`);
}

/* =========================================================
 * PDF - RELATÓRIO AGRUPADO
 * ======================================================= */

function createGroupedPdf(
  rows: GroupedRow[],

  filters: ReportFilters,

  title: string,
) {
  const document = new jsPDF({
    orientation: "portrait",

    unit: "mm",

    format: "a4",
  });

  document.setFont("helvetica", "bold");

  document.setFontSize(15);

  document.text(title, 14, 15);

  document.setFont("helvetica", "normal");

  document.setFontSize(9);

  document.text("Controladoria-Geral do Estado do Amazonas", 14, 21);

  const filtersText = document.splitTextToSize(
    `Filtros: ${buildFilterDescription(filters)}`,
    180,
  );

  document.setFontSize(8);

  document.text(filtersText, 14, 28);

  const startY = 34 + filtersText.length * 3;

  autoTable(document, {
    startY,

    theme: "grid",

    head: [["Categoria", "Quantidade", "Percentual"]],

    body: rows.map((row) => [
      row.label,

      String(row.total),

      `${row.percentage.toFixed(1)}%`,
    ]),

    styles: {
      fontSize: 9,
      cellPadding: 2,
    },

    headStyles: {
      fontStyle: "bold",
    },
  });

  document.save(`${slug(title)}-${fileDate()}.pdf`);
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
        title: getReportTitle("type"),
      };

    case "status":
      return {
        rows: groups.status,
        title: getReportTitle("status"),
      };

    case "organization":
      return {
        rows: groups.organization,
        title: getReportTitle("organization"),
      };

    case "location":
    default:
      return {
        rows: groups.location,
        title: getReportTitle("location"),
      };
  }
}

/* =========================================================
 * TITULO
 * ======================================================= */

function getReportTitle(kind: ReportKind) {
  switch (kind) {
    case "type":
      return "Relatório por tipo de visita";

    case "status":
      return "Relatório por situação";

    case "location":
      return "Relatório por sala";

    case "organization":
      return "Relatório por órgão ou instituição";

    case "general":
    default:
      return "Relatório geral de agendamentos de visitas";
  }
}

/* =========================================================
 * DESCRIÇÃO DOS FILTROS
 * ======================================================= */

function buildFilterDescription(filters: ReportFilters) {
  const parts: string[] = [];

  if (filters.dateRange.from) {
    parts.push(`De ${formatDate(filters.dateRange.from)}`);
  }

  if (filters.dateRange.to) {
    parts.push(`Até ${formatDate(filters.dateRange.to)}`);
  }

  if (filters.type) {
    parts.push(`Tipo: ${visitTypeLabels[filters.type]}`);
  }

  if (filters.location) {
    parts.push(`Sala: ${filters.location}`);
  }

  if (filters.status) {
    parts.push(`Situação: ${visitStatusLabels[filters.status]}`);
  }

  if (filters.subject.trim()) {
    parts.push(`Motivo: ${filters.subject.trim()}`);
  }

  if (filters.organization.trim()) {
    parts.push(`Órgão: ${filters.organization.trim()}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "Todos os registros";
}

/* =========================================================
 * DATAS
 * ======================================================= */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",

    timeStyle: "short",

    timeZone: "America/Manaus",
  }).format(value);
}

function fileDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";

  const month = parts.find((part) => part.type === "month")?.value ?? "00";

  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

/* =========================================================
 * SLUG
 * ======================================================= */

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
