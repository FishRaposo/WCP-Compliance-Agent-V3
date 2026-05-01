from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from wcp_backend.api.analytics import analytics_overview


@pytest.mark.asyncio
async def test_analytics_overview_returns_summary_fields(monkeypatch):
    monkeypatch.setattr("wcp_backend.api.analytics.settings.phase", 2)

    total_decisions_result = MagicMock(scalar=MagicMock(return_value=156))
    total_contracts_result = MagicMock(scalar=MagicMock(return_value=12))
    avg_trust_result = MagicMock(scalar=MagicMock(return_value=0.8742))
    approved_result = MagicMock(scalar=MagicMock(return_value=134))
    human_review_result = MagicMock(scalar=MagicMock(return_value=16))
    month_result = MagicMock(scalar=MagicMock(return_value=42))

    session = AsyncMock(
        execute=AsyncMock(
            side_effect=[
                total_decisions_result,
                total_contracts_result,
                avg_trust_result,
                approved_result,
                human_review_result,
                month_result,
            ]
        )
    )

    monkeypatch.setattr(
        "wcp_backend.api.analytics.async_session",
        MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=session), __aexit__=AsyncMock(return_value=None))),
    )

    response = await analytics_overview(days=30)

    assert response.total_decisions == 156
    assert response.total_contracts == 12
    assert response.avg_trust_score == 0.8742
    assert response.overall_approval_rate == 0.859
    assert response.human_review_queue_depth == 16
    assert response.decisions_this_month == 42