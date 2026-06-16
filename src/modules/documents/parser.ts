import { PDFParse } from "pdf-parse";
import { isSupportedMimeType } from "./constants";

export { isSupportedMimeType } from "./constants";

let workerLoaded = false;

async function ensurePdfWorker() {
  if (workerLoaded) return;
  // pdf-parse usa pdfjs-dist, que en entornos Node.js / Server Actions no
  // resuelve el worker por defecto. Cargamos el worker manualmente para que
  // exponga WorkerMessageHandler en globalThis.pdfjsWorker y evite el
  // import() dinámico fallido desde el bundle de Next.js.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  workerLoaded = true;
}

export async function parseDocument(
  mimeType: string,
  buffer: Buffer
): Promise<{ text: string; pageCount?: number }> {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  switch (mimeType) {
    case "application/pdf": {
      await ensurePdfWorker();
      const parser = new PDFParse({ data: buffer });
      try {
        const textResult = await parser.getText();
        return {
          text: normalizeText(textResult.text),
          pageCount: textResult.pages.length,
        };
      } finally {
        await parser.destroy();
      }
    }
    case "text/plain":
    case "text/markdown":
      return {
        text: normalizeText(buffer.toString("utf-8")),
      };
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
