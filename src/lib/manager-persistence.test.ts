import { createAgentRun } from "@may-agent/sdk/runtime";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import { fakeModel } from "../../test/fixtures/model.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { EventBus, type AgentEvent } from "../app/core/events/bus.js";
import { readJsonArtifactWithDescriptor } from "./artifacts.js";
import { DbWriter } from "./db-writer.js";
import { closeDb, getDb } from "./db/connection.js";
import { SubagentManager } from "./manager.js";
import { readActiveSessionProcessId, readSessionMeta } from "./persistence.js";

const fixtures: Array<{ root: string; manager: SubagentManager; release: () => void }> = [];
afterEach(async () => {
  for (const { root, manager, release } of fixtures.splice(0)) {
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    release();
    await Promise.allSettled(sessions.map(({ sessionId }) => manager.waitFor(sessionId)));
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(mode: "writer" | "bus" | "none" = "writer", error?: string, withTool = false) {
  const root = mkdtempSync(join(tmpdir(), "manager-persistence-"));
  const bus = mode === "none" ? undefined : new EventBus();
  if (mode === "writer") bus!.setPersistenceSubscriber(new DbWriter(root).handler);
  const completion = Promise.withResolvers<void>();
  const manager = new SubagentManager({
    persistDir: root,
    bus,
    agentRunFactory: (config) => {
      let modelSteps = 0;
      const run = createAgentRun({
        ...config,
        streamFn: () => {
          const stream = createAssistantMessageEventStream();
          if (withTool && modelSteps++ === 0) {
            stream.push({
              type: "done",
              reason: "toolUse",
              message: usageReply({
                stopReason: "toolUse",
                content: [{ type: "toolCall", id: "operation-1", name: "operation", arguments: {} }],
              }),
            });
            return stream;
          }
          stream.push({
            type: "done",
            reason: "stop",
            message: usageReply({ content: [{ type: "text", text: "Saved result" }] }),
          });
          return stream;
        },
      });
      const prompt = run.prompt.bind(run);
      run.prompt = async (...args) => {
        await completion.promise;
        if (error) throw new Error(error);
        await prompt(...args);
      };
      return run;
    },
  });
  manager.register({
    name: "worker",
    description: "Fixture",
    domain: "test",
    systemPrompt: "Fixture",
    model: fakeModel(),
    tools: withTool
      ? [
          {
            name: "operation",
            label: "operation",
            description: "Perform a fixture operation",
            parameters: Type.Object({}),
            execute: async () => ({ content: [{ type: "text", text: "Operation complete" }] }),
          },
        ]
      : [],
  });
  const release = () => completion.resolve();
  fixtures.push({ root, manager, release });
  return { root, bus, manager, release, db: getDb(root) };
}

test.each(["writer", "bus", "none"] as const)(
  "manager owns start/end persistence with %s publication",
  async (mode) => {
    const f = fixture(mode);
    const observed: string[] = [];
    f.bus?.subscribe((event) => {
      if (event.type !== "session.start" && event.type !== "session.end") return;
      const row = f.db.prepare("SELECT status, result_ref FROM sessions WHERE sessionId = ?").get(event.data.sessionId);
      expect(row).toMatchObject(
        event.type === "session.start"
          ? { status: "running", result_ref: null }
          : { status: "done", result_ref: `sessions/${event.data.sessionId}/result.json` },
      );
      if (event.type === "session.end")
        expect(readJsonArtifactWithDescriptor(f.root, String(row!.result_ref))?.value).toMatchObject({
          status: "done",
          summary: "Saved result",
        });
      observed.push(event.type);
    });
    const id = f.manager.run("worker", "Persist the work", {
      source: "fixture",
      kind: "call",
      projectId: "sample",
      workflowRunId: "workflow",
      requestId: "request",
      stepLabel: "step",
    });
    expect(
      f.db
        .prepare(
          "SELECT agent, task, status, source, kind, projectId, workflowRunId, requestId, stepLabel FROM sessions WHERE sessionId = ?",
        )
        .get(id),
    ).toEqual({
      agent: "worker",
      task: "Persist the work",
      status: "running",
      source: "fixture",
      kind: "call",
      projectId: "sample",
      workflowRunId: "workflow",
      requestId: "request",
      stepLabel: "step",
    });
    const first = f.manager.waitFor(id);
    const second = f.manager.waitFor(id);
    f.release();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toMatchObject({ status: "done", lastAssistantText: "Saved result" });
    expect(b).toEqual(a);
    const artifact = readJsonArtifactWithDescriptor(f.root, `sessions/${id}/result.json`)!;
    expect(artifact.value).toMatchObject({
      schemaVersion: 1,
      sessionId: id,
      status: "done",
      outcome: "done",
      summary: "Saved result",
      opCount: 0,
      turnCount: 1,
      endedAt: expect.any(Number),
    });
    closeDb(f.root);
    expect(
      getDb(f.root)
        .prepare("SELECT status, outcome, result_ref, result_sha256, result_bytes FROM sessions WHERE sessionId = ?")
        .get(id),
    ).toEqual({
      status: "done",
      outcome: "done",
      result_ref: artifact.descriptor.ref,
      result_sha256: artifact.descriptor.sha256,
      result_bytes: artifact.descriptor.bytes,
    });
    expect(observed).toEqual(mode === "none" ? [] : ["session.start", "session.end"]);
    const restarted = new SubagentManager({ persistDir: f.root });
    expect(await restarted.waitFor(id)).toMatchObject({
      sessionId: id,
      status: "done",
      lastAssistantText: "Saved result",
    });
  },
);

test.each(["writer", "bus", "none"] as const)(
  "manager counts model steps and tool calls once with %s publication",
  async (mode) => {
    const f = fixture(mode, undefined, true);
    const observed: AgentEvent[] = [];
    f.bus?.subscribe((event) => observed.push(event));
    const id = f.manager.run("worker", "Perform an operation and save the result");
    f.release();
    expect(await f.manager.waitFor(id)).toMatchObject({ status: "done", lastAssistantText: "Saved result" });
    expect(f.manager.progress(id, 20).filter((message) => message.role === "toolResult")).toMatchObject([
      { toolCallId: "operation-1", toolName: "operation", isError: false },
    ]);
    expect(readJsonArtifactWithDescriptor(f.root, `sessions/${id}/result.json`)?.value).toMatchObject({
      opCount: 1,
      turnCount: 2,
    });
    expect(f.db.prepare("SELECT opCount FROM sessions WHERE sessionId = ?").get(id)).toEqual({ opCount: 1 });
    expect(observed.filter((event) => event.type === "tool_call")).toHaveLength(mode === "none" ? 0 : 1);
    expect(observed.filter((event) => event.type === "tool_result")).toHaveLength(mode === "none" ? 0 : 1);
    expect(observed.filter((event) => event.type === "turn_end")).toMatchObject(
      mode === "none" ? [] : [{ toolCalls: 1 }, { toolCalls: 1 }],
    );
    expect(observed.filter((event) => event.type === "session.end")).toMatchObject(
      mode === "none" ? [] : [{ data: { opCount: 1, turnCount: 2 } }],
    );
  },
);

test("failed start projection releases live ownership without publishing or dispatching", () => {
  const f = fixture();
  f.db.exec(
    `CREATE TRIGGER reject_start BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'start projection failed'); END`,
  );
  expect(() => f.manager.run("worker", "Rejected start", { sessionId: "rejected" })).toThrow("start projection failed");
  expect(f.manager.hasActiveSession("rejected")).toBe(false);
  expect(readSessionMeta(f.root, "rejected")).toMatchObject({ status: "error" });
  expect(f.db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'session.start'").get()).toEqual({ n: 0 });
});

test.each(["artifact", "projection", "event"] as const)(
  "terminal %s failure reaches concurrent waiters without a completion notification",
  async (failure) => {
    const f = fixture();
    const observed: string[] = [];
    f.bus!.subscribe((event) => {
      if (event.type.startsWith("session.")) observed.push(event.type);
    });
    const id = f.manager.run("worker", "Retain failure evidence");
    if (failure === "artifact") mkdirSync(join(f.root, `sessions/${id}/result.json`));
    if (failure === "projection")
      f.db.exec(`CREATE TRIGGER reject_result BEFORE UPDATE ON sessions
    WHEN NEW.result_ref IS NOT NULL BEGIN SELECT RAISE(ABORT, 'result projection failed'); END`);
    if (failure === "event")
      f.db.exec(`CREATE TRIGGER reject_end BEFORE INSERT ON events
    WHEN NEW.event_type = 'session.end' BEGIN SELECT RAISE(ABORT, 'end event failed'); END`);
    const first = f.manager.waitFor(id);
    const second = f.manager.waitFor(id);
    f.release();
    const [a, b] = await Promise.allSettled([first, second]);
    expect(a.status).toBe("rejected");
    expect(b).toEqual(a);
    if (a.status === "rejected")
      expect(String(a.reason)).toContain(
        failure === "artifact" ? "EISDIR" : failure === "projection" ? "result projection failed" : "end event failed",
      );
    expect(f.manager.hasActiveSession(id)).toBe(false);
    expect(readActiveSessionProcessId(f.root, id)).toBeNull();
    expect(observed).toEqual(["session.start"]);
    expect(f.db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'session.end'").get()).toEqual({ n: 0 });
    // The earlier terminal status remains; failed publication cannot undo owner evidence.
    expect(f.db.prepare("SELECT status, result_ref FROM sessions WHERE sessionId = ?").get(id)).toEqual({
      status: "done",
      result_ref: failure === "event" ? `sessions/${id}/result.json` : null,
    });
  },
);
