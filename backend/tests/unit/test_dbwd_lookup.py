"""Unit tests for DBWD rate lookup."""

import pytest

from wcp_backend.models.schemas import DBWDRateRecord
from wcp_backend.pipeline.dbwd_lookup import (
    get_dbwd_rate,
    _normalize_trade,
    _levenshtein_distance,
    _load_corpus,
)


class TestNormalizeTrade:
    """Test trade name normalization."""
    
    def test_normalize_lowercases_and_replaces_spaces(self):
        """Test that normalization lowercases and replaces spaces with underscores."""
        assert _normalize_trade("Electrician") == "electrician"
        assert _normalize_trade("Sheet Metal Worker") == "sheet_metal_worker"
        assert _normalize_trade("  Electrician  ") == "electrician"


class TestLevenshteinDistance:
    """Test Levenshtein edit distance calculation."""
    
    def test_same_string_zero_distance(self):
        """Test that identical strings have zero distance."""
        assert _levenshtein_distance("electrician", "electrician") == 0
    
    def test_single_character_difference(self):
        """Test single character substitutions."""
        assert _levenshtein_distance("electrician", "electrcian") == 1  # Missing 'i'
        assert _levenshtein_distance("plumber", "plummer") == 1  # 'b' -> 'm'
    
    def test_insertion_deletion(self):
        """Test insertions and deletions."""
        assert _levenshtein_distance("electrician", "electricians") == 1  # Insertion
        assert _levenshtein_distance("carpenter", "carpentr") == 1  # Deletion
    
    def test_typo_tolerance(self):
        """Test common typos are within acceptable distance."""
        # "Electrian" -> "Electrician" (1 transposition)
        assert _levenshtein_distance("electrian", "electrician") <= 2
        # "Plumer" -> "Plumber" (1 missing letter)
        assert _levenshtein_distance("plumer", "plumber") == 1


class TestLoadCorpus:
    """Test corpus loading."""
    
    def test_corpus_loads_with_20_trades(self):
        """Test that corpus loads with all 20 trades."""
        corpus = _load_corpus()
        
        assert len(corpus) == 20
        
        # Check for key trades
        assert "electrician" in corpus
        assert "plumber" in corpus
        assert "carpenter" in corpus
    
    def test_corpus_returns_dbwd_rate_records(self):
        """Test that corpus values are DBWDRateRecord instances."""
        corpus = _load_corpus()
        
        for record in corpus.values():
            assert isinstance(record, DBWDRateRecord)
            assert record.rate > 0
            assert record.fringe > 0
            assert record.locality == "Washington, DC"


class TestGetDBWDRate:
    """Test DBWD rate lookup."""
    
    @pytest.mark.asyncio
    async def test_exact_match_returns_rate(self):
        """Test that exact trade name match returns the rate."""
        result = await get_dbwd_rate("Electrician", "Washington, DC", "2026-01-01")
        
        assert isinstance(result, DBWDRateRecord)
        assert result.trade == "Electrician"
        assert result.rate == 51.69
        assert result.fringe == 34.63
    
    @pytest.mark.asyncio
    async def test_case_insensitive_match(self):
        """Test that lookup is case insensitive."""
        result1 = await get_dbwd_rate("electrician", "Washington, DC", "2026-01-01")
        result2 = await get_dbwd_rate("ELECTRICIAN", "Washington, DC", "2026-01-01")
        
        assert result1.rate == result2.rate
    
    @pytest.mark.asyncio
    async def test_fuzzy_match_finds_close_trades(self):
        """Test that fuzzy matching finds similar trade names."""
        # "Electrian" is a common misspelling of "Electrician"
        result = await get_dbwd_rate("Electrian", "Washington, DC", "2026-01-01")
        
        assert result.trade == "Electrician"
    
    @pytest.mark.asyncio
    async def test_all_20_trades_retrievable(self):
        """Test that all 20 trades can be looked up."""
        expected_trades = [
            "Electrician", "Plumber", "Carpenter", "Laborer",
            "Equipment Operator", "Ironworker", "Painter", "Sheet Metal Worker",
            "HVAC Technician", "Welder", "Mason", "Roofer",
            "Glazier", "Insulation Worker", "Tile Setter", "Drywall Installer",
            "Concrete Finisher", "Surveyor", "Flagger", "Truck Driver"
        ]
        
        for trade in expected_trades:
            result = await get_dbwd_rate(trade, "Washington, DC", "2026-01-01")
            assert result.trade == trade, f"Failed to lookup {trade}"
    
    @pytest.mark.asyncio
    async def test_unknown_trade_raises_value_error(self):
        """Test that unknown trades raise ValueError."""
        with pytest.raises(ValueError) as exc_info:
            await get_dbwd_rate("UnknownTradeXYZ", "Washington, DC", "2026-01-01")
        
        assert "UnknownTradeXYZ" in str(exc_info.value)
        assert "not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_unsupported_locality_raises_value_error(self):
        """Test that lookup does not return DC rates for other localities."""
        with pytest.raises(ValueError) as exc_info:
            await get_dbwd_rate("Electrician", "New York, NY", "2026-01-01")

        assert "New York, NY" in str(exc_info.value)
        assert "No DBWD rates found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_before_effective_date_raises_value_error(self):
        """Test that rates are not returned before their effective date."""
        with pytest.raises(ValueError) as exc_info:
            await get_dbwd_rate("Electrician", "Washington, DC", "2025-12-31")

        assert "2025-12-31" in str(exc_info.value)
        assert "No DBWD rates found" in str(exc_info.value)
