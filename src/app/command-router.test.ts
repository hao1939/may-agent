import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it.each([
    { path: "projects/legacy", declared: false },
    { path: "agents/sample/workspace/projects/legacy", declared: false },
    { path: "projects/legacy", declared: true },
  ])("leaves project policy to declared routes ($path, declared=$declared)", async ({ path, declared }) => {
    const f = fixture();
    const projectDir = join(f.root, path);
    const project = "---\nstatus: blocked\n---\n# Retained project\n";
    const discussion = "# Retained discussion\n";
    const observed: string[] = [];
    const delivered = Promise.withResolvers<void>();
    const unsubscribe = f.bus.subscribe((event) => { observed.push(event.type); });
    const unsubscribeRoute = f.bus.subscribeDurableRoute((event) => {
      if (declared && event.type === "project.comment.created") {
        return { accepted: true, by: "app:sample", route: "direct", note: "declared App consumer" };
      }
    });
    // A later passive listener provides a deterministic delivery barrier;
    // no sleep guesses when the event has reached its observers.
    const unsubscribeObserved = f.bus.listen(() => { delivered.resolve(); }, {
      label: "comment-observed", types: ["project.comment.created"],
    });
    try {
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "project.md"), project);
      writeFileSync(join(projectDir, "discussion.md"), discussion);
      const event = f.bus.emit({ type: "project.comment.created", source: "test", owner: "app:sample",
        data: { project: "sample", projectPath: path, comment: "Review the blocked work" } } as any);
      await delivered.promise;

      expect(readFileSync(join(projectDir, "project.md"), "utf8")).toBe(project);
      expect(readFileSync(join(projectDir, "discussion.md"), "utf8")).toBe(discussion);
      expect(observed).not.toContain("project.nudge");
      expect(f.runs).toEqual([]);
      const receipt = getDb(f.root).prepare("SELECT delivery_status, accepted_by, data FROM events WHERE id = ?")
        .get(Number(event[EVENT_ROW_ID])) as { delivery_status: string; accepted_by: string; data: string };
      expect(JSON.parse(receipt.data).comment).toBe("Review the blocked work");
      if (declared) expect(receipt).toMatchObject({ delivery_status: "accepted", accepted_by: "app:sample" });
      else expect(receipt.delivery_status).not.toBe("accepted");
    } finally {
      unsubscribeObserved();
      unsubscribeRoute();
      unsubscribe();
      cleanup(f.root, f.router);
    }
  });

  it("accepts reload synchronously, shares in-flight redelivery and emits one correlated terminal result", async () => {
    const result = Promise.withResolvers<{ ok: boolean; summary: string }>();
    const started = Promise.withResolvers<void>();
    let calls = 0;
    const f = fixture(() => { calls++; started.resolve(); return result.promise; });
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
      // Duplicate delivery before execution starts and while it is in flight
      // must attach to the same operation, not start another reload.
      f.bus.redeliverPersisted(request, Number(request[EVENT_ROW_ID]));
      await started.promise;
      f.bus.redeliverPersisted(request, Number(request[EVENT_ROW_ID]));
      await Bun.sleep(0);
      expect(calls).toBe(1);
      result.resolve({ ok: true, summary: "[reload] 6 task-enabled App(s)" });
      await Bun.sleep(0);
      expect(observed.filter((event) => event.type === "runtime.reload.finished")).toHaveLength(1);
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
      result.resolve({ ok: true, summary: "[reload] Fixture cleanup" });
      await Bun.sleep(0);
      unsubscribe();
      cleanup(f.root, f.router);
    }
  });

  it("allows redelivery after reload result recording fails without inventing a failed execution", async () => {
    let calls = 0;
    const f = fixture(() => { calls++; return { ok: true, summary: "[reload] Verified definitions" }; });
    const db = getDb(f.root);
    try {
      db.exec(`CREATE TEMP TRIGGER reject_reload_result BEFORE INSERT ON events
        WHEN NEW.event_type = 'runtime.reload.finished'
        BEGIN SELECT RAISE(ABORT, 'fixture result write unavailable'); END`);
      const request = f.bus.emit({ type: "runtime.reload.requested", source: "telegram", owner: "agent:may",
        data: { requestId: "reload-write-failure" } } as any);
      await Bun.sleep(0);
      expect(calls).toBe(1);
      expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'runtime.reload.finished'").get())
        .toEqual({ count: 0 });
      db.exec("DROP TRIGGER reject_reload_result");
      f.bus.redeliverPersisted(request, Number(request[EVENT_ROW_ID]));
      await Bun.sleep(0);
      expect(calls).toBe(2);
      const results = db.prepare("SELECT data FROM events WHERE event_type = 'runtime.reload.finished'").all();
      expect(results).toHaveLength(1);
      expect(JSON.parse(String(results[0].data))).toMatchObject({ ok: true, summary: "[reload] Verified definitions" });
    } finally { cleanup(f.root, f.router); }
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
