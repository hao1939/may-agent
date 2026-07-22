import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attachCommandRouter } from "./command-router.js";
import { childEventTrace, EventBus } from "./event-bus.js";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { checkEventTraceIntegrity } from "../lib/db/event-traces.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-command-router-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const sent: Array<{ sessionId: string; text: string; opts?: Record<string, unknown> }> = [];
  const cancelled: string[] = [];
  const manager = {
    status: () => [
      {
        sessionId: "s_chat",
        agent: "may",
        task: "chat",
        status: "idle",
        runtime: "1s",
      },
    ],
    send: (sessionId: string, text: string, opts?: Record<string, unknown>) => sent.push({ sessionId, text, opts }),
    cancel: (sessionId: string) => cancelled.push(sessionId),
  };
  const router = attachCommandRouter({
    bus,
    manager: manager as any,
    getChatSession: () => undefined,
    clearCancelLatch: () => undefined,
    projectRoot: root,
    reload: () => undefined,
    restart: () => undefined,
    shutdown: () => undefined,
  });
  return { root, bus, router, sent, cancelled };
}

describe("command router human intent contract", () => {
  it("returns an exact Telegram approval identity and artifact fingerprint", () => {
    const { root, bus, router } = fixture();
    const observed: Array<Record<string, unknown>> = [];
    const unsubscribe = bus.subscribe((event) => {
      if (event.type === "project.approval.submitted") {
        observed.push(event as unknown as Record<string, unknown>);
      }
    });
    try {
      bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "approve",
          context: {
            telegramReply: {
              conversationId: "approval:gym-agent-g2",
              originalIssue: {
                eventType: "project.approval.requested",
                approvalKind: "agent-improvement",
                approvalId: "gym-agent-g2",
                expectedResponse: {
                  type: "project.approval.submitted",
                  approvalId: "gym-agent-g2",
                  taskId: "improve/may",
                  taskGeneration: 2,
                  artifactFingerprint: "sha256:abc123",
                },
              },
              expectedClosure: ["project.approval.submitted"],
            },
          },
        },
      });

      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({
        type: "project.approval.submitted",
        data: {
          approvalKind: "agent-improvement",
          approvalId: "gym-agent-g2",
          taskId: "improve/may",
          taskGeneration: 2,
          artifactFingerprint: "sha256:abc123",
          decision: "approve",
        },
      });
    } finally {
      unsubscribe();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("propagates one human-rooted trace into an existing chat turn", () => {
    const { root, bus, router, sent } = fixture();
    try {
      bus.emit({
        type: "human.input.received",
        source: "test",
        owner: "agent:may",
        data: { actor: "human", text: "continue", target: { sessionId: "s_chat" } },
      });

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        sessionId: "s_chat",
        text: "continue",
        opts: { trace: { traceId: expect.any(String), parentEventId: expect.any(Number) } },
      });

      const db = getDb(root);
      const rows = db
        .prepare(
          `SELECT e.event_type, t.trace_id, t.parent_event_id
           FROM events e
           JOIN event_traces t ON t.event_id = e.id
           WHERE e.event_type IN ('human.input.received', 'session.steer.requested')
           ORDER BY e.id`,
        )
        .all() as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[1]).toMatchObject({
        event_type: "session.steer.requested",
        trace_id: rows[0]!.trace_id,
        parent_event_id: expect.any(Number),
      });
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects untargeted bare cancel instead of upgrading it to cancel-all", () => {
    const { root, bus, router, cancelled } = fixture();
    try {
      bus.emit({
        type: "human.input.received",
        source: "test",
        owner: "agent:may",
        data: { actor: "human", text: "cancel" },
      });

      expect(cancelled).toEqual([]);
      const types = getDb(root)
        .prepare("SELECT event_type FROM events ORDER BY id")
        .all()
        .map((row) => row.event_type);
      expect(types).toContain("human.input.rejected");
      expect(types).not.toContain("session.cancel_all.requested");
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a golden human turn only after terminal closure and channel delivery", () => {
    const { root, bus, router, sent } = fixture();
    try {
      bus.emit({
        type: "human.input.received",
        source: "test",
        owner: "agent:may",
        data: { actor: "human", text: "do the work", target: { sessionId: "s_chat" } },
      });
      const intentTrace = sent[0]!.opts!.trace as { traceId: string; parentEventId: number };
      const start = {
        type: "session.start",
        source: "runtime",
        owner: "agent:may",
        data: {
          sessionId: "s_chat",
          agent: "may",
          task: "do the work",
          trigger: "chat",
          firedAt: Date.now(),
        },
        trace: intentTrace,
      } as any;
      bus.emit(start);
      const terminal = {
        type: "session.idle",
        source: "runtime",
        owner: "agent:may",
        data: {
          sessionId: "s_chat",
          agent: "may",
          summary: "done",
          durationMs: 1,
          status: "idle",
        },
        trace: {
          ...childEventTrace(start)!,
          links: [{ eventId: intentTrace.parentEventId, type: "closure", label: "turn-intent" }],
        },
      } as any;
      bus.emit(terminal);
      bus.emit({
        type: "channel.delivery.completed",
        source: "test-channel",
        owner: "agent:may",
        data: { channel: "test", sessionId: "s_chat", resultEventType: "session.idle" },
        trace: childEventTrace(terminal),
      } as any);

      expect(checkEventTraceIntegrity(getDb(root))).toMatchObject({
        closedPairMissingClosureCount: 0,
        pairTraceSplitCount: 0,
        humanRootWithoutSingleIntentCount: 0,
        humanResultUndeliveredCount: 0,
        bookkeepingOnlyAcceptanceCount: 0,
        semanticOk: true,
        ok: true,
      });
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
