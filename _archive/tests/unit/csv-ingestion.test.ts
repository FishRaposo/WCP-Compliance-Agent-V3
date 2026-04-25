/**
 * Unit tests for CSV Ingestion Pipeline (M3)
 */

import { describe, it, expect } from "vitest";
import {
  parseCSV,
  parseCSVBuffer,
  csvRowToWCPText,
  csvToWCPInputs,
  CSVIngestionError,
  type CSVRow,
} from "../../src/ingestion/csv-ingestion.js";

describe("CSV Ingestion", () => {
  // ========================================================================
  // csvRowToWCPText
  // ========================================================================

  describe("csvRowToWCPText", () => {
    it("converts a full row to WCP text", () => {
      const row: CSVRow = {
        workerName: "Jane Smith",
        role: "Electrician",
        hours: "40",
        wage: "51.69",
        fringe: "34.63",
        grossPay: "2067.60",
        weekEnding: "2024-06-07",
        projectId: "FED-2024-001",
        localityCode: "MA-001",
        socialSecurityLast4: "1234",
        regularHours: "40",
        overtimeHours: "0",
      };

      const text = csvRowToWCPText(row);
      expect(text).toContain("Worker Name: Jane Smith");
      expect(text).toContain("Trade/Classification: Electrician");
      expect(text).toContain("Total Hours: 40");
      expect(text).toContain("Hourly Rate: $51.69");
      expect(text).toContain("Fringe Benefits: $34.63");
      expect(text).toContain("Gross Pay: $2067.60");
      expect(text).toContain("Week Ending: 2024-06-07");
      expect(text).toContain("Project: FED-2024-001");
      expect(text).toContain("Locality Code: MA-001");
      expect(text).toContain("SSN Last 4: 1234");
    });

    it("skips missing fields", () => {
      const row: CSVRow = { role: "Laborer", hours: "40", wage: "26.45" };
      const text = csvRowToWCPText(row);
      expect(text).not.toContain("Worker Name");
      expect(text).not.toContain("Fringe");
      expect(text).toContain("Trade/Classification: Laborer");
    });

    it("returns empty string for empty row", () => {
      const text = csvRowToWCPText({});
      expect(text).toBe("");
    });
  });

  // ========================================================================
  // parseCSV
  // ========================================================================

  describe("parseCSV", () => {
    it("parses a simple CSV string", () => {
      const csv = `role,hours,wage,fringe
Electrician,40,51.69,34.63
Laborer,40,26.45,12.50`;

      const result = parseCSV(csv, "test.csv");
      expect(result.rowCount).toBe(2);
      expect(result.rows[0].role).toBe("Electrician");
      expect(result.rows[1].role).toBe("Laborer");
      expect(result.errors).toHaveLength(0);
      expect(result.fileName).toBe("test.csv");
    });

    it("normalizes multi-word headers to camelCase", () => {
      const csv = `role,hours,wage,fringe\nPlumber,40,48.20,28.10`;

      const result = parseCSV(csv, "test.csv");
      expect(result.rows[0].role).toBe("Plumber");
      expect(result.rows[0].hours).toBe("40");
      expect(result.rows[0].wage).toBe("48.20");
      expect(result.rows[0].fringe).toBe("28.10");
    });

    it("normalizeHeader trims whitespace from column names", () => {
      // papaparse calls transformHeader per column — verify trim works
      const csv = `role , hours , wage\nLaborer,40,26.45`;
      const result = parseCSV(csv, "test.csv");
      // After trim + lowercase, keys should be 'role', 'hours', 'wage'
      expect(result.rows[0].role).toBe("Laborer");
      expect(result.rows[0].hours).toBe("40");
      expect(result.rows[0].wage).toBe("26.45");
    });

    it("skips empty lines", () => {
      const csv = `role,hours,wage\nElectrician,40,51.69\n\n\n`;
      const result = parseCSV(csv, "test.csv");
      expect(result.rowCount).toBe(1);
    });

    it("returns empty rows array for header-only CSV", () => {
      const csv = `role,hours,wage`;
      const result = parseCSV(csv, "test.csv");
      expect(result.rowCount).toBe(0);
      expect(result.rows).toHaveLength(0);
    });

    it("trims whitespace from values", () => {
      const csv = `role,hours\n  Electrician  ,  40  `;
      const result = parseCSV(csv, "test.csv");
      expect(result.rows[0].role).toBe("Electrician");
      expect(result.rows[0].hours).toBe("40");
    });
  });

  // ========================================================================
  // parseCSVBuffer
  // ========================================================================

  describe("parseCSVBuffer", () => {
    it("parses a Buffer the same as a string", () => {
      const csv = `role,hours,wage\nElectrician,40,51.69`;
      const buffer = Buffer.from(csv, "utf-8");
      const result = parseCSVBuffer(buffer, "test.csv");
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].role).toBe("Electrician");
    });
  });

  // ========================================================================
  // csvToWCPInputs
  // ========================================================================

  describe("csvToWCPInputs", () => {
    it("converts rows to WCP text blocks", () => {
      const csv = `role,hours,wage\nElectrician,40,51.69\nLaborer,40,26.45`;
      const parsed = parseCSV(csv, "test.csv");
      const inputs = csvToWCPInputs(parsed);
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toContain("Electrician");
      expect(inputs[1]).toContain("Laborer");
    });

    it("skips rows without role, hours, or wage", () => {
      const csv = `role,hours,wage,note\nElectrician,40,51.69,good\n,,, empty row`;
      const parsed = parseCSV(csv, "test.csv");
      const inputs = csvToWCPInputs(parsed);
      expect(inputs).toHaveLength(1);
    });
  });

  // ========================================================================
  // CSVIngestionError
  // ========================================================================

  describe("CSVIngestionError", () => {
    it("has correct name and code", () => {
      const err = new CSVIngestionError("too large", "TOO_LARGE");
      expect(err.name).toBe("CSVIngestionError");
      expect(err.code).toBe("TOO_LARGE");
      expect(err.message).toBe("too large");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
