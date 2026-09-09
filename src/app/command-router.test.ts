import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { attachCommandRouter } from "./command-router.js";
import { EVENT_REDELIVERY_REQUIRED, EVENT_ROW_ID, EventBus } from "./core/events/bus.js";

function fixture(
  reload: () => { ok: boolean; summary: string } | Promise<{ ok: boolean; summary: string }> = () => ({
    ok: true,
    summary: "[reload] No changes",
  }),
) {
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
    projectRoot: root,
    reload,
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
  it("accepts reload synchronously and emits one correlated terminal result", async () => {
    const f = fixture(async () => ({ ok: true, summary: "[reload] 6 task-enabled App(s)" }));
    const observed: any[] = [];
    const unsubscribe = f.bus.subscribe((event) => observed.push(event));
    try {
      const request = f.bus.emit({
        type: "runtime.reload.requested",
        source: "may-console",
        owner: "agent:may",
        data: { requestId: "console-reload-1" },
      } as any);

      expect(
        getDb(f.root)
          .prepare("SELECT delivery_status, accepted_by FROM events WHERE id = ?")
          .get(Number(request[EVENT_ROW_ID])),
      ).toEqual({ delivery_status: "accepted", accepted_by: "command-router:runtime-reload" });
      await Bun.sleep(0);
      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "runtime.reload.finished",
          source: "runtime",
          owner: "agent:may",
          data: {
            requestId: "console-reload-1",
            ok: true,
            summary: "[reload] 6 task-enabled App(s)",
          },
        }),
      );
    } finally {
      unsubscribe();
      cleanup(f.root, f.router);
    }
  });

  it("turns a reload exception into a terminal failure result", async () => {
    const f = fixture(async () => {
      throw new Error("invalid App manifest");
    });
    const observed: any[] = [];
    const unsubscribe = f.bus.subscribe((event) => observed.push(event));
    try {
      f.bus.emit({
        type: "runtime.reload.requested",
        source: "telegram",
        owner: "agent:may",
        data: { requestId: "telegram-reload-1" },
      } as any);
      await Bun.sleep(0);
      expect(observed).toContainEqual(
        expect.objectContaining({
          type: "runtime.reload.finished",
          data: expect.objectContaining({
            requestId: "telegram-reload-1",
            ok: false,
            summary: "[reload] Failed: invalid App manifest",
          }),
        }),
      );
    } finally {
      unsubscribe();
      cleanup(f.root, f.router);
    }
  });

  it("keeps typed session controls deterministic", () => {
    const f = fixture();
    try {
      f.bus.emit({
        type: "session.steer.requested",
        source: "web-ui",
        owner: "agent:may",
        target: { sessionId: "s_chat" },
        data: { message: "continue" },
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
    const f = fixture();
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

  it("does not reconstruct an agent message into a second May path", () => {
    const f = fixture();
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
