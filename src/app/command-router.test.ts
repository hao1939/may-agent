import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attachCommandRouter } from "./command-router.js";
import { childEventTrace, EventBus } from "./event-bus.js";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { checkEventTraceIntegrity } from "../lib/db/event-traces.js";
import { storeNotificationMessage } from "../lib/db/notifications.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-command-router-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const sent: Array<{ sessionId: string; text: string; opts?: Record<string, unknown> }> = [];
  const runs: Array<{ agent: string; text: string; opts?: Record<string, unknown> }> = [];
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
    run: (agent: string, text: string, opts?: Record<string, unknown>) => {
      runs.push({ agent, text, opts });
      return `s_new_${runs.length}`;
    },
    cancel: (sessionId: string) => cancelled.push(sessionId),
  };
  const router = attachCommandRouter({
    bus,
    manager: manager as any,
    getChatSession: () => undefined,
    clearCancelLatch: () => undefined,
    projectRoot: root,
    persistDir: root,
    reload: () => undefined,
    restart: () => undefined,
    shutdown: () => undefined,
  });
  return { root, bus, router, sent, runs, cancelled };
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

  it("starts a fresh bounded May turn for ordinary Telegram language even when an old session is attached", () => {
    const { root, bus, router, sent, runs } = fixture();
    const routed: Array<Record<string, unknown>> = [];
    const unsubscribe = bus.subscribe((event) => {
      if (event.type === "chat.start.requested" || event.type === "session.steer.requested") {
        routed.push(event as unknown as Record<string, unknown>);
      }
    });
    try {
      storeNotificationMessage(root, {
        telegram_msg_id: 500,
        event_type: "response",
        agent: "may",
        session_id: "s_old",
        project_id: null,
        data: JSON.stringify({
          direction: "outbound",
          conversationId: "telegram:chat:123:topic:0:agent:may",
          traceId: "trace-prior",
          text: "Gym is training while AKS waits on proof.",
        }),
      });
      bus.emit({
        type: "project.owner.result",
        source: "gym",
        owner: "agent:may",
        data: {
          status: "waiting",
          summary: "Gym is waiting for the provider to return model output.",
        },
        trace: { traceId: "trace-prior" },
      } as any);
      bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          inputId: "telegram:501",
          actor: "human",
          text: "review the apps and suggest what to do next",
          conversation: {
            id: "telegram:chat:123:topic:0:agent:may",
            channel: "telegram",
            channelMessageId: 501,
          },
          target: { agent: "may", sessionId: "s_old" },
          context: {
            conversationId: "telegram:chat:123:topic:0:agent:may",
            telegramReply: {
              conversationId: "telegram:chat:123:topic:0:agent:may",
              traceId: "trace-prior",
              taskId: "learning/gym-run",
              projectId: "gym",
            },
          },
        },
      });

      expect(sent).toEqual([]);
      expect(routed.map((event) => event.type)).toEqual(["chat.start.requested"]);
      expect(routed[0]).toMatchObject({
        source: "telegram",
        data: {
          forceNew: true,
          requestId: "telegram:501",
          conversationId: "telegram:chat:123:topic:0:agent:may",
        },
      });
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        agent: "may",
        opts: {
          kind: "chat",
          source: "telegram",
          requestId: "telegram:501",
          conversationId: "telegram:chat:123:topic:0:agent:may",
          channelMessageId: 501,
          trace: { traceId: expect.any(String), parentEventId: expect.any(Number) },
        },
      });
      expect(runs[0]?.text).toContain("review the apps and suggest what to do next");
      expect(runs[0]?.text).toContain("Recent Telegram context");
      expect(runs[0]?.text).toContain("Gym is training while AKS waits on proof.");
      expect(runs[0]?.text).toContain("Focused request (system-provided durable view)");
      expect(runs[0]?.text).toContain("Trace: trace-prior");
      expect(runs[0]?.text).toContain("Owner task: learning/gym-run");
      expect(runs[0]?.text).toContain("Gym is waiting for the provider to return model output.");
    } finally {
      unsubscribe();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps explicit Telegram session control available without making it the default", () => {
    const { root, bus, router, sent, runs } = fixture();
    try {
      bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "use the smaller plan",
          target: { agent: "may", sessionId: "s_chat" },
          context: { explicitSessionControl: true },
        },
      });

      expect(runs).toEqual([]);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ sessionId: "s_chat", text: "use the smaller plan" });
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps overlapping Telegram requests on separate traces and bounded turns", () => {
    const { root, bus, router, runs } = fixture();
    try {
      for (const [id, text] of [
        [601, "review Gym"],
        [602, "review AKS"],
      ] as const) {
        bus.emit({
          type: "human.input.received",
          source: "telegram",
          owner: "agent:may",
          data: {
            inputId: `telegram:${id}`,
            actor: "human",
            text,
            conversation: {
              id: "telegram:chat:123:topic:0:agent:may",
              channel: "telegram",
              channelMessageId: id,
            },
            target: { agent: "may" },
          },
        });
      }

      expect(runs).toHaveLength(2);
      expect(runs[0]?.opts?.requestId).toBe("telegram:601");
      expect(runs[1]?.opts?.requestId).toBe("telegram:602");
      expect(runs[0]?.opts?.channelMessageId).toBe(601);
      expect(runs[1]?.opts?.channelMessageId).toBe(602);
      expect((runs[0]?.opts?.trace as any)?.traceId).not.toBe((runs[1]?.opts?.trace as any)?.traceId);
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
