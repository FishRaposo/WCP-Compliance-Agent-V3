/**
 * CSV Bulk Ingestion Pipeline (M3)
 *
 * Streams and parses bulk WH-347 payroll data from CSV files using papaparse.
 * Each row is normalized into the WCP text format expected by extractWCPData().
 *
 * Expected CSV columns (case-insensitive):
 *   workerName, role, hours, wage, fringe, grossPay, weekEnding, projectId,
 *   localityCode, socialSecurityLast4, regularHours, overtimeHours
 */

import Papa from "papaparse";
import { childLogger } from "../utils/logger.js";

const log = childLogger("CSVIngestion");

// ============================================================================
// Types
// ============================================================================

export interface CSVRow {
  workerName?: string;
  role?: string;
  hours?: string;
  wage?: string;
  fringe?: string;
  grossPay?: string;
  weekEnding?: string;
  projectId?: string;
  localityCode?: string;
  socialSecurityLast4?: string;
  regularHours?: string;
  overtimeHours?: string;
  [key: string]: string | undefined;
}

export interface CSVIngestionResult {
  rows: CSVRow[];
  rowCount: number;
  errors: string[];
  fileName: string;
}

export class CSVIngestionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CSVIngestionError";
  }
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize CSV column headers to camelCase.
 * Handles common variants like "Worker Name", "worker_name", "WORKER NAME".
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+(.)/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convert a CSV row into the WCP text format used by Layer 1 extraction.
 * Produces a structured text block matching regex patterns in extractWCPData().
 */
export function csvRowToWCPText(row: CSVRow): string {
  const lines: string[] = [];

  if (row.workerName) lines.push(`Worker Name: ${row.workerName}`);
  if (row.socialSecurityLast4) lines.push(`SSN Last 4: ${row.socialSecurityLast4}`);
  if (row.role) lines.push(`Trade/Classification: ${row.role}`);
  if (row.localityCode) lines.push(`Locality Code: ${row.localityCode}`);
  if (row.projectId) lines.push(`Project: ${row.projectId}`);
  if (row.weekEnding) lines.push(`Week Ending: ${row.weekEnding}`);
  if (row.hours) lines.push(`Total Hours: ${row.hours}`);
  if (row.regularHours) lines.push(`Regular Hours: ${row.regularHours}`);
  if (row.overtimeHours) lines.push(`Overtime Hours: ${row.overtimeHours}`);
  if (row.wage) lines.push(`Hourly Rate: $${row.wage}`);
  if (row.fringe) lines.push(`Fringe Benefits: $${row.fringe}`);
  if (row.grossPay) lines.push(`Gross Pay: $${row.grossPay}`);

  return lines.join("\n");
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse a CSV string into rows, normalizing headers.
 *
 * @param csvText Raw CSV string content
 * @param fileName Original file name (for logging)
 * @returns Parsed rows and metadata
 */
export function parseCSV(csvText: string, fileName: string): CSVIngestionResult {
  const startMs = Date.now();
  log.info({ fileName, sizeBytes: csvText.length }, "Parsing CSV");

  const errors: string[] = [];

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
    transform: (value: string) => value.trim(),
  });

  for (const e of (result.errors ?? [])) {
    if (e.type !== "Delimiter") {
      errors.push(`Row ${e.row ?? "?"}: ${e.message}`);
    }
  }

  const rows = (result.data ?? []) as CSVRow[];

  log.info({ fileName, rowCount: rows.length, errorCount: errors.length, ms: Date.now() - startMs }, "CSV parsed");

  return {
    rows,
    rowCount: rows.length,
    errors,
    fileName,
  };
}

/**
 * Parse CSV from a Buffer (multipart upload).
 *
 * @param buffer Raw CSV bytes
 * @param fileName Original file name
 * @returns Parsed rows and metadata
 */
export function parseCSVBuffer(buffer: Buffer, fileName: string): CSVIngestionResult {
  const text = buffer.toString("utf-8");
  return parseCSV(text, fileName);
}

/**
 * Convert all CSV rows into WCP text blocks ready for pipeline processing.
 *
 * @param ingestionResult Result from parseCSV / parseCSVBuffer
 * @returns Array of WCP text strings, one per row
 */
export function csvToWCPInputs(ingestionResult: CSVIngestionResult): string[] {
  return ingestionResult.rows
    .filter((row) => row.role || row.hours || row.wage) // skip header-only or empty rows
    .map((row) => csvRowToWCPText(row));
}
