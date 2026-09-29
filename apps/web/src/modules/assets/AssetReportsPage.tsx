import { useEffect, useState } from "react";

import { FilePdf, FileXls, FunnelSimple } from "@phosphor-icons/react";

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
  Select,
  SearchableSelect,
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@cge/ui";

import { api, ApiError } from "../../lib/api";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  ALL,
  assetStatusMeta,
  conservationOptions,
  formatCurrency,
  PageHeader,
  unitOptions,
  type OrganizationUnit,
} from "./shared";

type ReportType =
  | "inventory"
  | "sector"
  | "status"
  | "conservation"
  | "movements"
  | "financial";

type ReportAsset = {
  id: string;
  patrimonyNumber: string;
  description: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: "active" | "maintenance" | "disposed";
  conservationStatus: string | null;
  acquisitionDate: string | null;
  acquisitionValue: string | null;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  unitType: "department" | "sector" | "subsector" | null;
};

type AssetReportResponse = {
  assets: ReportAsset[];

  summary: {
    total: number;
    totalValue: number;
  };
};

function formatDateForSpreadsheet(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function buildExportRows(assets: ReportAsset[]) {
  return assets.map((asset) => ({
    Patrimônio: asset.patrimonyNumber,

    Descrição: asset.description,

    Marca: asset.brand ?? "",

    Modelo: asset.model ?? "",

    "Número de série": asset.serialNumber ?? "",

    Localização: asset.unitCode
      ? `${asset.unitCode} - ${asset.unitName ?? ""}`
      : "Não informado",

    Situação: assetStatusMeta[asset.status].label,

    Conservação: asset.conservationStatus ?? "Não informado",

    "Data de aquisição": asset.acquisitionDate
      ? formatDateForSpreadsheet(asset.acquisitionDate)
      : "",

    "Valor de aquisição": asset.acquisitionValue
      ? Number(asset.acquisitionValue)
      : "",
  }));
}

const reportTypeLabels: Record<ReportType, string> = {
  inventory: "Inventário geral",
  sector: "Bens por setor",
  status: "Bens por situação",
  conservation: "Estado de conservação",
  movements: "Movimentações",
  financial: "Relatório financeiro",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function fileDate() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function AssetReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("inventory");

  const [departmentId, setDepartmentId] = useState("");

  const [sectorId, setSectorId] = useState("");

  const [subsectorId, setSubsectorId] = useState("");

  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  const [loadingUnits, setLoadingUnits] = useState(true);

  const [unitsError, setUnitsError] = useState<string | null>(null);

  const [status, setStatus] = useState("");

  const [conservationStatus, setConservationStatus] = useState("");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const [report, setReport] = useState<AssetReportResponse | null>(null);

  const [loadingReport, setLoadingReport] = useState(false);

  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      try {
        setLoadingUnits(true);
        setUnitsError(null);

        const result = await api<
          | OrganizationUnit[]
          | {
              units: OrganizationUnit[];
            }
        >("/api/organization-units");

        if (cancelled) {
          return;
        }

        const loadedUnits = Array.isArray(result) ? result : result.units;

        setUnits(loadedUnits.filter((unit) => unit.active));
      } catch (cause) {
        if (cancelled) {
          return;
        }

        setUnitsError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar a estrutura organizacional.",
        );
      } finally {
        if (!cancelled) {
          setLoadingUnits(false);
        }
      }
    }

    void loadUnits();

    return () => {
      cancelled = true;
    };
  }, []);

  const departments = units.filter(
    (unit) => unit.type === "department" && unit.active,
  );

  const sectors = units.filter(
    (unit) =>
      unit.type === "sector" &&
      unit.active &&
      (!departmentId || unit.parentId === departmentId),
  );

  const subsectors = units.filter(
    (unit) =>
      unit.type === "subsector" &&
      unit.active &&
      (!sectorId || unit.parentId === sectorId),
  );

  async function handleGenerateReport() {
    try {
      setLoadingReport(true);
      setReportError(null);

      const params = new URLSearchParams();

      if (departmentId) {
        params.set("departmentId", departmentId);
      }

      if (sectorId) {
        params.set("sectorId", sectorId);
      }

      if (subsectorId) {
        params.set("subsectorId", subsectorId);
      }

      if (status) {
        params.set("status", status);
      }

      if (conservationStatus) {
        params.set("conservationStatus", conservationStatus);
      }

      if (startDate) {
        params.set("startDate", startDate);
      }

      if (endDate) {
        params.set("endDate", endDate);
      }

      const queryString = params.toString();

      const result = await api<AssetReportResponse>(
        queryString
          ? `/api/assets/reports?${queryString}`
          : "/api/assets/reports",
      );

      setReport(result);
    } catch (cause) {
      setReportError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível gerar o relatório.",
      );
    } finally {
      setLoadingReport(false);
    }
  }

  function reportToExport() {
    if (!report) {
      setReportError("Gere o relatório antes de exportar.");

      return null;
    }

    if (report.assets.length === 0) {
      setReportError("Não há dados para exportar.");

      return null;
    }

    setReportError(null);

    return report;
  }

  function describeFilters() {
    const unitName = (id: string) =>
      units.find((unit) => unit.id === id)?.name ?? id;

    const parts = [
      departmentId && `Departamento: ${unitName(departmentId)}`,
      sectorId && `Setor: ${unitName(sectorId)}`,
      subsectorId && `Subsetor: ${unitName(subsectorId)}`,
      status &&
        `Situação: ${assetStatusMeta[status as ReportAsset["status"]]?.label ?? status}`,
      conservationStatus && `Conservação: ${conservationStatus}`,
      startDate && `De: ${formatDateForSpreadsheet(startDate)}`,
      endDate && `Até: ${formatDateForSpreadsheet(endDate)}`,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" | ") : "Todos os registros";
  }

  function handleExportPdf() {
    const data = reportToExport();

    if (!data) {
      return;
    }

    const rows = buildExportRows(data.assets);

    const document = new jsPDF({
      orientation: "landscape",

      unit: "mm",

      format: "a4",
    });

    const pageWidth = document.internal.pageSize.getWidth();

    const pageHeight = document.internal.pageSize.getHeight();

    document.setFont("helvetica", "bold");

    document.setFontSize(15);

    document.text(
      `RELATÓRIO PATRIMONIAL - ${reportTypeLabels[reportType].toUpperCase()}`,
      14,
      15,
    );

    document.setFont("helvetica", "normal");

    document.setFontSize(9);

    document.text("Controladoria-Geral do Estado do Amazonas", 14, 21);

    document.text(
      `Total de bens: ${data.summary.total} | Valor total: ${currency.format(data.summary.totalValue)}`,
      pageWidth - 14,
      15,
      { align: "right" },
    );

    document.text(
      `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
      pageWidth - 14,
      21,
      { align: "right" },
    );

    const filtersText = document.splitTextToSize(
      `Filtros: ${describeFilters()}`,
      pageWidth - 28,
    );

    document.setFontSize(8);

    document.text(filtersText, 14, 28);

    autoTable(document, {
      startY: 34 + filtersText.length * 3,

      theme: "grid",

      head: [Object.keys(rows[0] ?? {})],

      body: rows.map((row) =>
        Object.values(row).map((value) =>
          typeof value === "number" ? currency.format(value) : value,
        ),
      ),

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

        document.text("CGE-AM - Controle de Patrimônio", 14, pageHeight - 7);

        document.text(
          `Página ${document.getNumberOfPages()}`,
          pageWidth - 14,
          pageHeight - 7,
          { align: "right" },
        );
      },
    });

    document.save(`relatorio-patrimonial-${fileDate()}.pdf`);
  }

  function handleExportXlsx() {
    const data = reportToExport();

    if (!data) {
      return;
    }

    const rows = buildExportRows(data.assets);

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 40 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventário");

    const summaryRows = [
      {
        Informação: "Quantidade de bens",

        Valor: data.summary.total,
      },

      {
        Informação: "Valor patrimonial total",

        Valor: data.summary.totalValue,
      },
    ];

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);

    summaryWorksheet["!cols"] = [{ wch: 30 }, { wch: 25 }];

    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Resumo");

    XLSX.writeFile(workbook, `relatorio-patrimonial-${fileDate()}.xlsx`);
  }

  const statusOptions = [
    { label: "Todas", value: ALL },
    ...(Object.keys(assetStatusMeta) as ReportAsset["status"][]).map(
      (value) => ({ label: assetStatusMeta[value].label, value }),
    ),
  ];

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        description="Consulte informações patrimoniais e exporte relatórios em PDF ou XLSX."
        title="Relatórios"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FunnelSimple aria-hidden="true" size={20} />
            <div>
              <h2 className="font-bold">Filtros do relatório</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Selecione o tipo de relatório e os filtros desejados.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {unitsError ? (
            <Alert title="Não foi possível carregar as unidades" tone="danger">
              {unitsError}
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField htmlFor="reportType" label="Tipo de relatório">
              <Select
                id="reportType"
                name="reportType"
                onValueChange={(value) => setReportType(value as ReportType)}
                options={Object.entries(reportTypeLabels).map(
                  ([value, label]) => ({ label, value }),
                )}
                value={reportType}
              />
            </FormField>

            <FormField htmlFor="departmentId" label="Departamento">
              <SearchableSelect
                disabled={loadingUnits}
                id="departmentId"
                name="departmentId"
                onValueChange={(value) => {
                  setDepartmentId(value === ALL ? "" : value);
                  setSectorId("");
                  setSubsectorId("");
                }}
                options={[
                  { label: "Todos os departamentos", value: ALL },
                  ...unitOptions(departments),
                ]}
                placeholder={loadingUnits ? "Carregando..." : undefined}
                value={departmentId || ALL}
              />
            </FormField>

            <FormField htmlFor="sectorId" label="Setor">
              <SearchableSelect
                disabled={loadingUnits || !departmentId}
                id="sectorId"
                name="sectorId"
                onValueChange={(value) => {
                  setSectorId(value === ALL ? "" : value);
                  setSubsectorId("");
                }}
                options={[
                  { label: "Todos os setores", value: ALL },
                  ...unitOptions(sectors),
                ]}
                placeholder="Selecione primeiro o departamento"
                value={sectorId || ALL}
              />
            </FormField>

            <FormField htmlFor="subsectorId" label="Subsetor">
              <SearchableSelect
                disabled={loadingUnits || !sectorId}
                id="subsectorId"
                name="subsectorId"
                onValueChange={(value) =>
                  setSubsectorId(value === ALL ? "" : value)
                }
                options={[
                  { label: "Todos os subsetores", value: ALL },
                  ...unitOptions(subsectors),
                ]}
                placeholder="Selecione primeiro o setor"
                value={subsectorId || ALL}
              />
            </FormField>

            <FormField htmlFor="status" label="Situação">
              <Select
                id="status"
                name="status"
                onValueChange={(value) => setStatus(value === ALL ? "" : value)}
                options={statusOptions}
                value={status || ALL}
              />
            </FormField>

            <FormField htmlFor="conservationStatus" label="Conservação">
              <Select
                id="conservationStatus"
                name="conservationStatus"
                onValueChange={(value) =>
                  setConservationStatus(value === ALL ? "" : value)
                }
                options={[
                  { label: "Todas", value: ALL },
                  ...conservationOptions,
                ]}
                value={conservationStatus || ALL}
              />
            </FormField>

            <FormField
              className="sm:col-span-2 lg:col-span-1"
              htmlFor="reportRange"
              label="Período de aquisição"
            >
              <DateRangePicker
                id="reportRange"
                onChange={(range) => {
                  setStartDate(range.from);
                  setEndDate(range.to);
                }}
                placeholder="Todas as datas"
                value={{ from: startDate, to: endDate }}
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loadingReport}
              onClick={() => {
                void handleGenerateReport();
              }}
              type="button"
              variant="primary"
            >
              {loadingReport ? "Gerando..." : "Gerar relatório"}
            </Button>
            <Button
              disabled={!report}
              onClick={handleExportPdf}
              type="button"
              variant="secondary"
            >
              <FilePdf aria-hidden="true" size={16} />
              Exportar PDF
            </Button>
            <Button
              disabled={!report}
              onClick={handleExportXlsx}
              type="button"
              variant="secondary"
            >
              <FileXls aria-hidden="true" size={16} />
              Exportar XLSX
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportError ? (
        <Alert title="Erro no relatório" tone="danger">
          {reportError}
        </Alert>
      ) : null}

      {loadingReport ? (
        <TableSkeleton
          ariaLabel="Carregando relatório"
          headers={[
            "Patrimônio",
            "Descrição",
            "Localização",
            "Situação",
            "Conservação",
            "Valor",
          ]}
        />
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent>
                <p className="text-2xl font-extrabold tabular-nums">
                  {report.summary.total}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Quantidade de bens
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-2xl font-extrabold tabular-nums">
                  {formatCurrency(report.summary.totalValue)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Valor patrimonial
                </p>
              </CardContent>
            </Card>
          </div>

          {report.assets.length === 0 ? (
            <EmptyState
              description="Ajuste os filtros e gere o relatório novamente."
              title="Nenhum bem encontrado"
            />
          ) : (
            <Card>
              <CardHeader>
                <div>
                  <h2 className="font-bold">Resultado</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {reportTypeLabels[reportType]}
                  </p>
                </div>
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <TableHead>Patrimônio</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Conservação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {report.assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>{asset.patrimonyNumber}</TableCell>
                      <TableCell>{asset.description}</TableCell>
                      <TableCell>
                        {asset.unitCode
                          ? `${asset.unitCode} - ${asset.unitName ?? ""}`
                          : "Não informado"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assetStatusMeta[asset.status].variant}>
                          {assetStatusMeta[asset.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {asset.conservationStatus ?? "Não informado"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(asset.acquisitionValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          description="Selecione os filtros e clique em Gerar relatório."
          title="Gere um relatório"
        />
      )}
    </div>
  );
}
