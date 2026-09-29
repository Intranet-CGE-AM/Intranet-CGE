import { crc32, deflateRawSync } from "node:zlib";

import AxeBuilder from "@axe-core/playwright";

import { auditAccounts } from "./audit-document-fixtures";
import { expect, type Page } from "./fixtures";

export async function signInPage(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page
    .getByLabel("Senha")
    .fill(
      email === auditAccounts.admin
        ? "Admin-E2E-Password-123"
        : "Homolog-Password-2026",
    );
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: /(Bom dia|Boa tarde|Boa noite),/ }),
  ).toBeVisible();
}

/** Axe (0 violations) and no horizontal scroll at phone, tablet and desktop. */
export async function checkLayout(page: Page) {
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      (
        await new AxeBuilder({ page })
          // The viewer frame holds the uploaded file, sandboxed without scripts.
          .exclude("iframe[sandbox]")
          .analyze()
      ).violations,
      `axe at ${width}px`,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `horizontal scroll at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 844 });
}

function zip(entries: Record<string, Buffer | string>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const packed = deflateRawSync(data);
    const fileName = Buffer.from(name);
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0);
    common.writeUInt16LE(0x0800, 2); // UTF-8 names
    common.writeUInt16LE(8, 4);
    common.writeUInt32LE(crc32(data), 10);
    common.writeUInt32LE(packed.length, 14);
    common.writeUInt32LE(data.length, 18);
    common.writeUInt16LE(fileName.length, 22);
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      common,
      fileName,
      packed,
    ]);
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE(offset, 10);
    centrals.push(
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x01, 0x02, 20, 0]),
        common,
        tail,
        fileName,
      ]),
    );
    locals.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Word file with one of each element the editor supports: headings 1-3,
 * bold/italic/underline, a bullet list with a nested numbered list, a table
 * with a header row, an image with alt text, centered and justified
 * paragraphs, and http/https/mailto/javascript links.
 */
export function richDocx() {
  const p = (body: string, props = "") =>
    `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${body}</w:p>`;
  const r = (text: string, props = "") =>
    `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  const heading = (level: number, text: string) =>
    p(r(text), `<w:pStyle w:val="Heading${level}"/>`);
  const listItem = (numId: number, level: number, text: string) =>
    p(
      r(text),
      `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`,
    );
  const cell = (text: string) => `<w:tc>${p(r(text))}</w:tc>`;
  const link = (id: string, text: string) =>
    `<w:hyperlink r:id="${id}">${r(text)}</w:hyperlink>`;
  const image = `<w:r><w:drawing><wp:inline><wp:extent cx="95250" cy="95250"/><wp:docPr id="1" name="Imagem 1" descr="Gráfico de achados"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="95250" cy="95250"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const body = [
    heading(1, "Relatório de auditoria"),
    heading(2, "Achados"),
    heading(3, "Detalhe do achado"),
    p(
      r("Texto ") +
        r("forte", "<w:b/>") +
        r(" e ") +
        r("inclinado", "<w:i/>") +
        r(" e ") +
        r("sublinhado", '<w:u w:val="single"/>'),
    ),
    listItem(1, 0, "Item A"),
    listItem(2, 1, "Passo 1"),
    listItem(2, 1, "Passo 2"),
    listItem(1, 0, "Item B"),
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${cell("Achado")}${cell("Risco")}</w:tr><w:tr>${cell("Falha")}${cell("Alto")}</w:tr></w:tbl>`,
    p(image),
    p(r("Texto centralizado"), '<w:jc w:val="center"/>'),
    p(r("Texto justificado"), '<w:jc w:val="both"/>'),
    p(
      link("rIdHttps", "portal") +
        r(" ") +
        link("rIdHttp", "intranet") +
        r(" ") +
        link("rIdMail", "e-mail") +
        r(" ") +
        link("rIdScript", "clique"),
    ),
  ].join("");
  const levels = (format: string, texts: string[]) =>
    texts
      .map(
        (text, level) =>
          `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/><w:pPr><w:ind w:left="${720 * (level + 1)}" w:hanging="360"/></w:pPr></w:lvl>`,
      )
      .join("");
  const relationship = (
    id: string,
    type: string,
    target: string,
    external = false,
  ) =>
    `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"${external ? ' TargetMode="External"' : ""}/>`;
  return zip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationship("rId1", "officeDocument", "word/document.xml")}</Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[
      relationship("rIdStyles", "styles", "styles.xml"),
      relationship("rIdNumbering", "numbering", "numbering.xml"),
      relationship("rIdImage", "image", "media/image1.png"),
      relationship("rIdHttps", "hyperlink", "https://www.cge.am.gov.br/", true),
      relationship("rIdHttp", "hyperlink", "http://intranet.local/", true),
      relationship("rIdMail", "hyperlink", "mailto:sci@cge.am.gov.br", true),
      relationship("rIdScript", "hyperlink", "javascript:alert(1)", true),
    ].join("")}</Relationships>`,
    "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}">${[
      1, 2, 3,
    ]
      .map(
        (level) =>
          `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/></w:style>`,
      )
      .join("")}</w:styles>`,
    "word/numbering.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0">${levels("bullet", ["•", "◦"])}</w:abstractNum><w:abstractNum w:abstractNumId="1">${levels("decimal", ["%1.", "%2."])}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`,
    "word/media/image1.png": PIXEL,
  });
}
