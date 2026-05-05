"""Authentication API — user validation for agent JWT issuance."""

from __future__ import annotations

import logging

import bcrypt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from wcp_backend.services.db import async_session
from wcp_backend.services.tables import users_table

logger = logging.getLogger(__name__)
router = APIRouter()


class AuthValidateRequest(BaseModel):
    email: str
    password: str


class AuthValidateResponse(BaseModel):
    valid: bool
    user_id: str | None = None
    role: str | None = None


@router.post("/validate", response_model=AuthValidateResponse)
async def validate_credentials(
    request: AuthValidateRequest,
) -> AuthValidateResponse:
    """Validate user credentials. Returns user info on success."""
    try:
        async with async_session() as session:
            query = select(users_table).where(users_table.c.email == request.email)
            result = await session.execute(query)
            row = result.fetchone()

            if not row:
                return AuthValidateResponse(valid=False)

            if not _verify_password(request.password, row.password_hash):
                return AuthValidateResponse(valid=False)

            return AuthValidateResponse(
                valid=True,
                user_id=str(row.id),
                role=row.role,
            )
    except Exception as e:
        logger.exception("validate_credentials failed")
        raise HTTPException(status_code=500, detail="Authentication error") from e


def _verify_password(plain: str, hashed: str) -> bool:
    return bool(bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8")))
