"""Events — Redis Streams producer (V4).

Purpose: Emit real-time decision events to Redis Streams whenever a decision is
persisted. Enables live dashboard updates and cross-service event consumption.

Responsibilities:
- emit_decision_event(): XADD to decisions:stream on decision persist
- Event schema definition (DecisionEvent Pydantic model)
- Consumer group management for downstream consumers

Best-effort / non-blocking: if Redis is unavailable, events are logged but
do not raise errors or block the calling code. This ensures the primary
decision path is never blocked by Redis unavailability.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from wcp_backend.config import settings

if TYPE_CHECKING:
    from wcp_backend.events.schemas import DecisionEvent, PayrollIngestedEvent

logger = logging.getLogger(__name__)

__all__ = [
    "emit_decision_event",
    "emit_payroll_ingested_event",
    "ModuleMetadata",
]

STREAM_NAME = "wcp.decisions"
PAYROLL_STREAM_NAME = "wcp.payrolls"


class ModuleMetadata:
    MODULE_NAME = "events"
    MODULE_OWNER = "v4"


async def _publish_to_redis(stream: str, payload: dict[str, str]) -> str | None:
    """Internal helper to publish a payload to a Redis stream.

    Returns stream entry ID on success, None on failure.
    Non-blocking: catches all exceptions and logs them.
    """
    try:
        import redis.asyncio as redis

        redis_url = getattr(settings, "redis_url", "redis://localhost:6379")
        r = redis.from_url(redis_url, decode_responses=True)
        try:
            entry_id = await r.xadd(stream, payload)
            logger.debug("Published event to stream %s: %s", stream, entry_id)
            return entry_id
        finally:
            await r.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Failed to publish event to Redis stream %s (non-fatal): %s",
            stream,
            exc,
        )
        return None


async def emit_decision_event(event: DecisionEvent) -> str | None:
    """Emit a decision event to the Redis stream.

    Args:
        event: DecisionEvent instance (Pydantic model from schemas.py).

    Returns:
        Stream entry ID (e.g., "1706119234567-0") on success, None on failure.

    Note:
        This is best-effort / non-blocking. If Redis is unavailable,
        the event is logged but no exception is raised. The primary
        decision path should never be blocked by Redis unavailability.
    """
    payload = event.to_redis_payload()
    return await _publish_to_redis(STREAM_NAME, payload)


async def emit_payroll_ingested_event(event: PayrollIngestedEvent) -> str | None:
    """Emit a payroll ingested event to the Redis stream.

    Args:
        event: PayrollIngestedEvent instance.

    Returns:
        Stream entry ID on success, None on failure.
    """
    payload = event.to_redis_payload()
    return await _publish_to_redis(PAYROLL_STREAM_NAME, payload)


async def emit_event(stream: str, event_data: dict) -> str | None:
    """Generic event emitter for any stream with a dict payload.

    Args:
        stream: Redis stream name.
        event_data: Dict to serialize as JSON and publish.

    Returns:
        Stream entry ID on success, None on failure.
    """
    import json

    return await _publish_to_redis(stream, {"event": json.dumps(event_data)})


# Synchronous wrapper for use in non-async contexts (e.g., Celery tasks)
def emit_decision_event_sync(event: DecisionEvent) -> str | None:
    """Synchronous wrapper for emit_decision_event.

    Use this from Celery tasks or other sync contexts.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No running loop — create a new one (blocking, use only in sync contexts)
        return asyncio.run(emit_decision_event(event))

    # Schedule on existing loop (non-blocking from caller's perspective)
    asyncio.ensure_future(emit_decision_event(event))
    return None  # Best-effort: we don't wait for result in sync wrapper
