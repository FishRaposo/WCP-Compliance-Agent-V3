from datetime import date
from decimal import Decimal

from wcp_backend.contracts.schemas import ContractCreate, ContractFilters


def test_contract_create_accepts_required_fields() -> None:
    contract = ContractCreate(
        contract_number="GS-TEST-001",
        project_name="Test Project",
        contractor_name="Test Contractor",
        locality="Boston, MA",
        start_date=date(2026, 1, 1),
        total_value=Decimal("100000.00"),
    )

    assert contract.contract_number == "GS-TEST-001"
    assert contract.source == "manual"


def test_contract_filters_defaults_to_created_desc() -> None:
    filters = ContractFilters()

    assert filters.sort == "created_at"
    assert filters.order == "desc"
