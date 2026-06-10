import { describe, expect, it, vi } from "vitest";
import { createEventPlayer } from "./player.js";
import { getScenario } from "./scenarios.js";

describe("createEventPlayer", () => {
  it("plays all events with delay", async () => {
    vi.useFakeTimers();
    const events = getScenario("plan-mode").events;
    const received: number[] = [];
    const player = createEventPlayer({
      events,
      delayMs: 100,
      onEvent: (_msg, index) => received.push(index),
      onComplete: () => received.push(-1),
    });

    player.play();
    await vi.runAllTimersAsync();

    expect(received).toHaveLength(events.length + 1);
    expect(received.at(-1)).toBe(-1);
    vi.useRealTimers();
  });

  it("supports pause and resume", async () => {
    vi.useFakeTimers();
    const events = getScenario("edit-failure").events.slice(0, 4);
    let count = 0;
    const player = createEventPlayer({
      events,
      delayMs: 50,
      onEvent: () => {
        count += 1;
      },
    });

    player.play();
    await vi.advanceTimersByTimeAsync(60);
    player.pause();
    const pausedCount = count;
    await vi.advanceTimersByTimeAsync(200);
    expect(count).toBe(pausedCount);

    player.resume();
    await vi.runAllTimersAsync();
    expect(count).toBe(events.length);
    vi.useRealTimers();
  });

  it("scales delay with speed", async () => {
    vi.useFakeTimers();
    const events = getScenario("config-change").events.slice(0, 3);
    let count = 0;
    const player = createEventPlayer({
      events,
      delayMs: 100,
      onEvent: () => {
        count += 1;
      },
    });

    player.setSpeed(2);
    player.play();
    await vi.advanceTimersByTimeAsync(75);
    expect(count).toBe(2);
    vi.useRealTimers();
  });
});
