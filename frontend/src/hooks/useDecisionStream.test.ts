import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDecisionStream } from './useDecisionStream';

class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent | { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, ((event: unknown) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    mockEventSources.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(l => l !== listener);
  }

  close() {
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.listeners = {};
    const index = mockEventSources.indexOf(this);
    if (index !== -1) mockEventSources.splice(index, 1);
  }
}

let mockEventSources: MockEventSource[] = [];

describe('useDecisionStream', () => {
  beforeEach(() => {
    mockEventSources = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('connects and receives decisions', () => {
    const { result } = renderHook(() => useDecisionStream());

    expect(result.current.connected).toBe(false);
    expect(result.current.latestDecision).toBeNull();

    expect(mockEventSources.length).toBe(1);
    const es = mockEventSources[0];
    expect(es.url).toBe('/api/decisions/stream');

    act(() => {
      es.onopen?.();
    });

    expect(result.current.connected).toBe(true);

    const mockDecision = { decision_id: '1', status: 'approved' };
    act(() => {
      es.onmessage?.({ data: JSON.stringify(mockDecision) });
    });

    expect(result.current.latestDecision).toEqual(mockDecision);
  });

  it('ignores malformed JSON', () => {
    const { result } = renderHook(() => useDecisionStream());
    const es = mockEventSources[0];

    act(() => {
      es.onopen?.();
    });

    const mockDecision = { decision_id: '1', status: 'approved' };
    act(() => {
      es.onmessage?.({ data: JSON.stringify(mockDecision) });
    });

    act(() => {
      es.onmessage?.({ data: 'invalid json' });
    });

    expect(result.current.latestDecision).toEqual(mockDecision);
  });

  it('handles connection error and reconnects with exponential backoff', () => {
    const { result } = renderHook(() => useDecisionStream());
    const es1 = mockEventSources[0];

    act(() => {
      es1.onopen?.();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      es1.onerror?.();
    });
    expect(result.current.connected).toBe(false);
    expect(mockEventSources.length).toBe(0); // es1 was closed

    // First retry delay: 1000 * 2^0 = 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockEventSources.length).toBe(1);
    const es2 = mockEventSources[0];
    expect(es2).not.toBe(es1);

    act(() => {
      es2.onerror?.();
    });
    expect(result.current.connected).toBe(false);

    // Second retry delay: 1000 * 2^1 = 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockEventSources.length).toBe(1);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useDecisionStream());

    expect(mockEventSources.length).toBe(1);

    unmount();

    expect(mockEventSources.length).toBe(0);
  });
});
