/**
 * Unit tests for PDF Ingestion Pipeline (M2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractTextFromPDF,
  parseMultipartPDF,
  PDFIngestionError,
} from "../../src/ingestion/pdf-ingestion.js";

describe("PDF Ingestion", () => {
  // ========================================================================
  // PDFIngestionError
  // ========================================================================

  describe("PDFIngestionError", () => {
    it("has correct name and code", () => {
      const err = new PDFIngestionError("too large", "PDF_TOO_LARGE");
      expect(err.name).toBe("PDFIngestionError");
      expect(err.code).toBe("PDF_TOO_LARGE");
      expect(err.message).toBe("too large");
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ========================================================================
  // Size limit enforcement
  // ========================================================================

  describe("extractTextFromPDF", () => {
    it("throws PDF_TOO_LARGE when buffer exceeds limit", async () => {
      const LIMIT = parseInt(process.env.API_MAX_PDF_BYTES ?? "10485760", 10);
      const oversizedBuffer = Buffer.alloc(LIMIT + 1);

      await expect(
        extractTextFromPDF(oversizedBuffer, "large.pdf")
      ).rejects.toMatchObject({
        code: "PDF_TOO_LARGE",
        name: "PDFIngestionError",
      });
    });

    it("throws PDF_PARSE_ERROR for invalid PDF data", async () => {
      const invalidBuffer = Buffer.from("This is not a PDF", "utf-8");

      await expect(
        extractTextFromPDF(invalidBuffer, "invalid.pdf")
      ).rejects.toMatchObject({
        code: "PDF_PARSE_ERROR",
        name: "PDFIngestionError",
      });
    });
  });

  // ========================================================================
  // parseMultipartPDF
  // ========================================================================

  describe("parseMultipartPDF", () => {
    it("rejects oversized Uint8Array", async () => {
      const LIMIT = parseInt(process.env.API_MAX_PDF_BYTES ?? "10485760", 10);
      const oversized = new Uint8Array(LIMIT + 1);

      await expect(
        parseMultipartPDF(oversized, "large.pdf")
      ).rejects.toMatchObject({
        code: "PDF_TOO_LARGE",
      });
    });

    it("throws PDF_PARSE_ERROR for non-PDF content", async () => {
      const bytes = new TextEncoder().encode("not a pdf");
      await expect(
        parseMultipartPDF(bytes, "bad.pdf")
      ).rejects.toMatchObject({ code: "PDF_PARSE_ERROR" });
    });
  });
});
