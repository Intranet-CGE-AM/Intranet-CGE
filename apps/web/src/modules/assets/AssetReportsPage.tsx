import { useState } from "react";

import {
  ClipboardText,
  FileArrowDown,
  FunnelSimple,
} from "@phosphor-icons/react";

type ReportType =
  | "inventory"
  | "sector"
  | "status"
  | "conservation"
  | "movements"
  | "financial";

export function AssetReportsPage() {
  const [reportType, setReportType] =
    useState<ReportType>("inventory");

  const [unitId, setUnitId] =
    useState("");

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

  function handleGenerateReport() {
    console.log({
      reportType,
      unitId,
      status,
      conservationStatus,
      startDate,
      endDate,
    });
  }

  function handleExportPdf() {
    console.log("Exportar PDF");
  }

  function handleExportXml() {
    console.log("Exportar XML");
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
          relatórios em PDF ou XML.
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

          {/* SETOR */}
          <label className="space-y-1">
            <span className="text-sm font-medium">
              Setor
            </span>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={unitId}
              onChange={(event) =>
                setUnitId(event.target.value)
              }
            >
              <option value="">
                Todos os setores
              </option>
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
            onClick={handleGenerateReport}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
          >
            <ClipboardText size={18} />

            Gerar relatório
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
            onClick={handleExportXml}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
          >
            <FileArrowDown size={18} />

            Exportar XML
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

        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Selecione os filtros e clique em{" "}
          <strong>Gerar relatório</strong>.
        </div>
      </div>
    </div>
  );
}