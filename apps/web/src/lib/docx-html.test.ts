import type { JSONContent } from "@tiptap/react";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  type ParagraphChild,
} from "docx";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { docxToHtml, editorToDocx } from "./docx-html";

// 1x1 transparent PNG.
const PIXEL_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PIXEL = Uint8Array.from(atob(PIXEL_BASE64), (char) => char.charCodeAt(0));
const PIXEL_SRC = `data:image/png;base64,${PIXEL_BASE64}`;
const image = (alt: string) =>
  new RegExp(`<img (?=[^>]*src="${PIXEL_SRC}")(?=[^>]*alt="${alt}")[^>]*>`);

/** Minimal zip reader (central directory + deflate-raw), enough for .docx. */
async function unzip(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = buffer.byteLength - 22;
  while (view.getUint32(end, true) !== 0x06054b50) end -= 1;
  let offset = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  for (let index = 0; index < view.getUint16(end + 10, true); index += 1) {
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      new Uint8Array(buffer, offset + 46, nameLength),
    );
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const data = new Uint8Array(buffer, start, size);
    const bytes =
      method === 0
        ? data
        : new Uint8Array(
            await new Response(
              new Blob([data])
                .stream()
                .pipeThrough(new DecompressionStream("deflate-raw")),
            ).arrayBuffer(),
          );
    files.set(name, new TextDecoder().decode(bytes));
    offset +=
      46 +
      nameLength +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  return files;
}

/** Word file built with the same library a user's Word file would resemble. */
function wordFile(children: (Paragraph | Table)[]) {
  const levels = (format: "bullet" | "decimal") =>
    [0, 1].map((level) => ({
      level,
      format: format === "bullet" ? LevelFormat.BULLET : LevelFormat.DECIMAL,
      text: format === "bullet" ? "•" : `%${level + 1}.`,
    }));
  return Packer.toBlob(
    new Document({
      numbering: {
        config: [
          { reference: "bullets", levels: levels("bullet") },
          { reference: "numbers", levels: levels("decimal") },
        ],
      },
      sections: [{ children }],
    }),
  ).then((blob) => blob.arrayBuffer());
}

const text = (value: string, marks: string[] = []): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const paragraph = (
  content: JSONContent[],
  attrs: Record<string, unknown> = {},
): JSONContent => ({ type: "paragraph", attrs, content });
const item = (...content: JSONContent[]): JSONContent => ({
  type: "listItem",
  content,
});
const link = (href: string, value: string): JSONContent => ({
  type: "text",
  text: value,
  marks: [{ type: "link", attrs: { href } }],
});

/** Editor document -> .docx -> its parts and the HTML the editor reloads. */
async function saved(content: JSONContent[]) {
  const blob = await editorToDocx({ type: "doc", content }, "Relatório");
  const buffer = await blob.arrayBuffer();
  const parts = await unzip(buffer);
  return {
    parts,
    xml: parts.get("word/document.xml") ?? "",
    rels: parts.get("word/_rels/document.xml.rels") ?? "",
    html: await docxToHtml(buffer),
  };
}

beforeAll(() => {
  // Node has no <img>; the browser decodes data URIs before the file is built.
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 1;
      naturalHeight = 1;
      decode() {
        return Promise.resolve();
      }
    },
  );
});

describe("Word -> editor", () => {
  it("keeps headings 1 to 3", async () => {
    const html = await docxToHtml(
      await wordFile(
        (
          [
            [HeadingLevel.HEADING_1, "Achados"],
            [HeadingLevel.HEADING_2, "Contexto"],
            [HeadingLevel.HEADING_3, "Detalhe"],
          ] as const
        ).map(([heading, value]) => new Paragraph({ heading, text: value })),
      ),
    );
    expect(html).toContain("<h1>Achados</h1>");
    expect(html).toContain("<h2>Contexto</h2>");
    expect(html).toContain("<h3>Detalhe</h3>");
  });

  it("keeps bold, italic and underline around the exact runs", async () => {
    const html = await docxToHtml(
      await wordFile([
        new Paragraph({
          children: [
            new TextRun("Texto "),
            new TextRun({ text: "forte", bold: true }),
            new TextRun(" e "),
            new TextRun({ text: "inclinado", italics: true }),
            new TextRun(" e "),
            new TextRun({ text: "sublinhado", underline: {} }),
            new TextRun(" e "),
            new TextRun({
              text: "tudo",
              bold: true,
              italics: true,
              underline: {},
            }),
          ],
        }),
      ]),
    );
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain("<em>inclinado</em>");
    expect(html).toContain("<u>sublinhado</u>");
    expect(html).toMatch(
      /<(strong|em|u)><(strong|em|u)><(strong|em|u)>tudo<\/\3><\/\2><\/\1>/,
    );
    expect(html).toContain("<p>Texto <strong>");
  });

  it("keeps nested bullet and ordered lists with their levels", async () => {
    const html = await docxToHtml(
      await wordFile([
        new Paragraph({
          text: "Primeiro",
          numbering: { reference: "bullets", level: 0 },
        }),
        new Paragraph({
          text: "Primeiro passo",
          numbering: { reference: "numbers", level: 1 },
        }),
        new Paragraph({
          text: "Segundo passo",
          numbering: { reference: "numbers", level: 1 },
        }),
        new Paragraph({
          text: "Segundo",
          numbering: { reference: "bullets", level: 0 },
        }),
      ]),
    );
    expect(html).toBe(
      "<ul><li>Primeiro<ol><li>Primeiro passo</li><li>Segundo passo</li></ol></li><li>Segundo</li></ul>",
    );
  });

  it("keeps tables with the header row", async () => {
    const cell = (value: string) =>
      new TableCell({ children: [new Paragraph(value)] });
    const html = await docxToHtml(
      await wordFile([
        new Table({
          rows: [
            new TableRow({
              tableHeader: true,
              children: ["Achado", "Risco", "Prazo"].map(cell),
            }),
            new TableRow({ children: ["Falha", "Alto", "30 dias"].map(cell) }),
          ],
        }),
      ]),
    );
    expect(html).toContain(
      "<thead><tr><th><p>Achado</p></th><th><p>Risco</p></th><th><p>Prazo</p></th></tr></thead>",
    );
    expect(html).toContain(
      "<tr><td><p>Falha</p></td><td><p>Alto</p></td><td><p>30 dias</p></td></tr>",
    );
  });

  it("keeps images inline with their alternative text", async () => {
    const html = await docxToHtml(
      await wordFile([
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: PIXEL,
              transformation: { width: 1, height: 1 },
              altText: { name: "Gráfico", description: "Gráfico de achados" },
            }),
          ],
        }),
      ]),
    );
    expect(html).toMatch(image("Gráfico de achados"));
  });

  it("keeps center and justify alignment", async () => {
    const html = await docxToHtml(
      await wordFile([
        new Paragraph({ text: "Centro", alignment: AlignmentType.CENTER }),
        new Paragraph({
          text: "Justificado",
          alignment: AlignmentType.JUSTIFIED,
        }),
        new Paragraph({
          text: "Título central",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph("Normal"),
      ]),
    );
    expect(html).toContain('<p style="text-align: center">Centro</p>');
    expect(html).toContain('<p style="text-align: justify">Justificado</p>');
    expect(html).toContain(
      '<h1 style="text-align: center">Título central</h1>',
    );
    expect(html).toContain("<p>Normal</p>");
  });

  it("keeps http, https and mailto links", async () => {
    const hyperlink = (href: string, value: string): ParagraphChild =>
      new ExternalHyperlink({ link: href, children: [new TextRun(value)] });
    const html = await docxToHtml(
      await wordFile([
        new Paragraph({
          children: [
            hyperlink("https://www.cge.am.gov.br/", "portal"),
            hyperlink("http://intranet.local/", "intranet"),
            hyperlink("mailto:sci@cge.am.gov.br", "e-mail"),
          ],
        }),
      ]),
    );
    expect(html).toContain('<a href="https://www.cge.am.gov.br/">portal</a>');
    expect(html).toContain('<a href="http://intranet.local/">intranet</a>');
    expect(html).toContain('<a href="mailto:sci@cge.am.gov.br">e-mail</a>');
  });
});

describe("editor -> Word -> editor", () => {
  it("writes headings 1 to 3 as Word heading styles", async () => {
    const { xml, html } = await saved(
      [1, 2, 3].map((level) => ({
        type: "heading",
        attrs: { level },
        content: [text(`Título ${level}`)],
      })),
    );
    for (const level of [1, 2, 3]) {
      expect(xml).toContain(`<w:pStyle w:val="Heading${level}"/>`);
      expect(html).toContain(`<h${level}>Título ${level}</h${level}>`);
    }
  });

  it("writes bold, italic and underline runs", async () => {
    const { xml, html } = await saved([
      paragraph([
        text("forte", ["bold"]),
        text(" "),
        text("inclinado", ["italic"]),
        text(" "),
        text("sublinhado", ["underline"]),
      ]),
    ]);
    expect(xml).toMatch(/<w:b\/>.*<w:t[^>]*>forte</);
    expect(xml).toMatch(/<w:i\/>.*<w:t[^>]*>inclinado</);
    expect(xml).toMatch(/<w:u w:val="single"\/>.*<w:t[^>]*>sublinhado</);
    expect(html).toBe(
      "<p><strong>forte</strong> <em>inclinado</em> <u>sublinhado</u></p>",
    );
  });

  it("writes nested bullet and ordered lists with their levels", async () => {
    const { xml, html } = await saved([
      {
        type: "bulletList",
        content: [
          item(paragraph([text("Primeiro")]), {
            type: "orderedList",
            content: [
              item(paragraph([text("Primeiro passo")])),
              item(paragraph([text("Segundo passo")])),
            ],
          }),
          item(paragraph([text("Segundo")])),
        ],
      },
    ]);
    const levels = [...xml.matchAll(/<w:ilvl w:val="(\d)"\/>/g)].map(
      (match) => match[1],
    );
    expect(levels).toEqual(["0", "1", "1", "0"]);
    expect(html).toBe(
      "<ul><li>Primeiro<ol><li>Primeiro passo</li><li>Segundo passo</li></ol></li><li>Segundo</li></ul>",
    );
  });

  it("writes tables with a repeated header row", async () => {
    const row = (type: string, values: string[]): JSONContent => ({
      type: "tableRow",
      content: values.map((value) => ({
        type,
        content: [paragraph([text(value)])],
      })),
    });
    const { xml, html } = await saved([
      {
        type: "table",
        content: [
          row("tableHeader", ["Achado", "Risco", "Prazo"]),
          row("tableCell", ["Falha", "Alto", "30 dias"]),
        ],
      },
    ]);
    expect(xml.match(/<w:tr>/g)).toHaveLength(2);
    expect(xml).toContain("<w:tblHeader/>");
    expect(xml.indexOf("<w:tblHeader/>")).toBeLessThan(xml.indexOf("Falha"));
    expect(html).toContain(
      "<thead><tr><th><p>Achado</p></th><th><p>Risco</p></th><th><p>Prazo</p></th></tr></thead>",
    );
    expect(html).toContain(
      "<tr><td><p>Falha</p></td><td><p>Alto</p></td><td><p>30 dias</p></td></tr>",
    );
  });

  it("embeds images as media referenced by the drawing", async () => {
    const { parts, xml, rels, html } = await saved([
      paragraph([
        {
          type: "image",
          attrs: { src: PIXEL_SRC, alt: "Gráfico de achados" },
        },
      ]),
    ]);
    const media = [...parts.keys()].filter(
      (name) => name.startsWith("word/media/") && !name.endsWith("/"),
    );
    expect(media).toHaveLength(1);
    const embed = xml.match(/<a:blip r:embed="([^"]+)"/)?.[1];
    expect(embed).toBeTruthy();
    expect(rels).toMatch(
      new RegExp(
        `Id="${embed}"[^>]*Target="media/${media[0]!.slice("word/media/".length)}"|Target="media/${media[0]!.slice("word/media/".length)}"[^>]*Id="${embed}"`,
      ),
    );
    expect(xml).toContain('descr="Gráfico de achados"');
    expect(html).toMatch(image("Gráfico de achados"));
  });

  it("writes center and justify alignment", async () => {
    const { xml, html } = await saved([
      paragraph([text("Centro")], { textAlign: "center" }),
      paragraph([text("Justificado")], { textAlign: "justify" }),
    ]);
    expect(xml).toMatch(/<w:jc w:val="center"\/>.*Centro/);
    expect(xml).toMatch(/<w:jc w:val="both"\/>.*Justificado/);
    expect(html).toContain('<p style="text-align: center">Centro</p>');
    expect(html).toContain('<p style="text-align: justify">Justificado</p>');
  });

  it("keeps http, https and mailto links and drops javascript: links", async () => {
    const { parts, xml, rels, html } = await saved([
      paragraph([
        link("https://www.cge.am.gov.br/", "portal"),
        text(" "),
        link("http://intranet.local/", "intranet"),
        text(" "),
        link("mailto:sci@cge.am.gov.br", "e-mail"),
        text(" "),
        link("javascript:alert(1)", "clique"),
      ]),
    ]);
    for (const href of [
      "https://www.cge.am.gov.br/",
      "http://intranet.local/",
      "mailto:sci@cge.am.gov.br",
    ])
      expect(rels).toContain(`Target="${href}" TargetMode="External"`);
    expect(rels).not.toContain("javascript");
    // Word shows links through the Hyperlink character style.
    expect(xml.match(/<w:rStyle w:val="Hyperlink"\/>/g)).toHaveLength(3);
    expect(parts.get("word/styles.xml")).toContain('w:styleId="Hyperlink"');
    expect(xml).toContain("clique");
    expect(html).toContain('<a href="https://www.cge.am.gov.br/">portal</a>');
    expect(html).toContain('<a href="http://intranet.local/">intranet</a>');
    expect(html).toContain('<a href="mailto:sci@cge.am.gov.br">e-mail</a>');
    expect(html).not.toContain("javascript");
    expect(html).toContain("clique");
  });
});
