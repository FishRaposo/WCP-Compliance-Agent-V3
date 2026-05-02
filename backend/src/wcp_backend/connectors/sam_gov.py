"""SAM.gov API client for live DBWD rate fetching (V4).

Purpose: Fetch prevailing wage rates from SAM.gov (beta.sam.gov) API
for Davis-Bacon Act wage determinations. Implements the WDOL
(Wage Determinations Online) API integration.

API Docs: https://sam.gov/api/docs
WDOL Service: https://sam.gov/api/v1/wage-determinations
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from wcp_backend.connectors.base import ConnectorConfig

__all__ = ["SamGovClient", "SamGovError"]

_logger = logging.getLogger(__name__)


class SamGovError(Exception):
    """Error from SAM.gov API."""

    pass


class SamGovClient:
    """Client for SAM.gov WDOL API.

    Fetches Davis-Bacon Act wage determinations for specific localities
    and trade classifications.
    """

    BASE_URL = "https://sam.gov/api/prod/wage-determinations/v1"

    def __init__(self, api_key: str | None = None) -> None:
        """Initialize SAM.gov client.

        Args:
            api_key: SAM.gov API key. If not provided, reads from SAM_GOV_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get("SAM_GOV_API_KEY")
        if not self.api_key:
            _logger.warning("SAM.gov API key not provided; API calls will fail")

    def _get_headers(self) -> dict[str, str]:
        """Get request headers with API key."""
        return {
            "Accept": "application/json",
            "X-Api-Key": self.api_key or "",
        }

    def search_wage_determinations(
        self,
        state: str | None = None,
        county: str | None = None,
        construction_type: str = "building",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Search for wage determinations.

        Args:
            state: Two-letter state code (e.g., "DC", "CA").
            county: County name (optional).
            construction_type: Type of construction ("building", "heavy", "highway", "residential").
            limit: Maximum results to return.

        Returns:
            List of wage determination records.

        Raises:
            SamGovError: On API error.
        """
        import requests

        params: dict[str, str | int] = {
            "limit": limit,
            "constructionType": construction_type,
        }
        if state:
            params["state"] = state
        if county:
            params["county"] = county

        try:
            response = requests.get(
                f"{self.BASE_URL}/wage-determinations",
                headers=self._get_headers(),
                params=params,
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()

            # Extract wage determinations from response
            wds = data.get("wageDeterminations", [])
            _logger.info("Found %d wage determinations", len(wds))
            return wds

        except requests.HTTPError as exc:
            raise SamGovError(f"SAM.gov API error: {exc}") from exc
        except requests.RequestException as exc:
            raise SamGovError(f"Network error connecting to SAM.gov: {exc}") from exc

    def get_wage_determination(self, wd_number: str) -> dict[str, Any]:
        """Get detailed wage determination by number.

        Args:
            wd_number: Wage determination number (e.g., "DC20260001").

        Returns:
            Wage determination details with rates.

        Raises:
            SamGovError: On API error.
        """
        import requests

        try:
            response = requests.get(
                f"{self.BASE_URL}/wage-determinations/{wd_number}",
                headers=self._get_headers(),
                timeout=30,
            )
            response.raise_for_status()
            return response.json()

        except requests.HTTPError as exc:
            if exc.response and exc.response.status_code == 404:
                raise SamGovError(f"Wage determination {wd_number} not found") from exc
            raise SamGovError(f"SAM.gov API error: {exc}") from exc
        except requests.RequestException as exc:
            raise SamGovError(f"Network error connecting to SAM.gov: {exc}") from exc

    def extract_rates(
        self,
        wage_determination: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Extract trade rates from a wage determination.

        Args:
            wage_determination: WD response from API.

        Returns:
            List of rate records with trade_code, locality, wage, fringe.
        """
        rates: list[dict[str, Any]] = []

        wd_number = wage_determination.get("wdNumber", "unknown")
        state = wage_determination.get("state", "")
        county = wage_determination.get("county", "")
        locality = f"{county}, {state}" if county else state
        effective_date = wage_determination.get("effectiveDate", "")

        classifications = wage_determination.get("classifications", [])
        for classification in classifications:
            trade_code = classification.get("code", "")
            title = classification.get("title", "")

            # Get basic hourly rate
            basic_rate = classification.get("basicHourlyRate", 0)
            fringe_rate = classification.get("fringeBenefits", 0)

            rate_key = f"{trade_code}-{state}-{effective_date[:4] if effective_date else 'unknown'}"

            rates.append({
                "rate_key": rate_key,
                "trade_code": trade_code,
                "trade_title": title,
                "locality_code": locality,
                "state": state,
                "county": county,
                "wage": float(basic_rate) if basic_rate else 0.0,
                "fringe": float(fringe_rate) if fringe_rate else 0.0,
                "effective_date": effective_date,
                "wage_determination_number": wd_number,
                "source": "sam_gov",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })

        _logger.info("Extracted %d rates from WD %s", len(rates), wd_number)
        return rates

    def fetch_rates_for_locality(
        self,
        state: str,
        county: str | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch all rates for a specific locality.

        Args:
            state: Two-letter state code.
            county: Optional county name.

        Returns:
            List of rate records for the locality.
        """
        try:
            wds = self.search_wage_determinations(state=state, county=county)
            all_rates: list[dict[str, Any]] = []

            for wd_summary in wds[:5]:  # Limit to first 5 WDs to avoid rate limits
                wd_number = wd_summary.get("wdNumber")
                if not wd_number:
                    continue

                try:
                    wd_detail = self.get_wage_determination(wd_number)
                    rates = self.extract_rates(wd_detail)
                    all_rates.extend(rates)
                except SamGovError as exc:
                    _logger.warning("Failed to fetch WD %s: %s", wd_number, exc)
                    continue

            return all_rates

        except SamGovError:
            raise


def create_sam_gov_connector_config() -> ConnectorConfig:
    """Create a connector config for SAM.gov.

    Returns:
        ConnectorConfig for SAM.gov API.
    """
    return ConnectorConfig(
        name="sam_gov_dbwd",
        connector_type="sam_gov",
        connection_config={
            "api_key_env": "SAM_GOV_API_KEY",
            "base_url": "https://sam.gov/api/prod/wage-determinations/v1",
        },
        schedule_cron="0 2 * * 0",  # Weekly on Sunday at 2 AM
        is_active=True,
        metadata={
            "description": "SAM.gov Davis-Bacon wage determination fetcher",
            "rate_limit": "1000/day",
        },
    )
