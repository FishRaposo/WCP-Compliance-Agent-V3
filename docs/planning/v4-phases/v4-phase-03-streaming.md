# V4 Phase 3 — Streaming

**Goal:** Add Redis Streams for real-time decision event streaming. Backend publishes events on decision persist, agent gateway consumes and pushes via SSE to React analytics dashboard.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry run pytest tests/unit -v             # All tests pass

# Test event emission
poetry run python -c "
import asyncio
from wcp_backend.events.producer import emit_decision_event
from wcp_backend.events.schemas import DecisionEvent
event = DecisionEvent(
    decision_id='test-123', status='Approved', trust_score=0.94,
    trust_band='auto', trade='ELEC', locality='Boston', violation_count=0,
    model_used='gpt-4o', cost_usd=0.08, latency_ms=1800,
    timestamp=datetime.utcnow()
)
# Should not throw
"

# Test SSE endpoint
cd agent
npm ci && npm run typecheck && npm test     # 0 errors

# Test SSE from browser
# Open http://localhost:5173/analytics
# Submit a WCP analysis via /analyze
# Decision event should appear in LiveFeed within 500ms
```

**Do not declare Phase 3 complete until decision events flow from backend → Redis → agent → SSE → React in under 500ms.**

---

## Goals

1. Create DecisionEvent Pydantic model
2. Create Redis Streams producer (backend)
3. Create Redis Streams consumer (agent)
4. Create SSE push endpoint (agent)
5. Add LiveFeed component to React analytics
6. Add event consumer tests
7. Measure end-to-end latency

---

## Task Breakdown

### 3.1 — Create Event Schemas

**Destination:** `backend/src/wcp_backend/events/schemas.py`

```python
from pydantic import BaseModel, Field
from datetime import datetime

class DecisionEvent(BaseModel):
    decision_id: str
    contract_id: str | None = None
    status: str = Field(description="Approved | Revise | Rejected | Pending Human Review")
    trust_score: float = Field(ge=0.0, le=1.0)
    trust_band: str = Field(description="auto | flag | human")
    trade: str
    locality: str
    violation_count: int = Field(ge=0)
    model_used: str
    cost_usd: float = Field(ge=0)
    latency_ms: int = Field(ge=0)
    timestamp: datetime
```

---

### 3.2 — Create Redis Streams Producer

**Destination:** `backend/src/wcp_backend/events/producer.py`

```python
import redis.asyncio as redis
from .schemas import DecisionEvent
from ..config import Settings

async def emit_decision_event(event: DecisionEvent, settings: Settings) -> None:
    client = redis.from_url(settings.redis_url)
    try:
        await client.xadd(
            "decisions:stream",
            {"data": event.model_dump_json()},
            maxlen=100000
        )
    finally:
        await client.aclose()
```

**Integration point:** Hook into V3's `services/audit.py` after decision persist:

```python
# In audit.py, after successful INSERT to decisions table:
from ..events.producer import emit_decision_event
from ..events.schemas import DecisionEvent

event = DecisionEvent(
    decision_id=decision.id,
    contract_id=decision.contract_id,
    status=decision.verdict,
    trust_score=decision.trust_score,
    trust_band=decision.trust_band,
    trade=extracted.trade_code,
    locality=extracted.locality_code,
    violation_count=decision.violation_count,
    model_used=decision.model,
    cost_usd=decision.cost_usd,
    latency_ms=decision.latency_ms,
    timestamp=datetime.utcnow(),
)
await emit_decision_event(event, settings)
```

**Important:** Event emission is fire-and-forget. If Redis is unavailable, the decision still persists. Event emission failure is logged but does not block the V3 pipeline.

---

### 3.3 — Create Redis Streams Consumer (Agent)

**Destination:** `agent/src/events/consumer.ts`

```typescript
import { createClient, type RedisClientType } from "redis";
import { logger } from "../utils/logger.js";

const STREAM_KEY = "decisions:stream";
const GROUP_NAME = "agent-sse";
const CONSUMER_NAME = `agent-${process.pid}`;

let consumer: RedisClientType | null = null;

export async function startConsumer(redisUrl: string): Promise<void> {
  consumer = createClient({ url: redisUrl }) as RedisClientType;
  await consumer.connect();

  try {
    await consumer.xGroupCreate(STREAM_KEY, GROUP_NAME, "0", { MKSTREAM: true });
  } catch (e: any) {
    if (!e.message.includes("BUSYGROUP")) throw e;
  }

  logger.info({ group: GROUP_NAME, consumer: CONSUMER_NAME }, "Redis Streams consumer started");

  while (true) {
    try {
      const response = await consumer.xReadGroup(
        "GROUP", GROUP_NAME, CONSUMER_NAME,
        "BLOCK", 5000,
        "COUNT", 10,
        "STREAMS", STREAM_KEY, ">"
      );

      if (!response) continue;

      for (const stream of response) {
        for (const message of stream.messages) {
          try {
            const event = JSON.parse(message.message.data);
            pushToClients(event);
            await consumer.xAck(STREAM_KEY, GROUP_NAME, message.id);
          } catch (e) {
            logger.error({ error: e, messageId: message.id }, "Failed to process stream message");
          }
        }
      }
    } catch (e) {
      logger.error({ error: e }, "Consumer loop error, reconnecting...");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
```

---

### 3.4 — Create SSE Push Manager

**Destination:** `agent/src/events/sse.ts`

```typescript
import type { Context } from "hono";
import { SSEStreamingApi } from "hono/streaming";

interface SSEClient {
  id: string;
  stream: SSEStreamingApi;
  connectedAt: Date;
}

const clients: SSEClient[] = [];

export function addClient(id: string, stream: SSEStreamingApi): void {
  clients.push({ id, stream, connectedAt: new Date() });
}

export function removeClient(id: string): void {
  const index = clients.findIndex((c) => c.id === id);
  if (index >= 0) clients.splice(index, 1);
}

export function pushToClients(event: Record<string, unknown>): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.stream.writeSSE({ event: "decision", data });
    } catch {
      removeClient(client.id);
    }
  }
}

export function getClientCount(): number {
  return clients.length;
}
```

---

### 3.5 — Create SSE Endpoint in Agent

**Destination:** `agent/src/api/v4-events.ts`

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { addClient, removeClient, getClientCount } from "../events/sse.js";
import { randomUUID } from "crypto";

const v4Events = new Hono();

v4Events.get("/subscribe", async (c) => {
  const clientId = randomUUID();

  return streamSSE(c, async (stream) => {
    addClient(clientId, stream);

    stream.writeSSE({ event: "connected", data: JSON.stringify({ clientId }) });

    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: JSON.stringify({ timestamp: new Date().toISOString() }) });
    }, 30000);

    stream.onAbort(() => {
      clearInterval(heartbeat);
      removeClient(clientId);
    });

    await new Promise(() => {});
  });
});

export { v4Events };
```

**Mount in server.ts:**
```typescript
app.route("/api/events", v4Events);
```

---

### 3.6 — Add LiveFeed Component

**Destination:** `frontend/src/components/analytics/LiveFeed.tsx`

```typescript
import { useState, useEffect } from "react";

interface DecisionEvent {
  decision_id: string;
  status: string;
  trust_score: number;
  trade: string;
  locality: string;
  model_used: string;
  timestamp: string;
}

interface LiveFeedProps {
  maxItems?: number;
}

export function LiveFeed({ maxItems = 50 }: LiveFeedProps) {
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events/subscribe");

    es.addEventListener("connected", () => setConnected(true));
    es.addEventListener("decision", (e) => {
      const event: DecisionEvent = JSON.parse((e as MessageEvent).data);
      setEvents((prev) => [event, ...prev].slice(0, maxItems));
    });
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [maxItems]);

  return (
    <div>
      <div>Live Feed {connected ? "🟢" : "🔴"}</div>
      <div>
        {events.map((e, i) => (
          <div key={i}>
            <span>{e.status === "Approved" ? "✅" : e.status === "Revise" ? "⚠️" : "❌"}</span>
            <span>{e.trade}</span>
            <span>{e.locality}</span>
            <span>{e.trust_score.toFixed(2)}</span>
            <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 3.7 — Add Streaming Tests

**Backend test:** `backend/tests/unit/test_events.py`

```python
import pytest
from wcp_backend.events.schemas import DecisionEvent
from wcp_backend.events.producer import emit_decision_event
from datetime import datetime

class TestDecisionEvent:
    def test_valid_event(self):
        event = DecisionEvent(
            decision_id="test-123", status="Approved", trust_score=0.94,
            trust_band="auto", trade="ELEC", locality="Boston", violation_count=0,
            model_used="gpt-4o", cost_usd=0.08, latency_ms=1800,
            timestamp=datetime.utcnow()
        )
        assert event.decision_id == "test-123"

    def test_invalid_trust_score(self):
        with pytest.raises(ValidationError):
            DecisionEvent(
                decision_id="test", status="Approved", trust_score=1.5,
                trust_band="auto", trade="ELEC", locality="Boston",
                violation_count=0, model_used="gpt-4o", cost_usd=0.08,
                latency_ms=100, timestamp=datetime.utcnow()
            )

    def test_negative_cost_rejected(self):
        with pytest.raises(ValidationError):
            DecisionEvent(
                decision_id="test", status="Approved", trust_score=0.5,
                trust_band="auto", trade="ELEC", locality="Boston",
                violation_count=0, model_used="gpt-4o", cost_usd=-1.0,
                latency_ms=100, timestamp=datetime.utcnow()
            )
```

**Agent test:** `agent/src/tests/unit/streaming.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { DecisionEventSchema } from "../../events/schemas.js";

describe("Event streaming", () => {
  it("validates DecisionEvent schema", () => {
    const event = {
      decision_id: "test-123",
      status: "Approved",
      trust_score: 0.94,
      trust_band: "auto",
      trade: "ELEC",
      locality: "Boston",
      violation_count: 0,
      model_used: "gpt-4o",
      cost_usd: 0.08,
      latency_ms: 1800,
      timestamp: new Date().toISOString(),
    };
    expect(() => DecisionEventSchema.parse(event)).not.toThrow();
  });
});
```

**Minimum: 3 backend tests + 1 agent test**

---

## Architecture Notes

### Redis Streams Already Exists
V3 already uses Redis for Celery broker and DBWD caching. V4 adds a new stream key `decisions:stream` to the same Redis instance. Zero new infrastructure.

### Fire-and-Forget Event Emission
Event emission in the backend is non-blocking. If Redis is down, the decision still persists. This ensures V3's reliability is not affected by V4's streaming feature.

### Consumer Group for Exactly-Once Processing
Using Redis consumer groups (`XREADGROUP`) ensures each event is delivered to exactly one consumer in the group. If the agent crashes, unacknowledged messages are re-delivered.

### SSE Heartbeat
The SSE endpoint sends a heartbeat every 30 seconds. This prevents load balancers and proxies from closing idle connections. React's `EventSource` handles reconnection automatically.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Redis unavailable blocks decision persist | Medium | High | Fire-and-forget pattern. Event emission is async and non-blocking |
| SSE connection drops | Medium | Low | EventSource auto-reconnects. Missed events filled on reconnect via analytics API |
| High event volume overwhelms SSE clients | Low | Medium | Consumer batch size (10). Client-side buffering. Rate-limit if needed |
| Memory leak from accumulated SSE clients | Low | High | `onAbort` handler cleans up. `removeClient()` on write failure |

---

## Command Reference

```bash
# Backend
cd backend
poetry run pytest tests/unit/test_events.py -v

# Agent
cd agent
npm ci && npm run typecheck && npm test

# Manual test: watch Redis stream
redis-cli XREAD COUNT 10 STREAMS decisions:stream $

# Manual test: SSE from curl
curl -N http://localhost:3000/api/events/subscribe
```

---

*Phase 3 document version: 2026-04-30*
*Blocked by: Phase 1 (analytics foundation) — LiveFeed renders on analytics page*
