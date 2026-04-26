"""WH-347 payroll form extraction — PDF/text → ExtractedWCP.

Supports two input modes:
  - extract_from_text(): parses labeled key-value text or tabular rows
  - extract_from_pdf(): wraps pdfplumber → extract_from_text()

Example labeled-field WH-347 text format::

    Contractor: ABC Construction
    Project: Federal Building Renovation
    Location: Washington, DC
    Certified: 2026-01-15
    Payroll # 1

    Name: John Smith
    Trade: Electrician
    Hours: 40
    Hourly Wage: 51.69
    Fringe: 1385.20
    Gross: 2067.60
    Deductions: 150.00
    Net: 1917.60

Note: fringe_benefits in EmployeeRecord stores the *total fringe paid*
(e.g. $1385.20), not the per-hour rate ($34.63). The fringe_check then
validates total_fringe >= dbwd_rate.fringe × hours_worked.
"""

from __future__ import annotations

import io
import re
import uuid
from datetime import date, datetime
from typing import Any

import pdfplumber

from wcp_backend.models.aliases import resolve_classification
from wcp_backend.models.schemas import ContractorInfo, EmployeeRecord, ExtractedWCP, ProjectInfo
from wcp_backend.observability.tracing import trace_span


def _extract_pattern(text: str, pattern: str, group: int = 1, default: Any = None) -> Any:
    """Extract a single regex match from text."""
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        try:
            return match.group(group)
        except IndexError:
            return default
    return default


def _extract_float(text: str, pattern: str, group: int = 1) -> float | None:
    """Extract a float value from text."""
    result = _extract_pattern(text, pattern, group)
    if result:
        try:
            # Remove $ and commas before parsing
            cleaned = result.replace("$", "").replace(",", "").strip()
            return float(cleaned)
        except ValueError:
            return None
    return None


def _extract_int(text: str, pattern: str, group: int = 1) -> int | None:
    """Extract an integer value from text."""
    result = _extract_pattern(text, pattern, group)
    if result:
        try:
            return int(result.replace(",", "").strip())
        except ValueError:
            return None
    return None


def _extract_date(text: str, pattern: str, group: int = 1) -> date | None:
    """Extract a date value from text (supports multiple formats)."""
    result = _extract_pattern(text, pattern, group)
    if result:
        # Try ISO format first
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(result.strip(), fmt).date()
            except ValueError:
                continue
    return None


@trace_span("extract_from_text", attributes={"component": "extraction"})
def extract_from_text(text: str) -> ExtractedWCP:
    """Extract structured data from plain text representation of WH-347."""
    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    
    # Extract contractor info
    contractor_name = _extract_pattern(
        text,
        r"(?:contractor|employer|company)[:\s]+([^\n,]+)"
    ) or "Unknown Contractor"
    
    contractor_address = _extract_pattern(
        text,
        r"(?:address)[:\s]+([^\n]+)"
    ) or ""
    
    contractor_ein = _extract_pattern(
        text,
        r"(?:ein|tax.?id|federal.?id)[:\s#]+(\d{2}-?\d{7})"
    ) or ""
    
    # Extract project info
    project_name = _extract_pattern(
        text,
        r"(?:project|job.?name)[:\s]+([^\n,]+)"
    ) or "Unknown Project"
    
    project_location = _extract_pattern(
        text,
        r"(?:project.?location|site.?location|locality)[:\s]+([^\n,]+)"
    ) or "Washington, DC"
    
    contract_number = _extract_pattern(
        text,
        r"(?:contract.?number|contract.?no)[:\s#]+([A-Z0-9-]+)"
    ) or ""
    
    wage_determination = _extract_pattern(
        text,
        r"(?:wage.?determination|wd.?number)[:\s#]+([A-Z0-9-]+)"
    ) or ""
    
    # Extract payroll metadata
    payroll_number = _extract_int(text, r"(?:payroll.?#|payroll.?number)[:\s]*(\d+)")
    
    week_ending = _extract_date(
        text,
        r"(?:week.?ending|period.?ending)[:\s]*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})"
    )
    
    certification_date = _extract_date(
        text,
        r"(?:certified|certification.?date)[:\s]*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})"
    )
    
    # Extract employee records
    employees = _extract_employees(text)
    
    return ExtractedWCP(
        job_id=job_id,
        contractor=ContractorInfo(
            name=contractor_name.strip(),
            address=contractor_address.strip(),
            ein=contractor_ein
        ),
        project=ProjectInfo(
            name=project_name.strip(),
            location=project_location.strip(),
            contract_number=contract_number,
            wage_determination_number=wage_determination
        ),
        employees=employees,
        certification_date=certification_date,
        payroll_number=payroll_number,
        week_ending=week_ending
    )


def _extract_employees(text: str) -> list[EmployeeRecord]:
    """Extract employee records from WH-347 text."""
    employees: list[EmployeeRecord] = []
    
    # Look for employee sections - various formats
    # Pattern 1: "Employee: Name" or "Worker: Name"
    # Pattern 2: Table-like rows with multiple fields
    
    # Look for structured employee data
    # Common WH-347 format: Name, Trade, Hours, Wage, Fringe, Gross, Deductions, Net
    
    # Try regex-based row extraction
    row_pattern = re.compile(
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+"  # Name
        r"([A-Za-z\s]+?)\s+"  # Trade (non-greedy)
        r"(\d+(?:\.\d+)?)\s+"  # Hours
        r"\$?(\d+(?:\.\d+)?)\s*"  # Hourly wage
        r"(?:\$?(\d+(?:\.\d+)?))?\s*"  # Fringe (optional)
        r"\$?(\d+(?:,\d+)*(?:\.\d+)?)\s*"  # Gross
        r"(?:\$?(\d+(?:,\d+)*(?:\.\d+)?))?\s*"  # Deductions (optional)
        r"\$?(\d+(?:,\d+)*(?:\.\d+)?)",  # Net
        re.IGNORECASE
    )
    
    for match in row_pattern.finditer(text):
        try:
            name = match.group(1).strip()
            raw_trade = match.group(2).strip()
            trade = resolve_classification(raw_trade)
            
            hours = float(match.group(3))
            wage = float(match.group(4).replace(",", ""))
            fringe = float(match.group(5).replace(",", "")) if match.group(5) else 0.0
            gross = float(match.group(6).replace(",", ""))
            deductions = float(match.group(7).replace(",", "")) if match.group(7) else 0.0
            net = float(match.group(8).replace(",", ""))
            
            # Calculate overtime (simplified - assumes hours > 40 is OT)
            overtime_hours = max(0, hours - 40)
            
            employees.append(EmployeeRecord(
                name=name,
                trade_classification=trade,
                hours_worked=hours,
                overtime_hours=overtime_hours,
                hourly_wage=wage,
                fringe_benefits=fringe,
                gross_earnings=gross,
                deductions=deductions,
                net_wages=net
            ))
        except (ValueError, IndexError):
            continue
    
    # If no structured rows found, try simpler pattern matching
    if not employees:
        employees = _extract_employees_simple(text)
    
    return employees


def _extract_employees_simple(text: str) -> list[EmployeeRecord]:
    """Simplified employee extraction for less structured text.
    
    Supports multiple employee blocks separated by 'Name:' markers.
    """
    employees: list[EmployeeRecord] = []
    
    # Split text into per-employee blocks on 'Name:' boundaries
    # Each block starts from 'Name:' up to the next 'Name:' or end
    name_pattern = re.compile(r"(?:^|\n)\s*(?:name|employee)\s*[:\s]", re.IGNORECASE)
    positions = [m.start() for m in name_pattern.finditer(text)]
    
    if not positions:
        return employees
    
    # Build blocks: each block is from one Name: to the next
    blocks = []
    for i, pos in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(text)
        blocks.append(text[pos:end])
    
    for block in blocks:
        emp = _parse_employee_block(block)
        if emp is not None:
            employees.append(emp)
    
    return employees


def _parse_employee_block(block: str) -> EmployeeRecord | None:
    """Parse a single employee text block into an EmployeeRecord."""
    name = _extract_pattern(block, r"(?:name|employee)[:\s]+([A-Z][a-zA-Z]+(?:[ ][A-Z][a-zA-Z]+)*)") or "Unknown"
    if name == "Unknown":
        return None
    
    # Extract trade and resolve
    raw_trade = _extract_pattern(
        block,
        r"(?:trade|role|classification)[:\s]+([A-Za-z\s]+?)(?:[,\n]|$)"
    ) or "Laborer"
    trade = resolve_classification(raw_trade.strip())
    
    # Extract hours
    hours = _extract_float(block, r"(?:hours.?worked|hours)[:\s]*(\d+(?:\.\d+)?)") or 40.0
    overtime = _extract_float(block, r"(?:overtime|ot)[:\s]*(\d+(?:\.\d+)?)") or 0.0
    
    # Extract wage
    wage = _extract_float(block, r"(?:hourly.?wage|wage)[:\s]*\$?(\d+(?:\.\d+)?)") or 0.0
    
    # Extract fringe (total fringe paid, not per-hour rate)
    fringe = _extract_float(block, r"(?:fringe|benefits)[:\s]*\$?(\d+(?:,\d+)*(?:\.\d+)?)") or 0.0
    
    # Extract gross/net
    gross = _extract_float(block, r"(?:gross|gross.?earnings)[:\s]*\$?(\d+(?:,\d+)*(?:\.\d+)?)") or 0.0
    net = _extract_float(block, r"(?:net|net.?wages)[:\s]*\$?(\d+(?:,\d+)*(?:\.\d+)?)") or 0.0
    deductions_raw = _extract_float(block, r"(?:deductions?)[:\s]*\$?(\d+(?:,\d+)*(?:\.\d+)?)")
    deductions = deductions_raw if deductions_raw is not None else (gross - net if gross > net else 0.0)
    
    return EmployeeRecord(
        name=name,
        trade_classification=trade,
        hours_worked=hours,
        overtime_hours=overtime,
        hourly_wage=wage,
        fringe_benefits=fringe,
        gross_earnings=gross,
        deductions=deductions,
        net_wages=net
    )


@trace_span("extract_from_pdf", attributes={"component": "extraction"})
def extract_from_pdf(pdf_bytes: bytes) -> ExtractedWCP:
    """Extract structured data from a WH-347 PDF using pdfplumber."""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            # Extract text from all pages
            all_text = ""
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    all_text += text + "\n"
                
                # Also try to extract tables
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if row:
                            all_text += " ".join(str(cell) for cell in row if cell) + "\n"
            
            # Process extracted text
            if all_text.strip():
                return extract_from_text(all_text)
    except Exception:
        # If PDF extraction fails, return minimal structure
        pass
    
    # Return empty structure with generated job_id
    job_id = str(uuid.uuid4())
    return ExtractedWCP(
        job_id=job_id,
        contractor=ContractorInfo(name="Unknown", address="", ein=""),
        project=ProjectInfo(name="Unknown", location="", contract_number="", wage_determination_number=""),
        employees=[],
        certification_date=None
    )
