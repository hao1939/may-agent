import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "./db/connection.js";
import { createWorkflowRunner } from "./workflow-tool.js";
import { readWorkflowEvidence } from "./workflow-evidence.js";
import {
  createWorkflowDiagnostics,
  MAX_WORKFLOW_DIAGNOSTICS_BYTES,
  readWorkflowDiagnostics,
} from "./workflow-diagnostics.js";
import { SubagentManager } from "./manager.js";

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
