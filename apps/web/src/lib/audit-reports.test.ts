import type {
  AuditDocumentMetrics,
  AuditDocumentSummary,
} from "@cge/contracts";
import type { jsPDF } from "jspdf";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ageInDays,
  brDate,
  buildAuditReport,
  formatHours,
  formatRate,
  manausDay,
  type AuditReportData,
} from "./audit-reports";

// Issued on 2003-03-11 at 12:00 in Manaus (UTC-4).
const NOW = new Date("2003-03-11T16:00:00Z");

/** Text drawn on each page, in drawing order (jsPDF streams are uncompressed). */
function pages(document: jsPDF) {
  const raw = new TextDecoder("windows-1252").decode(
    document.output("arraybuffer"),
  );
  return [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)]
    .map(([, stream]) =>
      [...stream!.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(([, text]) =>
        text!.replace(/\\(.)/g, "$1"),
      ),
    )
    .filter((texts) => texts.length > 0);
}

/** The strings drawn right after a label (the rest of its table row). */
function row(texts: string[], label: string, cells: number) {
  const index = texts.indexOf(label);
  expect(index, `"${label}" not found`).toBeGreaterThanOrEqual(0);
  return texts.slice(index + 1, index + 1 + cells);
}

const unit = (id: number) => `00000000-0000-4000-8000-00000000000${id}`;

// The worked scenario of the metrics e2e spec (2003-03-10, hand computed).
const metrics: AuditDocumentMetrics = {
  units: [
    { id: unit(1), name: "Equipe Alfa" },
    { id: unit(2), name: "Equipe Beta" },
  ],
  bottleneckRounds: 2,
  pending: [
    {
      unitId: unit(1),
      unitName: "Equipe Alfa",
      withReviewer: 4,
      withTeam: 1,
      oldestWithReviewerSince: new Date("2003-03-10T13:00:00Z"),
      oldestWithTeamSince: new Date("2003-03-11T14:00:00Z"),
    },
    {
      unitId: unit(2),
      unitName: "Equipe Beta",
      withReviewer: 1,
      withTeam: 0,
      oldestWithReviewerSince: new Date("2003-03-07T16:00:00Z"),
      oldestWithTeamSince: null,
    },
  ],
  period: {
    documentsSubmitted: 7,
    documentsApprovedNow: 1,
    documentsCancelled: 1,
    approvalEvents: 3,
    deliveryRate: 1 / 7,
  },
  perTeam: [
    {
      unitId: unit(1),
      unitName: "Equipe Alfa",
      documentsSubmitted: 6,
      documentsApprovedNow: 1,
      deliveryRate: 1 / 6,
    },
    {
      unitId: unit(2),
      unitName: "Equipe Beta",
      documentsSubmitted: 1,
      documentsApprovedNow: 0,
      deliveryRate: 0,
    },
  ],
  reviewerResponse: { count: 7, averageHours: 25 / 7, medianHours: 2 },
  teamResponse: { count: 3, averageHours: 8 / 3, medianHours: 3 },
  correctionRounds: {
    distribution: [
      { rounds: 0, documents: 4 },
      { rounds: 1, documents: 2 },
      { rounds: 2, documents: 1 },
    ],
    top: [
      {
        id: unit(5),
        title: "Relatório D5",
        unitName: "Equipe Alfa",
        rounds: 2,
        bottleneck: true,
      },
      {
        id: unit(3),
        title: "Relatório D3",
        unitName: "Equipe Alfa",
        rounds: 1,
        bottleneck: false,
      },
    ],
  },
  firstRead: { count: 2, averageHours: 0.75, medianHours: 0.75 },
  reads: { files: 9, readByReviewer: 2, rate: 2 / 9 },
};

const summary = (
  id: number,
  values: Partial<AuditDocumentSummary>,
): AuditDocumentSummary => ({
  id: unit(id),
  unitId: unit(1),
  unitName: "Equipe Alfa",
  title: `Relatório D${id}`,
  reference: null,
  category: null,
  status: "in_review",
  version: 1,
  fileCount: 1,
  latestFileId: unit(9),
  latestFileName: "relatorio.docx",
  latestFileKind: "docx",
  correctionRounds: 0,
  bottleneck: false,
  statusChangedAt: new Date("2003-03-10T13:00:00Z"),
  createdByAccountId: unit(8),
  createdByName: "Coordenação",
  createdAt: new Date("2003-03-10T13:00:00Z"),
  updatedAt: new Date("2003-03-10T13:00:00Z"),
  ...values,
});

const data: AuditReportData = {
  metrics,
  documents: [
    summary(1, {
      status: "approved",
      category: "Nota técnica",
      fileCount: 2,
      correctionRounds: 1,
      createdAt: new Date("2003-03-10T12:00:00Z"),
      statusChangedAt: new Date("2003-03-10T20:00:00Z"),
    }),
    summary(4, {
      status: "cancelled",
      createdAt: new Date("2003-03-10T15:00:00Z"),
      statusChangedAt: new Date("2003-03-10T16:00:00Z"),
    }),
    // 23:30 in Manaus is already the next day in UTC.
    summary(7, {
      unitId: unit(2),
      unitName: "Equipe Beta",
      createdAt: new Date("2003-03-11T03:30:00Z"),
      statusChangedAt: new Date("2003-03-11T03:30:00Z"),
    }),
  ],
  filters: { from: "2003-03-10", to: "2003-03-10", unitName: "Todas" },
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("formatting helpers (pt-BR)", () => {
  it("formats dates in Manaus", () => {
    expect(brDate("2003-03-10")).toBe("10/03/2003");
    expect(manausDay("2003-03-11T03:30:00Z")).toBe("2003-03-10");
    expect(manausDay("2003-03-11T04:00:00Z")).toBe("2003-03-11");
  });

  it("formats rates as integer percentages", () => {
    expect(formatRate(1 / 6)).toBe("17%");
    expect(formatRate(0.25)).toBe("25%");
    expect(formatRate(2 / 9)).toBe("22%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(null)).toBe("—");
  });

  it("formats durations in hours and minutes", () => {
    expect(formatHours(null)).toBe("—");
    expect(formatHours(0)).toBe("< 1 h");
    expect(formatHours(0.75)).toBe("< 1 h");
    expect(formatHours(1)).toBe("1 h");
    expect(formatHours(2)).toBe("2 h");
    expect(formatHours(2.5)).toBe("2 h 30 min");
    expect(formatHours(25 / 7)).toBe("3 h 34 min");
    expect(formatHours(8 / 3)).toBe("2 h 40 min");
    // 1 h 59.99 min rounds up to the next hour.
    expect(formatHours(1.9999)).toBe("2 h");
  });

  it("counts whole days since a date", () => {
    expect(ageInDays(null)).toBe("—");
    expect(ageInDays(new Date(NOW.getTime() - 36 * 3_600_000))).toBe("1 dia");
    expect(ageInDays(new Date(NOW.getTime() - 3 * 86_400_000))).toBe("3 dias");
  });
});

describe("audit PDFs", () => {
  it.each(["draft", "detailed", "analytic"] as const)(
    "%s report states the filters and the issue time in Manaus",
    (kind) => {
      const [first] = pages(buildAuditReport(kind, data));
      expect(first).toContain(
        "Filtros: período de 10/03/2003 a 10/03/2003 · Equipe: Todas",
      );
      expect(first).toContainEqual(
        expect.stringMatching(/^Emitido em: 11\/03\/2003,? 12:00$/),
      );
    },
  );

  it("draft carries the RASCUNHO watermark on every page", () => {
    const one = pages(buildAuditReport("draft", data));
    expect(one).toHaveLength(1);
    expect(one[0]).toContain("RASCUNHO");

    // Enough teams to spill the summary table onto more pages.
    const teams = Array.from({ length: 80 }, (_, index) => ({
      unitId: unit(1),
      unitName: `Equipe ${String(index + 1).padStart(2, "0")}`,
      documentsSubmitted: 1,
      documentsApprovedNow: 0,
      deliveryRate: 0,
    }));
    const many = pages(
      buildAuditReport("draft", {
        ...data,
        metrics: { ...metrics, perTeam: teams },
      }),
    );
    expect(many.length).toBeGreaterThan(1);
    for (const texts of many) expect(texts).toContain("RASCUNHO");
  });

  it("draft summarises each team and the period", () => {
    const [texts] = pages(buildAuditReport("draft", data));
    expect(row(texts!, "Equipe Alfa", 5)).toEqual(["6", "1", "17%", "4", "1"]);
    expect(row(texts!, "Equipe Beta", 5)).toEqual(["1", "0", "0%", "1", "0"]);
    expect(row(texts!, "Taxa de entrega", 1)).toEqual(["14%"]);
    expect(row(texts!, "Resposta média da Subcontroladoria", 1)).toEqual([
      "3 h 34 min",
    ]);
    expect(row(texts!, "Resposta média das equipes", 1)).toEqual([
      "2 h 40 min",
    ]);
  });

  it("detailed report is landscape with one row per document", () => {
    const document = buildAuditReport("detailed", data);
    expect(document.internal.pageSize.getWidth()).toBeGreaterThan(
      document.internal.pageSize.getHeight(),
    );
    const texts = pages(document).flat();
    expect(texts).toContain("Documentos enviados no período (3)");
    expect(row(texts, "Relatório D1", 6)).toEqual([
      "Nota técnica",
      "Aprovado",
      "2",
      "1",
      expect.stringMatching(/^10\/03\/2003,? 08:00$/),
      expect.stringMatching(/^Aprovado em 10\/03\/2003,? 16:00$/),
    ]);
    expect(row(texts, "Relatório D4", 6)).toEqual([
      "—",
      "Cancelado",
      "1",
      "0",
      expect.stringMatching(/^10\/03\/2003,? 11:00$/),
      expect.stringMatching(/^Cancelado em 10\/03\/2003,? 12:00$/),
    ]);
    expect(row(texts, "Relatório D7", 6)).toEqual([
      "—",
      "Em revisão",
      "1",
      "0",
      expect.stringMatching(/^10\/03\/2003,? 23:30$/),
      expect.stringMatching(/^Em revisão em 10\/03\/2003,? 23:30$/),
    ]);
    // Each row starts with its team.
    expect(texts[texts.indexOf("Relatório D7") - 1]).toBe("Equipe Beta");
  });

  it("analytic report has every section with pt-BR numbers", () => {
    const texts = pages(buildAuditReport("analytic", data)).flat();
    for (const section of [
      "Totais do período",
      "Tempos de resposta",
      "Ranking de rodadas de correção (gargalo a partir de 2)",
      "Entrega por equipe",
      "Pendências por equipe (hoje)",
    ])
      expect(texts).toContain(section);
    expect(row(texts, "Enviados", 1)).toEqual(["7"]);
    expect(row(texts, "Aprovados (situação atual)", 1)).toEqual(["1"]);
    expect(row(texts, "Cancelados", 1)).toEqual(["1"]);
    expect(row(texts, "Aprovações registradas", 1)).toEqual(["3"]);
    expect(row(texts, "Taxa de entrega", 1)).toEqual(["14%"]);
    expect(row(texts, "Versões lidas pela Subcontroladoria", 1)).toEqual([
      "2 de 9 (22%)",
    ]);
    expect(row(texts, "Subcontroladoria (análise)", 3)).toEqual([
      "7",
      "3 h 34 min",
      "2 h",
    ]);
    expect(row(texts, "Equipes (correção)", 3)).toEqual([
      "3",
      "2 h 40 min",
      "3 h",
    ]);
    expect(row(texts, "Primeira leitura", 3)).toEqual(["2", "< 1 h", "< 1 h"]);
    expect(row(texts, "Relatório D5", 3)).toEqual(["Equipe Alfa", "2", "Sim"]);
    expect(row(texts, "Relatório D3", 3)).toEqual(["Equipe Alfa", "1", "Não"]);
    // Delivery rows come before the pending rows for the same team.
    const alfa = texts.indexOf(
      "Equipe Alfa",
      texts.indexOf("Entrega por equipe"),
    );
    expect(texts.slice(alfa + 1, alfa + 4)).toEqual(["6", "1", "17%"]);
    const pendingAlfa = texts.indexOf(
      "Equipe Alfa",
      texts.indexOf("Pendências por equipe (hoje)"),
    );
    // With the reviewer since 2003-03-10 09:00 (27 h before the issue time),
    // with the team since 10:00 of the issue day.
    expect(texts.slice(pendingAlfa + 1, pendingAlfa + 5)).toEqual([
      "4",
      "1 dia",
      "1",
      "Hoje",
    ]);
    const pendingBeta = texts.indexOf("Equipe Beta", pendingAlfa);
    // Since 2003-03-07 12:00, exactly 4 days before the issue time.
    expect(texts.slice(pendingBeta + 1, pendingBeta + 5)).toEqual([
      "1",
      "4 dias",
      "0",
      "—",
    ]);
  });
});
