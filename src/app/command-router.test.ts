import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppInput } from "@may-agent/sdk";

import { attachCommandRouter } from "./command-router.js";
import { childEventTrace, EVENT_ROW_ID, EventBus } from "./event-bus.js";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { checkEventTraceIntegrity } from "../lib/db/event-traces.js";
import { storeNotificationMessage } from "../lib/db/notifications.js";

function fixture(
  beforeAttach?: (context: { root: string; bus: EventBus }) => void,
  turnResults: Array<Record<string, unknown>> = [],
  routerOptions: { acceptsDirectAppInput?: (appId: string, input: AppInput) => boolean } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "may-command-router-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const sent: Array<{ sessionId: string; text: string; opts?: Record<string, unknown> }> = [];
  const runs: Array<{ agent: string; text: string; opts?: Record<string, unknown> }> = [];
  const cancelled: string[] = [];
  let turnResultIndex = 0;
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
    waitFor: (sessionId: string) => {
      const run = runs[Number(sessionId.replace("s_new_", "")) - 1];
      const requestId = String(run?.opts?.requestId ?? "");
      if (requestId.startsWith("may-turn:") || requestId.startsWith("may-break-glass:")) {
        const structuredResult = turnResults[turnResultIndex++];
        if (!structuredResult) return new Promise(() => undefined);
        return Promise.resolve({
          sessionId,
          status: "done",
          lastAssistantText: "structured May result",
          messages: [],
          duration: "1ms",
          outputDir: root,
          structuredResult,
        });
      }
      return Promise.resolve({
        sessionId,
        status: "done",
        lastAssistantText: "session result",
        messages: [],
        duration: "1ms",
        outputDir: root,
        structuredResult: undefined,
      });
    },
    cancel: (sessionId: string) => cancelled.push(sessionId),
  };
  beforeAttach?.({ root, bus });
  const router = attachCommandRouter({
    bus,
    manager: manager as any,
    getChatSession: () => undefined,
    clearCancelLatch: () => undefined,
    projectRoot: root,
    persistDir: root,
    ...routerOptions,
    reload: () => undefined,
    restart: () => undefined,
    shutdown: () => undefined,
  });
  return { root, bus, router, manager, sent, runs, cancelled };
}

describe("command router human intent contract", () => {
  it("routes ordinary May input through the durable conversation App when registered", () => {
    const { root, bus, router, runs } = fixture(undefined, [], {
      acceptsDirectAppInput: (appId) => appId === "may",
    });
    const emitted: unknown[] = [];
    const unsubscribe = bus.subscribe((event) => emitted.push(event));
    try {
      const source = bus.emit({
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

      expect(emitted).toContainEqual(
        expect.objectContaining({
          type: "app.input.requested",
          source: "telegram",
          owner: "app:may",
          data: expect.objectContaining({
            appId: "may",
            source: expect.objectContaining({ kind: "human" }),
            input: {
              kind: "message",
              data: { message: "please review the deployment" },
            },
            conversationId: "telegram:123",
            channel: "telegram",
            channelThreadId: "thread-7",
            channelMessageId: 99,
            idempotencyKey: "telegram-update:42",
          }),
        }),
      );
      expect(emitted).not.toContainEqual(expect.objectContaining({ type: "chat.start.requested" }));
      expect(runs).toEqual([]);
      const sourceEventId = Number(source[EVENT_ROW_ID]);
      expect(
        getDb(root)
          .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
          .get(sourceEventId),
      ).toEqual({
        delivery_status: "accepted",
        accepted_by: "command-router:app:may",
        delivery_route: "direct",
      });
      expect(
        getDb(root)
          .prepare(
            "SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'owner_inbox' AND open_event_id = ?",
          )
          .get(sourceEventId),
      ).toEqual({ count: 0 });
    } finally {
      unsubscribe();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("routes direct project input to that project's durable App inbox", () => {
    const { root, bus, router } = fixture(undefined, [], {
      acceptsDirectAppInput: (appId) => appId === "may" || appId === "alpha-project",
    });
    const emitted: unknown[] = [];
    const unsubscribe = bus.subscribe((event) => emitted.push(event));
    try {
      const source = bus.emit({
        type: "human.input.received",
        source: "web-ui",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "re-run the focused validation",
          conversation: { id: "web:1", channel: "web-ui" },
          target: { projectPath: "projects/alpha-project.app" },
        },
      } as any);

      expect(emitted).toContainEqual(
        expect.objectContaining({
          type: "app.input.requested",
          source: "web-ui",
          data: expect.objectContaining({
            appId: "alpha-project",
            source: { kind: "human", id: expect.stringMatching(/^event:\d+$/) },
            input: {
              kind: "message",
              data: { message: "re-run the focused validation" },
            },
            conversationId: "web:1",
            conversationSequence: expect.any(Number),
            channel: "web-ui",
          }),
        }),
      );
      expect(emitted).not.toContainEqual(expect.objectContaining({ type: "project.comment.created" }));
      const sourceEventId = Number(source[EVENT_ROW_ID]);
      expect(
        getDb(root)
          .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
          .get(sourceEventId),
      ).toEqual({
        delivery_status: "accepted",
        accepted_by: "command-router:app:alpha-project",
        delivery_route: "direct",
      });
      expect(
        getDb(root)
          .prepare(
            "SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'owner_inbox' AND open_event_id = ?",
          )
          .get(sourceEventId),
      ).toEqual({ count: 0 });
    } finally {
      unsubscribe();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps project comments on the compatibility path when the target App does not accept message input", () => {
    const { root, bus, router } = fixture(undefined, [], {
      acceptsDirectAppInput: (appId) => appId === "may",
    });
    const emitted: unknown[] = [];
    const unsubscribe = bus.subscribe((event) => emitted.push(event));
    try {
      bus.emit({
        type: "human.input.received",
        source: "web-ui",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "review this project",
          conversation: { id: "web:2", channel: "web-ui" },
          target: { projectPath: "projects/legacy-project.app" },
        },
      } as any);

      expect(emitted).toContainEqual(
        expect.objectContaining({
          type: "project.comment.created",
          data: expect.objectContaining({
            projectPath: "projects/legacy-project.app",
            comment: "review this project",
          }),
        }),
      );
      expect(emitted).not.toContainEqual(
        expect.objectContaining({
          type: "app.input.requested",
          data: expect.objectContaining({ appId: "legacy-project" }),
        }),
      );
    } finally {
      unsubscribe();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not reconstruct an agent message into a second May execution path", async () => {
    const { root, bus, router, runs } = fixture();
    try {
      const message = bus.emit({
        type: "message.created",
        source: "agent:evaluator",
        owner: "agent:may",
        data: { from: "evaluator", to: "may", content: "App inbox owns this request." },
      });
      const sourceEventId = Number((message as any)[Symbol.for("may-agent.eventRowId")]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(runs).toEqual([]);
      expect(
        getDb(root).prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(sourceEventId),
      ).toBeNull();
      expect(getDb(root).prepare("SELECT delivery_status FROM events WHERE id = ?").get(sourceEventId)).toEqual({
        delivery_status: "pending",
      });
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns an exact Telegram approval identity and artifact fingerprint", () => {
    const { root, bus, router } = fixture(undefined, [], {
      acceptsDirectAppInput: (appId) => appId === "may",
    });
    const observed: Array<Record<string, unknown>> = [];
    const unsubscribe = bus.subscribe((event) => {
      if (event.type === "project.approval.submitted") {
        observed.push(event as unknown as Record<string, unknown>);
      }
    });
    try {
      const source = bus.emit({
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
      const sourceEventId = Number(source[EVENT_ROW_ID]);
      expect(
        getDb(root)
          .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
          .get(sourceEventId),
      ).toEqual({
        delivery_status: "accepted",
        accepted_by: "command-router:approval",
        delivery_route: "direct",
      });
      expect(
        getDb(root)
          .prepare(
            "SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'owner_inbox' AND open_event_id = ?",
          )
          .get(sourceEventId),
      ).toEqual({ count: 0 });
    } finally {
      unsubscribe();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("propagates one human-rooted trace into an explicitly controlled chat turn", () => {
    const { root, bus, router, sent } = fixture(undefined, [], {
      acceptsDirectAppInput: (appId) => appId === "may",
    });
    try {
      const source = bus.emit({
        type: "human.input.received",
        source: "test",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "continue",
          target: { sessionId: "s_chat" },
          context: { explicitSessionControl: true },
        },
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
      const sourceEventId = Number(source[EVENT_ROW_ID]);
      const deliveries = db
        .prepare(
          `SELECT e.id, e.event_type, e.delivery_status, e.accepted_by, e.delivery_route,
                  COUNT(p.id) AS owner_inbox_pairs
           FROM events e
           LEFT JOIN event_pair_runs p
             ON p.open_event_id = e.id AND p.pair_name = 'owner_inbox'
           WHERE e.id = ? OR e.event_type = 'session.steer.requested'
           GROUP BY e.id
           ORDER BY e.id`,
        )
        .all(sourceEventId);
      expect(deliveries).toEqual([
        {
          id: sourceEventId,
          event_type: "human.input.received",
          delivery_status: "accepted",
          accepted_by: "command-router:session-steer",
          delivery_route: "direct",
          owner_inbox_pairs: 0,
        },
        {
          id: expect.any(Number),
          event_type: "session.steer.requested",
          delivery_status: "accepted",
          accepted_by: "command-router:session-steer",
          delivery_route: "direct",
          owner_inbox_pairs: 0,
        },
      ]);
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("owns canonical deterministic controls directly", () => {
    const { root, bus, router } = fixture();
    try {
      const controls = [
        {
          event: {
            type: "session.cancel.requested",
            source: "web-ui",
            owner: "agent:may",
            data: { sessionId: "s_chat", reason: "human requested cancel" },
          },
          acceptedBy: "command-router:session-cancel",
        },
        {
          event: {
            type: "session.cancel_all.requested",
            source: "web-ui",
            owner: "agent:may",
            urgency: "high",
            data: { reason: "human requested cancel all" },
          },
          acceptedBy: "command-router:session-cancel-all",
        },
        {
          event: {
            type: "runtime.reload.requested",
            source: "web-ui",
            owner: "agent:may",
            data: { reason: "human requested reload" },
          },
          acceptedBy: "command-router:runtime-reload",
        },
        {
          event: {
            type: "runtime.restart.requested",
            source: "web-ui",
            owner: "agent:may",
            urgency: "high",
            data: { reason: "human requested restart" },
          },
          acceptedBy: "command-router:runtime-restart",
        },
        {
          event: {
            type: "runtime.shutdown.requested",
            source: "web-ui",
            owner: "agent:may",
            urgency: "high",
            data: { reason: "human requested shutdown" },
          },
          acceptedBy: "command-router:runtime-shutdown",
        },
      ] as const;

      for (const control of controls) {
        const emitted = bus.emit(control.event);
        const eventId = Number(emitted[EVENT_ROW_ID]);
        expect(
          getDb(root)
            .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
            .get(eventId),
        ).toEqual({
          delivery_status: "accepted",
          accepted_by: control.acceptedBy,
          delivery_route: "direct",
        });
        expect(
          getDb(root)
            .prepare(
              "SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'owner_inbox' AND open_event_id = ?",
            )
            .get(eventId),
        ).toEqual({ count: 0 });
      }
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("starts a fresh structured May turn for ordinary console input even when a session is targeted", async () => {
    const { root, bus, router, sent, runs } = fixture(undefined, [
      { disposition: "answer", response: "I reviewed the request." },
    ]);
    try {
      bus.emit({
        type: "human.input.received",
        source: "console",
        owner: "agent:may",
        data: { actor: "human", text: "review this", target: { agent: "may", sessionId: "s_chat" } },
      });

      expect(sent).toEqual([]);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        agent: "may",
        opts: { kind: "job", source: "console", toolPolicy: "deputy", requireFinish: true },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("defaults a new May chat request to a structured deputy turn", async () => {
    const { root, bus, router, runs } = fixture(undefined, [
      { disposition: "answer", response: "The direct request is understood." },
    ]);
    try {
      bus.emit({
        type: "chat.start.requested",
        source: "control",
        owner: "agent:may",
        data: { agent: "may", message: "review this direct request", channel: "control" },
      } as any);

      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        agent: "may",
        opts: { kind: "job", source: "control", toolPolicy: "deputy", requireFinish: true },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes socket input and May forks to structured human turns", async () => {
    const { root, bus, router, runs } = fixture(undefined, [
      { disposition: "answer", response: "Socket input understood." },
      { disposition: "answer", response: "Socket fork understood." },
    ]);
    try {
      bus.emit({ type: "input", source: "socket", message: "from input" } as any);
      bus.emit({ type: "fork", agent: "may", task: "from fork", opts: { source: "socket" } } as any);

      expect(runs).toHaveLength(2);
      expect(runs.map((run) => run.opts?.toolPolicy)).toEqual(["deputy", "deputy"]);
      expect(runs.map((run) => run.text)).toEqual([
        expect.stringContaining("from input"),
        expect.stringContaining("from fork"),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 0));
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
          kind: "job",
          source: "telegram",
          requestId: expect.stringMatching(/^may-turn:/),
          conversationId: "telegram:chat:123:topic:0:agent:may",
          channelMessageId: 501,
          requireFinish: true,
          toolPolicy: "deputy",
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
      expect(runs[0]?.opts?.requestId).toMatch(/^may-turn:/);
      expect(runs[1]?.opts?.requestId).toMatch(/^may-turn:/);
      expect(runs[0]?.opts?.requestId).not.toBe(runs[1]?.opts?.requestId);
      expect(runs[0]?.opts?.channelMessageId).toBe(601);
      expect(runs[1]?.opts?.channelMessageId).toBe(602);
      expect((runs[0]?.opts?.trace as any)?.traceId).not.toBe((runs[1]?.opts?.trace as any)?.traceId);
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("turns a structured May route into one canonical app intent", async () => {
    const { root, bus, router, runs } = fixture(undefined, [
      {
        disposition: "route",
        response: "I am routing this to Gym; you do not need to act.",
        project: "gym",
        outcome: "Train May on the boundary behavior.",
        requiredProof: "The held-back Gym case passes.",
        constraints: ["Keep the evaluator fixed."],
      },
    ]);
    mkdirSync(join(root, "projects/gym.app"), { recursive: true });
    writeFileSync(join(root, "projects/gym.app/app.ts"), "export default {};\n");
    writeFileSync(join(root, "projects/gym.app/project.json"), JSON.stringify({ owner: "gym" }));
    try {
      bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "train May on the boundary behavior",
          conversation: { id: "telegram:chat:1:topic:0:agent:may", channel: "telegram", channelMessageId: 701 },
          target: { agent: "may" },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(runs).toHaveLength(1);
      expect(runs[0]?.opts).toMatchObject({ kind: "job", toolPolicy: "deputy", requireFinish: true });
      const row = getDb(root)
        .prepare("SELECT owner, data FROM events WHERE event_type = 'project.comment.created' ORDER BY id DESC LIMIT 1")
        .get() as {
        owner: string;
        data: string;
        id?: number;
      };
      expect(row.owner).toBe("agent:gym");
      expect(JSON.parse(row.data)).toMatchObject({
        projectId: "gym",
        projectPath: "projects/gym.app",
      });
      expect(JSON.parse(row.data).comment).toContain("The held-back Gym case passes.");
      const intent = getDb(root)
        .prepare("SELECT id FROM events WHERE event_type = 'project.comment.created' ORDER BY id DESC LIMIT 1")
        .get() as { id: number };
      const completion = getDb(root)
        .prepare("SELECT data FROM events WHERE event_type = 'may.turn.completed' ORDER BY id DESC LIMIT 1")
        .get() as {
        data: string;
      };
      expect(JSON.parse(completion.data)).toMatchObject({
        disposition: "route",
        acceptance: "pending",
        projectIntentEventId: intent.id,
      });
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs break glass as one audited full-tool attempt and then requests review", async () => {
    const { root, bus, router, runs } = fixture(undefined, [
      {
        disposition: "break-glass",
        response: "I am taking over the broken reply path; you do not need to act.",
        reason: "The normal owner path failed after bounded recovery.",
        scope: "Repair the reply correlation path only.",
        terminalProof: "The original request receives the correct reply.",
        stopCondition: "Stop after the targeted test and live proof pass.",
      },
      {
        disposition: "closed",
        summary: "The reply correlation path is repaired.",
        evidence: ["The targeted correlation test passed."],
      },
    ]);
    try {
      bus.emit({
        type: "human.input.received",
        source: "telegram",
        owner: "agent:may",
        data: {
          actor: "human",
          text: "take over and repair the broken reply path",
          conversation: { id: "telegram:chat:1:topic:0:agent:may", channel: "telegram", channelMessageId: 702 },
          target: { agent: "may" },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(runs[0]?.opts).toMatchObject({ toolPolicy: "deputy" });
      expect(runs[1]?.opts).toMatchObject({
        kind: "job",
        source: "may-break-glass",
        toolPolicy: "full",
        requireFinish: true,
      });
      expect(runs[1]?.text).toContain("Repair the reply correlation path only.");
      expect(runs[2]?.opts).toMatchObject({ toolPolicy: "deputy" });
      const eventTypes = getDb(root)
        .prepare("SELECT event_type FROM events WHERE event_type LIKE 'may.break-glass.%' ORDER BY id")
        .all()
        .map((row) => row.event_type);
      expect(eventTypes).toEqual(["may.break-glass.started", "may.break-glass.completed"]);
    } finally {
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes an interrupted break-glass attempt after restart and requests one safe review", async () => {
    let sourceEventId = 0;
    const { root, bus, router, manager, runs } = fixture(
      ({ bus }) => {
        const source = bus.emit({
          type: "human.input.received",
          source: "telegram",
          owner: "agent:may",
          data: {
            actor: "human",
            text: "repair the broken reply path",
            conversation: { id: "telegram:chat:1:topic:0:agent:may", channel: "telegram", channelMessageId: 703 },
            target: { agent: "may" },
          },
        } as any);
        sourceEventId = Number((source as any)[Symbol.for("may-agent.eventRowId")]);
        bus.emit({
          type: "may.break-glass.started",
          source: "handler:may-turn",
          owner: "agent:may",
          data: {
            sourceEventId,
            sourceSessionId: "s_source",
            sessionId: "s_interrupted_privileged",
            reason: "normal owner recovery failed",
            scope: "reply path only",
            terminalProof: "correct reply arrives",
            stopCondition: "targeted proof passes",
          },
        } as any);
      },
      [{ disposition: "answer", response: "The privileged attempt stopped at restart; I am reviewing the blocker." }],
    );
    let restartedRouter: ReturnType<typeof attachCommandRouter> | undefined;
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        agent: "may",
        opts: { source: "telegram", toolPolicy: "deputy", requireFinish: true, channelMessageId: 703 },
      });
      expect(runs[0]?.text).toContain("repair the broken reply path");
      expect(runs[0]?.text).toContain("runtime-restarted");
      expect(runs[0]?.text).toContain("Do not choose break-glass again");
      const db = getDb(root);
      expect(
        db
          .prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'may.break-glass' AND correlation_key = ?")
          .get("s_interrupted_privileged"),
      ).toEqual({ status: "closed" });
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM events WHERE event_type = 'may.break-glass.failed' AND json_extract(data, '$.sourceEventId') = ?",
          )
          .get(sourceEventId),
      ).toEqual({ count: 1 });

      router.close();
      restartedRouter = attachCommandRouter({
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
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(runs).toHaveLength(1);
    } finally {
      restartedRouter?.close();
      router.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects untargeted bare cancel instead of upgrading it to cancel-all", () => {
    const { root, bus, router, cancelled } = fixture(undefined, [], {
      acceptsDirectAppInput: (appId) => appId === "may",
    });
    try {
      const source = bus.emit({
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
      const sourceEventId = Number(source[EVENT_ROW_ID]);
      expect(
        getDb(root)
          .prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?")
          .get(sourceEventId),
      ).toEqual({
        delivery_status: "accepted",
        accepted_by: "command-router:session-cancel-rejected",
        delivery_route: "direct",
      });
      expect(
        getDb(root)
          .prepare(
            "SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'owner_inbox' AND open_event_id = ?",
          )
          .get(sourceEventId),
      ).toEqual({ count: 0 });
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
        data: {
          actor: "human",
          text: "do the work",
          target: { sessionId: "s_chat" },
          context: { explicitSessionControl: true },
        },
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
