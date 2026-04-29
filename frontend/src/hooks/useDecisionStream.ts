import { useCallback, useEffect, useRef, useState } from "react";

import type { DecisionSummary } from "../types/api.ts";
import { mockDecisionSummaries } from "../utils/mock-data.ts";

const IS_MOCK = import.meta.env.VITE_MOCK_API === "true";

export function useDecisionStream() {
  const [latestDecision, setLatestDecision] = useState<DecisionSummary | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);

  const connect = useCallback(() => {
    if (IS_MOCK) {
      setConnected(true);
      const interval = setInterval(() => {
        const random = mockDecisionSummaries[Math.floor(Math.random() * mockDecisionSummaries.length)];
        setLatestDecision({ ...random, created_at: new Date().toISOString() });
      }, 10_000);
      return () => clearInterval(interval);
    }

    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/decisions/stream");
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retryRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const decision: DecisionSummary = JSON.parse(event.data);
        setLatestDecision(decision);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      scheduleReconnect();
    };

    const scheduleReconnect = () => {
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current += 1;
      setTimeout(connect, delay);
    };

    return undefined;
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);

  return { latestDecision, connected };
}
