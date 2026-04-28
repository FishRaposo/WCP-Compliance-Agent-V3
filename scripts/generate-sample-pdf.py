"""Generate a minimal WH-347 PDF fixture for integration tests.

This script creates a valid PDF file at backend/tests/fixtures/sample-wh347.pdf
using only Python stdlib (no external dependencies).

Usage:
    python scripts/generate-sample-pdf.py
"""

from __future__ import annotations

import os
from pathlib import Path


def _build_minimal_pdf() -> bytes:
    """Build a minimal valid PDF with WH-347 text content.

    Uses raw PDF operators to avoid any dependency on reportlab/fpdf2.
    """
    # Page content stream — simple text layout mimicking WH-347
    content_lines = [
        "BT",
        "/F1 12 Tf",
        "50 750 Td",
        "(WH-347 Payroll Certification) Tj",
        "0 -20 Td",
        "(Contractor: Sample Construction LLC) Tj",
        "0 -20 Td",
        "(Project: Federal Building Renovation) Tj",
        "0 -20 Td",
        "(Location: Washington, DC) Tj",
        "0 -20 Td",
        "(Contract Number: GS-001-2026) Tj",
        "0 -20 Td",
        "(Wage Determination: WD 2025-0001) Tj",
        "0 -20 Td",
        "(Payroll Number: 1) Tj",
        "0 -20 Td",
        "(Week Ending: 2026-06-07) Tj",
        "0 -40 Td",
        "(Employee Records:) Tj",
        "0 -20 Td",
        "(Name: John Smith) Tj",
        "0 -20 Td",
        "(Trade: Electrician) Tj",
        "0 -20 Td",
        "(Hours Worked: 40) Tj",
        "0 -20 Td",
        "(Hourly Wage: 51.69) Tj",
        "0 -20 Td",
        "(Fringe Benefits: 1385.20) Tj",
        "0 -20 Td",
        "(Gross Earnings: 2067.60) Tj",
        "0 -20 Td",
        "(Deductions: 150.00) Tj",
        "0 -20 Td",
        "(Net Wages: 1917.60) Tj",
        "0 -40 Td",
        "(Certification Date: 2026-06-07) Tj",
        "0 -20 Td",
        "(I certify that the above payroll is correct and complete.) Tj",
        "ET",
    ]
    content = "\n".join(content_lines)
    content_bytes = content.encode("latin-1")

    objects: list[str] = []

    # Object 1: Catalog
    objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")

    # Object 2: Pages
    objects.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj")

    # Object 3: Page
    objects.append(
        "3 0 obj\n"
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n"
        "endobj"
    )

    # Object 4: Content stream
    objects.append(
        f"4 0 obj\n<< /Length {len(content_bytes)} >>\nstream\n"
        f"{content}\n"
        f"endstream\nendobj"
    )

    # Object 5: Font
    objects.append(
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
    )

    # Build PDF
    pdf_parts: list[str] = ["%PDF-1.4\n"]
    offsets: list[int] = []

    for obj in objects:
        offsets.append(len("".join(pdf_parts).encode("latin-1")))
        pdf_parts.append(obj + "\n")

    xref_offset = len("".join(pdf_parts).encode("latin-1"))

    # Cross-reference table
    pdf_parts.append("xref\n")
    pdf_parts.append(f"0 {len(objects) + 1}\n")
    pdf_parts.append("0000000000 65535 f \n")
    for offset in offsets:
        pdf_parts.append(f"{offset:010d} 00000 n \n")

    # Trailer
    pdf_parts.append("trailer\n")
    pdf_parts.append(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n")
    pdf_parts.append("startxref\n")
    pdf_parts.append(f"{xref_offset}\n")
    pdf_parts.append("%%EOF\n")

    return "".join(pdf_parts).encode("latin-1")


def main() -> None:
    fixture_dir = Path(__file__).parent.parent / "backend" / "tests" / "fixtures"
    fixture_dir.mkdir(parents=True, exist_ok=True)
    output_path = fixture_dir / "sample-wh347.pdf"

    pdf_bytes = _build_minimal_pdf()
    output_path.write_bytes(pdf_bytes)

    size = os.path.getsize(output_path)
    print(f"Generated {output_path} ({size} bytes)")


if __name__ == "__main__":
    main()
