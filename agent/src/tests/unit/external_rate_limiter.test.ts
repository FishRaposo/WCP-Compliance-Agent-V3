import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ExternalAPIRateLimiter } from "../../utils/rate_limiter.js";

describe("ExternalAPIRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should execute up to maxConcurrent requests immediately", async () => {
    const limiter = new ExternalAPIRateLimiter(3, 1000);
    const executions: number[] = [];

    const createTask = (id: number) => {
      return limiter.throttle(async () => {
        executions.push(id);
        await new Promise(r => setTimeout(r, 100)); // task takes 100ms
      });
    };

    // start 4 tasks
    const p1 = createTask(1);
    const p2 = createTask(2);
    const p3 = createTask(3);
    const p4 = createTask(4);

    // Initial tick to let them start
    await Promise.resolve();

    // Only 3 should have started
    expect(executions).toEqual([1, 2, 3]);

    // advance by 100ms so tasks finish
    await vi.advanceTimersByTimeAsync(100);

    // they finished, but we don't have a new token yet (needs 1000ms)
    expect(executions).toEqual([1, 2, 3]);

    // advance to 1000ms for token refill
    await vi.advanceTimersByTimeAsync(900);

    expect(executions).toEqual([1, 2, 3, 4]);
  });

  it("should refill tokens correctly over time", async () => {
    const limiter = new ExternalAPIRateLimiter(2, 500);
    let active = 0;
    const history: { time: number, active: number }[] = [];

    const createTask = () => {
      return limiter.throttle(async () => {
        active++;
        history.push({ time: Date.now(), active });
        await new Promise(r => setTimeout(r, 100));
        active--;
      });
    };

    const startTime = Date.now();
    vi.setSystemTime(startTime);

    for (let i = 0; i < 5; i++) {
      createTask();
    }

    await Promise.resolve();
    expect(active).toBe(2); // First 2 started

    await vi.advanceTimersByTimeAsync(100); // 100ms: first 2 finish
    expect(active).toBe(0);

    await vi.advanceTimersByTimeAsync(400); // 500ms total: 1 token refilled
    expect(active).toBe(1);

    await vi.advanceTimersByTimeAsync(100); // 600ms total: finishes
    expect(active).toBe(0);

    await vi.advanceTimersByTimeAsync(400); // 1000ms total: 1 token refilled
    expect(active).toBe(1);

    await vi.advanceTimersByTimeAsync(100); // 1100ms total: finishes
    expect(active).toBe(0);

    await vi.advanceTimersByTimeAsync(400); // 1500ms total: last token refilled
    expect(active).toBe(1);
  });
});
