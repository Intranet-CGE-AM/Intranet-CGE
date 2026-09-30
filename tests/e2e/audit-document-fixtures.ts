import { crc32, deflateRawSync } from "node:zlib";

import {
  clientHeaders,
  expect,
  type APIRequestContext,
  type PlaywrightWorkerArgs,
} from "./fixtures";

export const docxMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Monta um ZIP mínimo (deflate) sem depender de biblioteca de compactação.
// Entradas em `stored` vão sem compressão, para controlar o tamanho exato.
export function zip(
  entries: Record<string, Buffer | string>,
  stored: ReadonlySet<string> = new Set(),
) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const packed = stored.has(name) ? data : deflateRawSync(data);
    const fileName = Buffer.from(name);
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0);
    common.writeUInt16LE(0, 2);
    common.writeUInt16LE(stored.has(name) ? 0 : 8, 4);
    common.writeUInt32LE(0, 6);
    common.writeUInt32LE(crc32(data), 10);
    common.writeUInt32LE(packed.length, 14);
    common.writeUInt32LE(data.length, 18);
    common.writeUInt16LE(fileName.length, 22);
    common.writeUInt16LE(0, 24);
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      common,
      fileName,
      packed,
    ]);
    // comment length, disk, internal and external attributes, local offset.
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

// PNG 1x1 transparente.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

// DOCX real com um parágrafo e uma imagem, sem dados pessoais. `extra`
// acrescenta partes ao pacote; as listadas em `stored` vão sem compressão.
export function sampleDocx(
  text = "Relatório de auditoria de teste",
  extra: Record<string, Buffer> = {},
  stored: ReadonlySet<string> = new Set(),
) {
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const r =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return zip(
    {
      ...extra,
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>`,
      "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${r}/image" Target="media/image1.png"/></Relationships>`,
      "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${w}" xmlns:r="${r}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline><wp:extent cx="95250" cy="95250"/><wp:docPr id="1" name="Imagem 1"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="95250" cy="95250"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:body></w:document>`,
      "word/media/image1.png": pixel,
    },
    stored,
  );
}

// PDF de uma página com camada de texto (pesquisável), sem dados pessoais.
export function searchablePdf(text = "Relatorio de auditoria de teste") {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

export const auditAccounts = {
  assessorA: "assessoria.aud01@homolog.cge.am.gov.br",
  coordinatorA: "coordenacao.aud01@homolog.cge.am.gov.br",
  assessorB: "assessoria.aud02@homolog.cge.am.gov.br",
  coordinatorB: "coordenacao.aud02@homolog.cge.am.gov.br",
  reviewer: "subcontroladoria.sci@homolog.cge.am.gov.br",
  noAccess: "ana.vasconcelos@homolog.cge.am.gov.br",
  admin: "admin-e2e@local.invalid",
} as const;

export async function signIn(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  email: string,
) {
  const client = await playwright.request.newContext({
    baseURL,
    // Origin follows baseURL, so the specs run against any web port.
    extraHTTPHeaders: { ...clientHeaders(), Origin: baseURL },
  });
  const response = await client.post("/api/auth/login", {
    data: {
      email,
      password:
        email === auditAccounts.admin
          ? "Admin-E2E-Password-123"
          : "Homolog-Password-2026",
    },
  });
  expect(response.status()).toBe(200);
  return client;
}

export const auditTeams = {
  a: "Equipe de Auditoria 01",
  b: "Equipe de Auditoria 02",
} as const;

export async function unitId(client: APIRequestContext, name: string) {
  const response = await client.get("/api/audit-documents/options");
  expect(response.status()).toBe(200);
  const { units, visibleUnits } = (await response.json()) as {
    units: { id: string; name: string }[];
    visibleUnits: { id: string; name: string }[];
  };
  const unit = [...units, ...visibleUnits].find((item) => item.name === name);
  if (!unit) throw new Error(`Unit ${name} not visible`);
  return unit.id;
}

export function createDocument(
  client: APIRequestContext,
  metadata: Record<string, unknown>,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  return client.post("/api/audit-documents", {
    multipart: { metadata: JSON.stringify(metadata), file },
  });
}

export function uploadVersion(
  client: APIRequestContext,
  id: string,
  metadata: Record<string, unknown>,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  return client.post(`/api/audit-documents/${id}/files`, {
    multipart: { metadata: JSON.stringify(metadata), file },
  });
}

export const docxFile = (name = "relatorio.docx") => ({
  name,
  mimeType: docxMime,
  buffer: sampleDocx(),
});
export const pdfFile = (name = "relatorio.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: searchablePdf(),
});
