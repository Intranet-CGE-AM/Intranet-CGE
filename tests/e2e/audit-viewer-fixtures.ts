import { readFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { richDocx } from "./audit-ui-fixtures";

/** Solid-color PNG with an optional band, drawn in code (no binary blobs). */
function png(
  width: number,
  height: number,
  color: (x: number, y: number) => [number, number, number],
) {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      rows.set(color(x, y), y * (width * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A bar chart: four bars on a white background.
const chart = () =>
  png(480, 240, (x, y) => {
    const bar = Math.floor(x / 120);
    const top = [60, 120, 30, 90][bar] ?? 240;
    return x % 120 > 20 && x % 120 < 100 && y > top
      ? [47, 84, 150]
      : [255, 255, 255];
  });

const lorem =
  "A equipe examinou os contratos de tecnologia firmados entre 2024 e 2025, com foco na execução financeira, na fiscalização e na entrega dos serviços previstos. Os achados abaixo seguem a ordem de materialidade.";

/** Word's own defaults (Office 2013+), spelled out: the docx lib ships bare heading styles. */
const wordStyles = {
  default: {
    document: {
      run: { font: "Calibri", size: 22 },
      paragraph: {
        spacing: { after: 160, line: 259, lineRule: LineRuleType.AUTO },
      },
    },
    heading1: {
      run: { font: "Calibri Light", size: 32, color: "2F5496" },
      paragraph: { spacing: { before: 240, after: 0 }, keepNext: true },
    },
    heading2: {
      run: { font: "Calibri Light", size: 26, color: "2F5496" },
      paragraph: { spacing: { before: 40, after: 0 }, keepNext: true },
    },
    heading3: {
      run: { font: "Calibri Light", size: 24, color: "1F3763" },
      paragraph: { spacing: { before: 40, after: 0 }, keepNext: true },
    },
    title: { run: { font: "Calibri Light", size: 56 } },
    hyperlink: { run: { color: "0563C1", underline: {} } },
  },
};

/**
 * What a user gets from Word with the default template: header and footer
 * with page numbers, numbered headings, a bordered table with a shaded
 * header row, a chart image, a footnote and a link. Built with the docx lib.
 */
export async function wordDefaultsDocx() {
  const cell = (text: string, header = false) =>
    new TableCell({
      children: [
        new Paragraph({ children: [new TextRun({ text, bold: header })] }),
      ],
      shading: header
        ? { fill: "D9E2F3", type: ShadingType.CLEAR, color: "auto" }
        : undefined,
    });
  const heading = (text: string, level: 0 | 1) =>
    new Paragraph({
      text,
      heading: level ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
      numbering: { reference: "headings", level },
    });
  const file = new Document({
    title: "Relatório de auditoria",
    styles: wordStyles,
    numbering: {
      config: [
        {
          reference: "headings",
          levels: [0, 1].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: level ? "%1.%2." : "%1.",
            alignment: AlignmentType.LEFT,
          })),
        },
      ],
    },
    footnotes: {
      1: {
        children: [new Paragraph("Valores em reais, corrigidos pelo IPCA.")],
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1417, bottom: 1417, left: 1701, right: 1134 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Relatório de auditoria nº 12/2026",
                    color: "7F7F7F",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    size: 18,
                    children: [
                      "Página ",
                      PageNumber.CURRENT,
                      " de ",
                      PageNumber.TOTAL_PAGES,
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            text: "Relatório de auditoria",
            heading: HeadingLevel.TITLE,
          }),
          heading("Introdução", 0),
          new Paragraph({
            children: [
              new TextRun(lorem),
              new TextRun(" O montante auditado soma R$ 12,4 milhões"),
              new FootnoteReferenceRun(1),
              new TextRun("."),
            ],
          }),
          heading("Achados", 0),
          heading("Execução financeira", 1),
          new Paragraph(lorem),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: ["Achado", "Risco", "Valor"].map((text) =>
                  cell(text, true),
                ),
              }),
              ...[
                ["Pagamento sem ateste", "Alto", "R$ 1.200.000,00"],
                ["Aditivo acima de 25%", "Médio", "R$ 480.000,00"],
                ["Garantia vencida", "Baixo", "R$ 35.000,00"],
              ].map(
                (row) =>
                  new TableRow({ children: row.map((text) => cell(text)) }),
              ),
            ],
          }),
          heading("Evolução dos pagamentos", 1),
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: chart(),
                transformation: { width: 480, height: 240 },
                altText: {
                  name: "Gráfico",
                  description: "Pagamentos por trimestre",
                  title: "Gráfico",
                },
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun("Base legal no "),
              new ExternalHyperlink({
                link: "https://www.cge.am.gov.br/",
                children: [
                  new TextRun({ text: "portal da CGE", style: "Hyperlink" }),
                ],
              }),
              new TextRun("."),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(file);
}

/**
 * Institutional template: letterhead image in the header, serif headings in
 * the house color, Arial 12 justified with 1.5 spacing, ABNT margins.
 */
export async function institutionalDocx() {
  const letterhead = png(1200, 160, (x, y) =>
    y > 140 ? [0, 102, 51] : x < 160 ? [11, 61, 110] : [255, 255, 255],
  );
  const body = (text: string) =>
    new Paragraph({ text, alignment: AlignmentType.JUSTIFIED });
  const file = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 24, color: "262626" },
          paragraph: {
            spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 120 },
          },
        },
        heading1: {
          run: { font: "Georgia", size: 30, bold: true, color: "0B3D6E" },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        heading2: {
          run: { font: "Georgia", size: 26, bold: true, color: "006633" },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: 1701,
              bottom: 1134,
              left: 1701,
              right: 1134,
              header: 567,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: letterhead,
                    transformation: { width: 600, height: 80 },
                    altText: {
                      name: "Timbre",
                      description: "Timbre institucional",
                      title: "Timbre",
                    },
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "006633",
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: "Av. Exemplo, 100, Manaus/AM  ·  ",
                    size: 16,
                  }),
                  new TextRun({ size: 16, children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "NOTA TÉCNICA Nº 7/2026",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({ text: "1. Objeto", heading: HeadingLevel.HEADING_1 }),
          body(lorem),
          new Paragraph({
            text: "1.1 Contexto",
            heading: HeadingLevel.HEADING_2,
          }),
          body(`${lorem} ${lorem}`),
          body(lorem),
          new Paragraph({
            text: "2. Conclusão",
            heading: HeadingLevel.HEADING_1,
          }),
          body(`${lorem} ${lorem} ${lorem}`),
        ],
      },
    ],
  });
  return Packer.toBuffer(file);
}

/**
 * A real file saved by Microsoft Word 2007 (Letter paper, theme, headers,
 * footnotes part). Source: Apache POI test-data/document/sample.docx,
 * https://github.com/apache/poi, Apache License 2.0.
 */
export const wordSampleDocx = () =>
  readFileSync(new URL("./assets/word-sample.docx", import.meta.url));

/** The samples the viewer must render as a page. */
export const viewerSamples = async () => ({
  bare: richDocx({ styles: false }),
  "word-defaults": await wordDefaultsDocx(),
  institutional: await institutionalDocx(),
  "word-2007": wordSampleDocx(),
});
