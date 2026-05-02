import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DecisionEvent {
  decision_id: string;
  status: "Approved" | "Revise" | "Rejected" | "Pending Human Review";
  trust_score: number;
  trade: string;
  locality: string;
  model_used?: string;
  timestamp: string;
}

type ConnectionState = "connecting" | "connected" | "reconnecting" | "error";

interface LiveFeedProps {
  maxItems?: number;
}

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function StatusBadge({ status }: { status: DecisionEvent["status"] }) {
  const colors = {
    Approved: "bg-green-100 text-green-800",
    Revise: "bg-yellow-100 text-yellow-800",
    Rejected: "bg-red-100 text-red-800",
    "Pending Human Review": "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  connecting: "bg-yellow-500",
  connected: "bg-green-500",
  reconnecting: "bg-yellow-500 animate-pulse",
  error: "bg-red-500",
};

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: "Connecting...",
  connected: "Live",
  reconnecting: "Reconnecting...",
  error: "Connection error",
};

export function LiveFeed({ maxItems = 50 }: LiveFeedProps) {
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const esRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const connect = () => {
      setConnectionState("connecting");
      const es = new EventSource("/api/events/subscribe?stream=wcp.decisions");
      esRef.current = es;

      es.onopen = () => {
        setConnectionState("connected");
        // Heartbeat ping every 30 seconds to keep connection alive
        heartbeatRef.current = setInterval(() => {
          // Server-side event source heartbeat is handled by the server sending comment messages
          // Client just monitors the connection state
        }, 30000);
      };

      const handleEvent = (e: MessageEvent) => {
        try {
          const event = normalizeDecisionEvent(JSON.parse(e.data));
          if (!event) return;
          setEvents((prev) => [event, ...prev].slice(0, maxItems));
        } catch {
          // Ignore parse errors for non-JSON messages (e.g., heartbeat comments)
        }
      };

      es.onmessage = handleEvent;
      es.addEventListener("decision.created", handleEvent);
      es.addEventListener("job.completed", handleEvent);

      es.onerror = () => {
        setConnectionState("reconnecting");
        es.close();
        clearInterval(heartbeatRef.current ?? undefined);
        // Exponential backoff capped at 30 seconds
        retryTimeoutRef.current = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      clearTimeout(retryTimeoutRef.current ?? undefined);
      clearInterval(heartbeatRef.current ?? undefined);
    };
  }, [maxItems]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span>Live Feed</span>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${CONNECTION_COLORS[connectionState]} ${connectionState === "reconnecting" ? "animate-pulse" : ""}`} />
            <span className="text-xs text-muted-foreground">{CONNECTION_LABELS[connectionState]}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {connectionState === "reconnecting" || connectionState === "connecting"
              ? "Connecting to live feed..."
              : connectionState === "error"
              ? "Connection error. Retrying..."
              : "Waiting for events..."}
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {events.map((event) => (
              <div key={event.decision_id} className="flex items-center gap-3 text-xs p-2 rounded hover:bg-muted/50">
                <StatusBadge status={event.status} />
                <span className="font-medium">{event.trade}</span>
                <span className="text-muted-foreground truncate flex-1">{event.locality}</span>
                <span className="font-mono">{event.trust_score.toFixed(2)}</span>
                <span className="text-muted-foreground tabular-nums">{relativeTime(event.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function normalizeDecisionEvent(raw: unknown): DecisionEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const nested = typeof data.event === "string" ? safeParse(data.event) : data;
  if (!nested || typeof nested !== "object") return null;
  const event = nested as Record<string, unknown>;
  const decisionId = event.decision_id ?? event.id;
  if (typeof decisionId !== "string") return null;
  const verdict = String(event.status ?? event.verdict ?? "Pending Human Review");
  return {
    decision_id: decisionId,
    status: normalizeStatus(verdict),
    trust_score: Number(event.trust_score ?? 0),
    trade: String(event.trade ?? event.trade_code ?? "unknown"),
    locality: String(event.locality ?? "unknown"),
    model_used: typeof event.model_used === "string" ? event.model_used : undefined,
    timestamp: String(event.timestamp ?? event.created_at ?? new Date().toISOString()),
  };
}

function normalizeStatus(value: string): DecisionEvent["status"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("approve")) return "Approved";
  if (normalized.includes("reject")) return "Rejected";
  if (normalized.includes("revise")) return "Revise";
  return "Pending Human Review";
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
