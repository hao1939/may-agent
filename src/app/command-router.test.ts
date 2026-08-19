import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppInput } from "@may-agent/sdk";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { attachCommandRouter } from "./command-router.js";
import { EVENT_REDELIVERY_REQUIRED, EVENT_ROW_ID, EventBus } from "./event-bus.js";

function fixture(acceptsAppInput: (appId: string, input: AppInput) => boolean = () => false) {
  const root = mkdtempSync(join(tmpdir(), "may-command-router-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const sent: Array<{ sessionId: string; text: string; opts?: Record<string, unknown> }> = [];
  const runs: Array<{ agent: string; text: string; opts?: Record<string, unknown> }> = [];
  const cancelled: string[] = [];
  const manager = {
    status: () => [{ sessionId: "s_chat", agent: "may", task: "chat", status: "idle", runtime: "1s" }],
    send: (sessionId: string, text: string, opts?: Record<string, unknown>) => sent.push({ sessionId, text, opts }),
    resumeSession: () => undefined,
    run: (agent: string, text: string, opts?: Record<string, unknown>) => {
      runs.push({ agent, text, opts });
      return typeof opts?.sessionId === "string" ? opts.sessionId : `s_new_${runs.length}`;
    },
    cancel: (sessionId: string) => cancelled.push(sessionId),
    getAgentDefinition: () => ({ sessionIdPrefix: "chat" }),
    getSessionSummary: (sessionId: string) => ({
      task: "",
      summary: "",
      status: runs.some((run) => run.opts?.sessionId === sessionId) ? "running" : "unknown",
    }),
  };
  const router = attachCommandRouter({
    bus,
    manager: manager as any,
    clearCancelLatch: () => undefined,
    projectRoot: root,
    persistDir: root,
    acceptsAppInput,
    reload: () => undefined,
    restart: () => undefined,
    shutdown: () => undefined,
  });
  return { root, bus, router, sent, runs, cancelled };
}

function cleanup(root: string, router: { close(): void }): void {
  router.close();
  closeDb(root);
  rmSync(root, { recursive: true, force: true });
}

describe("command router", () => {
  it("admits ordinary May input to the durable conversation App", () => {
    const f = fixture((appId) => appId === "may");
    const observed: unknown[] = [];
    const unsubscribe = f.bus.subscribe((event) => observed.push(event));
    try {
      const source = f.bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          actor: "human",
          inputId: "telegram-update:42",
          text: "please review the deployment",
          conversation: {
            id: "telegram:123",
            channel: "telegram",
            channelThreadId: "thread-7",
            channelMessageId: 99,
          },
          target: { agent: "may" },
        },
      } as any);

      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "app.input.requested",
          owner: "app:may",
          data: expect.objectContaining({
            appId: "may",
            source: { kind: "human", id: expect.stringMatching(/^event:\d+$/) },
            input: { kind: "message", data: { message: "please review the deployment" } },
            conversationId: "telegram:123",
            channelThreadId: "thread-7",
            channelMessageId: 99,
            idempotencyKey: "telegram-update:42",
          }),
        }),
      );
      expect(f.runs).toEqual([]);
      expect(
        getDb(f.root)
          .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
          .get(Number(source[EVENT_ROW_ID])),
      ).toEqual({
        delivery_status: "accepted",
        accepted_by: "command-router:app:may",
        delivery_route: "direct",
      });
    } finally {
      unsubscribe();
      cleanup(f.root, f.router);
    }
  });

  it("normalizes console, chat-start, and May fork ingress into the same App route", () => {
    const f = fixture((appId) => appId === "may");
    try {
      f.bus.emit({ type: "input", source: "console", message: "from console" } as any);
      f.bus.emit({
        type: "chat.start.requested",
        source: "control",
        owner: "agent:may",
        data: { agent: "may", message: "from control", channel: "control" },
      } as any);
      f.bus.emit({ type: "fork", agent: "may", task: "from socket", opts: { source: "socket" } } as any);

      const inputs = getDb(f.root)
        .prepare("SELECT data FROM events WHERE event_type = 'app.input.requested' ORDER BY id")
        .all()
        .map((row: { data: string }) => JSON.parse(row.data).input.data.message);
      expect(inputs).toEqual(["from console", "from control", "from socket"]);
      expect(
        getDb(f.root).prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'human.input.received'").get(),
      ).toEqual({ count: 0 });
      expect(f.runs).toEqual([]);
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("routes a direct project message to its App and keeps only unmigrated projects on the comment adapter", () => {
    const f = fixture((appId) => appId === "alpha-project" || appId === "may");
    try {
      f.bus.emit({
        type: "human.input.received",
        source: "web-ui",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "run focused validation",
          target: { projectPath: "projects/alpha-project.app" },
          conversation: { id: "web:1", channel: "web-ui" },
        },
      } as any);
      f.bus.emit({
        type: "human.input.received",
        source: "web-ui",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "review legacy project",
          target: { projectPath: "projects/legacy.app" },
          conversation: { id: "web:2", channel: "web-ui" },
        },
      } as any);

      expect(
        getDb(f.root).prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'app.input.requested'").get(),
      ).toEqual({ count: 1 });
      expect(
        getDb(f.root)
          .prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'project.comment.created'")
          .get(),
      ).toEqual({ count: 1 });
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("applies an explicit approval as a deterministic typed control", () => {
    const f = fixture((appId) => appId === "may");
    try {
      const source = f.bus.emit({
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
      } as any);

      const approval = getDb(f.root)
        .prepare("SELECT data FROM events WHERE event_type = 'project.approval.submitted'")
        .get() as { data: string };
      expect(JSON.parse(approval.data)).toMatchObject({
        approvalKind: "agent-improvement",
        approvalId: "gym-agent-g2",
        taskId: "improve/may",
        taskGeneration: 2,
        artifactFingerprint: "sha256:abc123",
        decision: "approve",
      });
      expect(
        getDb(f.root).prepare("SELECT accepted_by FROM events WHERE id = ?").get(Number(source[EVENT_ROW_ID])),
      ).toEqual({ accepted_by: "command-router:approval" });
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("keeps broker questions on May even when notification targets name a project and session", () => {
    const f = fixture((appId) => appId === "may");
    try {
      f.bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "what would this retry change?",
          target: { projectPath: "projects/alpha-project.app", sessionId: "s_source" },
          context: {
            explicitSessionControl: true,
            telegramReply: {
              originalIssue: { eventType: "escalation.created", escalationId: "esc-1" },
              expectedClosure: ["escalation.resolved", "escalation.dismissed"],
            },
          },
        },
      } as any);

      const appInput = getDb(f.root)
        .prepare("SELECT owner, data FROM events WHERE event_type = 'app.input.requested'")
        .get() as { owner: string; data: string };
      expect(appInput.owner).toBe("app:may");
      expect(JSON.parse(appInput.data).input.data.message).toContain("what would this retry change?");
      expect(
        getDb(f.root)
          .prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'project.comment.created'")
          .get(),
      ).toEqual({ count: 0 });
      expect(f.sent).toEqual([]);
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("keeps explicit session controls deterministic", () => {
    const f = fixture((appId) => appId === "may");
    try {
      f.bus.emit({
        type: "human.input.received",
        source: "web-ui",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "continue",
          target: { sessionId: "s_chat" },
          context: { explicitSessionControl: true },
        },
      } as any);
      f.bus.emit({
        type: "session.cancel.requested",
        source: "web-ui",
        target: { sessionId: "s_chat" },
        data: {},
      } as any);

      expect(f.sent).toHaveLength(1);
      expect(f.sent[0]).toMatchObject({
        sessionId: "s_chat",
        text: "continue",
        opts: { trace: { traceId: expect.any(String), parentEventId: expect.any(Number) } },
      });
      expect(f.cancelled).toEqual(["s_chat"]);
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("replays required controls through the durable route", () => {
    const f = fixture((appId) => appId === "may");
    try {
      const event = {
        type: "session.cancel.requested",
        source: "recovery",
        owner: "agent:may",
        target: { sessionId: "s_chat" },
        data: {},
      } as any;
      Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true });

      f.bus.emit(event);

      expect(f.cancelled).toEqual(["s_chat"]);
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("correlates direct chat recovery to one deterministic session", () => {
    const f = fixture();
    try {
      const event = {
        type: "chat.start.requested",
        source: "control-socket",
        owner: "agent:dev",
        data: {
          agent: "dev",
          message: "investigate",
          idempotencyKey: "direct-chat-1",
        },
      } as any;
      Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true });

      const first = f.bus.emit(event);
      f.bus.emit(event);

      expect(f.runs).toHaveLength(1);
      expect(f.runs[0]).toMatchObject({
        agent: "dev",
        text: "investigate",
        opts: {
          sessionId: `chat_event_${Number(first[EVENT_ROW_ID])}`,
          requestId: `event:${Number(first[EVENT_ROW_ID])}`,
        },
      });
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("rejects May input explicitly when the conversation App is unavailable", () => {
    const f = fixture(() => false);
    try {
      const source = f.bus.emit({
        type: "human.input.received",
        source: "console",
        owner: "agent:may",
        data: { actor: "human", text: "review this", target: { agent: "may" } },
      } as any);

      expect(f.runs).toEqual([]);
      expect(
        getDb(f.root).prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'human.input.rejected'").get(),
      ).toEqual({ count: 1 });
      expect(
        getDb(f.root).prepare("SELECT accepted_by FROM events WHERE id = ?").get(Number(source[EVENT_ROW_ID])),
      ).toEqual({ accepted_by: "command-router:app:may-unavailable" });
    } finally {
      cleanup(f.root, f.router);
    }
  });

  it("does not reconstruct an agent message into a second May path", () => {
    const f = fixture((appId) => appId === "may");
    try {
      const message = f.bus.emit({
        type: "message.created",
        source: "agent:evaluator",
        owner: "agent:may",
        data: { from: "evaluator", to: "may", content: "App inbox owns this request." },
      });
      expect(f.runs).toEqual([]);
      expect(
        getDb(f.root).prepare("SELECT delivery_status FROM events WHERE id = ?").get(Number(message[EVENT_ROW_ID])),
      ).toEqual({ delivery_status: "pending" });
    } finally {
      cleanup(f.root, f.router);
    }
  });
});
