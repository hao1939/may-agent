import { afterEach, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markStaleSession } from "../../../../test/fixtures/stale-session.js";
import { SubagentManager } from "../../../lib/manager.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { getDb, closeDb } from "../../../lib/db/connection.js";
import { upsertSession, updateSessionDb } from "../../../lib/db/sessions.js";
import { describeText } from "../../../lib/artifacts.js";
import { markSessionActive, readSessionMeta, writeSessionMeta } from "../../../lib/persistence.js";
import { EventBus, type AgentEvent } from "../../core/events/bus.js";
import { createTaskSessionRecovery } from "./session-recovery.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function recoveryFixture(status: "running" | "idle" | "done" | "error" | "interrupted" = "running") {
  const root = mkdtempSync(join(tmpdir(), "may-recovery-evidence-"));
  roots.push(root);
  const sessionId = "retained-session";
  const binding = { appId: "sample", taskId: "work", generation: 1, attemptId: "attempt-one" };
  writeSessionMeta(root, sessionId, {
    agent: "judge",
    task: "Inspect retained work",
    status,
    startedAt: 1,
    taskBinding: binding,
  });
  const bus = new EventBus();
  const events: AgentEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const recovery = createTaskSessionRecovery({
    persistDir: root,
    manager: new SubagentManager({ persistDir: root }),
    bus,
  });
  return {
    root,
    sessionId,
    binding,
    recovery,
    events,
    transcript: join(root, "sessions", sessionId, "session.jsonl"),
    result: join(root, "sessions", sessionId, "result.json"),
    metadata: join(root, "sessions", sessionId, "meta.json"),
  };
}

it("marks an interrupted session once, preserves transcript bytes, and points to the owning Task", () => {
  const f = recoveryFixture();
  const bytes = '{"role":"user","content":"Known progress"}\n{"unfinished":';
  writeFileSync(f.transcript, bytes);
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  expect(readSessionMeta(f.root, f.sessionId)).toMatchObject({
    status: "interrupted",
    error: "Previous worker exited",
  });
  expect(readFileSync(f.transcript, "utf8")).toBe(bytes);
  expect(JSON.parse(readFileSync(f.result, "utf8"))).toMatchObject({
    status: "interrupted",
    outcome: "interrupted",
    error: "Previous worker exited",
    summary: expect.stringContaining("Consult the Task's current state"),
  });
  expect(f.events.filter((event) => event.type === "session.end")).toMatchObject([
    { data: { sessionId: f.sessionId, status: "interrupted", error: "Previous worker exited" } },
  ]);
  expect(f.recovery.interrupt(f.sessionId, "Repeated recovery", "work", f.binding)).toBe(true);
  expect(f.events.filter((event) => event.type === "session.end")).toHaveLength(1);
  expect(readFileSync(f.transcript, "utf8")).toBe(bytes);
});

it("emits recovered interrupted completion with the persisted agentRelativeDir after disabling its App", () => {
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
  writeFileSync(join(globalDir, "context.md"), "Global history\n");
  const sessionId = "recovered-session";
  writeSessionMeta(root, sessionId, {
    agent: "arc",
    agentRelativeDir: relativeDir,
    task: "Produce checked facts",
    status: "running",
    startedAt: 1,
    kind: "call",
  });
  writeFileSync(join(root, "projects/sample.app/.disabled"), "");
  const bus = new EventBus();
  const events: AgentEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const recovery = createTaskSessionRecovery({
    persistDir: root,
    manager: new SubagentManager({ persistDir: root }),
    bus,
  });
  recovery.interrupt(sessionId, "Previous worker exited");
  expect(events.filter((event) => event.type === "session.end")).toMatchObject([
    { data: { sessionId, agentRelativeDir: relativeDir, status: "interrupted" } },
  ]);
  expect(readSessionMeta(root, sessionId)).toMatchObject({ status: "interrupted", agentRelativeDir: relativeDir });
  expect(existsSync(join(localDir, "context.md"))).toBe(false);
  expect(readFileSync(join(globalDir, "context.md"), "utf8")).toBe("Global history\n");
  recovery.interrupt(sessionId, "Repeated recovery");
  expect(events.filter((event) => event.type === "session.end")).toHaveLength(1);
});

it.each([
  { name: "missing", bytes: null },
  { name: "unreadable JSON", bytes: '{"status":"running"' },
  { name: "unreadable fields", bytes: '{"status":["running"]}' },
  { name: "partial binding", bytes: '{"taskBinding":{"appId":"sample"}}' },
])("uses retained Task ownership with $name metadata and preserves its evidence", ({ bytes }) => {
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
});

it("preserves session state and result evidence until damaged process evidence is repaired", () => {
  const f = recoveryFixture();
  const metadata = readFileSync(f.metadata, "utf8");
  const result = '{"summary":"Retained work"}';
  const path = join(f.root, "sessions", f.sessionId, "bash-process-groups.json");
  const damaged = '{"pgids":[';
  writeFileSync(f.result, result);
  writeFileSync(path, damaged);
  expect(() => f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toThrow("bash process-group evidence");
  expect(readFileSync(path, "utf8")).toBe(damaged);
  expect(readFileSync(f.metadata, "utf8")).toBe(metadata);
  expect(readFileSync(f.result, "utf8")).toBe(result);
  expect(f.events).toEqual([]);
  writeFileSync(path, '{"pgids":[]}');
  expect(f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(readFileSync(f.result, "utf8")).toBe(result);
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

it("can interrupt a rejected session from its valid metadata without giving it a retained Task attempt", () => {
  const f = recoveryFixture();
  // The session-start handler also uses this adapter to stop rejected/stale
  // execution. Such execution was never admitted as the Task's owned attempt.
  expect(f.recovery.interrupt(f.sessionId, "Session start was rejected", "work")).toBe(true);
  expect(readSessionMeta(f.root, f.sessionId)?.status).toBe("interrupted");
  expect(getDb(f.root).prepare("SELECT count(*) AS count FROM app_task_attempts").get()).toEqual({ count: 0 });
});

it.each((["running", "idle"] as const).flatMap((status) =>
  [true, false].map((copiedBinding) => ({ status, copiedBinding })),
))("preserves a surviving result during $status cleanup (copied binding: $copiedBinding)", ({ status, copiedBinding }) => {
  const f = recoveryFixture(status);
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  if (!copiedBinding) delete meta.taskBinding;
  writeFileSync(f.metadata, JSON.stringify(meta));
  const bytes = '{"status":"done","summary":"Previously saved contribution"}\n';
  writeFileSync(f.result, bytes);
  const artifact = describeText(`sessions/${f.sessionId}/result.json`, bytes);
  upsertSession(f.root, { sessionId: f.sessionId, agent: "judge", task: "work", status, startedAt: 1, taskBinding: f.binding });
  updateSessionDb(f.root, f.sessionId, { status, outcome: "Previously saved contribution", resultArtifact: artifact });
  const bus = new EventBus();
  const writer = new DbWriter(f.root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.subscribe((event) => f.events.push(event));
  const recovery = createTaskSessionRecovery({ persistDir: f.root, manager: new SubagentManager({ persistDir: f.root }), bus });

  expect(existsSync(f.transcript)).toBe(false);
  expect(recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  expect(readFileSync(f.result, "utf8")).toBe(bytes);
  expect(getDb(f.root).prepare("SELECT status, endedAt, outcome, result_ref, result_sha256, result_bytes FROM sessions WHERE sessionId = ?").get(f.sessionId)).toEqual({
    status: "interrupted", endedAt: expect.any(Number), outcome: "Previously saved contribution",
    result_ref: artifact.ref, result_sha256: artifact.sha256, result_bytes: artifact.bytes,
  });
  expect(readSessionMeta(f.root, f.sessionId)?.status).toBe("interrupted");
  expect(f.events.filter((event) => event.type === "session.end")).toEqual([]);
  closeDb(f.root);
  expect(recovery.interrupt(f.sessionId, "Repeated recovery", "work", f.binding)).toBe(true);
  expect(readFileSync(f.result, "utf8")).toBe(bytes);
});

it.each([
  { field: "error", value: 42 },
  { field: "error", value: { message: "unknown legacy format" } },
  { field: "endedAt", value: { timestamp: 2 } },
])("retains damaged optional $field evidence without rewriting metadata", ({ field, value }) => {
  const f = recoveryFixture("done");
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  meta[field] = value;
  const bytes = JSON.stringify(meta);
  writeFileSync(f.metadata, bytes);
  expect(f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(readFileSync(f.metadata, "utf8")).toBe(bytes);
  expect(f.events).toEqual([]);
});

it("preserves terminal SQL facts when metadata cannot describe the old outcome", () => {
  const f = recoveryFixture("done");
  upsertSession(f.root, {
    sessionId: f.sessionId, agent: "judge", task: "work", status: "done", startedAt: 1,
    endedAt: 2, outcome: "Retained decision", taskBinding: f.binding,
  });
  writeFileSync(f.metadata, '{"status":');
  const before = getDb(f.root).prepare("SELECT * FROM sessions WHERE sessionId = ?").get(f.sessionId);
  expect(f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(getDb(f.root).prepare("SELECT * FROM sessions WHERE sessionId = ?").get(f.sessionId)).toEqual(before);
  expect(readFileSync(f.metadata, "utf8")).toBe('{"status":');
  expect(existsSync(f.result)).toBe(false);
  expect(f.events).toEqual([]);
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

it.each((["damaged", "terminal"] as const).flatMap((kind) =>
  (["absent", "unreadable", "other-pid"] as const).map((marker) => ({ kind, marker })),
))("honors a live detached process in $kind metadata with $marker marker", ({ kind, marker }) => {
  const f = recoveryFixture("done");
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  if (kind === "damaged") meta.status = ["running"];
  meta.detached = true;
  meta.pid = process.pid;
  meta.startedAt = Date.now();
  writeFileSync(f.metadata, JSON.stringify(meta));
  if (marker !== "absent") writeFileSync(join(f.root, "sessions", f.sessionId, "[ACTIVE]"),
    marker === "unreadable" ? "legacy timestamp" : JSON.stringify({ pid: 2147483647 }));
  expect(f.recovery.isLive(f.sessionId)).toBe(true);
  expect(() => f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toThrow("external owner is still live");
  expect(readFileSync(f.metadata, "utf8")).toBe(JSON.stringify(meta));
  expect(f.events).toEqual([]);
});

it.each(["damaged", "terminal"])("does not reuse a PID rejected by the session process marker in %s metadata", (kind) => {
  const f = recoveryFixture("done");
  const meta = JSON.parse(readFileSync(f.metadata, "utf8"));
  if (kind === "damaged") meta.status = ["running"];
  meta.detached = true;
  meta.pid = process.pid;
  // Recent history alone cannot establish PID reuse; the explicit process
  // identity mismatch must take precedence even without an old timestamp.
  meta.startedAt = Date.now();
  const bytes = JSON.stringify(meta);
  writeFileSync(f.metadata, bytes);
  markStaleSession(f.root, f.sessionId);
  expect(f.recovery.isLive(f.sessionId)).toBe(false);
  expect(f.recovery.interrupt(f.sessionId, "Recover", "work", f.binding)).toBe(true);
  expect(readFileSync(f.metadata, "utf8")).toBe(bytes);
  expect(existsSync(f.result)).toBe(false);
});

it.each(["absent", "terminal"] as const)("honors the live process marker when metadata is %s", (kind) => {
  const f = recoveryFixture("done");
  if (kind === "absent") rmSync(f.metadata);
  markSessionActive(f.root, f.sessionId);
  expect(f.recovery.isLive(f.sessionId)).toBe(true);
  expect(() => f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toThrow("external owner is still live");
  expect(existsSync(f.result)).toBe(false);
});

it.each(["done", "error", "interrupted"] as const)("preserves %s terminal evidence without emitting duplicate session.end", (status) => {
  const f = recoveryFixture(status);
  const savedResult = JSON.stringify({ status, summary: "Retained result" });
  writeFileSync(f.result, savedResult);
  writeFileSync(f.transcript, '{"unfinished":');
  expect(f.recovery.interrupt(f.sessionId, "Previous worker exited", "work", f.binding)).toBe(true);
  expect(f.recovery.interrupt(f.sessionId, "Repeated recovery", "work", f.binding)).toBe(true);
  expect(readSessionMeta(f.root, f.sessionId)?.status).toBe(status);
  expect(readFileSync(f.result, "utf8")).toBe(savedResult);
  expect(f.events.filter((event) => event.type === "session.end")).toHaveLength(0);
});
