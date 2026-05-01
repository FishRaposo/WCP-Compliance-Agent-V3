from datetime import date
from decimal import Decimal

import pytest

from wcp_backend.payrolls.schemas import PayrollRecordCreate
from wcp_backend.payrolls.service import partition_name_for_contract


def test_partition_name_sanitizes_contract_id() -> None:
    assert partition_name_for_contract("abc-123") == "payroll_records_contract_abc_123"


def test_payroll_record_accepts_valid_daily_hours() -> None:
    record = PayrollRecordCreate(
        employee_name="Jane Worker",
        trade_code="ELEC",
        locality_code="Boston, MA",
        week_ending=date(2026, 1, 9),
        hours_monday=Decimal("8"),
        total_hours=Decimal("40"),
        hourly_rate=Decimal("50"),
        gross_pay=Decimal("2000"),
    )

    assert record.total_hours == Decimal("40")


def test_payroll_record_rejects_daily_hours_over_24() -> None:
    with pytest.raises(ValueError, match="daily hours"):
        PayrollRecordCreate(
            employee_name="Jane Worker",
            trade_code="ELEC",
            locality_code="Boston, MA",
            week_ending=date(2026, 1, 9),
            hours_monday=Decimal("25"),
            total_hours=Decimal("40"),
            hourly_rate=Decimal("50"),
            gross_pay=Decimal("2000"),
        )
