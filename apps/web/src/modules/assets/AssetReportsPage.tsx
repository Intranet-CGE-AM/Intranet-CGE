import {
  useEffect,
  useState,
} from "react";

import {
  ClipboardText,
  FileArrowDown,
  FunnelSimple,
} from "@phosphor-icons/react";

import { api } from "../../lib/api";

import * as XLSX from "xlsx"

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ReportType =
  | "inventory"
  | "sector"
  | "status"
  | "conservation"
  | "movements"
  | "financial";

type OrganizationUnit = {
  id: string;
  code: string;
  name: string;
  type:
    | "department"
    | "sector"
    | "subsector"
    | null;
  parentId:
    | string
    | null;
  active: boolean;
};

type ReportAsset = {
  id: string;
  patrimonyNumber: string;
  description: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status:
    | "active"
    | "maintenance"
    | "disposed";
  conservationStatus: string | null;
  acquisitionDate: string | null;
  acquisitionValue: string | null;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  unitType:
    | "department"
    | "sector"
    | "subsector"
    | null;
};

type AssetReportResponse = {
  assets: ReportAsset[];

  summary: {
    total: number;
    totalValue: number;
  };
};

function formatDateForSpreadsheet(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] = value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function AssetReportsPage() {
  const [reportType, setReportType] =
    useState<ReportType>("inventory");

  const [
  departmentId,
  setDepartmentId,
  ] = useState("");

  const [
    sectorId,
    setSectorId,
  ] = useState("");

  const [
    subsectorId,
    setSubsectorId,
  ] = useState("");

  const [units, setUnits] =
  useState<OrganizationUnit[]>([]);

  const [loadingUnits, setLoadingUnits] =
    useState(true);

  const [unitsError, setUnitsError] =
    useState<string | null>(null);

  const [status, setStatus] =
    useState("");

  const [
    conservationStatus,
    setConservationStatus,
  ] = useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [
    report,
    setReport,
  ] = useState<AssetReportResponse | null>(
    null,
  );

  const [
    loadingReport,
    setLoadingReport,
  ] = useState(false);

  const [
    reportError,
    setReportError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
  let cancelled = false;

  async function loadUnits() {
    try {
      setLoadingUnits(true);
      setUnitsError(null);

      const result =
        await api<
          | OrganizationUnit[]
          | {
              units: OrganizationUnit[];
            }
        >("/api/organization-units");

      if (cancelled) {
        return;
      }

      const loadedUnits =
        Array.isArray(result)
          ? result
          : result.units;

      setUnits(
        loadedUnits.filter(
          (unit) => unit.active,
        ),
      );
      } catch (error) {
      if (cancelled) {
        return;
      }

      console.error(
        "Erro ao carregar setores:",
        error,
      );

      setUnitsError(
        "Não foi possível carregar a estrutura organizacional.",
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

const departments =
  units.filter(
    (unit) =>
      unit.type === "department" &&
      unit.active,
  );

const sectors =
  units.filter(
    (unit) =>
      unit.type === "sector" &&
      unit.active &&
      (
        !departmentId ||
        unit.parentId === departmentId
      ),
  );

const subsectors =
  units.filter(
    (unit) =>
      unit.type === "subsector" &&
      unit.active &&
      (
        !sectorId ||
        unit.parentId === sectorId
      ),
  );

{unitsError ? (
  <p className="text-sm text-red-600">
    {unitsError}
  </p>
) : null}

async function handleGenerateReport() {
  try {
    setLoadingReport(true);
    setReportError(null);

    const params =
      new URLSearchParams();

    if (departmentId) {
      params.set(
        "departmentId",
        departmentId,
      );
    }

    if (sectorId) {
      params.set(
        "sectorId",
        sectorId,
      );
    }

    if (subsectorId) {
      params.set(
        "subsectorId",
        subsectorId,
      );
    }

    if (status) {
      params.set(
        "status",
        status,
      );
    }

    if (
      conservationStatus
    ) {
      params.set(
        "conservationStatus",
        conservationStatus,
      );
    }

    if (startDate) {
      params.set(
        "startDate",
        startDate,
      );
    }

    if (endDate) {
      params.set(
        "endDate",
        endDate,
      );
    }

    const queryString =
      params.toString();

    const result =
      await api<AssetReportResponse>(
        queryString
          ? `/api/assets/reports?${queryString}`
          : "/api/assets/reports",
      );

    setReport(result);
  } catch (error) {
    console.error(
      "Erro ao gerar relatório:",
      error,
    );

    setReportError(
      "Não foi possível gerar o relatório.",
    );
  } finally {
    setLoadingReport(false);
  }
}

function handleExportPdf() {
  if (!report) {
    setReportError(
      "Gere o relatório antes de exportar.",
    );

    return;
  }

  if (report.assets.length === 0) {
    setReportError(
      "Não há dados para exportar.",
    );

    return;
  }

  setReportError(null);

  const doc =
    new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const generatedAt =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        dateStyle: "short",
        timeStyle: "short",
      },
    ).format(
      new Date(),
    );

  doc.setFontSize(16);

  doc.text(
    "Relatório Patrimonial",
    14,
    15,
  );

  doc.setFontSize(9);

  doc.text(
    `Gerado em: ${generatedAt}`,
    14,
    21,
  );

  doc.text(
    `Quantidade de bens: ${report.summary.total}`,
    14,
    27,
  );

  doc.text(
    `Valor patrimonial: ${new Intl.NumberFormat(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      },
    ).format(
      report.summary.totalValue,
    )}`,
    14,
    33,
  );

  autoTable(
    doc,
    {
      startY: 39,

      head: [
        [
          "Patrimônio",
          "Descrição",
          "Marca",
          "Modelo",
          "Localização",
          "Situação",
          "Conservação",
          "Aquisição",
          "Valor",
        ],
      ],

      body:
        report.assets.map(
          (asset) => [
            asset.patrimonyNumber,

            asset.description,

            asset.brand ??
              "—",

            asset.model ??
              "—",

            asset.unitCode
              ? `${asset.unitCode} - ${asset.unitName ?? ""}`
              : "Não informado",

            asset.status === "active"
              ? "Ativo"
              : asset.status ===
                  "maintenance"
                ? "Em manutenção"
                : "Baixado",

            asset.conservationStatus ??
              "Não informado",

            asset.acquisitionDate
              ? formatDateForSpreadsheet(
                  asset.acquisitionDate,
                )
              : "—",

            asset.acquisitionValue
              ? new Intl.NumberFormat(
                  "pt-BR",
                  {
                    style:
                      "currency",
                    currency:
                      "BRL",
                  },
                ).format(
                  Number(
                    asset.acquisitionValue,
                  ),
                )
              : "—",
          ],
        ),

      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
      },

      headStyles: {
        fontSize: 7,
        fontStyle: "bold",
      },

      columnStyles: {
        0: {
          cellWidth: 22,
        },

        1: {
          cellWidth: 45,
        },

        2: {
          cellWidth: 24,
        },

        3: {
          cellWidth: 24,
        },

        4: {
          cellWidth: 55,
        },

        5: {
          cellWidth: 25,
        },

        6: {
          cellWidth: 25,
        },

        7: {
          cellWidth: 22,
        },

        8: {
          cellWidth: 28,
          halign: "right",
        },
      },

      margin: {
        left: 14,
        right: 14,
      },

      didDrawPage: () => {
        const pageNumber =
          doc.getNumberOfPages();

        doc.setFontSize(8);

        doc.text(
          `Página ${pageNumber}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 8,
          {
            align: "right",
          },
        );
      },
    },
  );

  const now =
    new Date();

  const date =
    [
      now.getFullYear(),
      String(
        now.getMonth() + 1,
      ).padStart(
        2,
        "0",
      ),
      String(
        now.getDate(),
      ).padStart(
        2,
        "0",
      ),
    ].join("-");

  doc.save(
    `relatorio-patrimonial-${date}.pdf`,
  );
}

  function handleExportXlsx() {
    if (!report) {
      setReportError(
        "Gere o relatório antes de exportar.",
      );

      return;
    }

    if (
      report.assets.length === 0
    ) {
      setReportError(
        "Não há dados para exportar.",
      );

      return;
    }

    setReportError(null);

    const rows =
      report.assets.map(
        (asset) => ({
          Patrimônio:
            asset.patrimonyNumber,

          Descrição:
            asset.description,

          Marca:
            asset.brand ?? "",

          Modelo:
            asset.model ?? "",

          "Número de série":
            asset.serialNumber ?? "",

          Localização:
            asset.unitCode
              ? `${asset.unitCode} - ${asset.unitName ?? ""}`
              : "Não informado",

          Situação:
            asset.status === "active"
              ? "Ativo"
              : asset.status ===
                  "maintenance"
                ? "Em manutenção"
                : "Baixado",

          Conservação:
            asset.conservationStatus ??
            "Não informado",

          "Data de aquisição":
            asset.acquisitionDate
              ? formatDateForSpreadsheet(
                  asset.acquisitionDate,
                )
              : "",

          "Valor de aquisição":
            asset.acquisitionValue
              ? Number(
                  asset.acquisitionValue,
                )
              : "",
        }),
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows,
      );

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

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Inventário",
    );

    const summaryRows = [
      {
        Informação:
          "Quantidade de bens",

        Valor:
          report.summary.total,
      },

      {
        Informação:
          "Valor patrimonial total",

        Valor:
          report.summary.totalValue,
      },
    ];

    const summaryWorksheet =
      XLSX.utils.json_to_sheet(
        summaryRows,
      );

    summaryWorksheet["!cols"] = [
      { wch: 30 },
      { wch: 25 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      summaryWorksheet,
      "Resumo",
    );

    const now =
      new Date();

    const date =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1,
        ).padStart(2, "0"),
        String(
          now.getDate(),
        ).padStart(2, "0"),
      ].join("-");

    XLSX.writeFile(
      workbook,
      `relatorio-patrimonial-${date}.xlsx`,
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Controle de Patrimônio
        </p>

        <h1 className="text-2xl font-semibold">
          Relatórios patrimoniais
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte informações patrimoniais e exporte
          relatórios em PDF ou XLSX.
        </p>
      </div>

      {/* FILTROS */}
      <div className="rounded-lg border bg-background p-6">
        <div className="mb-5 flex items-center gap-3">
          <FunnelSimple size={22} />

          <div>
            <h2 className="font-semibold">
              Filtros do relatório
            </h2>

            <p className="text-sm text-muted-foreground">
              Selecione o tipo de relatório e os
              filtros desejados.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* TIPO */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Tipo de relatório
            </span>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={reportType}
              onChange={(event) =>
                setReportType(
                  event.target.value as ReportType,
                )
              }
            >
              <option value="inventory">
                Inventário geral
              </option>

              <option value="sector">
                Bens por setor
              </option>

              <option value="status">
                Bens por situação
              </option>

              <option value="conservation">
                Estado de conservação
              </option>

              <option value="movements">
                Movimentações
              </option>

              <option value="financial">
                Relatório financeiro
              </option>
            </select>
          </label>

          {/* Departamento */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Departamento
            </span>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(
                  event.target.value,
                );

                setSectorId("");
                setSubsectorId("");
              }}
              disabled={loadingUnits}
            >
              <option value="">
                {loadingUnits
                  ? "Carregando..."
                  : "Todos os departamentos"}
              </option>

              {departments.map(
                (department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.code}
                    {" - "}
                    {department.name}
                  </option>
                ),
              )}
            </select>
          </label>

          {/* SETOR */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Setor
            </span>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={sectorId}
              onChange={(event) => {
                setSectorId(
                  event.target.value,
                );

                setSubsectorId("");
              }}
              disabled={
                loadingUnits ||
                !departmentId
              }
            >
              <option value="">
                {!departmentId
                  ? "Selecione primeiro o departamento"
                  : "Todos os setores"}
              </option>

              {sectors.map(
                (sector) => (
                  <option
                    key={sector.id}
                    value={sector.id}
                  >
                    {sector.code}
                    {" - "}
                    {sector.name}
                  </option>
                ),
              )}
            </select>
          </label>

        {/* SUBSETOR */}
        <label className="space-y-1">
          <span className="text-sm font-medium">
            Subsetor
          </span>

          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={subsectorId}
            onChange={(event) =>
              setSubsectorId(
                event.target.value,
              )
            }
            disabled={
              loadingUnits ||
              !sectorId
            }
          >
            <option value="">
              {!sectorId
                ? "Selecione primeiro o setor"
                : "Todos os subsetores"}
            </option>

            {subsectors.map(
              (subsector) => (
                <option
                  key={subsector.id}
                  value={subsector.id}
                >
                  {subsector.code}
                  {" - "}
                  {subsector.name}
                </option>
              ),
            )}
          </select>
        </label>

          {/* STATUS */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Situação
            </span>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="">
                Todas
              </option>

              <option value="active">
                Ativo
              </option>

              <option value="maintenance">
                Em manutenção
              </option>

              <option value="disposed">
                Baixado
              </option>
            </select>
          </label>

          {/* CONSERVAÇÃO */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Conservação
            </span>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={conservationStatus}
              onChange={(event) =>
                setConservationStatus(
                  event.target.value,
                )
              }
            >
              <option value="">
                Todas
              </option>

              <option value="Ótimo">
                Ótimo
              </option>

              <option value="Bom">
                Bom
              </option>

              <option value="Regular">
                Regular
              </option>

              <option value="Ruim">
                Ruim
              </option>

              <option value="Inservível">
                Inservível
              </option>
            </select>
          </label>

          {/* DATA INICIAL */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Data inicial
            </span>

            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
            />
          </label>

          {/* DATA FINAL */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Data final
            </span>

            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
            />
          </label>
        </div>

        {/* BOTÕES */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void handleGenerateReport();
            }}
            disabled={loadingReport}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
          >
            <ClipboardText size={18} />

            {loadingReport
              ? "Gerando..."
              : "Gerar relatório"}
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
          >
            <FileArrowDown size={18} />

            Exportar PDF
          </button>

          <button
            type="button"
            onClick={handleExportXlsx}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
          >
            <FileArrowDown size={18} />

            Exportar XLSX
          </button>
        </div>
      </div>

      {/* RESULTADO */}
      <div className="rounded-lg border bg-background p-6">
        <div className="mb-4">
          <h2 className="font-semibold">
            Resultado
          </h2>

          <p className="text-sm text-muted-foreground">
            Os dados do relatório serão exibidos aqui
            após a consulta.
          </p>
        </div>

        {reportError ? (
          <div className="rounded-md border p-4 text-sm text-red-600">
            {reportError}
          </div>
        ) : null}

        {loadingReport ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Carregando relatório...
          </div>
        ) : report ? (
          <>
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">
                  Quantidade de bens
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {report.summary.total}
                </p>
              </div>

              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">
                  Valor patrimonial
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {new Intl.NumberFormat(
                    "pt-BR",
                    {
                      style: "currency",
                      currency: "BRL",
                    },
                  ).format(
                    report.summary.totalValue,
                  )}
                </p>
              </div>
            </div>

            {report.assets.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum bem encontrado com os filtros informados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-3 font-medium">
                        Patrimônio
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Descrição
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Localização
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Situação
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Conservação
                      </th>

                      <th className="px-3 py-3 text-right font-medium">
                        Valor
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.assets.map(
                      (asset) => (
                        <tr
                          key={asset.id}
                          className="border-b"
                        >
                          <td className="px-3 py-3">
                            {asset.patrimonyNumber}
                          </td>

                          <td className="px-3 py-3">
                            {asset.description}
                          </td>

                          <td className="px-3 py-3">
                            {asset.unitCode
                              ? `${asset.unitCode} - ${asset.unitName ?? ""}`
                              : "Não informado"}
                          </td>

                          <td className="px-3 py-3">
                            {asset.status === "active"
                              ? "Ativo"
                              : asset.status === "maintenance"
                                ? "Em manutenção"
                                : "Baixado"}
                          </td>

                          <td className="px-3 py-3">
                            {asset.conservationStatus ??
                              "Não informado"}
                          </td>

                          <td className="px-3 py-3 text-right">
                            {asset.acquisitionValue
                              ? new Intl.NumberFormat(
                                  "pt-BR",
                                  {
                                    style:
                                      "currency",
                                    currency:
                                      "BRL",
                                  },
                                ).format(
                                  Number(
                                    asset.acquisitionValue,
                                  ),
                                )
                              : "—"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Selecione os filtros e clique em{" "}
            <strong>
              Gerar relatório
            </strong>.
          </div>
        )}
      </div>
    </div>
  );
}