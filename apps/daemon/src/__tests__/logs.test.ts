import { LogHub } from "../exec/logs.js";
import type { LogEvent } from "../exec/target.js";
import { takeEvents } from "./helpers.js";

function event(text: string): LogEvent {
  return { source: "stdout", text, timestamp: Date.now() };
}

describe("LogHub", () => {
  it("delivers events to two concurrent consumers in order", async () => {
    const hub = new LogHub();
    const first = hub.subscribe();
    const second = hub.subscribe();
    hub.emit(event("one"));
    hub.emit(event("two"));
    hub.emit(event("three"));

    const fromFirst = await takeEvents(first, 3);
    const fromSecond = await takeEvents(second, 3);
    expect(fromFirst.map((e) => e.text)).toEqual(["one", "two", "three"]);
    expect(fromSecond.map((e) => e.text)).toEqual(["one", "two", "three"]);
  });

  it("replays buffered history to late subscribers before live events", async () => {
    const hub = new LogHub();
    hub.emit(event("early-1"));
    hub.emit(event("early-2"));

    const late = hub.subscribe();
    hub.emit(event("live-3"));
    const events = await takeEvents(late, 3);
    expect(events.map((e) => e.text)).toEqual(["early-1", "early-2", "live-3"]);
  });

  it("evicts oldest events once the ring buffer cap is exceeded", async () => {
    const hub = new LogHub(5);
    for (let i = 1; i <= 8; i++) {
      hub.emit(event(`e${i}`));
    }
    const events = await takeEvents(hub.subscribe(), 5);
    expect(events.map((e) => e.text)).toEqual(["e4", "e5", "e6", "e7", "e8"]);
  });

  it("line-buffers chunks and strips ANSI from complete lines", async () => {
    const hub = new LogHub();
    const ingestor = hub.createLineIngestor({ source: "stdout", workflow: "dev", pid: 123 });
    const line = "  \x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m5173\x1b[22m/\x1b[39m";
    // The ANSI escape and the URL are split across chunks mid-sequence.
    ingestor.write(line.slice(0, 25));
    ingestor.write(`${line.slice(25)}\nsecond line\npartial`);
    ingestor.flush();

    const events = await takeEvents(hub.subscribe(), 3);
    expect(events[0]?.text).toBe("  ➜  Local:   http://localhost:5173/");
    expect(events[0]?.workflow).toBe("dev");
    expect(events[0]?.pid).toBe(123);
    expect(events[1]?.text).toBe("second line");
    expect(events[2]?.text).toBe("partial");
  });

  it("terminates all consumers cleanly on close", async () => {
    const hub = new LogHub();
    const subscription = hub.subscribe();
    hub.emit(event("last"));
    hub.close();

    const received: string[] = [];
    for await (const e of subscription) {
      received.push(e.text);
    }
    expect(received).toEqual(["last"]);

    // Post-close subscriptions terminate immediately and emit() is a no-op.
    hub.emit(event("ignored"));
    const after: string[] = [];
    for await (const e of hub.subscribe()) {
      after.push(e.text);
    }
    expect(after).toEqual([]);
  });
});
