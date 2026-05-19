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

      expect(events).toContainEqual(expect.objectContaining({
        type: "session.escalated",
        source: "runtime",
        owner: "agent:scout",
        data: expect.objectContaining({
          sessionId: "s_1",
          agent: "scout",
          finishParams: { status: "blocked", summary: "need input" },
        }),
      }));
      const completed = events.find((event) => event.type === "session.completed");
      expect(completed).toMatchObject({
        type: "session.completed",
        source: "runtime",
        owner: "agent:scout",
        data: {
          sessionId: "s_1",
          agent: "scout",
          outcome: "need input",
          status: "done",
        },
      });
      expect(completed).not.toHaveProperty("sessionId");
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("emits canonical escalation.created when auto-resume attempts are exhausted", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-resume-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeInterrupted: () => false,
    };
    const originalSetTimeout = globalThis.setTimeout;

    try {
      (globalThis as any).setTimeout = (fn: () => void) => {
        fn();
        return 0;
      };
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      const interrupted = {
        type: "session.end",
        sessionId: "s_retry",
        agent: "scout",
        outcome: "interrupted",
        summary: "interrupted",
        durationMs: 10,
        status: "interrupted",
        error: "network reset",
        task: "finish investigation",
        opCount: 1,
        turnCount: 3,
      } as const;

      bus.emit(interrupted);
      bus.emit(interrupted);
      bus.emit(interrupted);

      const escalation = events.find((event) => event.type === "escalation.created");
      expect(escalation).toMatchObject({
        type: "escalation.created",
        source: "runtime:auto-resume",
        owner: "agent:may",
        urgency: "high",
        data: expect.objectContaining({
          sourceAgent: "scout",
          sourceSessionId: "s_retry",
          reason: expect.stringContaining("Interrupted 3x"),
          severity: "P1",
        }),
      });
      expect(events.some((event) => event.type === "message.created" && event.owner === "human:operator")).toBe(false);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
