"""Unit tests for auth validation endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from wcp_backend.api.auth import _verify_password


class TestVerifyPassword:
    """Test password hashing verification."""

    def test_verify_correct_password(self):
        """Test that correct password verifies successfully."""
        import bcrypt

        hashed = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode("utf-8")
        assert _verify_password("secret123", hashed) is True

    def test_verify_wrong_password(self):
        """Test that wrong password fails verification."""
        import bcrypt

        hashed = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode("utf-8")
        assert _verify_password("wrongpassword", hashed) is False


class TestAuthValidateEndpoint:
    """Test auth /validate endpoint."""

    async def test_missing_user_returns_invalid(self, client, monkeypatch):
        """Test that non-existent email returns valid=false."""
        monkeypatch.setattr(
            "wcp_backend.api.auth.async_session",
            MagicMock(
                return_value=AsyncMock(
                    __aenter__=AsyncMock(
                        return_value=AsyncMock(
                            execute=AsyncMock(
                                return_value=MagicMock(fetchone=MagicMock(return_value=None))
                            )
                        )
                    ),
                    __aexit__=AsyncMock(return_value=None),
                )
            ),
        )

        response = client.post(
            "/auth/validate",
            json={"email": "nonexistent@example.com", "password": "password"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert data["user_id"] is None

    async def test_valid_credentials_return_user_info(self, client, monkeypatch):
        """Test that correct credentials return valid=true with user info."""
        import bcrypt

        hashed = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode("utf-8")

        mock_row = MagicMock()
        mock_row.id = "user-123"
        mock_row.password_hash = hashed
        mock_row.role = "admin"

        monkeypatch.setattr(
            "wcp_backend.api.auth.async_session",
            MagicMock(
                return_value=AsyncMock(
                    __aenter__=AsyncMock(
                        return_value=AsyncMock(
                            execute=AsyncMock(
                                return_value=MagicMock(fetchone=MagicMock(return_value=mock_row))
                            )
                        )
                    ),
                    __aexit__=AsyncMock(return_value=None),
                )
            ),
        )

        response = client.post(
            "/auth/validate",
            json={"email": "test@example.com", "password": "secret123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["user_id"] == "user-123"
        assert data["role"] == "admin"
