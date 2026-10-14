import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

const library = createRequire(import.meta.url).resolve("pdf-lib");

// Parsing de arquivo não confiável tem limites de tempo e memória, fora do servidor HTTP.
export function isValidPdf(bytes: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const worker = new Worker(
      `const { parentPort, workerData } = require('node:worker_threads');
       const { PDFDocument } = require(workerData.library);
       PDFDocument.load(workerData.bytes, { throwOnInvalidObject: true, updateMetadata: false })
         .then(doc => parentPort.postMessage(doc.getPageCount() > 0))
         .catch(() => parentPort.postMessage(false));`,
      {
        eval: true,
        workerData: { library, bytes },
        resourceLimits: { maxOldGenerationSizeMb: 128 },
      },
    );
    const finish = (valid: boolean) => {
      clearTimeout(timeout);
      void worker.terminate();
      resolve(valid);
    };
    const timeout = setTimeout(() => finish(false), 5_000);
    worker.once("message", (valid: unknown) => finish(valid === true));
    worker.once("error", () => finish(false));
    worker.once("exit", () => finish(false));
  });
}
