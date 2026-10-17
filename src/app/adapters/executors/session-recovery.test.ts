import { afterEach, expect, it } from "bun:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../../lib/manager.js";
import { appendSessionMessage, markSessionActive, readSessionMeta, writeSessionMeta } from "../../../lib/persistence.js";
import { closeDb } from "../../../lib/requests.js";
import { createLastSessionWriter } from "../../../lib/session-subscribers.js";
import { EventBus, type AgentEvent } from "../../core/events/bus.js";
import type { AppTaskAttempt } from "../../core/tasks/app-task-state.js";
import { createTaskSessionRecovery } from "./session-recovery.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

it.each([
  { finishStatus: "success", hasSummary: true },
  { finishStatus: "failure", hasSummary: true },
  { finishStatus: "blocked", hasSummary: true },
  { finishStatus: "partial", hasSummary: true },
  { finishStatus: "success", hasSummary: false },
])(
  "retains structured session facts exactly once ($finishStatus, summary: $hasSummary)",
  ({ finishStatus, hasSummary }) => {
    const root = mkdtempSync(join(tmpdir(), "may-recovered-judgment-"));
    roots.push(root);
    const sessionId = "judge-session";
    const judgment = { state: "incomplete", summary: "Further recovery exceeds the authorized budget." };
    writeSessionMeta(root, sessionId, {
      agent: "judge",
      task: "Decide whether recovery is worthwhile",
      status: "running",
      startedAt: 1,
      kind: "call",
      outputSchema: Type.Object({ state: Type.Literal("incomplete"), summary: Type.String() }),
    });
    appendSessionMessage(root, sessionId, {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "finish-call",
          name: "finish",
          arguments: {
            status: finishStatus,
            ...(hasSummary ? { summary: judgment.summary } : {}),
            result: judgment,
          },
        },
      ],
    } as AgentMessage);
    appendSessionMessage(root, sessionId, {
      role: "toolResult",
      toolCallId: "finish-call",
      toolName: "finish",
      content: [{ type: "text", text: "Recorded" }],
      isError: false,
      timestamp: 2,
    });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const options = { persistDir: root, manager: new SubagentManager({ persistDir: root }), bus };
    const recovery = createTaskSessionRecovery(options);

    recovery.interrupt(sessionId, "Previous process exited");
    expect(readSessionMeta(root, sessionId)?.status).toBe("done");
    expect(
      JSON.parse(readFileSync(join(root, "sessions", sessionId, "result.json"), "utf8")).finishParams.result,
    ).toEqual(judgment);
    expect(events.filter((event) => event.type === "session.end")).toMatchObject([
      { data: {
        status: "done",
        finishParams: { status: finishStatus, result: judgment },
        summary: hasSummary
          ? judgment.summary
          : "Runtime recovery restored a committed finish result. Consult the Task's current state for acceptance.",
      } },
    ]);

    closeDb(root);
    const reopened = createTaskSessionRecovery({ ...options, manager: new SubagentManager({ persistDir: root }) });
    expect(
      JSON.parse(readFileSync(join(root, "sessions", sessionId, "result.json"), "utf8")).finishParams.result,
    ).toEqual(judgment);
    reopened.interrupt(sessionId, "Repeated recovery");
    expect(events.filter((event) => event.type === "session.end")).toHaveLength(1);
  },
);

it.each(["interrupted", "done", "error"] as const)(
  "writes recovered %s completion to the persisted owner after disabling its App",
  (status) => {
    const root = mkdtempSync(join(tmpdir(), "may-recovered-owner-"));
    roots.push(root);
    const relativeDir = "projects/sample.app/agents/actual-folder";
    const localDir = join(root, relativeDir);
    const globalDir = join(root, "agents/arc");
    for (const dir of [localDir, globalDir]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "agent.json"), JSON.stringify({ name: "arc" }));
    }
    writeFileSync(join(root, "projects/sample.app/app.js"), "export default {};");
    for (const file of ["last-session.md", "context.md"]) writeFileSync(join(globalDir, file), "Global history\n");
    const sessionId = "recovered-session";
    writeSessionMeta(root, sessionId, {
      agent: "arc",
      agentRelativeDir: relativeDir,
      task: "Produce checked facts",
      status: "running",
      startedAt: 1,
      kind: "call",
    });
    if (status !== "interrupted") {
      const finish = {
        status: status === "done" ? "success" : "failure",
        summary: "Retained decision",
        context_updates: [{ action: "add", content: "Retained owner facts" }],
      };
      appendSessionMessage(root, sessionId, {
        role: "assistant",
        content: [{ type: "toolCall", id: "finish-call", name: "finish", arguments: finish }],
      } as AgentMessage);
      appendSessionMessage(root, sessionId, {
        role: "toolResult",
        toolCallId: "finish-call",
        toolName: "finish",
        content: [{ type: "text", text: "Recorded" }],
        isError: false,
        timestamp: 2,
      });
    }
    writeFileSync(join(root, "projects/sample.app/.disabled"), "");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    bus.subscribe(createLastSessionWriter(root));
    // A fresh manager has no live owner; recovery uses only the durable record.
    const recovery = createTaskSessionRecovery({
      persistDir: root,
      manager: new SubagentManager({ persistDir: root }),
      bus,
    });
    recovery.interrupt(sessionId, "Previous worker exited");
    expect(events.filter((event) => event.type === "session.end")).toMatchObject([
      { data: { sessionId, agentRelativeDir: relativeDir, status } },
    ]);
    expect(readSessionMeta(root, sessionId)).toMatchObject({ status, agentRelativeDir: relativeDir });
    expect(readFileSync(join(localDir, "last-session.md"), "utf8")).toContain(sessionId);
    expect(existsSync(join(localDir, "context.md"))).toBe(false);
    if (status !== "interrupted") {
      const result = JSON.parse(readFileSync(join(root, "sessions", sessionId, "result.json"), "utf8"));
      expect(result.finishParams.context_updates).toEqual([{ action: "add", content: "Retained owner facts" }]);
    }
    for (const file of ["last-session.md", "context.md"])
      expect(readFileSync(join(globalDir, file), "utf8")).toBe("Global history\n");
    recovery.interrupt(sessionId, "Repeated recovery");
    expect(events.filter((event) => event.type === "session.end")).toHaveLength(1);
  },
);


function recoveryFixture(status: "running" | "done" | "error" | "interrupted" = "running") {
  const root = mkdtempSync(join(tmpdir(), "may-recovery-evidence-"));
  roots.push(root);
  const sessionId = "retained-session";
  const binding = { appId: "sample", taskId: "work", generation: 1, attemptId: "attempt-one" };
  writeSessionMeta(root, sessionId, {
    agent: "judge", task: "Inspect retained work", status, startedAt: 1, taskBinding: binding,
  });
  const bus = new EventBus();
  const events: AgentEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const recovery = createTaskSessionRecovery({ persistDir: root, manager: new SubagentManager({ persistDir: root }), bus });
  const handoff = () => recovery.handoff({
    sessionId, handler: "agent:judge", failureReason: "previous-runtime-attempt-requeued",
  } as AppTaskAttempt);
  return { root, sessionId, binding, recovery, events, handoff,
    transcript: join(root, "sessions", sessionId, "session.jsonl"),
    result: join(root, "sessions", sessionId, "result.json"),
    metadata: join(root, "sessions", sessionId, "meta.json"),
  };
}

it.each(["transcript", "checkpoint"] as const)("retains partial %s evidence and lets the replacement judge it", (kind) => {
  const f = recoveryFixture();
  let path = f.transcript;
  let good = { role: "user", content: "Known progress" } as Record<string, unknown>;
  if (kind === "checkpoint") {
    mkdirSync(join(f.root, "checkpoints"), { recursive: true });
    path = join(f.root, "checkpoints", `${f.sessionId}.jsonl`);
    good = { sessionId: f.sessionId, agentName: "judge", step: 1, summary: "Known progress", data: {}, timestamp: 1 };
  }
  // No trailing newline: recovery must not append synthetic entries to damage.
  const bytes = `${JSON.stringify(good)}\n{"unfinished":`;
  writeFileSync(path, bytes);
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  expect(readSessionMeta(f.root, f.sessionId)?.status).toBe("interrupted");
  expect(readFileSync(path, "utf8")).toBe(bytes);
  const facts = f.handoff()!.facts.join("\n");
  expect(facts).toContain("Recovery history incomplete");
  expect(facts).toContain("lines 2");
  expect(facts).toContain("Known progress");
  expect(facts).not.toContain("explicit reconciliation is required");
  expect(JSON.parse(readFileSync(f.result, "utf8")).recovery.facts.join("\n")).toContain("Recovery history incomplete");
  expect(JSON.parse(readFileSync(f.result, "utf8")).recovery).toMatchObject({
    disposition: "interrupted",
    summary: expect.stringContaining("Consult the Task's current state"),
  });
  expect(f.events.filter((event) => event.type === "session.end")).toMatchObject([
    { data: { status: "interrupted", recoveryFacts: [expect.stringContaining("Recovery history incomplete")] } },
  ]);
  expect(f.recovery.interrupt(f.sessionId, "Repeated recovery", "work", f.binding)).toBe(true);
  expect(f.events.filter((event) => event.type === "session.end")).toHaveLength(1);
  expect(readFileSync(path, "utf8")).toBe(bytes);
});

it.each([
  { kind: "transcript", contents: "{}\n" },
  { kind: "transcript", contents: '{"role":"assistant","content":[{}]}\n' },
  { kind: "checkpoint", contents: "{}\n" },
  { kind: "transcript", contents: '{"role":"toolResult","toolCallId":"call","toolName":7,"content":[],"isError":false}\n' },
])("reports structurally invalid $kind without treating it as absent", ({ kind, contents }) => {
  const f = recoveryFixture();
  if (kind === "transcript") writeFileSync(f.transcript, contents);
  else {
    mkdirSync(join(f.root, "checkpoints"), { recursive: true });
    writeFileSync(join(f.root, "checkpoints", `${f.sessionId}.jsonl`), contents);
  }
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  const facts = f.handoff()!.facts.join("\n");
  expect(facts).toContain("Recovery history incomplete");
  expect(facts).toContain("lines 1");
  expect(facts).toContain("unavailable in incomplete history");
  expect(facts).not.toContain("checkpoint: absent");
});

it.each([
  { name: "missing", bytes: null },
  { name: "unreadable JSON", bytes: '{"status":"running"' },
  { name: "unreadable fields", bytes: '{"status":["running"]}' },
  { name: "partial binding", bytes: '{"taskBinding":{"appId":"sample"}}' },
])("uses retained Task ownership with $name metadata and preserves its evidence", ({ name, bytes }) => {
  const f = recoveryFixture();
  if (bytes === null) rmSync(f.metadata);
  else writeFileSync(f.metadata, bytes);
  const result = '{"summary":"Earlier work may already have effects"}';
  writeFileSync(f.result, result);
  writeFileSync(f.transcript, '{"unfinished":');
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  if (bytes === null) expect(existsSync(f.metadata)).toBe(false);
  else expect(readFileSync(f.metadata, "utf8")).toBe(bytes);
  expect(readFileSync(f.result, "utf8")).toBe(result);
  expect(f.events).toEqual([]);
  expect(f.handoff()!.facts.join("\n")).toContain(`session metadata is ${name === "missing" ? "missing" : "unreadable"}`);
  expect(f.handoff()!.facts.join("\n")).toContain("Recovery history incomplete");
});

it("still requires the old process to exit when session metadata is missing", () => {
  const f = recoveryFixture();
  rmSync(f.metadata);
  let drained = false;
  let drainCalls = 0;
  const recovery = createTaskSessionRecovery({
    persistDir: f.root, bus: new EventBus(),
    manager: { hasActiveSession: () => false } as never,
    drainPersistedBashProcessGroups: () => { drainCalls++; return drained; },
  });
  markSessionActive(f.root, f.sessionId);
  expect(() => recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toThrow("external owner is still live");
  expect(drainCalls).toBe(0);
  rmSync(join(f.root, "sessions", f.sessionId, "[ACTIVE]"));
  expect(() => recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toThrow("did not exit");
  drained = true;
  expect(recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(existsSync(f.metadata)).toBe(false);
});

it.each([null, '{"status":"running"', '{"status":"bogus"}'])("requires an ownership source before cleanup with metadata %s", (bytes) => {
  const f = recoveryFixture();
  if (bytes === null) rmSync(f.metadata);
  else writeFileSync(f.metadata, bytes);
  const touched: string[] = [];
  const recovery = createTaskSessionRecovery({
    persistDir: f.root, bus: new EventBus(),
    manager: { hasActiveSession: () => true, cancel: () => touched.push("cancel") } as never,
    drainPersistedBashProcessGroups: () => { touched.push("drain"); return true; },
  });
  expect(() => recovery.interrupt(f.sessionId, "Recover")).toThrow("no retained Task binding and no valid session metadata");
  expect(touched).toEqual([]);
  if (bytes !== null) expect(readFileSync(f.metadata, "utf8")).toBe(bytes);
  expect(existsSync(f.result)).toBe(false);
});

it("uses the retained binding when the session has no copied Task binding", () => {
  const f = recoveryFixture("done");
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  delete meta.taskBinding;
  const bytes = JSON.stringify(meta);
  writeFileSync(f.metadata, bytes);
  expect(f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(readFileSync(f.metadata, "utf8")).toBe(bytes);
  expect(f.events).toEqual([]);
});

it("builds usable recovery context when the optional session error is not text", () => {
  const f = recoveryFixture("done");
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  meta.error = 42;
  writeFileSync(f.metadata, JSON.stringify(meta));
  expect(f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(f.handoff()?.reason).toBe("recovered-session");
  expect(f.handoff()?.facts).toContain(`Recovered interrupted agent session metadata: ${f.metadata}`);
});

it.each(["valid", "damaged", "partial"] as const)("preserves readable ownership conflicts in %s metadata", (status) => {
  const f = recoveryFixture();
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  meta.taskBinding.attemptId = "another-attempt";
  if (status === "damaged") meta.status = ["running"];
  if (status === "partial") meta.taskBinding = { attemptId: "another-attempt" };
  writeFileSync(f.metadata, JSON.stringify(meta));
  const touched: string[] = [];
  const recovery = createTaskSessionRecovery({
    persistDir: f.root, bus: new EventBus(),
    manager: { hasActiveSession: () => true, cancel: () => touched.push("cancel") } as never,
    drainPersistedBashProcessGroups: () => { touched.push("drain"); return true; },
  });
  expect(() => recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toThrow("session Task binding");
  expect(touched).toEqual([]);
  expect(readFileSync(f.metadata, "utf8")).toBe(JSON.stringify(meta));
  expect(existsSync(f.result)).toBe(false);
});

it("rejects a retained binding for another Task before cancellation or drain", () => {
  const f = recoveryFixture();
  rmSync(f.metadata);
  const touched: string[] = [];
  const recovery = createTaskSessionRecovery({
    persistDir: f.root, bus: new EventBus(),
    manager: { hasActiveSession: () => true, cancel: () => touched.push("cancel") } as never,
    drainPersistedBashProcessGroups: () => { touched.push("drain"); return true; },
  });
  expect(() => recovery.interrupt(f.sessionId, "Previous worker exited", "another-task", f.binding)).toThrow("retained Task binding");
  expect(touched).toEqual([]);
  expect(existsSync(f.result)).toBe(false);
});

it.each(["damaged", "terminal"])("honors a live detached process in %s metadata", (kind) => {
  const f = recoveryFixture("done");
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  if (kind === "damaged") meta.status = ["running"];
  meta.detached = true;
  meta.pid = process.pid;
  writeFileSync(f.metadata, JSON.stringify(meta));
  expect(f.recovery.isLive(f.sessionId)).toBe(true);
  expect(() => f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toThrow("external owner is still live");
  expect(readFileSync(f.metadata, "utf8")).toBe(JSON.stringify(meta));
  expect(f.events).toEqual([]);
});

it.each(["absent", "terminal"] as const)("honors the live process marker when metadata is %s", (kind) => {
  const f = recoveryFixture("done");
  if (kind === "absent") rmSync(f.metadata);
  markSessionActive(f.root, f.sessionId);
  expect(f.recovery.isLive(f.sessionId)).toBe(true);
  expect(() => f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toThrow("external owner is still live");
  expect(existsSync(f.result)).toBe(false);
});

it.each(["done", "error", "interrupted"] as const)("preserves %s terminal evidence while exposing damaged history", (status) => {
  const f = recoveryFixture(status);
  const savedResult = JSON.stringify({ status, summary: "Retained result" });
  writeFileSync(f.result, savedResult);
  writeFileSync(f.transcript, '{"unfinished":');
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  expect(f.recovery.interrupt(f.sessionId, "Repeated recovery", "work", f.binding)).toBe(true);
  expect(readSessionMeta(f.root, f.sessionId)?.status).toBe(status);
  expect(readFileSync(f.result, "utf8")).toBe(savedResult);
  expect(f.events.filter((event) => event.type === "session.end")).toHaveLength(0);
  expect(f.handoff()!.facts.join("\n")).toContain("Recovery history incomplete");
});

it("preserves a committed finish receipt despite unrelated earlier malformed history", () => {
  const f = recoveryFixture();
  writeFileSync(f.transcript, "malformed\n");
  appendSessionMessage(f.root, f.sessionId, {
    role: "assistant",
    content: [{ type: "toolCall", id: "finish-call", name: "finish", arguments: { status: "success", summary: "Committed" } }],
  } as AgentMessage);
  appendSessionMessage(f.root, f.sessionId, {
    role: "toolResult", toolCallId: "finish-call", toolName: "finish",
    content: [{ type: "text", text: "Recorded" }], isError: false, timestamp: 2,
  });
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  expect(readSessionMeta(f.root, f.sessionId)?.status).toBe("done");
  expect(JSON.parse(readFileSync(f.result, "utf8"))).toMatchObject({
    status: "done", finishParams: { status: "success", summary: "Committed" },
  });
  expect(f.handoff()!.facts.join("\n")).toContain("Recovery history incomplete");
});
