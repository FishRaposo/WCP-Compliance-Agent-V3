# ADR-013: Redis Streams for Event Streaming

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 needs real-time decision event streaming: every time a decision is persisted, an event should propagate to the analytics dashboard in under 500ms. This requires a publish-subscribe mechanism with persistence and consumer group support.

Options:
1. **Apache Kafka:** Industry standard for event streaming
2. **RabbitMQ:** Message broker with pub/sub
3. **Redis Streams:** Lightweight streaming on existing Redis infrastructure
4. **WebSocket:** Direct push without message broker

---

## Decision

Use **Redis Streams** for real-time decision event streaming.

---

## Rationale

**Already have Redis:**
- V3 uses Redis for Celery broker and DBWD caching
- Zero new infrastructure — just a new stream key
- Same connection, same server, same operational model

**Right-scale patterns:**
- Consumer groups for exactly-once processing (same pattern as Kafka)
- Message persistence (unlike Redis Pub/Sub)
- Message acknowledgment (consumer confirms processing)
- `XREADGROUP` blocking read with timeout

**Why not Kafka:**
- Kafka for ~100 decisions/day is architectural overkill
- Kafka requires Zookeeper or KRaft, separate JVM processes
- Kafka adds significant operational complexity for a single-developer project
- "Using Kafka for this scale is resume padding, not engineering"

**Why not RabbitMQ:**
- RabbitMQ is a message broker, not an event stream
- Adds a new service to operate
- Redis Streams provides the same pub/sub + consumer group patterns

---

## Technical Capabilities

```python
# Producer (backend)
await redis.xadd("decisions:stream", {"data": event.json()}, maxlen=100000)

# Consumer (agent)
messages = await redis.xreadgroup(
    "GROUP", "agent-sse", "agent-1",
    "BLOCK", 5000, "COUNT", 10,
    "STREAMS", "decisions:stream", ">"
)
```

---

## When NOT to Use Redis Streams

| Scenario | Better Alternative |
|---|---|
| >10K events/second | Kafka (partitioning, higher throughput) |
| Multi-datacenter replication | Kafka MirrorMaker, NATS |
| Complex routing/topology | RabbitMQ (exchanges, bindings) |
| Long-term event storage | Kafka (log compaction) |

For V4 compliance decisions (100-1000/day), Redis Streams is the right choice.

---

## Consequences

**Positive:**
- Zero new infrastructure (uses existing Redis)
- Consumer groups for reliable processing
- Message persistence (no lost events on consumer crash)
- Simple API (XADD, XREADGROUP, XACK)

**Negative:**
- Not horizontally scalable (single Redis node)
- Max stream length requires tuning (MAXLEN policy)
- No built-in schema registry (handled by Pydantic)

---

## Related

- ADR-008: redis.asyncio (V3 uses same Redis instance)
- [V4 Data Flows](../architecture/v4-data-flows.md) — Flow 2: Real-time streaming
- [V3/V4 Boundary](../planning/V3_V4_BOUNDARY.md) — Event contract
