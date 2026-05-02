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
from typing import TYPE_CHECKING, Any

from wcp_backend.config import settings
from wcp_backend.events.schemas import ModuleMetadata

if TYPE_CHECKING:
    from wcp_backend.events.schemas import DecisionEvent, PayrollIngestedEvent

logger = logging.getLogger(__name__)

# Lazy-initialized shared Redis client for event publishing
_redis_client: Any = None


def _get_redis_client() -> Any:
    """Return a shared async Redis client, creating it if needed."""
    global _redis_client
    if _redis_client is None:
        import redis.asyncio as aioredis

        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _redis_client


__all__ = [
    "emit_decision_event",
    "emit_payroll_ingested_event",
    "ModuleMetadata",
]

STREAM_NAME = "wcp.decisions"
PAYROLL_STREAM_NAME = "wcp.payrolls"

_background_tasks: set[asyncio.Future[Any]] = set()


def _schedule_background(coro: Any) -> None:
    task = asyncio.ensure_future(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def _publish_to_redis(stream: str, payload: dict[str, str]) -> str | None:
    """Publish a single event to a Redis stream.

    Args:
        stream: Redis stream name (e.g., "wcp.decisions").
        payload: Dict to serialize as JSON and publish.

    Returns:
        Stream entry ID on success, None on failure.
    """
    try:
        r = _get_redis_client()
        entry_id = await r.xadd(stream, payload)
        logger.debug("Published event to stream %s: %s", stream, entry_id)
        return entry_id
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
    import json

    payload = {"event": json.dumps(event.model_dump(mode="json"))}
    return await _publish_to_redis(STREAM_NAME, payload)


async def emit_payroll_ingested_event(event: PayrollIngestedEvent) -> str | None:
    """Emit a payroll ingested event to the Redis stream.

    Args:
        event: PayrollIngestedEvent instance.

    Returns:
        Stream entry ID on success, None on failure.
    """
    import json

    payload = {"event": json.dumps(event.model_dump(mode="json"))}
    return await _publish_to_redis(PAYROLL_STREAM_NAME, payload)


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
    _schedule_background(emit_decision_event(event))
    return None  # Best-effort: we don't wait for result in sync wrapper
