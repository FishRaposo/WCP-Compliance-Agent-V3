import { useEffect, useState } from "react";

// SSE hook for real-time decision updates.
export function useDecisionStream() {
  const [latestDecision, setLatestDecision] = useState<unknown>(null);

  useEffect(() => {
    // TODO: implement SSE connection to /api/decisions/stream
    return () => {};
  }, []);

  return { latestDecision };
}
