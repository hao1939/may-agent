import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./db/connection.js";
import { listWorkflowRunIds } from "./db/workflows.js";
import { createWorkflowRunner } from "./workflow-tool.js";
import { readWorkflowEvidence } from "./workflow-evidence.js";
import {
  createWorkflowDiagnostics,
  MAX_WORKFLOW_DIAGNOSTICS_BYTES,
  readWorkflowDiagnostics,
} from "./workflow-diagnostics.js";
import { SubagentManager } from "./manager.js";
import { MAX_WORKFLOW_PAYLOAD_BYTES, retainWorkflowPayload } from "./workflow-payload.js";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "workflow-evidence-"));
  roots.push(root);
  const workflows = join(root, "workflows");
  mkdirSync(workflows);
  return { root, workflows };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("workflow evidence without reporting", () => {
  it("bounds payload traversal without invoking authored accessors, serializers or proxy traps", () => {
    let invoked = 0;
    const hook = () => { invoked++; throw new Error("Authored hook must not run"); };
    for (const value of [{ get data() { return hook(); } }, { toJSON: hook }, new Proxy({}, { ownKeys: hook })]) {
      expect(retainWorkflowPayload("output", value)).toEqual({ kind: "output", state: "unavailable", reason: "not-json" });
    }
    expect(invoked).toBe(0);
    const wide = { large: "x".repeat(MAX_WORKFLOW_PAYLOAD_BYTES + 1), get later() { return hook(); } };
    const deep = Array.from({ length: 100 }).reduce<object>((child) => ({ child }), {});
    for (const value of [wide, deep, new Array(1_000_000), { ["x".repeat(MAX_WORKFLOW_PAYLOAD_BYTES)]: 0 }]) {
      expect(retainWorkflowPayload("output", value)).toEqual({ kind: "output", state: "unavailable", reason: "too-large" });
    }
    expect(invoked).toBe(0);
    for (const value of [{ optional: undefined }, [undefined], new Array(1)]) {
      expect(retainWorkflowPayload("output", value)).toMatchObject({ state: "unavailable", reason: "not-json" });
    }
    const shared = { count: 1 };
    expect(retainWorkflowPayload("output", [shared, shared])).toMatchObject({ state: "available", value: [shared, shared] });
    const boundary = "x".repeat(MAX_WORKFLOW_PAYLOAD_BYTES - 2);
    expect(retainWorkflowPayload("output", boundary)).toMatchObject({ state: "available", value: boundary });
    expect(retainWorkflowPayload("output", boundary + "x")).toMatchObject({ state: "unavailable", reason: "too-large" });
    const longSecret = "token=" + "x".repeat(16_000);
    expect(retainWorkflowPayload("output", Array(10).fill(longSecret))).toMatchObject({ state: "unavailable", reason: "too-large" });
    const secretKey = "ghp_" + "x".repeat(36);
    expect(retainWorkflowPayload("output", { [secretKey]: "data" })).toEqual({ kind: "output", state: "unavailable", reason: "sensitive-key" });
  });
  it.each(["done", "blocked"] as const)(
    "retains %s output with redaction and integrity checks after storage reopen",
    async (status) => {
      const { root, workflows } = fixture();
      const secret = "synthetic-credential-".repeat(4);
      writeFileSync(
        join(workflows, "packet.ts"),
        `
      export const name = "packet";
      export const description = "Evidence fixture";
      export async function execute(ctx) {
        return ctx.${status}("collected", {
          revision: "v1", attempts: [{status: 503}, {status: 200}],
          token: ${JSON.stringify(secret)}, detail: ${JSON.stringify(`token=${secret}`)}
        });
      }
    `,
      );
      const runner = createWorkflowRunner({ manager: {} as SubagentManager, workflowDir: workflows, persistDir: root });
      const result = await runner.run("packet", "test");
      expect(result.type).toBe(status);
      if (!("workflowRunId" in result) || !result.workflowRunId) throw new Error("Missing run identity");
      const path = join(root, "workflow-runs", result.workflowRunId, "run.json");
      expect(readFileSync(path, "utf8")).not.toContain(secret);
      closeDb(root);
      const retained = readWorkflowEvidence(root, result.workflowRunId)!;
      expect(retained.run.result_payload).toEqual({
        kind: status === "done" ? "output" : "evidence",
        state: "available",
        redacted: true,
        value: {
          revision: "v1",
          attempts: [{ status: 503 }, { status: 200 }],
          token: "[REDACTED]",
          detail: "token=[REDACTED]",
        },
      });
      // Inspection sanitizes its own copy; the immediate caller still gets the authored value.
      expect(
        status === "done" && result.type === "done" ? result.output : result.type === "blocked" ? result.context : null,
      ).toMatchObject({ token: secret });
      writeFileSync(path, JSON.stringify({ ...retained.run, result_payload: { value: "tampered" } }));
      expect(readWorkflowEvidence(root, result.workflowRunId)?.run).toMatchObject({
        artifact_error: "workflow artifact integrity mismatch",
      });
      expect(readWorkflowEvidence(root, result.workflowRunId)?.run.result_payload).toBeUndefined();
      rmSync(path);
      expect(readWorkflowEvidence(root, result.workflowRunId)?.run).toMatchObject({
        artifact_error: "workflow artifact missing",
      });
    },
  );

  it.each([
    ["oversize", `"长".repeat(${MAX_WORKFLOW_PAYLOAD_BYTES})`, "too-large"],
    ["circular", "(() => { const a = {}; a.self = a; return a; })()", "not-json"],
    ["bigint", "{ count: 1n }", "not-json"],
    ["throwing", "{ toJSON() { throw new Error('private data'); } }", "not-json"],
  ])("keeps completed work when its inspection payload is %s", async (_name, expression, reason) => {
    const { root, workflows } = fixture();
    writeFileSync(
      join(workflows, "payload.ts"),
      `
      export const name = "payload";
      export const description = "Bad output fixture";
      export async function execute(ctx) { return ctx.done("finished", ${expression}); }
    `,
    );
    const runner = createWorkflowRunner({ manager: {} as SubagentManager, workflowDir: workflows, persistDir: root });
    const result = await runner.run("payload", "test");
    expect(result.type).toBe("done");
    if (result.type !== "done") throw new Error("Expected completed run");
    closeDb(root);
    expect(readWorkflowEvidence(root, result.workflowRunId)?.run.result_payload).toEqual({
      kind: "output",
      state: "unavailable",
      reason,
    });
  });

  it.each(["insert", "started-event", "finalize"] as const)(
    "reports honest evidence when workflow setup or persistence fails: %s",
    async (failure) => {
      const { root, workflows } = fixture();
      writeFileSync(
        join(workflows, "setup.ts"),
        `
        export const name = "setup";
        export const description = "Fixture setup failure";
        export async function execute(ctx) { return ctx.done("executed"); }
      `,
      );
      const db = getDb(root);
      if (failure === "insert")
        db.run(`CREATE TRIGGER fail_insert BEFORE INSERT ON workflow_runs
        BEGIN SELECT RAISE(ABORT, 'fixture insert failed'); END`);
      if (failure === "finalize")
        db.run(`CREATE TRIGGER fail_update BEFORE UPDATE ON workflow_runs
        BEGIN SELECT RAISE(ABORT, 'fixture finalize failed'); END`);
      const seen: string[] = [];
      const runner = createWorkflowRunner({
        manager: {} as SubagentManager,
        workflowDir: workflows,
        persistDir: root,
        runtimeCtx: {
          emit(event: { type: string }) {
            seen.push(event.type);
            if (failure === "started-event") throw new Error(`fixture ${event.type} failed`);
          },
        } as never,
      });
      const result = await runner.run("setup", "test setup");
      expect(result).toMatchObject({
        type: "error",
        error: `fixture ${failure === "started-event" ? "workflow.started" : failure} failed`,
      });
      closeDb(root);
      const runIds = listWorkflowRunIds(root);
      if (failure === "started-event") {
        expect(runIds).toHaveLength(1);
        expect(result).toMatchObject({ workflowRunId: runIds[0] });
        const evidence = readWorkflowEvidence(root, runIds[0]!)!;
        expect(evidence.run).toMatchObject({ status: "error", result_reason: "fixture workflow.started failed" });
        expect(evidence.run.endedAt).toBeGreaterThanOrEqual(evidence.run.startedAt);
        expect(evidence.run.artifact_error).toBeUndefined();
        expect(evidence.steps).toEqual([]);
        expect(seen).not.toContain("workflow.completed");
      } else {
        expect(result).not.toHaveProperty("workflowRunId");
        expect(runIds).toHaveLength(failure === "insert" ? 0 : 1);
        if (failure === "finalize") expect(readWorkflowEvidence(root, runIds[0]!)?.run.status).toBe("running");
      }
    },
  );

  it("retains a recovered child failure and scoped logs after reopening storage", async () => {
    const { root, workflows } = fixture();
    writeFileSync(
      join(workflows, "upload.ts"),
      `
      export const name = "upload";
      export const description = "Fixture upload";
      export async function execute(ctx) {
        if (ctx.input.fail) throw new Error("Upload unavailable");
        return ctx.done("uploaded");
      }`,
    );
    writeFileSync(
      join(workflows, "report.ts"),
      `
      export const name = "report";
      export const description = "Fixture report";
      export async function execute(ctx) {
        ctx.log.info("prepared report");
        try { await ctx.workflows.run("upload", { fail: true }); }
        catch { ctx.log.warn("retrying upload"); }
        await ctx.workflows.run("upload", { fail: false });
        return ctx.done("delivered");
      }`,
    );
    // No runtimeCtx, MetricService, EventBus, or reporting component installed.
    const runner = createWorkflowRunner({
      manager: {} as SubagentManager,
      workflowDir: workflows,
      persistDir: root,
      agentName: "owner",
    });
    const result = await runner.run("report", "prepare report");
    expect(result.type).toBe("done");
    if (result.type !== "done") throw new Error("Expected completed run");
    closeDb(root);
    const evidence = readWorkflowEvidence(root, result.workflowRunId)!;
    expect(evidence.run).toMatchObject({ status: "done", result_summary: "delivered" });
    expect(evidence.diagnostics.entries.map((entry) => entry.message)).toEqual(["prepared report", "retrying upload"]);
    expect(evidence.childRunIds.map((id) => readWorkflowEvidence(root, id)!.run.status)).toEqual(["error", "done"]);
    expect(readWorkflowEvidence(root, evidence.childRunIds[0]!)!.run.result_reason).toBe("Upload unavailable");
    const trace = new SubagentManager({ persistDir: root }).trace(result.workflowRunId);
    expect(trace.evidence).toEqual(evidence);
    expect(trace.tree.children[0]).toMatchObject({ status: "done", summary: "delivered" });
    expect(readWorkflowEvidence(root, "wr_missing")).toBeNull();
  });

  it("keeps the original failure and logs when a presentation logger throws", async () => {
    const { root, workflows } = fixture();
    writeFileSync(
      join(workflows, "fail.ts"),
      `
      export const name = "fail";
      export const description = "Fixture failure";
      export async function execute(ctx) {
        ctx.log.info("prepared partial output");
        throw new Error("original upload error");
      }`,
    );
    const runner = createWorkflowRunner({
      manager: {} as SubagentManager,
      workflowDir: workflows,
      persistDir: root,
      runtimeCtx: {
        emit() {},
        log() {
          throw new Error("sink failure");
        },
      } as never,
    });
    const result = await runner.run("fail", "test");
    expect(result).toMatchObject({ type: "error", error: "original upload error" });
    if (result.type !== "error" || !result.workflowRunId) throw new Error("Missing failed run identity");
    const evidence = readWorkflowEvidence(root, result.workflowRunId)!;
    expect(evidence.run).toMatchObject({ status: "error", result_reason: "original upload error" });
    expect(evidence.diagnostics.entries[0]?.message).toBe("prepared partial output");
  });

  it("bounds and redacts diagnostics, and exposes missing or corrupt detail honestly", () => {
    const { root } = fixture();
    const record = createWorkflowDiagnostics(root, "wr_bounded");
    const secret = "test-credential-".repeat(5);
    record("info", `token=${secret}`);
    for (let i = 0; i < 100; i++) record("warn", "长".repeat(10_000));
    const evidence = readWorkflowDiagnostics(root, "wr_bounded");
    expect(evidence).toMatchObject({ state: "available", truncated: true });
    const path = join(root, evidence.ref);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_WORKFLOW_DIAGNOSTICS_BYTES);
    expect(readFileSync(path, "utf8")).not.toContain(secret);
    expect(evidence.entries[0]?.message).toContain("[REDACTED]");
    writeFileSync(path, "broken");
    expect(readWorkflowDiagnostics(root, "wr_bounded").state).toBe("unavailable");
    expect(readWorkflowDiagnostics(root, "wr_legacy").state).toBe("unavailable");
    expect(() => readWorkflowDiagnostics(root, "../outside")).toThrow("Invalid workflow run identity");
    // File where a directory is expected deterministically fails on every OS/user.
    writeFileSync(join(root, "not-a-directory"), "fixture");
    const broken = createWorkflowDiagnostics(join(root, "not-a-directory"), "wr_failed");
    expect(() => broken("error", "still running")).not.toThrow();
  });
});
