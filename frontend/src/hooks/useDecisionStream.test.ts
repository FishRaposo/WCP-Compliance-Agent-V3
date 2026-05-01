import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mockDecisionSummaries } from "../utils/mock-data";

// Define MockEventSource in module scope so we can track instances
class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState: number = 0;

  static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helpers
  triggerOpen() {
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: string) {
    if (this.onmessage) this.onmessage({ data });
  }

  triggerError() {
    if (this.onerror) this.onerror();
  }
}

describe("useDecisionStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", MockEventSource);
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  describe("when VITE_MOCK_API is false", () => {
    let useDecisionStream: typeof import('./useDecisionStream').useDecisionStream;

    beforeEach(async () => {
      vi.resetModules();
      vi.stubEnv('VITE_MOCK_API', 'false');
      const module = await import('./useDecisionStream');
      useDecisionStream = module.useDecisionStream;
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should connect and set connected to true on open", () => {
      const { result } = renderHook(() => useDecisionStream());

      expect(MockEventSource.instances).toHaveLength(1);
      expect(result.current.connected).toBe(false);

      const es = MockEventSource.instances[0];
      act(() => {
        es.triggerOpen();
      });

      expect(result.current.connected).toBe(true);
    });

    it("should parse and set valid messages", () => {
      const { result } = renderHook(() => useDecisionStream());

      expect(MockEventSource.instances).toHaveLength(1);
      const es = MockEventSource.instances[0];

      act(() => {
        es.triggerOpen();
      });

      const mockDecision = mockDecisionSummaries[0];

      act(() => {
        es.triggerMessage(JSON.stringify(mockDecision));
      });

      expect(result.current.latestDecision).toEqual(mockDecision);
    });

    it("should ignore malformed messages", () => {
      const { result } = renderHook(() => useDecisionStream());

      expect(MockEventSource.instances).toHaveLength(1);
      const es = MockEventSource.instances[0];

      act(() => {
        es.triggerOpen();
      });

      act(() => {
        es.triggerMessage("invalid json");
      });

      // Should not crash and should remain null
      expect(result.current.latestDecision).toBeNull();
    });

    it("should reconnect with exponential backoff on error", () => {
      const { result } = renderHook(() => useDecisionStream());

      expect(MockEventSource.instances).toHaveLength(1);
      const es1 = MockEventSource.instances[0];

      act(() => {
        es1.triggerOpen();
      });

      expect(result.current.connected).toBe(true);

      // Trigger error
      act(() => {
        es1.triggerError();
      });

      expect(result.current.connected).toBe(false);
      expect(es1.readyState).toBe(2); // CLOSED

      // First retry delay is Math.min(1000 * 2^0, 30_000) = 1000ms
      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(MockEventSource.instances.length).toBe(1); // Not reconnected yet

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(MockEventSource.instances.length).toBe(2); // Reconnected!

      const es2 = MockEventSource.instances[1];

      // Trigger error again to test next backoff
      act(() => {
        es2.triggerError();
      });

      // Second retry delay is Math.min(1000 * 2^1, 30_000) = 2000ms
      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(MockEventSource.instances.length).toBe(2);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(MockEventSource.instances.length).toBe(3);
    });

    it("should cap exponential backoff at 30 seconds", () => {
      const { result } = renderHook(() => useDecisionStream());
      expect(MockEventSource.instances).toHaveLength(1);

      // Force many failures to exceed 30 seconds (2^5 * 1000 = 32000)
      for (let i = 0; i < 6; i++) {
        const es = MockEventSource.instances[MockEventSource.instances.length - 1];
        act(() => {
          es.triggerError();
        });
        // Fast forward past the delay
        act(() => {
          vi.runAllTimers();
        });
      }

      const currentInstances = MockEventSource.instances.length;

      // The delay for the 6th retry should be capped at 30000ms
      const es = MockEventSource.instances[currentInstances - 1];
      act(() => {
        es.triggerError();
      });

      act(() => {
        vi.advanceTimersByTime(29999);
      });
      expect(MockEventSource.instances.length).toBe(currentInstances);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(MockEventSource.instances.length).toBe(currentInstances + 1);
    });

    it("should close EventSource on unmount", () => {
      const { unmount } = renderHook(() => useDecisionStream());
      expect(MockEventSource.instances).toHaveLength(1);
      const es = MockEventSource.instances[0];

      unmount();

      expect(es.readyState).toBe(2); // CLOSED
    });
  });
});
