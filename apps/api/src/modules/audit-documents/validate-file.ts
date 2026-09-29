import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

import { strFromU8, unzipSync } from "fflate";

import { isValidPdf } from "../documents/validate-pdf.js";

export type AuditDocumentValidation =
  | { ok: true; kind: "docx" | "pdf"; mime: string }
  | { ok: false; code: string; message: string };

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PDF_MIME = "application/pdf";

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export const MAX_AUDIT_DOCUMENT_BYTES = 20 * 1024 * 1024;

const reject = (code: string, message: string): AuditDocumentValidation => ({
  ok: false,
  code,
  message,
});

export async function validateAuditDocumentFile(
  buffer: Buffer,
  fileName: string,
  declaredMime: string,
): Promise<AuditDocumentValidation> {
  if (buffer.length === 0)
    return reject("empty_file", "O arquivo enviado está vazio.");
  if (buffer.length > MAX_AUDIT_DOCUMENT_BYTES)
    return reject("file_too_large", "O arquivo excede o limite de 20 MB.");
  const extension = fileName.toLowerCase().split(".").pop();
  if (
    fileName.indexOf(".") === -1 ||
    (extension !== "docx" && extension !== "pdf")
  )
    return reject(
      "unsupported_type",
      "Formato não aceito. Envie o documento em .docx ou PDF pesquisável.",
    );
  const mismatch = reject(
    "type_mismatch",
    "O conteúdo do arquivo não corresponde à extensão informada.",
  );
  const mime = declaredMime.split(";")[0]!.trim().toLowerCase();
  // Browsers without a registered handler send an empty or generic MIME. That is not a claim.
  const declares = (expected: string) =>
    mime === expected || mime === "" || mime === "application/octet-stream";

  if (extension === "docx") {
    if (!declares(DOCX_MIME) || !buffer.subarray(0, 4).equals(ZIP_MAGIC))
      return mismatch;
    return checkDocx(buffer) ?? { ok: true, kind: "docx", mime: DOCX_MIME };
  }
  if (!declares(PDF_MIME) || buffer.toString("latin1", 0, 5) !== "%PDF-")
    return mismatch;
  if (!(await isValidPdf(buffer)))
    return reject("invalid_pdf", "O PDF está corrompido ou não pôde ser lido.");
  const characters = await countPdfText(buffer);
  if (characters === undefined)
    return reject("invalid_pdf", "O PDF está corrompido ou não pôde ser lido.");
  if (characters < MIN_PDF_TEXT_CHARS)
    return reject(
      "pdf_without_text",
      "O PDF não tem texto pesquisável. Envie o PDF com OCR aplicado ou o documento em .docx.",
    );
  return { ok: true, kind: "pdf", mime: PDF_MIME };
}

const CONTENT_TYPES = "[Content_Types].xml";

const MAX_DOCX_ENTRIES = 2000;
// Zip bomb guard, using the sizes the central directory declares.
const MAX_DOCX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;

const tooComplex = reject(
  "docx_too_complex",
  "O arquivo .docx tem estrutura grande demais para ser processada.",
);

const macro = reject(
  "docx_macro",
  "Documentos com macros não são aceitos. Salve como .docx comum e envie de novo.",
);

const unpdf = createRequire(import.meta.url).resolve("unpdf");
const PDF_TEXT_PAGES = 3;
// ponytail: heuristic, a scan with a tiny OCR'd stamp passes. Raise it if that shows up.
const MIN_PDF_TEXT_CHARS = 20;

// Non-whitespace characters in the text layer of the first pages, or undefined if the
// PDF could not be read in time. Same isolation as isValidPdf: worker, memory cap, timeout.
function countPdfText(bytes: Buffer): Promise<number | undefined> {
  return new Promise((resolve) => {
    const worker = new Worker(
      `const { parentPort, workerData } = require('node:worker_threads');
       const { getDocumentProxy } = require(workerData.unpdf);
       (async () => {
         const doc = await getDocumentProxy(new Uint8Array(workerData.bytes), {
           isEvalSupported: false,
           disableFontFace: true,
         });
         let characters = 0;
         for (let n = 1; n <= Math.min(doc.numPages, workerData.pages); n++) {
           const { items } = await (await doc.getPage(n)).getTextContent();
           for (const item of items) characters += (item.str || '').replace(/\\s/g, '').length;
         }
         parentPort.postMessage(characters);
       })().catch(() => parentPort.postMessage(null));`,
      {
        eval: true,
        workerData: { unpdf, bytes, pages: PDF_TEXT_PAGES },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      },
    );
    const finish = (characters: number | undefined) => {
      clearTimeout(timeout);
      void worker.terminate();
      resolve(characters);
    };
    const timeout = setTimeout(() => finish(undefined), 10_000);
    worker.once("message", (characters: unknown) =>
      finish(typeof characters === "number" ? characters : undefined),
    );
    worker.once("error", () => finish(undefined));
    worker.once("exit", () => finish(undefined));
  });
}

// Reads the zip central directory. Only [Content_Types].xml gets inflated, capped at 1 MiB.
function checkDocx(buffer: Buffer): AuditDocumentValidation | undefined {
  const names = new Set<string>();
  let contentTypes: Uint8Array | undefined;
  let entries = 0;
  let uncompressed = 0;
  try {
    ({ [CONTENT_TYPES]: contentTypes } = unzipSync(buffer, {
      filter: (entry) => {
        uncompressed += entry.originalSize;
        if (
          ++entries > MAX_DOCX_ENTRIES ||
          uncompressed > MAX_DOCX_UNCOMPRESSED_BYTES
        )
          throw tooComplex;
        names.add(entry.name);
        return (
          entry.name === CONTENT_TYPES && entry.originalSize <= 1024 * 1024
        );
      },
    }));
  } catch (error) {
    if (error === tooComplex) return tooComplex;
    return reject(
      "invalid_docx",
      "O arquivo .docx está corrompido ou incompleto.",
    );
  }
  if (!contentTypes || !names.has("word/document.xml"))
    return reject(
      "invalid_docx",
      "O arquivo .docx está corrompido ou incompleto.",
    );
  if ([...names].some((name) => name.toLowerCase().endsWith("vbaproject.bin")))
    return macro;
  if (/macroenabled/i.test(strFromU8(contentTypes))) return macro;
  return undefined;
}
