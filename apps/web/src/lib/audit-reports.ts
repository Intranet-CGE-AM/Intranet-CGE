import type {
  AuditDocumentMetrics,
  AuditDocumentStatus,
  AuditDocumentSummary,
} from "@cge/contracts";
import { GState, jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type AuditReportKind = "draft" | "detailed" | "analytic";

export type AuditReportData = {
  metrics: AuditDocumentMetrics;
  /** Documents submitted in the period. */
  documents: AuditDocumentSummary[];
  filters: { from: string; to: string; unitName: string };
};

const statusLabels: Record<AuditDocumentStatus, string> = {
  in_review: "Em revisão",
  correction_requested: "Aguardando correção",
  approved: "Aprovado",
  cancelled: "Cancelado",
};

export const brDate = (value: string) => value.split("-").reverse().join("/");

export const manausDay = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Manaus" });

// The screen shows "—" for missing values. PDFs use "-" and "Não informado":
// jsPDF's standard fonts write "—" as WinAnsi byte 0x97, which text tools read
// differently depending on the platform.
const PDF_EMPTY = "-";

export function formatHours(hours: number | null, empty = "—") {
  if (hours === null) return empty;
  if (hours < 1) return "< 1 h";
  const minutes = Math.round(hours * 60);
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ""}`;
}

export function formatRate(rate: number | null, empty = "—") {
  return rate === null
    ? empty
    : `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

export function ageInDays(
  since: Date | string | null,
  now = Date.now(),
  empty = "—",
) {
  if (!since) return empty;
  const days = Math.floor((now - new Date(since).getTime()) / 86_400_000);
  return days <= 0 ? "Hoje" : days === 1 ? "1 dia" : `${days} dias`;
}

const dateTime = (value: Date | string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  });

const titles: Record<AuditReportKind, string> = {
  draft: "Resumo por equipe (rascunho)",
  detailed: "Relatório detalhado de documentos de auditoria",
  analytic: "Relatório analítico de documentos de auditoria",
};

const fileNames: Record<AuditReportKind, string> = {
  draft: "resumo-rascunho",
  detailed: "relatorio-detalhado",
  analytic: "relatorio-analitico",
};

/** Builds the PDF without saving it (the page saves; tests read it). */
export function buildAuditReport(kind: AuditReportKind, data: AuditReportData) {
  const document = new jsPDF({
    format: "a4",
    orientation: kind === "detailed" ? "landscape" : "portrait",
    unit: "mm",
  });
  const width = document.internal.pageSize.getWidth();
  const height = document.internal.pageSize.getHeight();
  const { filters, metrics } = data;

  document.setFont("helvetica", "bold");
  document.setFontSize(15);
  document.text(titles[kind], 14, 15);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text("Controladoria-Geral do Estado do Amazonas", 14, 21);
  document.text(`Emitido em: ${dateTime(new Date())}`, width - 14, 21, {
    align: "right",
  });
  document.setFontSize(8);
  document.text(
    `Filtros: período de ${brDate(filters.from)} a ${brDate(filters.to)} · Equipe: ${filters.unitName}`,
    14,
    28,
  );

  const footer = () => {
    document.setFontSize(7);
    document.setTextColor(0);
    document.text(
      "CGE-AM - Controle Interno - Documentos de auditoria",
      14,
      height - 7,
    );
    document.text(
      `Página ${document.getNumberOfPages()}`,
      width - 14,
      height - 7,
      { align: "right" },
    );
  };
  const table = (
    title: string,
    head: string[],
    body: (string | number)[][],
  ) => {
    const last = (document as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    const startY = last ? last.finalY + 10 : 36;
    document.setFont("helvetica", "bold");
    document.setFontSize(10);
    document.text(title, 14, startY - 2);
    document.setFont("helvetica", "normal");
    autoTable(document, {
      body: body.length
        ? body
        : [[`Sem registros`, ...head.slice(1).map(() => "")]],
      didDrawPage: footer,
      head: [head],
      headStyles: { fontStyle: "bold" },
      margin: { bottom: 14, left: 10, right: 10 },
      startY,
      styles: { cellPadding: 2, fontSize: 8, overflow: "linebreak" },
      theme: "grid",
    });
  };

  const deliveryRows = metrics.perTeam.map((team) => [
    team.unitName,
    team.documentsSubmitted,
    team.documentsApprovedNow,
    formatRate(team.deliveryRate, PDF_EMPTY),
  ]);
  const pendingRows = metrics.pending.map((row) => [
    row.unitName,
    row.withReviewer,
    ageInDays(row.oldestWithReviewerSince, Date.now(), PDF_EMPTY),
    row.withTeam,
    ageInDays(row.oldestWithTeamSince, Date.now(), PDF_EMPTY),
  ]);

  if (kind === "draft") {
    // One-page summary per team; the watermark marks it as a working copy.
    const teams = new Set([
      ...metrics.pending.map((row) => row.unitName),
      ...metrics.perTeam.map((row) => row.unitName),
    ]);
    const rows = [...teams]
      .sort((left, right) => left.localeCompare(right, "pt-BR"))
      .map((unitName) => {
        const pending = metrics.pending.find(
          (row) => row.unitName === unitName,
        );
        const delivery = metrics.perTeam.find(
          (row) => row.unitName === unitName,
        );
        return [
          unitName,
          delivery?.documentsSubmitted ?? 0,
          delivery?.documentsApprovedNow ?? 0,
          formatRate(delivery?.deliveryRate ?? null, PDF_EMPTY),
          pending?.withReviewer ?? 0,
          pending?.withTeam ?? 0,
        ];
      });
    table(
      "Resumo por equipe",
      [
        "Equipe",
        "Enviados",
        "Aprovados",
        "Entrega",
        "Com a Subcontroladoria",
        "Com a equipe",
      ],
      rows,
    );
    table(
      "Totais do período",
      ["Indicador", "Valor"],
      [
        ["Enviados", metrics.period.documentsSubmitted],
        ["Aprovados (situação atual)", metrics.period.documentsApprovedNow],
        ["Taxa de entrega", formatRate(metrics.period.deliveryRate, PDF_EMPTY)],
        [
          "Resposta média da Subcontroladoria",
          formatHours(metrics.reviewerResponse.averageHours, PDF_EMPTY),
        ],
        [
          "Resposta média das equipes",
          formatHours(metrics.teamResponse.averageHours, PDF_EMPTY),
        ],
      ],
    );
    // Drawn last on every page, translucent, so it never hides the table text.
    for (let page = 1; page <= document.getNumberOfPages(); page += 1) {
      document.setPage(page);
      document.setGState(new GState({ opacity: 0.12 }));
      document.setFont("helvetica", "bold");
      document.setFontSize(72);
      document.text("RASCUNHO", width / 2, height / 2 + 20, {
        align: "center",
        angle: 35,
      });
      document.setGState(new GState({ opacity: 1 }));
    }
  }

  if (kind === "detailed") {
    table(
      `Documentos enviados no período (${data.documents.length})`,
      [
        "Equipe",
        "Título",
        "Categoria",
        "Situação",
        "Versões",
        "Correções",
        "Enviado em",
        "Última movimentação",
      ],
      data.documents.map((item) => [
        item.unitName,
        item.title,
        item.category ?? "Não informado",
        statusLabels[item.status],
        item.fileCount,
        item.correctionRounds,
        dateTime(item.createdAt),
        `${statusLabels[item.status]} em ${dateTime(item.statusChangedAt)}`,
      ]),
    );
  }

  if (kind === "analytic") {
    table(
      "Totais do período",
      ["Indicador", "Valor"],
      [
        ["Enviados", metrics.period.documentsSubmitted],
        ["Aprovados (situação atual)", metrics.period.documentsApprovedNow],
        ["Cancelados", metrics.period.documentsCancelled],
        ["Aprovações registradas", metrics.period.approvalEvents],
        ["Taxa de entrega", formatRate(metrics.period.deliveryRate, PDF_EMPTY)],
        [
          "Versões lidas pela Subcontroladoria",
          `${metrics.reads.readByReviewer} de ${metrics.reads.files} (${formatRate(metrics.reads.rate, PDF_EMPTY)})`,
        ],
      ],
    );
    table(
      "Tempos de resposta",
      ["Etapa", "Medições", "Média", "Mediana"],
      (
        [
          ["Subcontroladoria (análise)", metrics.reviewerResponse],
          ["Equipes (correção)", metrics.teamResponse],
          ["Primeira leitura", metrics.firstRead],
        ] as const
      ).map(([label, stats]) => [
        label,
        stats.count,
        formatHours(stats.averageHours, PDF_EMPTY),
        formatHours(stats.medianHours, PDF_EMPTY),
      ]),
    );
    table(
      `Ranking de rodadas de correção (gargalo a partir de ${metrics.bottleneckRounds})`,
      ["Documento", "Equipe", "Rodadas", "Gargalo"],
      metrics.correctionRounds.top.map((row) => [
        row.title,
        row.unitName,
        row.rounds,
        row.bottleneck ? "Sim" : "Não",
      ]),
    );
    table(
      "Entrega por equipe",
      ["Equipe", "Enviados", "Aprovados", "Entrega"],
      deliveryRows,
    );
    table(
      "Pendências por equipe (hoje)",
      [
        "Equipe",
        "Com a Subcontroladoria",
        "Mais antigo",
        "Com a equipe",
        "Mais antigo",
      ],
      pendingRows,
    );
  }

  return document;
}

export function createAuditReport(
  kind: AuditReportKind,
  data: AuditReportData,
) {
  buildAuditReport(kind, data).save(
    `${fileNames[kind]}-${manausDay(new Date())}.pdf`,
  );
}
