import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { EventBus } from "../src/app/event-bus.js";
import { attachDaemonEventSubscribers } from "../src/app/daemon-events.js";

describe("daemon event subscribers", () => {
  it("translates session.end into completion and escalation events", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeInterrupted: () => false,
    };

    try {
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      bus.emit({
        type: "session.end",
        sessionId: "s_1",
        agent: "scout",
        outcome: "need input",
        summary: "blocked",
        durationMs: 10,
        status: "done",
        finishParams: { status: "blocked", summary: "need input" },
      });

      expect(events.some((event) => event.type === "session.escalated" && event.sessionId === "s_1")).toBe(true);
      expect(events.some((event) => event.type === "session.completed" && event.sessionId === "s_1")).toBe(true);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
