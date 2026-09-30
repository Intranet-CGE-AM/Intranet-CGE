import { randomBytes } from "node:crypto";

import { strToU8, zipSync, type Zippable } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  MAX_AUDIT_DOCUMENT_BYTES,
  validateAuditDocumentFile,
} from "./validate-file.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

function docx(overrides: Zippable = {}): Buffer {
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "word/document.xml": strToU8("<w:document/>"),
      ...overrides,
    }),
  );
}

async function pdf(pageTexts: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage([595, 842]);
    if (text) page.drawText(text, { x: 50, y: 780, size: 12, font });
  }
  return Buffer.from(await doc.save());
}

// 1x1 grey PNG, standing in for a scanned page.
const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==";

async function scannedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(Buffer.from(PIXEL_PNG, "base64"));
  doc
    .addPage([595, 842])
    .drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
  return Buffer.from(await doc.save());
}

const REPORT_TEXT = "Relatorio de auditoria interna numero 12";

// Rewrites the uncompressed size an entry declares in the central directory.
function declareSize(zip: Buffer, name: string, size: number): Buffer {
  for (
    let at = zip.indexOf("PK\x01\x02", 0, "latin1");
    at !== -1;
    at = zip.indexOf("PK\x01\x02", at + 4, "latin1")
  ) {
    const nameLength = zip.readUInt16LE(at + 28);
    if (zip.toString("latin1", at + 46, at + 46 + nameLength) === name) {
      zip.writeUInt32LE(size, at + 24);
      return zip;
    }
  }
  throw new Error(`entry ${name} not found`);
}

describe("validateAuditDocumentFile", () => {
  it("rejects an empty file", async () => {
    const result = await validateAuditDocumentFile(
      Buffer.alloc(0),
      "relatorio.docx",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "empty_file" });
  });

  it("rejects a file over 20 MiB", async () => {
    expect(MAX_AUDIT_DOCUMENT_BYTES).toBe(20 * 1024 * 1024);
    const result = await validateAuditDocumentFile(
      Buffer.alloc(20 * 1024 * 1024 + 1),
      "relatorio.docx",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "file_too_large" });
  });

  it.each([
    "relatorio.doc",
    "relatorio.docm",
    "modelo.dotm",
    "setup.exe",
    "sem-extensao",
  ])("rejects unsupported extension %s", async (fileName) => {
    const result = await validateAuditDocumentFile(
      Buffer.from("PK\x03\x04qualquer coisa", "latin1"),
      fileName,
      "application/octet-stream",
    );
    expect(result).toMatchObject({ ok: false, code: "unsupported_type" });
  });

  it("accepts a well-formed .docx and returns the normalized MIME", async () => {
    const result = await validateAuditDocumentFile(
      docx(),
      "Relatorio.DOCX",
      DOCX_MIME,
    );
    expect(result).toEqual({ ok: true, kind: "docx", mime: DOCX_MIME });
  });

  it("rejects an executable renamed to .docx", async () => {
    const exe = Buffer.concat([
      Buffer.from("MZ\x90\x00", "latin1"),
      Buffer.alloc(200),
    ]);
    const result = await validateAuditDocumentFile(
      exe,
      "relatorio.docx",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  it.each([
    "application/pdf",
    "application/x-msdownload",
    "application/msword",
  ])("rejects a .docx declared as %s", async (mime) => {
    const result = await validateAuditDocumentFile(
      docx(),
      "relatorio.docx",
      mime,
    );
    expect(result).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  it.each(["application/octet-stream", ""])(
    "accepts a .docx whose browser sent the generic MIME %j",
    async (mime) => {
      const result = await validateAuditDocumentFile(
        docx(),
        "relatorio.docx",
        mime,
      );
      expect(result).toEqual({ ok: true, kind: "docx", mime: DOCX_MIME });
    },
  );

  it.each([
    [
      "without word/document.xml",
      zipSync({ "[Content_Types].xml": strToU8(CONTENT_TYPES) }),
    ],
    [
      "without [Content_Types].xml",
      zipSync({ "word/document.xml": strToU8("<w:document/>") }),
    ],
    ["that is a truncated zip", docx().subarray(0, 40)],
  ])("rejects a .docx %s", async (_label, bytes) => {
    const result = await validateAuditDocumentFile(
      Buffer.from(bytes),
      "relatorio.docx",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "invalid_docx" });
  });

  it.each(["word/vbaProject.bin", "customUI/VBAPROJECT.BIN"])(
    "rejects a .docx carrying %s",
    async (entry) => {
      const bytes = docx({ [entry]: new Uint8Array([1, 2, 3]) });
      const result = await validateAuditDocumentFile(
        bytes,
        "relatorio.docx",
        DOCX_MIME,
      );
      expect(result).toMatchObject({ ok: false, code: "docx_macro" });
    },
  );

  it("rejects a .docm renamed to .docx (macroEnabled content type)", async () => {
    const docm = CONTENT_TYPES.replace(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
      "application/vnd.ms-word.document.macroEnabled.main+xml",
    );
    const bytes = docx({ "[Content_Types].xml": strToU8(docm) });
    const result = await validateAuditDocumentFile(
      bytes,
      "relatorio.docx",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "docx_macro" });
  });

  it("accepts 2000 entries and rejects 2001", async () => {
    const withEntries = (total: number) =>
      docx(
        Object.fromEntries(
          Array.from({ length: total - 2 }, (_, i) => [
            `word/media/${i}.xml`,
            new Uint8Array(1),
          ]),
        ),
      );
    expect(
      await validateAuditDocumentFile(
        withEntries(2000),
        "relatorio.docx",
        DOCX_MIME,
      ),
    ).toMatchObject({ ok: true });
    expect(
      await validateAuditDocumentFile(
        withEntries(2001),
        "relatorio.docx",
        DOCX_MIME,
      ),
    ).toMatchObject({ ok: false, code: "docx_too_complex" });
  });

  it("rejects a .docx declaring more than 150 MiB uncompressed", async () => {
    const limit = 150 * 1024 * 1024;
    const others = Buffer.byteLength(CONTENT_TYPES);
    const atLimit = declareSize(docx(), "word/document.xml", limit - others);
    const overLimit = declareSize(
      docx(),
      "word/document.xml",
      limit - others + 1,
    );
    expect(
      await validateAuditDocumentFile(atLimit, "relatorio.docx", DOCX_MIME),
    ).toMatchObject({ ok: true });
    expect(
      await validateAuditDocumentFile(overLimit, "relatorio.docx", DOCX_MIME),
    ).toMatchObject({ ok: false, code: "docx_too_complex" });
  });

  // A docx padded with a STORED random entry, so its size is exact and the
  // uncompressed total stays far below the 150 MiB guard.
  function paddedDocx(target: number): Buffer {
    const build = (padding: number) =>
      docx({
        "word/media/padding.bin": [
          new Uint8Array(randomBytes(padding)),
          { level: 0 },
        ],
      });
    const probe = build(1024).length - 1024;
    const result = build(target - probe);
    expect(result.length).toBe(target);
    return result;
  }

  it.each([
    ["exactly 20 MiB", 20 * 1024 * 1024],
    ["20 MiB minus 1 byte", 20 * 1024 * 1024 - 1],
  ])("accepts a valid .docx of %s", async (_, size) => {
    expect(
      await validateAuditDocumentFile(
        paddedDocx(size),
        "relatorio.docx",
        DOCX_MIME,
      ),
    ).toEqual({ ok: true, kind: "docx", mime: DOCX_MIME });
  });

  // Real bomb: the central directory declares a tiny entry, the deflate
  // stream inflates to 160 MiB. It must be refused without inflating it all.
  it.each(["word/document.xml", "[Content_Types].xml"])(
    "rejects %s that inflates past its declared size",
    async (name) => {
      const bomb = Buffer.concat([
        Buffer.from(
          name === "word/document.xml" ? "<w:document>" : CONTENT_TYPES,
        ),
        Buffer.alloc(160 * 1024 * 1024, 32),
      ]);
      const zip = declareSize(
        Buffer.from(
          zipSync(
            {
              "[Content_Types].xml": strToU8(CONTENT_TYPES),
              "word/document.xml": strToU8("<w:document/>"),
              [name]: bomb,
            },
            { level: 9 },
          ),
        ),
        name,
        500,
      );
      expect(zip.length).toBeLessThan(1024 * 1024);
      const started = performance.now();
      const result = await validateAuditDocumentFile(
        zip,
        "relatorio.docx",
        DOCX_MIME,
      );
      expect(result).toMatchObject({ ok: false, code: "invalid_docx" });
      expect(performance.now() - started).toBeLessThan(250);
    },
    30_000,
  );

  it("accepts a PDF with a searchable text layer", async () => {
    const result = await validateAuditDocumentFile(
      await pdf([REPORT_TEXT]),
      "relatorio.PDF",
      "application/pdf",
    );
    expect(result).toEqual({ ok: true, kind: "pdf", mime: "application/pdf" });
  });

  it("rejects a .docx renamed to .pdf", async () => {
    const result = await validateAuditDocumentFile(
      docx(),
      "relatorio.pdf",
      "application/pdf",
    );
    expect(result).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  it("rejects a .pdf declared with the .docx MIME", async () => {
    const result = await validateAuditDocumentFile(
      await pdf([REPORT_TEXT]),
      "relatorio.pdf",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  it("rejects a PDF renamed to .docx", async () => {
    const result = await validateAuditDocumentFile(
      await pdf([REPORT_TEXT]),
      "relatorio.docx",
      DOCX_MIME,
    );
    expect(result).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  it("rejects a file with a PDF header but no valid structure", async () => {
    const result = await validateAuditDocumentFile(
      Buffer.from("%PDF-1.7\nisto nao e um pdf de verdade\n%%EOF"),
      "relatorio.pdf",
      "application/pdf",
    );
    expect(result).toMatchObject({ ok: false, code: "invalid_pdf" });
  });

  it("rejects an image-only PDF and points to OCR or .docx", async () => {
    const result = await validateAuditDocumentFile(
      await scannedPdf(),
      "relatorio.pdf",
      "application/pdf",
    );
    expect(result).toMatchObject({ ok: false, code: "pdf_without_text" });
    expect(result.ok === false && result.message).toMatch(/OCR/);
    expect(result.ok === false && result.message).toMatch(/\.docx/);
  });

  it("needs at least 20 non-whitespace characters, whitespace does not count", async () => {
    // 19 and 20 letters, padded with spaces that must be ignored.
    const nineteen = "abcde fghij klmno pqrs          ";
    const twenty = "abcde fghij klmno pqrst";
    expect(
      await validateAuditDocumentFile(
        await pdf([nineteen]),
        "a.pdf",
        "application/pdf",
      ),
    ).toMatchObject({ ok: false, code: "pdf_without_text" });
    expect(
      await validateAuditDocumentFile(
        await pdf([twenty]),
        "a.pdf",
        "application/pdf",
      ),
    ).toMatchObject({ ok: true });
  });

  it("counts text across the first 3 pages only", async () => {
    const tenLetters = "abcdefghij";
    expect(
      await validateAuditDocumentFile(
        await pdf(["", tenLetters, tenLetters]),
        "a.pdf",
        "application/pdf",
      ),
    ).toMatchObject({ ok: true });
    expect(
      await validateAuditDocumentFile(
        await pdf(["", "", "", REPORT_TEXT]),
        "a.pdf",
        "application/pdf",
      ),
    ).toMatchObject({ ok: false, code: "pdf_without_text" });
  });
});
