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
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import mammoth from "mammoth";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Word -> HTML for the editor. Images stay inline as data URIs. */
export async function docxToHtml(arrayBuffer: ArrayBuffer) {
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // alt defaults to "" (decorative) unless Word has alternative text.
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
        alt: (image as { altText?: string }).altText ?? "",
      })),
    },
  );
  return result.value;
}

const alignments = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;

const headings = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

const imageTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
} as const;

// Page body width in pixels at 96 dpi (A4 minus 2.5 cm margins, rounded).
const MAX_IMAGE_WIDTH = 600;

type ImageData = {
  type: "png" | "jpg" | "gif" | "bmp";
  data: Uint8Array;
  width: number;
  height: number;
};

async function loadImage(src: string): Promise<ImageData | null> {
  if (!src.startsWith("data:")) return null;
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null; // a format the browser cannot draw (e.g. EMF) is dropped
  }
  const scale = Math.min(1, MAX_IMAGE_WIDTH / (image.naturalWidth || 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const mime = src.slice(5, src.indexOf(";"));
  const type = imageTypes[mime as keyof typeof imageTypes];
  if (type) {
    const binary = atob(src.slice(src.indexOf(",") + 1));
    const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { type, data, width, height };
  }
  // Anything else the browser can draw is re-encoded as PNG.
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return null;
  return {
    type: "png",
    data: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
  };
}

type ListContext = { reference: string; level: number; instance: number };

/**
 * Editor document (TipTap JSON) -> Word file, built in the browser.
 * Covers the editor schema: headings, aligned paragraphs, bold, italic,
 * underline, strike, links, nested lists, tables, images, quotes and code.
 */
export async function editorToDocx(content: JSONContent, title: string) {
  const images = new Map<string, ImageData | null>();
  const collect = async (node: JSONContent) => {
    const src = node.attrs?.src;
    if (node.type === "image" && typeof src === "string" && !images.has(src))
      images.set(src, await loadImage(src));
    for (const child of node.content ?? []) await collect(child);
  };
  await collect(content);

  let listInstance = 0;

  const inline = (nodes: JSONContent[] = []): ParagraphChild[] =>
    nodes.flatMap((node): ParagraphChild[] => {
      if (node.type === "hardBreak") return [new TextRun({ break: 1 })];
      if (node.type === "image") {
        const image = images.get(String(node.attrs?.src ?? ""));
        return image
          ? [
              new ImageRun({
                type: image.type,
                data: image.data,
                transformation: { width: image.width, height: image.height },
                altText: {
                  name: "Imagem",
                  description: String(node.attrs?.alt ?? ""),
                },
              }),
            ]
          : [];
      }
      if (node.type !== "text" || !node.text) return [];
      const marks = new Map(node.marks?.map((mark) => [mark.type, mark]));
      const href = marks.get("link")?.attrs?.href;
      const link =
        typeof href === "string" && /^(https?:|mailto:)/i.test(href)
          ? href
          : null;
      const run = new TextRun({
        text: node.text,
        bold: marks.has("bold"),
        italics: marks.has("italic"),
        underline: marks.has("underline") || link ? {} : undefined,
        strike: marks.has("strike"),
        font: marks.has("code") ? "Consolas" : undefined,
        style: link ? "Hyperlink" : undefined,
      });
      return link ? [new ExternalHyperlink({ link, children: [run] })] : [run];
    });

  const paragraph = (node: JSONContent, extra: IParagraphOptions = {}) =>
    new Paragraph({
      children: inline(node.content),
      alignment: alignments[node.attrs?.textAlign as keyof typeof alignments],
      heading:
        node.type === "heading"
          ? headings[node.attrs?.level as keyof typeof headings]
          : undefined,
      ...extra,
    });

  const blocks = (
    nodes: JSONContent[] = [],
    list?: ListContext,
    quote = false,
  ): (Paragraph | Table)[] =>
    nodes.flatMap((node): (Paragraph | Table)[] => {
      switch (node.type) {
        case "paragraph":
        case "heading":
          return [
            paragraph(node, {
              ...(list ? { numbering: list } : {}),
              ...(quote ? { indent: { left: 720 } } : {}),
            }),
          ];
        case "bulletList":
        case "orderedList": {
          listInstance += 1;
          const current: ListContext = {
            reference: node.type === "bulletList" ? "bullets" : "numbers",
            level: list ? Math.min(list.level + 1, 8) : 0,
            instance: listInstance,
          };
          return (node.content ?? []).flatMap((item) => {
            const [first, ...rest] = item.content ?? [];
            return [
              ...(first ? blocks([first], current, quote) : []),
              // Nested lists go one level down; extra paragraphs are
              // indented under the item without a new bullet.
              ...rest.flatMap((child) =>
                child.type?.endsWith("List")
                  ? blocks([child], current, quote)
                  : blocks([child], undefined, true),
              ),
            ];
          });
        }
        case "blockquote":
          return blocks(node.content, list, true);
        case "codeBlock":
          return [
            new Paragraph({
              children: [
                new TextRun({
                  text: (node.content ?? [])
                    .map((child) => child.text ?? "")
                    .join(""),
                  font: "Consolas",
                }),
              ],
            }),
          ];
        case "horizontalRule":
          return [
            new Paragraph({
              border: {
                bottom: { style: "single", size: 6, color: "999999", space: 1 },
              },
              children: [],
            }),
          ];
        case "table":
          return [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: (node.content ?? []).map(
                (row) =>
                  new TableRow({
                    tableHeader: row.content?.every(
                      (cell) => cell.type === "tableHeader",
                    ),
                    children: (row.content ?? []).map((cell) => {
                      const children = blocks(cell.content);
                      return new TableCell({
                        columnSpan: Number(cell.attrs?.colspan ?? 1),
                        rowSpan: Number(cell.attrs?.rowspan ?? 1),
                        children: children.length
                          ? children
                          : [new Paragraph("")],
                      });
                    }),
                  }),
              ),
            }),
          ];
        case "image":
          return [new Paragraph({ children: inline([node]) })];
        default:
          return blocks(node.content, list, quote);
      }
    });

  const levels = (format: "bullet" | "decimal") =>
    Array.from({ length: 9 }, (_, level) => ({
      level,
      format: format === "bullet" ? LevelFormat.BULLET : LevelFormat.DECIMAL,
      text:
        format === "bullet"
          ? (["•", "◦", "▪"][level % 3] ?? "•")
          : `%${level + 1}.`,
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
      },
    }));

  const file = new Document({
    title,
    creator: "Intranet CGE",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: {
      config: [
        { reference: "bullets", levels: levels("bullet") },
        { reference: "numbers", levels: levels("decimal") },
      ],
    },
    sections: [{ children: blocks(content.content) }],
  });
  return Packer.toBlob(file);
}
