/**
 * Unit tests for attachDaemonInfoLog — the bus->log forwarder used in daemon
 * mode to make `bus.emit({ type: "info" })` visible without --console.
 *
 * See F7 in projects/may-agent.app/docs/archive/implementation/2026-05-19-e2e-harness-findings.md.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import { attachDaemonInfoLog } from "../../src/app/transport/daemon-info-log.js";
import { addLogSubscriber } from "../../src/lib/log.js";

describe("attachDaemonInfoLog", () => {
  let captured: Array<{ level: string; message: string }>;
  let detach: () => void;

  beforeEach(() => {
    captured = [];
    detach = addLogSubscriber((level, message) => {
      captured.push({ level, message });
    });
  });

  afterEach(() => {
    detach();
  });

  test("forwards info bus events to log() as info-level entries", () => {
    const bus = new EventBus();
    attachDaemonInfoLog(bus);
    bus.emit({ type: "info", message: "[reload] 1 updated (may)" });
    bus.emit({ type: "info", message: "[telegram] Bot enabled (1 chat)" });
    const infos = captured.filter((c) => c.level === "info");
    expect(infos.map((c) => c.message)).toEqual([
      "[reload] 1 updated (may)",
      "[telegram] Bot enabled (1 chat)",
    ]);
  });

  test("ignores non-info bus events", () => {
    const bus = new EventBus();
    attachDaemonInfoLog(bus);
    bus.emit({
      type: "session.start",
      sessionId: "s_test",
      data: { sessionId: "s_test", agent: "may", task: "t" },
    } as any);
    bus.emit({ type: "tool_call", sessionId: "s_test", tool: "bash", args: { command: "ls" } } as any);
    bus.emit({ type: "message.created", source: "x", data: { to: "human", from: "may", content: "hi" } } as any);
    expect(captured.filter((c) => c.level === "info")).toEqual([]);
  });

  test("ignores info events with empty or non-string message", () => {
    const bus = new EventBus();
    attachDaemonInfoLog(bus);
    bus.emit({ type: "info", message: "" });
    bus.emit({ type: "info", message: 42 } as any);
    bus.emit({ type: "info" } as any);
    expect(captured.filter((c) => c.level === "info")).toEqual([]);
  });

  test("multiple subscribers receive the same event (does not consume)", () => {
    const bus = new EventBus();
    const other: string[] = [];
    bus.subscribe((e) => {
      if (e.type === "info") other.push((e as any).message);
    });
    attachDaemonInfoLog(bus);
    bus.emit({ type: "info", message: "hello" });
    expect(other).toEqual(["hello"]);
    expect(captured.filter((c) => c.level === "info").map((c) => c.message)).toEqual(["hello"]);
  });
});
