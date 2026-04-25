/**
 * PDF Ingestion Pipeline (M2)
 *
 * Extracts plain text from a WH-347 PDF upload using pdf-parse.
 * Returns the raw text, which is then fed into the standard
 * extractWCPData() extraction pipeline in Layer 1.
 *
 * Size limit: API_MAX_PDF_BYTES env var (default 10 MB).
 */

import { createRequire } from "module";
import { childLogger } from "../utils/logger.js";

const require = createRequire(import.meta.url);
// pdf-parse is a CommonJS module; use require() for ESM interop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse = require("pdf-parse") as (buf: Buffer, options?: { max?: number }) => Promise<{ text: string; numpages: number }>;


const log = childLogger("PDFIngestion");

const MAX_PDF_BYTES = parseInt(process.env.API_MAX_PDF_BYTES ?? "10485760", 10); // 10 MB

// ============================================================================
// Types
// ============================================================================

export interface PDFIngestionResult {
  text: string;
  pageCount: number;
  fileName: string;
  sizeBytes: number;
}

export class PDFIngestionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PDFIngestionError";
  }
}

// ============================================================================
// PDF Text Extraction
// ============================================================================

/**
 * Parse a PDF buffer and extract plain text.
 *
 * @param buffer Raw PDF bytes
 * @param fileName Original file name (for logging)
 * @returns Extracted text and metadata
 * @throws PDFIngestionError on size violation or parse failure
 */
export async function extractTextFromPDF(
  buffer: Buffer,
  fileName: string
): Promise<PDFIngestionResult> {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new PDFIngestionError(
      `PDF exceeds size limit: ${buffer.byteLength} bytes > ${MAX_PDF_BYTES} bytes`,
      "PDF_TOO_LARGE"
    );
  }

  const startMs = Date.now();
  log.info({ fileName, sizeBytes: buffer.byteLength }, "Parsing PDF");

  try {
    const data = await pdfParse(buffer, {
      max: 0, // parse all pages
    });

    const result: PDFIngestionResult = {
      text: data.text,
      pageCount: data.numpages,
      fileName,
      sizeBytes: buffer.byteLength,
    };

    log.info({ fileName, pageCount: data.numpages, ms: Date.now() - startMs }, "PDF parsed successfully");
    return result;
  } catch (err) {
    if (err instanceof PDFIngestionError) throw err;
    log.error({ fileName, err }, "PDF parse failed");
    throw new PDFIngestionError(
      `Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`,
      "PDF_PARSE_ERROR"
    );
  }
}

/**
 * Parse a multipart field value (base64-encoded or raw buffer) into a PDF result.
 * Convenience wrapper for the Hono /analyze-pdf endpoint.
 */
export async function parseMultipartPDF(
  fileData: Uint8Array,
  fileName: string
): Promise<PDFIngestionResult> {
  return extractTextFromPDF(Buffer.from(fileData), fileName);
}
