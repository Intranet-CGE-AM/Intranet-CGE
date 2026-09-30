import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

import { Inflate } from "fflate";

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

type ZipEntry = { name: string; data: Buffer; method: number; size: number };

// Lists entries from the zip central directory, with each entry's compressed
// data located through its local header. undefined = not a readable zip.
function zipEntries(zip: Buffer): ZipEntry[] | undefined {
  const floor = Math.max(0, zip.length - 22 - 0xffff);
  let end = zip.length - 22;
  while (end >= floor && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < floor) return undefined;
  const entries: ZipEntry[] = [];
  let at = zip.readUInt32LE(end + 16);
  for (let index = zip.readUInt16LE(end + 10); index > 0; index--) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== 0x02014b50)
      return undefined;
    const nameLength = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50)
      return undefined;
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const compressed = zip.readUInt32LE(at + 20);
    if (start + compressed > zip.length) return undefined;
    entries.push({
      name: zip.toString("utf8", at + 46, at + 46 + nameLength),
      data: zip.subarray(start, start + compressed),
      method: zip.readUInt16LE(at + 10),
      size: zip.readUInt32LE(at + 24),
    });
    at +=
      46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return entries;
}

// Inflates an entry in small steps and stops as soon as it produces more than
// its declared size: a lying header (real zip bomb) never allocates past it.
function inflateWithin(entry: ZipEntry, keep: boolean) {
  if (entry.method === 0)
    return entry.data.length <= entry.size ? entry.data : undefined;
  if (entry.method !== 8) return undefined;
  const chunks: Uint8Array[] = [];
  let produced = 0;
  const inflater = new Inflate((chunk) => {
    produced += chunk.length;
    if (keep && produced <= entry.size) chunks.push(chunk.slice());
  });
  try {
    for (let offset = 0; offset < entry.data.length; offset += 4096) {
      const end = offset + 4096;
      inflater.push(entry.data.subarray(offset, end), end >= entry.data.length);
      if (produced > entry.size) return undefined;
    }
  } catch {
    return undefined;
  }
  return Buffer.concat(chunks);
}

// Checks the declared structure first (cheap), then inflates every entry
// bounded by its declared size. Only [Content_Types].xml is kept, capped at 1 MiB.
function checkDocx(buffer: Buffer): AuditDocumentValidation | undefined {
  const corrupted = reject(
    "invalid_docx",
    "O arquivo .docx está corrompido ou incompleto.",
  );
  const entries = zipEntries(buffer);
  if (!entries) return corrupted;
  if (entries.length > MAX_DOCX_ENTRIES) return tooComplex;
  let uncompressed = 0;
  for (const entry of entries) {
    uncompressed += entry.size;
    if (uncompressed > MAX_DOCX_UNCOMPRESSED_BYTES) return tooComplex;
  }
  let contentTypes: Buffer | undefined;
  for (const entry of entries) {
    const types = entry.name === CONTENT_TYPES && entry.size <= 1024 * 1024;
    const inflated = inflateWithin(entry, types);
    if (!inflated) return corrupted;
    if (types) contentTypes = inflated;
  }
  const names = new Set(entries.map((entry) => entry.name));
  if (!contentTypes || !names.has("word/document.xml")) return corrupted;
  if ([...names].some((name) => name.toLowerCase().endsWith("vbaproject.bin")))
    return macro;
  if (/macroenabled/i.test(contentTypes.toString("utf8"))) return macro;
  return undefined;
}
