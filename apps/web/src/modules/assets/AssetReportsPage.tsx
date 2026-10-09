import { useEffect, useState } from "react";
import { FilePdf, FileXls, FunnelSimple } from "@phosphor-icons/react";
import { useAuth } from "../../auth";
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

  status:
  | "active"
  | "maintenance"
  | "disposed";

  unitId: string | null;
  responsiblePersonId:
  | string
  | null;

  usageDate:
  | string
  | null;

  documentNumber:
  | string
  | null;

  documentDate:
  | string
  | null;

  commitmentNumber:
  | string
  | null;

  conservationStatus:
  | string
  | null;

  renavam:
  | string
  | null;

  chassis:
  | string
  | null;

  acquisitionDate:
  | string
  | null;

  acquisitionValue:
  | string
  | null;

  notes:
  | string
  | null;

  createdAt:
  string;

  updatedAt:
  string;

  unitCode:
  | string
  | null;

  unitName:
  | string
  | null;

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

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
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

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function formatDateForSpreadsheet(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

const reportTypeLabels: Record<
  ReportType,
  string
> = {
  inventory:
    "Inventário geral",

  sector:
    "Bens por setor",

  status:
    "Bens por situação",

  conservation:
    "Estado de conservação",

  movements:
    "Movimentações",

  financial:
    "Relatório financeiro",
};

const currency =
  new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  );

function fileDate() {
  const now =
    new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1,
    ).padStart(2, "0"),
    String(
      now.getDate(),
    ).padStart(2, "0"),
  ].join("-");
}


function getUnitLabel(
  units: OrganizationUnit[],
  id: string,
) {
  if (!id) {
    return "Todos";
  }

  const unit =
    units.find(
      (item) =>
        item.id === id,
    );

  if (!unit) {
    return "Todos";
  }

  return `${unit.code} - ${unit.name}`;
}

async function imageUrlToDataUrl(
  url: string,
) {
  const response =
    await fetch(url);

  const blob =
    await response.blob();

  return new Promise<string>(
    (
      resolve,
      reject,
    ) => {
      const reader =
        new FileReader();

      reader.onloadend =
        () => {
          if (
            typeof reader.result ===
            "string"
          ) {
            resolve(
              reader.result,
            );
          } else {
            reject(
              new Error(
                "Não foi possível carregar o brasão.",
              ),
            );
          }
        };

      reader.onerror =
        () =>
          reject(
            new Error(
              "Não foi possível carregar o brasão.",
            ),
          );

      reader.readAsDataURL(
        blob,
      );
    },
  );
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

    const [
      page,
      setPage,
    ] =
      useState(1);

    const [
      pageSize,
      setPageSize,
    ] =
      useState(10);

    const [
      movementPage,
      setMovementPage,
    ] = useState(1);

    const [
      movementPageSize,
      setMovementPageSize,
    ] = useState(20);  

    const [
  exportingPdf,
  setExportingPdf,
] =
  useState(false);

const [
  exportingXlsx,
  setExportingXlsx,
] =
  useState(false);



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

  const { user } =
  useAuth();

  const generatedBy =
    user?.person.displayName ??
    "Usuário não identificado";

  function describeFilters() {
    const filters: string[] =
      [];

    if (departmentId) {
      filters.push(
        `Departamento: ${departmentLabel}`,
      );
    }

    if (sectorId) {
      filters.push(
        `Setor: ${sectorLabel}`,
      );
    }

    if (subsectorId) {
      filters.push(
        `Subsetor: ${subsectorLabel}`,
      );
    }

    if (
      reportType !==
      "movements"
    ) {
      if (status) {
        filters.push(
          `Situação: ${statusLabel}`,
        );
      }

      if (
        conservationStatus
      ) {
        filters.push(
          `Conservação: ${conservationLabel}`,
        );
      }
    }

    if (
      startDate ||
      endDate
    ) {
      filters.push(
        `Período: ${periodLabel}`,
      );
    }

    return filters.length > 0
      ? filters.join(" | ")
      : "Nenhum filtro aplicado";
  }

    function rowsToExport():
    | Record<
      string,
      string | number
    >[]
    | null {
    if (
      reportType ===
      "movements"
    ) {
      if (
        !movementReport ||
        movementReport
          .movements.length === 0
      ) {
        setReportError(
          "Não há movimentações para exportar.",
        );

        return null;
      }

      return movementReport
        .movements.map(
          (movement) => ({
            Data:
              formatDateForSpreadsheet(
                movement.movementDate,
              ),

            Tombo:
              movement.patrimonyNumber ??
              "",

            Descrição:
              movement.description ??
              "",

            Origem:
              movement.fromUnit
                ? `${movement.fromUnit.code} - ${movement.fromUnit.name}`
                : "Não informado",

            Destino:
              movement.toUnit
                ? `${movement.toUnit.code} - ${movement.toUnit.name}`
                : "Não informado",

            Observação:
              movement.notes ??
              "",
          }),
        );
    }

    if (
      !report ||
      report.assets.length === 0
    ) {
      setReportError(
        "Não há dados para exportar.",
      );

      return null;
    }

    if (
      reportType ===
      "inventory"
    ) {
      


    }

    if (
      reportType ===
      "sector"
    ) {
      return assetsBySector.map(
        (sector) => ({
          Setor:
            `${sector.code} - ${sector.name}`,

          Quantidade:
            sector.total,

          Valor:
            sector.totalValue,
        }),
      );
    }

    if (
      reportType ===
      "status"
    ) {
      return assetsByStatus.map(
        (item) => ({
          Situação:
            item.label,

          Quantidade:
            item.total,
        }),
      );
    }

    if (
      reportType ===
      "conservation"
    ) {
      return assetsByConservation.map(
        (item) => ({
          Conservação:
            item.label,

          Quantidade:
            item.total,
        }),
      );
    }

    if (
      reportType ===
      "financial"
    ) {
      return assetsBySector.map(
        (sector) => ({
          Setor:
            `${sector.code} - ${sector.name}`,

          Bens:
            sector.total,

          Valor:
            sector.totalValue,
        }),
      );
    }

    return null;
  }

  function inventoryRowsToExport(
  assets: ReportAsset[],
): Record<
  string,
  string | number
>[] {
  return assets.map(
    (asset) => {
      const location =
        getAssetLocation(
          asset,
        );

      return {
        Tombo:
          asset.patrimonyNumber,

        Descrição:
          asset.description,

        Marca:
          asset.brand ?? "",

        Modelo:
          asset.model ?? "",

        "Nº Série":
          asset.serialNumber ??
          "",

        Departamento:
          location.department,

        Setor:
          location.sector,

        Subsetor:
          location.subsector,

        Situação:
          assetStatusMeta[
            asset.status
          ].label,

        Conservação:
          asset.conservationStatus ??
          "Não informado",

        "Data de uso":
          asset.usageDate
            ? formatDateForSpreadsheet(
                asset.usageDate,
              )
            : "",

        Documento:
          asset.documentNumber ??
          "",

        "Data do documento":
          asset.documentDate
            ? formatDateForSpreadsheet(
                asset.documentDate,
              )
            : "",

        Empenho:
          asset.commitmentNumber ??
          "",

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
            : 0,

        RENAVAM:
          asset.renavam ?? "",

        Chassi:
          asset.chassis ?? "",

        Observações:
          asset.notes ?? "",
      };
    },
  );
}


    async function handleGenerateReport(
      targetPage = 1,
      targetPageSize =
        reportType === "movements"
          ? movementPageSize
          : pageSize,
    ) {
      if (
        startDate &&
        endDate &&
        startDate > endDate
      ) {
        setReportError(
          "A data inicial deve ser anterior ou igual à data final.",
        );

        return;
      }

      setLoadingReport(true);
      setReportError(null);

      try {
        const params =
          new URLSearchParams();

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

        /*
        * MOVIMENTAÇÕES
        */
        if (
          reportType ===
          "movements"
        ) {
          params.set(
            "page",
            String(targetPage),
          );

          params.set(
            "pageSize",
            String(
              targetPageSize,
            ),
          );

          const query =
            params.toString();

          const result =
            await api<MovementReportResponse>(
              `/api/assets/reports/movements${
                query
                  ? `?${query}`
                  : ""
              }`,
            );

          setReport(null);

          setMovementReport(
            result,
          );

          setMovementPage(
            result.pagination.page,
          );

          setMovementPageSize(
            result.pagination.pageSize,
          );

          return;
        }

        /*
        * DEMAIS RELATÓRIOS
        */

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

        /*
        * INVENTÁRIO:
        * usa paginação.
        */
        if (
          reportType ===
          "inventory"
        ) {
          params.set(
            "page",
            String(targetPage),
          );

          params.set(
            "pageSize",
            String(
              targetPageSize,
            ),
          );
        } else {
          /*
          * SETOR
          * SITUAÇÃO
          * CONSERVAÇÃO
          * FINANCEIRO
          *
          * Precisam de todos os
          * registros para os cálculos.
          */
          params.set(
            "all",
            "true",
          );
        }

        const query =
          params.toString();

        const result =
          await api<AssetReportResponse>(
            `/api/assets/reports${
              query
                ? `?${query}`
                : ""
            }`,
          );

        setMovementReport(null);

        setReport(
          result,
        );

        if (
          reportType ===
          "inventory"
        ) {
          setPage(
            result.pagination.page,
          );

          setPageSize(
            result.pagination.pageSize,
          );
        }
      } catch (cause) {
        console.error(
          "Erro ao gerar relatório:",
          cause,
        );

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
    setPage(1);
    setMovementPage(1);

    setReport(null);

    setMovementReport(null,);
    setReportError(null,);
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

  const unitById =
    new Map(
      units.map(
        (unit) => [
          unit.id,
          unit,
        ],
      ),
    );

  function getAssetLocation(
  asset: ReportAsset,
  ) {
  if (!asset.unitId) {
    return {
      department: "Não informado",
      sector: "Não informado",
      subsector: "Não informado",
    };
  }

  const currentUnit =
    unitById.get(
      asset.unitId,
    );

  if (!currentUnit) {
    return {
      department: "Não informado",
      sector: "Não informado",
      subsector: "Não informado",
    };
  }

  let department:
    OrganizationUnit | undefined;

  let sector:
    OrganizationUnit | undefined;

  let subsector:
    OrganizationUnit | undefined;

  if (
    currentUnit.type ===
    "department"
  ) {
    department =
      currentUnit;
  }

  if (
    currentUnit.type ===
    "sector"
  ) {
    sector =
      currentUnit;

    department =
      currentUnit.parentId
        ? unitById.get(
            currentUnit.parentId,
          )
        : undefined;
  }

  if (
    currentUnit.type ===
    "subsector"
  ) {
    subsector =
      currentUnit;

    sector =
      currentUnit.parentId
        ? unitById.get(
            currentUnit.parentId,
          )
        : undefined;

    department =
      sector?.parentId
        ? unitById.get(
            sector.parentId,
          )
        : undefined;
  }

  return {
    department:
      department
        ? `${department.code} - ${department.name}`
        : "Não informado",

    sector:
      sector
        ? `${sector.code} - ${sector.name}`
        : "Não informado",

    subsector:
      subsector
        ? `${subsector.code} - ${subsector.name}`
        : "Não informado",
    };
  }

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


  const departmentLabel =
    getUnitLabel(
      units,
      departmentId,
    );

  const sectorLabel =
    getUnitLabel(
      units,
      sectorId,
    );

  const subsectorLabel =
    getUnitLabel(
      units,
      subsectorId,
    );

  const statusLabel =
    status === "active"
      ? "Ativo"
      : status === "maintenance"
        ? "Em manutenção"
        : status === "disposed"
          ? "Baixado"
          : "Todas";

  const conservationLabel =
    conservationStatus ||
    "Todas";

  const periodLabel =
    startDate || endDate
      ? `${startDate
        ? formatDateForSpreadsheet(
          startDate,
        )
        : "Início"} até ${endDate
        ? formatDateForSpreadsheet(
          endDate,
        )
        : "Hoje"
      }`
      : "Todos";

      async function loadFullReportForExport() {
        if (
          reportType !==
          "inventory"
        ) {
          return report;
        }

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

        params.set(
          "all",
          "true",
        );

        const query =
          params.toString();

        return api<AssetReportResponse>(
          `/api/assets/reports?${query}`,
        );
      }


      async function loadFullMovementReportForExport() {
      const params =
        new URLSearchParams();

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

      params.set(
        "all",
        "true",
      );

      const query =
        params.toString();

      return api<MovementReportResponse>(
        `/api/assets/reports/movements?${query}`,
      );
}


function movementRowsToExport(
  movements: MovementReportItem[],
): Record<
  string,
  string | number
>[] {
  return movements.map(
    (item) => ({
      Data:
        formatDateForSpreadsheet(
          item.movementDate,
        ),

      Tombo:
        item.patrimonyNumber ??
        "",

      Descrição:
        item.description ??
        "",

      Origem:
        item.fromUnit
          ? `${item.fromUnit.code} - ${item.fromUnit.name}`
          : "Não informado",

      Destino:
        item.toUnit
          ? `${item.toUnit.code} - ${item.toUnit.name}`
          : "Não informado",

      Observação:
        item.notes ?? "",
    }),
  );
}


async function handleExportPdf() {
  try {
    setExportingPdf(true);

    setReportError(null);

let rows:
  Record<
    string,
    string | number
  >[];

if (
  reportType ===
  "inventory"
) {
  const fullReport =
    await loadFullReportForExport();

  if (
    !fullReport ||
    fullReport.assets.length ===
      0
  ) {
    setReportError(
      "Não há dados para exportar.",
    );

    return;
  }

  rows =
    inventoryRowsToExport(
      fullReport.assets,
    );
    } else if (
      reportType ===
      "movements"
    ) {
      const fullMovementReport =
        await loadFullMovementReportForExport();

      if (
        !fullMovementReport ||
        fullMovementReport
          .movements.length === 0
      ) {
        setReportError(
          "Não há movimentações para exportar.",
        );

        return;
      }

      rows =
        movementRowsToExport(
          fullMovementReport
            .movements,
        );
    } else {
      const currentRows =
        rowsToExport();

      if (!currentRows) {
        return;
      }

      rows =
        currentRows;
    }

    setReportError(null);

    const document =
      new jsPDF({
        orientation: "landscape",
        unit: "mm",

        format:
          reportType === "inventory"
            ? "a4"
            : "a4",
      });
    
    const logo =
    await imageUrlToDataUrl(
      "/brasao_gov.png",
    );

    const pageWidth =
      document.internal
        .pageSize.getWidth();

    const pageHeight =
      document.internal
        .pageSize.getHeight();

      /* BRASÃO */

      document.addImage(
        logo,
        "PNG",
        10,
        5,
        18,
        20,
      );

          /* CABEÇALHO CENTRALIZADO */

          document.setFont(
            "helvetica",
            "bold",
          );

          document.setFontSize(12);

          document.text(
            "CONTROLADORIA-GERAL DO ESTADO DO AMAZONAS",
            pageWidth / 2,
            12,
            {
              align: "center",
            },
          );

          document.setFontSize(14);

          document.text(
            "RELATÓRIO PATRIMONIAL",
            pageWidth / 2,
            19,
            {
              align: "center",
            },
          );

          document.setFontSize(10);

          document.text(
            reportTypeLabels[
              reportType
            ].toUpperCase(),
            pageWidth / 2,
            25,
            {
              align: "center",
            },
          );

          document.setFont(
            "helvetica",
            "normal",
          );

          document.setFontSize(8);

          document.text(
            `Emitido em: ${new Date().toLocaleString(
              "pt-BR",
            )}`,
            pageWidth / 2,
            31,
            {
              align: "center",
            },
          );

    document.setFont(
      "helvetica",
      "normal",
    );

    document.setFontSize(
      9,
    );

    const summary =
    reportType ===
    "movements"
      ? `Total de movimentações: ${
          movementReport
            ?.summary.total ??
          0
        }`
      : `Total de bens: ${
          report?.summary
            .total ?? 0
        } | Valor total: ${currency.format(
          report?.summary
            .totalValue ?? 0,
        )}`;

   document.setFontSize(9);

    document.text(
      summary,
      pageWidth / 2,
      39,
      {
        align: "center",
      },
    );

    const filtersText:
      string[] =
      document.splitTextToSize(
        `Filtros: ${describeFilters()}`,
        pageWidth - 60,
      );

    document.setFontSize(8);

    filtersText.forEach(
      (
        line,
        index,
      ) => {
        document.text(
          line,
          pageWidth / 2,
          45 + index * 4,
          {
            align:
              "center",
          },
        );
      },
    );

    const headers =
      Object.keys(
        rows[0] ?? {},
      );

    const headerBottomY =
      50 +
      filtersText.length * 4;

    document.setDrawColor(
      180,
    );

    document.setLineWidth(
      0.2,
    );

    document.line(
      14,
      headerBottomY,
      pageWidth - 14,
      headerBottomY,
    );

    const pdfHeaderLabels:
      Record<string, string> = {
        Patrimônio: "Tombo",
        Descrição: "Descrição",
        Marca: "Marca",
        Modelo: "Modelo",
        "Número de série": "Nº Série",
        Departamento: "Depto.",
        Setor: "Setor",
        Subsetor: "Subsetor",
        Situação: "Situação",
        Conservação: "Conserv.",
        "Data de uso": "Dt. Uso",
        Documento: "Doc.",
        "Data do documento": "Dt. Doc.",
        Empenho: "Empenho",
        "Data de aquisição": "Dt. Aquisição",
        "Valor de aquisição": "Valor",
        RENAVAM: "RENAVAM",
        Chassi: "Chassi",
        Observações: "Observações",
      };

    const displayHeaders =
      headers.map(
        (header) =>
          pdfHeaderLabels[
            header
          ] ?? header,
      );

    autoTable(
      document,
      {
        startY: headerBottomY + 4,

        theme: "grid",

        head: [
          displayHeaders,
        ],

        body:
          rows.map(
            (row) =>
              headers.map(
                (key) => {
                  const value =
                    row[key];

                  return typeof value ===
                    "number" &&
                    key
                      .toLowerCase()
                      .includes(
                        "valor",
                      )
                    ? currency.format(
                      value,
                    )
                    : String(
                      value ?? "",
                    );
                },
              ),
          ),

          styles: {
            fontSize:
              reportType === "inventory"
                ? 6
                : 9,

            cellPadding:
              reportType === "inventory"
                ? 1.2
                : 2,

            overflow: "linebreak",
            valign: "top",
            minCellHeight: 5,
          },

          headStyles: {
            fontStyle: "bold",

            fontSize:
              reportType === "inventory"
                ? 5.5
                : 7,

            cellPadding:
              reportType === "inventory"
                ? 1
                : 2,
          },

          columnStyles:
  reportType === "inventory"
    ? {
        0: { cellWidth: 11 }, // Tombo
        1: { cellWidth: 30 }, // Descrição
        2: { cellWidth: 12 }, // Marca
        3: { cellWidth: 15 }, // Modelo
        4: { cellWidth: 13 }, // Nº Série

        5: { cellWidth: 18 }, // Departamento
        6: { cellWidth: 16 }, // Setor
        7: { cellWidth: 15 }, // Subsetor

        8: { cellWidth: 15 }, // Situação
        9: { cellWidth: 10 }, // Conservação

        10: { cellWidth: 13 }, // Dt Uso
        11: { cellWidth: 12 }, // Documento
        12: { cellWidth: 13 }, // Dt Doc
        13: { cellWidth: 12 }, // Empenho
        14: { cellWidth: 13 }, // Dt aquisição
        15: { cellWidth: 15 }, // Valor

        16: { cellWidth: 12 }, // RENAVAM
        17: { cellWidth: 12 }, // Chassi
        18: { cellWidth: 23 }, // Observações
      }
    : undefined,

        margin: {
          left: 7,
          right: 7,
          bottom: 10,
        },

        

    
        didDrawPage: () => {
          document.setFont(
            "helvetica",
            "normal",
          );

          document.setFontSize(7);

          document.text(
            "CGE-AM - Controle de Patrimônio",
            14,
            pageHeight - 7,
          );

          document.text(
            `Gerado por: ${generatedBy}`,
            pageWidth / 2,
            pageHeight - 7,
            {
              align: "center",
            },
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
        }
    );

    document.save(
      `relatorio-${reportType}-${fileDate()}.pdf`,
    );

 } catch (cause) {
    console.error(
      "Erro ao exportar PDF:",
      cause,
    );

    setReportError(
      "Não foi possível exportar o PDF.",
    );
  } finally {
    setExportingPdf(false);
  }
}
  

async function handleExportXlsx() {
  try {
    setExportingXlsx(true);

    setReportError(null);

let rows:
  Record<
    string,
    string | number
  >[];

if (
  reportType ===
  "inventory"
) {
  const fullReport =
    await loadFullReportForExport();

  if (
    !fullReport ||
    fullReport.assets.length ===
      0
  ) {
    setReportError(
      "Não há dados para exportar.",
    );

    return;
  }

      rows =
        inventoryRowsToExport(
          fullReport.assets,
        );
    } else if (
      reportType ===
      "movements"
    ) {
      const fullMovementReport =
        await loadFullMovementReportForExport();

      if (
        !fullMovementReport ||
        fullMovementReport
          .movements.length === 0
      ) {
        setReportError(
          "Não há movimentações para exportar.",
        );

        return;
      }

      rows =
        movementRowsToExport(
          fullMovementReport
            .movements,
        );
    } else {
      const currentRows =
        rowsToExport();

      if (!currentRows) {
        return;
      }

      rows =
        currentRows;
    }

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows,
      );

    const headers =
      Object.keys(
        rows[0] ?? {},
      );

    worksheet["!cols"] =
      headers.map(
        (key) => ({
          wch:
            Math.min(
              60,
              Math.max(
                18,
                key.length + 2,
              ),
            ),
        }),
      );

    rows.forEach(
      (
        row,
        index,
      ) =>
        headers.forEach(
          (
            key,
            column,
          ) => {
            if (
              typeof row[key] ===
                "number" &&
              key
                .toLowerCase()
                .includes(
                  "valor",
                )
            ) {
              const cell =
                worksheet[
                  XLSX.utils.encode_cell(
                    {
                      r:
                        index +
                        1,

                      c:
                        column,
                    },
                  )
                ];

              if (cell) {
                cell.z =
                  '"R$" #,##0.00';
              }
            }
          },
        ),
    );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Relatório",
    );

    const summaryRows: {
      Informação:
        string;

      Valor:
        string |
        number;
    }[] = [
      {
        Informação:
          "Tipo de relatório",

        Valor:
          reportTypeLabels[
            reportType
          ],
      },

      {
        Informação:
          "Filtros",

        Valor:
          describeFilters(),
      },

      {
        Informação:
          "Emitido em",

        Valor:
          new Date().toLocaleString(
            "pt-BR",
          ),
      },
    ];

    if (
      reportType ===
      "movements"
    ) {
      summaryRows.push({
        Informação:
          "Quantidade de movimentações",

        Valor:
          movementReport
            ?.summary.total ??
          0,
      });
    } else if (report) {
      summaryRows.push(
        {
          Informação:
            "Quantidade de bens",

          Valor:
            report.summary
              .total,
        },

        {
          Informação:
            "Valor patrimonial total",

          Valor:
            report.summary
              .totalValue,
        },
      );
    }

    const summaryWorksheet =
      XLSX.utils.json_to_sheet(
        summaryRows,
      );

    summaryWorksheet[
      "!cols"
    ] = [
      {
        wch: 32,
      },

      {
        wch: 80,
      },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      summaryWorksheet,
      "Resumo",
    );

    XLSX.writeFile(
      workbook,
      `relatorio-${reportType}-${fileDate()}.xlsx`,
    );
  } catch (cause) {
    console.error(
      "Erro ao exportar XLSX:",
      cause,
    );

    setReportError(
      "Não foi possível exportar o XLSX.",
    );
  } finally {
    setExportingXlsx(false);
  }
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
              disabled={
                loadingReport ||
                exportingPdf ||
                exportingXlsx ||
                !(report || movementReport)
              }
              onClick={() => {
                void handleExportPdf();
              }}
              type="button"
              variant="secondary"
            >
              <FilePdf
                aria-hidden="true"
                size={16}
              />

              {exportingPdf
                ? "Exportando PDF..."
                : "Exportar PDF"}
            </Button>
            
            <Button
              disabled={
                loadingReport ||
                exportingPdf ||
                exportingXlsx ||
                !(report || movementReport)
              }
              onClick={() => {
                void handleExportXlsx();
              }}
              type="button"
              variant="secondary"
            >
              <FileXls
                aria-hidden="true"
                size={16}
              />

              {exportingXlsx
                ? "Exportando XLSX..."
                : "Exportar XLSX"}
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
      ) :
      
      reportType === "movements" && movementReport ? (
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
            <>
              <Table>
              <thead>
                <tr>
                  {[
                    "Data",
                    "Tombo",
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
         
            </>

          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
  <div className="text-sm text-[var(--text-muted)]">
    {movementReport.pagination.total >
    0 ? (
      <>
        Mostrando{" "}
        <strong>
          {(movementReport.pagination.page -
            1) *
            movementReport.pagination.pageSize +
            1}
        </strong>

        {" – "}

        <strong>
          {Math.min(
            movementReport.pagination.page *
              movementReport.pagination.pageSize,

            movementReport.pagination.total,
          )}
        </strong>

        {" de "}

        <strong>
          {
            movementReport.pagination
              .total
          }
        </strong>

        {" movimentações"}
      </>
    ) : (
      "Nenhuma movimentação encontrada"
    )}
  </div>

  <div className="flex flex-wrap items-center gap-3">
    <select
      className="h-9 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      value={String(
        movementReport.pagination
          .pageSize,
      )}
      onChange={(event) => {
        const nextPageSize =
          Number(
            event.target.value,
          );

        setMovementPageSize(
          nextPageSize,
        );

        void handleGenerateReport(
          1,
          nextPageSize,
        );
      }}
    >
      <option value="10">
        10 por página
      </option>

      <option value="20">
        20 por página
      </option>

      <option value="50">
        50 por página
      </option>
    </select>

    <span className="min-w-[100px] text-center text-sm text-[var(--text-muted)]">
      Página{" "}
      {
        movementReport.pagination
          .page
      }{" "}
      de{" "}
      {
        movementReport.pagination
          .totalPages
      }
    </span>

    <Button
      type="button"
      variant="secondary"
      disabled={
        loadingReport ||
        movementReport.pagination
          .page <= 1
      }
      onClick={() => {
        void handleGenerateReport(
          movementReport.pagination
            .page - 1,

          movementReport.pagination
            .pageSize,
        );
      }}
    >
      Anterior
    </Button>

    <Button
      type="button"
      variant="secondary"
      disabled={
        loadingReport ||
        movementReport.pagination
          .page >=
          movementReport.pagination
            .totalPages
      }
      onClick={() => {
        void handleGenerateReport(
          movementReport.pagination
            .page + 1,

          movementReport.pagination
            .pageSize,
        );
      }}
    >
      Próxima
    </Button>
  </div>
</div>
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
              {reportType ===
                "inventory" ? (
               <div className="max-h-[70vh] overflow-auto ">
                <Table className="min-w-[2800px]">
                   <thead className="sticky top-0 z-40 bg-white shadow-sm">
                      <tr>
                        <TableHead className="sticky left-0 z-50 min-w-[120px] bg-white">
                          Tombo
                        </TableHead>

                        <TableHead className="sticky left-[120px] z-40 min-w-[280px] bg-white">
                          Descrição
                        </TableHead>

                        <TableHead>
                          Marca
                        </TableHead>

                        <TableHead>
                          Modelo
                        </TableHead>

                        <TableHead>
                          Nº de série
                        </TableHead>

                        <TableHead className="min-w-[220px]">
                          Departamento
                        </TableHead>

                        <TableHead className="min-w-[220px]">
                          Setor
                        </TableHead>

                        <TableHead className="min-w-[220px]">
                          Subsetor
                        </TableHead>

                        <TableHead>
                          Situação
                        </TableHead>

                        <TableHead>
                          Conservação
                        </TableHead>

                        <TableHead>
                          Data de Uso
                        </TableHead>

                        <TableHead>
                          Documento
                        </TableHead>

                        <TableHead>
                          Data de documento
                        </TableHead>

                        <TableHead>
                          Empenho
                        </TableHead>

                        <TableHead>
                          Data de aquisição
                        </TableHead>

                        <TableHead className="text-right">
                          Valor de aquisição
                        </TableHead>

                        <TableHead>
                          RENAVAM
                        </TableHead>

                        <TableHead>
                          Chassi
                        </TableHead>

                        <TableHead className="min-w-[280px]">
                          Observações
                        </TableHead>
                      </tr>
                    </thead>

                    <tbody>
                    {report.assets.map(
                      (asset) => {
                        const location =
                          getAssetLocation(
                            asset,
                          );

                        return (
                          <TableRow
                            key={asset.id}>
                          <TableCell className="sticky left-0 z-30 min-w-[120px] bg-white font-medium">
                            {asset.patrimonyNumber}
                          </TableCell>

                            <TableCell className="sticky left-[120px] z-20 min-w-[280px] bg-white whitespace-normal shadow-[4px_0_6px_-6px_rgba(0,0,0,0.35)]">
                              {asset.description}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {asset.brand ?? "—"}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {asset.model ?? "—"}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {asset.serialNumber ??
                                "—"}
                            </TableCell>

                            <TableCell className="min-w-[220px] whitespace-normal">
                              {location.department}
                            </TableCell>

                           <TableCell className="min-w-[220px] whitespace-normal">
                              {location.sector}
                            </TableCell>

                            <TableCell className="min-w-[220px] whitespace-normal">
                              {location.subsector}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  assetStatusMeta[
                                    asset.status
                                  ].variant
                                }
                              >
                                {
                                  assetStatusMeta[
                                    asset.status
                                  ].label
                                }
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {asset.conservationStatus ??
                                "Não informado"}
                            </TableCell>

                            <TableCell>
                              {asset.usageDate
                                ? formatDateForSpreadsheet(
                                    asset.usageDate,
                                  )
                                : "—"}
                            </TableCell>

                            <TableCell>
                              {asset.documentNumber ??
                                "—"}
                            </TableCell>

                            <TableCell>
                              {asset.documentDate
                                ? formatDateForSpreadsheet(
                                    asset.documentDate,
                                  )
                                : "—"}
                            </TableCell>

                            <TableCell>
                              {asset.commitmentNumber ??
                                "—"}
                            </TableCell>

                            <TableCell>
                              {asset.acquisitionDate
                                ? formatDateForSpreadsheet(
                                    asset.acquisitionDate,
                                  )
                                : "—"}
                            </TableCell>

                            <TableCell className="text-right">
                              {formatCurrency(
                                asset.acquisitionValue,
                              )}
                            </TableCell>

                            <TableCell>
                              {asset.renavam ?? "—"}
                            </TableCell>

                            <TableCell>
                              {asset.chassis ?? "—"}
                            </TableCell>

                            <TableCell className="min-w-[280px] whitespace-normal">
                              {asset.notes ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      },
                    )}
                  </tbody>
                    
                  </Table>

                  
                </div>
                
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

              {reportType ===
                "inventory" &&
              report ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                  <select
                    className="h-9 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    value={String(
                      report.pagination.pageSize,
                    )}
                    onChange={(event) => {
                      const nextPageSize =
                        Number(
                          event.target.value,
                        );

                      setPageSize(
                        nextPageSize,
                      );

                      void handleGenerateReport(
                        1,
                        nextPageSize,
                      );
                    }}
                  >
                    <option value="10">
                      10 por página
                    </option>

                    <option value="20">
                      20 por página
                    </option>

                    <option value="50">
                      50 por página
                    </option>
                  </select>

                  <span className="min-w-[100px] text-center text-sm text-[var(--text-muted)]">
                    Página{" "}
                    {
                      report.pagination
                        .page
                    }{" "}
                    de{" "}
                    {
                      report.pagination
                        .totalPages
                    }
                  </span>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      loadingReport ||
                      report.pagination
                        .page <= 1
                    }
                    onClick={() => {
                      void handleGenerateReport(
                        report.pagination
                          .page - 1,
                        report.pagination
                          .pageSize,
                      );
                    }}
                  >
                    Anterior
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      loadingReport ||
                      report.pagination
                        .page >=
                        report.pagination
                          .totalPages
                    }
                    onClick={() => {
                      void handleGenerateReport(
                        report.pagination
                          .page + 1,
                        report.pagination
                          .pageSize,
                      );
                    }}
                  >
                    Próxima
                  </Button>
                </div>

                  <div className="text-sm text-[var(--text-muted)]">
                  Mostrando{" "}
                  <strong>
                    {(report.pagination.page -
                      1) *
                      report.pagination.pageSize +
                      1}
                  </strong>
                  {" – "}
                  <strong>
                    {Math.min(
                      report.pagination.page *
                        report.pagination.pageSize,
                      report.pagination.total,
                    )}
                  </strong>
                  {" de "}
                  <strong>
                    {
                      report.pagination
                        .total
                    }
                  </strong>{" "}
                  bens
                </div>

                </div>
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
