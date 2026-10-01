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
type MovementReportItem = {
  id: string;
  assetId: string;
  patrimonyNumber: string | null;
  description: string | null;
  movementDate: string;
  notes: string | null;
  fromUnit: {
    id: string;
    code: string;
    name: string;
  } | null;
  toUnit: {
    id: string;
    code: string;
    name: string;
  } | null;
};
type MovementReportResponse = {
  movements: MovementReportItem[];
  summary: {
    total: number;
  };
};
function formatDateForSpreadsheet(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
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
  const [movementReport, setMovementReport] =
    useState<MovementReportResponse | null>(null);
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
    if (startDate && endDate && startDate > endDate) {
      setReportError("A data inicial deve ser anterior ou igual à data final.");
      return;
    }
    setLoadingReport(true);
    setReportError(null);
    setReport(null);
    setMovementReport(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (reportType === "movements") {
        const query = params.toString();
        const result = await api<MovementReportResponse>(
          `/api/assets/reports/movements${query ? `?${query}` : ""}`,
        );
        setMovementReport(result);
      } else {
        if (departmentId) params.set("departmentId", departmentId);
        if (sectorId) params.set("sectorId", sectorId);
        if (subsectorId) params.set("subsectorId", subsectorId);
        if (status) params.set("status", status);
        if (conservationStatus)
          params.set("conservationStatus", conservationStatus);
        const query = params.toString();
        const result = await api<AssetReportResponse>(
          `/api/assets/reports${query ? `?${query}` : ""}`,
        );
        setReport(result);
      }
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

  // Evita exportar dados de uma consulta anterior com filtros novos.
  useEffect(() => {
    setReport(null);
    setMovementReport(null);
    setReportError(null);
  }, [
    reportType,
    departmentId,
    sectorId,
    subsectorId,
    status,
    conservationStatus,
    startDate,
    endDate,
  ]);

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  // Subsector assets roll up into their parent sector.
  function sectorOf(asset: ReportAsset) {
    const unit = asset.unitId ? unitById.get(asset.unitId) : undefined;
    const sector =
      asset.unitType === "subsector" && unit?.parentId
        ? unitById.get(unit.parentId)
        : asset.unitType === "sector"
          ? unit
          : undefined;
    return sector
      ? { code: sector.code, name: sector.name }
      : { code: "SEM SETOR", name: "Sem setor informado" };
  }
  const assetsBySector = (() => {
    const groups = new Map<
      string,
      { code: string; name: string; total: number; totalValue: number }
    >();
    for (const asset of report?.assets ?? []) {
      const sector = sectorOf(asset);
      const key = `${sector.code}-${sector.name}`;
      const group = groups.get(key) ?? { ...sector, total: 0, totalValue: 0 };
      group.total += 1;
      group.totalValue += Number(asset.acquisitionValue ?? 0);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  })();
  const assetsByStatus = (
    Object.keys(assetStatusMeta) as ReportAsset["status"][]
  ).map((key) => ({
    key,
    label: assetStatusMeta[key].label,
    total: report?.assets.filter((asset) => asset.status === key).length ?? 0,
  }));
  const assetsByConservation = [
    ...(report?.assets ?? [])
      .reduce((groups, asset) => {
        const key = asset.conservationStatus ?? "Não informado";
        return groups.set(key, (groups.get(key) ?? 0) + 1);
      }, new Map<string, number>())
      .entries(),
  ].map(([label, total]) => ({ label, total }));
  function describeFilters() {
    const unitName = (id: string) => unitById.get(id)?.name ?? id;
    const parts = [
      ...(reportType === "movements"
        ? []
        : [
            departmentId && `Departamento: ${unitName(departmentId)}`,
            sectorId && `Setor: ${unitName(sectorId)}`,
            subsectorId && `Subsetor: ${unitName(subsectorId)}`,
            status &&
              `Situação: ${assetStatusMeta[status as ReportAsset["status"]]?.label ?? status}`,
            conservationStatus && `Conservação: ${conservationStatus}`,
          ]),
      startDate && `De: ${formatDateForSpreadsheet(startDate)}`,
      endDate && `Até: ${formatDateForSpreadsheet(endDate)}`,
    ].filter(Boolean);
    return parts.length ? parts.join(" | ") : "Todos os registros";
  }

  function exportRows(): Record<string, string | number>[] {
    if (reportType === "movements") {
      return (movementReport?.movements ?? []).map((item) => ({
        Data: formatDateForSpreadsheet(item.movementDate),
        Patrimônio: item.patrimonyNumber ?? "",
        Descrição: item.description ?? "",
        Origem: item.fromUnit
          ? `${item.fromUnit.code} - ${item.fromUnit.name}`
          : "Não informado",
        Destino: item.toUnit
          ? `${item.toUnit.code} - ${item.toUnit.name}`
          : "Não informado",
        Observação: item.notes ?? "",
      }));
    }
    if (!report) return [];
    if (reportType === "sector" || reportType === "financial") {
      return assetsBySector.map((item) => ({
        Setor: `${item.code} - ${item.name}`,
        Quantidade: item.total,
        "Valor patrimonial": item.totalValue,
      }));
    }
    if (reportType === "status") {
      return assetsByStatus.map((item) => ({
        Situação: item.label,
        Quantidade: item.total,
      }));
    }
    if (reportType === "conservation") {
      return assetsByConservation.map((item) => ({
        Conservação: item.label,
        Quantidade: item.total,
      }));
    }
    return buildExportRows(report.assets);
  }

  function rowsToExport() {
    const rows = exportRows();
    if (!rows.length || (!report && !movementReport)) {
      setReportError("Gere um relatório com dados antes de exportar.");
      return null;
    }
    setReportError(null);
    return rows;
  }

  function handleExportPdf() {
    const rows = rowsToExport();
    if (!rows) return;
    const document = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    document.setFont("helvetica", "bold");
    document.setFontSize(14);
    document.text(
      `RELATÓRIO PATRIMONIAL - ${reportTypeLabels[reportType].toUpperCase()}`,
      14,
      15,
    );
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text("Controladoria-Geral do Estado do Amazonas", 14, 22);
    document.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, 14, 28);
    const summary =
      reportType === "movements"
        ? `Total de movimentações: ${movementReport?.summary.total ?? 0}`
        : `Total de bens: ${report?.summary.total ?? 0} | Valor total: ${currency.format(report?.summary.totalValue ?? 0)}`;
    document.text(summary, 14, 34);
    const filtersText: string[] = document.splitTextToSize(
      `Filtros: ${describeFilters()}`,
      pageWidth - 28,
    );
    document.setFontSize(8);
    document.text(filtersText, 14, 41);
    const headers = Object.keys(rows[0] ?? {});
    autoTable(document, {
      startY: 46 + filtersText.length * 3,
      theme: "grid",
      head: [headers],
      body: rows.map((row) =>
        headers.map((key) => {
          const value = row[key];
          return typeof value === "number" &&
            key.toLowerCase().includes("valor")
            ? currency.format(value)
            : String(value ?? "");
        }),
      ),
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: { fontStyle: "bold" },
      margin: { left: 14, right: 14, bottom: 14 },
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
    document.save(`relatorio-${reportType}-${fileDate()}.pdf`);
  }

  function handleExportXlsx() {
    const rows = rowsToExport();
    if (!rows) return;
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] ?? {});
    worksheet["!cols"] = headers.map((key) => ({
      wch: Math.min(60, Math.max(18, key.length + 2)),
    }));
    rows.forEach((row, index) =>
      headers.forEach((key, column) => {
        if (
          typeof row[key] === "number" &&
          key.toLowerCase().includes("valor")
        ) {
          const cell =
            worksheet[XLSX.utils.encode_cell({ r: index + 1, c: column })];
          if (cell) cell.z = '"R$" #,##0.00';
        }
      }),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    const summaryRows: { Informação: string; Valor: string | number }[] = [
      { Informação: "Tipo de relatório", Valor: reportTypeLabels[reportType] },
      { Informação: "Filtros", Valor: describeFilters() },
      { Informação: "Emitido em", Valor: new Date().toLocaleString("pt-BR") },
    ];
    if (reportType === "movements") {
      summaryRows.push({
        Informação: "Quantidade de movimentações",
        Valor: movementReport?.summary.total ?? 0,
      });
    } else if (report) {
      summaryRows.push(
        { Informação: "Quantidade de bens", Valor: report.summary.total },
        {
          Informação: "Valor patrimonial total",
          Valor: report.summary.totalValue,
        },
      );
    }
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
    summaryWorksheet["!cols"] = [{ wch: 32 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Resumo");
    XLSX.writeFile(workbook, `relatorio-${reportType}-${fileDate()}.xlsx`);
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
                disabled={loadingReport}
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
                disabled={
                  loadingReport || loadingUnits || reportType === "movements"
                }
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
                disabled={
                  loadingReport ||
                  loadingUnits ||
                  !departmentId ||
                  reportType === "movements"
                }
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
                disabled={
                  loadingReport ||
                  loadingUnits ||
                  !sectorId ||
                  reportType === "movements"
                }
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
                disabled={loadingReport || reportType === "movements"}
                id="status"
                name="status"
                onValueChange={(value) => setStatus(value === ALL ? "" : value)}
                options={statusOptions}
                value={status || ALL}
              />
            </FormField>
            <FormField htmlFor="conservationStatus" label="Conservação">
              <Select
                disabled={loadingReport || reportType === "movements"}
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
              label={
                reportType === "movements"
                  ? "Período de movimentação"
                  : "Período de aquisição"
              }
            >
              <DateRangePicker
                id="reportRange"
                onChange={(range) => {
                  if (loadingReport) return;
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
              disabled={loadingReport || !(report || movementReport)}
              onClick={handleExportPdf}
              type="button"
              variant="secondary"
            >
              <FilePdf aria-hidden="true" size={16} />
              Exportar PDF
            </Button>
            <Button
              disabled={loadingReport || !(report || movementReport)}
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
        <Card>
          <CardContent>Carregando relatório...</CardContent>
        </Card>
      ) : reportType === "movements" && movementReport ? (
        <Card>
          <CardHeader>
            <h2 className="font-bold">
              Movimentações — {movementReport.summary.total} registros
            </h2>
          </CardHeader>
          {movementReport.movements.length === 0 ? (
            <EmptyState
              title="Nenhuma movimentação encontrada"
              description="Ajuste o período e gere o relatório novamente."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  {[
                    "Data",
                    "Patrimônio",
                    "Descrição",
                    "Origem",
                    "Destino",
                    "Observação",
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movementReport.movements.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {formatDateForSpreadsheet(item.movementDate)}
                    </TableCell>
                    <TableCell>{item.patrimonyNumber ?? "—"}</TableCell>
                    <TableCell>{item.description ?? "—"}</TableCell>
                    <TableCell>
                      {item.fromUnit
                        ? `${item.fromUnit.code} - ${item.fromUnit.name}`
                        : "Não informado"}
                    </TableCell>
                    <TableCell>
                      {item.toUnit
                        ? `${item.toUnit.code} - ${item.toUnit.name}`
                        : "Não informado"}
                    </TableCell>
                    <TableCell>{item.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent>
                <p className="text-xs text-[var(--text-muted)]">
                  Quantidade de bens
                </p>
                <p className="text-2xl font-bold">{report.summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-[var(--text-muted)]">
                  Valor patrimonial
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(report.summary.totalValue)}
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
              {reportType === "inventory" ? (
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
                          <Badge
                            variant={assetStatusMeta[asset.status].variant}
                          >
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
              ) : null}
              {reportType === "sector" ? (
                <Table>
                  <thead>
                    <tr>
                      <TableHead>Setor</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">
                        Valor patrimonial
                      </TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsBySector.map((sector) => (
                      <TableRow key={`${sector.code}-${sector.name}`}>
                        <TableCell>
                          {sector.code} - {sector.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {sector.total}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(sector.totalValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              ) : null}
              {reportType === "status" ? (
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  {assetsByStatus.map((item) => (
                    <Card key={item.key}>
                      <CardContent>
                        <p className="text-xs text-[var(--text-muted)]">
                          {item.label}
                        </p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums">
                          {item.total}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          bens patrimoniais
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              ) : null}
              {reportType === "conservation" ? (
                <Table>
                  <thead>
                    <tr>
                      <TableHead>Estado de conservação</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsByConservation.map((item) => (
                      <TableRow key={item.label}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right">
                          {item.total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              ) : null}
              {reportType === "financial" ? (
                <>
                  <CardContent className="grid gap-4 sm:grid-cols-3">
                    {[
                      ["Bens considerados", String(report.summary.total)],
                      [
                        "Valor patrimonial",
                        formatCurrency(report.summary.totalValue),
                      ],
                      [
                        "Valor médio",
                        formatCurrency(
                          report.summary.total > 0
                            ? report.summary.totalValue / report.summary.total
                            : 0,
                        ),
                      ],
                    ].map(([label, value]) => (
                      <Card key={label}>
                        <CardContent>
                          <p className="text-xs text-[var(--text-muted)]">
                            {label}
                          </p>
                          <p className="mt-1 text-2xl font-extrabold tabular-nums">
                            {value}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                  <Table>
                    <thead>
                      <tr>
                        <TableHead>Setor</TableHead>
                        <TableHead className="text-right">Bens</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {assetsBySector.map((sector) => (
                        <TableRow key={`${sector.code}-${sector.name}`}>
                          <TableCell>
                            {sector.code} - {sector.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {sector.total}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(sector.totalValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </>
              ) : null}
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
