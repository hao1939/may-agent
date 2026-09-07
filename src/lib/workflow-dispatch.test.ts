import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SubagentManager } from "./manager.js";
import { closeDb, getWorkflowRun } from "./requests.js";
import type { RuntimeCtx } from "./runtime-ctx.js";
import { runWorkflowDirect, WorkflowHandlerUnavailable } from "./workflow-tool.js";

describe("direct workflow dispatch snapshot", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = mkdtempSync(join(tmpdir(), "workflow-dispatch-"));
    roots.push(root);
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    return {
      workflowDir,
      persistDir: root,
      agentName: "owner",
      workflowName: "versioned",
      task: "Run one captured workflow definition",
      manager: {} as SubagentManager,
      runtimeCtx: { emit: () => {}, log: () => {} } as unknown as RuntimeCtx,
    };
  }

  for (const status of ["done", "blocked"] as const) {
    it(`keeps ${status} execution, nested calls, provenance, and verification in one snapshot`, async () => {
      const opts = setup();
      function source(version: string) {
        return `
export const name = "versioned";
export const description = "Versioned execution and verification fixture";
export async function execute(ctx) {
  const child = await ctx.workflows.run("child", {});
  return ctx.${status}("${version}:" + child.summary);
}
export async function verify(_context, result) {
  return { accepted: (result.summary ?? result.reason) === "${version}:${version}", version: "${version}" };
}
`;
      }
      function childSource(version: string) {
        return `
export const name = "child";
export const description = "Nested snapshot fixture";
export async function execute(ctx) { return ctx.done("${version}"); }
`;
      }
      const oldSource = source("v1");
      const oldPath = join(opts.workflowDir, "a-v1.ts");
      const newPath = join(opts.workflowDir, "a-v2.ts");
      const oldChildPath = join(opts.workflowDir, "b-v1.ts");
      writeFileSync(oldPath, oldSource);
      writeFileSync(oldChildPath, childSource("v1"));
      // The last catalog entry deterministically simulates a source publication
      // after v1 was loaded. Distinct entry paths also avoid relying on Bun
      // test's handling of query-string cache busting for same-path imports.
      writeFileSync(
        join(opts.workflowDir, "z-publish.ts"),
        `
import { unlinkSync, writeFileSync } from "node:fs";
unlinkSync(${JSON.stringify(oldPath)});
unlinkSync(${JSON.stringify(oldChildPath)});
writeFileSync(${JSON.stringify(newPath)}, ${JSON.stringify(source("v2"))});
writeFileSync(${JSON.stringify(join(opts.workflowDir, "b-v2.ts"))}, ${JSON.stringify(childSource("v2"))});
export const name = "publish-fixture";
export const description = "Simulate a source change during catalog loading";
export async function execute(ctx) { return ctx.done("unused"); }
`,
      );

      const first = await runWorkflowDirect(opts);
      expect(first.result).toEqual(
        status === "done"
          ? { type: "done", summary: "v1:v1", output: undefined }
          : { type: "blocked", reason: "v1:v1", context: undefined },
      );
      expect(first.verifier?.sourcePath).toBe(oldPath);
      expect(await first.verifier?.verify({}, first.result)).toEqual({ accepted: true, version: "v1" });
      expect(getWorkflowRun(opts.persistDir, first.runId)).toMatchObject({
        workflow: "versioned",
        sourcePath: oldPath,
        entryContentHash: createHash("sha256").update(oldSource).digest("hex"),
      });

      // A snapshot is per dispatch, not a permanent runner/module cache.
      const second = await runWorkflowDirect(opts);
      expect(second.result).toEqual(
        status === "done"
          ? { type: "done", summary: "v2:v2", output: undefined }
          : { type: "blocked", reason: "v2:v2", context: undefined },
      );
      expect(second.verifier?.sourcePath).toBe(newPath);
      expect(await second.verifier?.verify({}, second.result)).toEqual({ accepted: true, version: "v2" });
      expect(await first.verifier?.verify({}, first.result)).toEqual({ accepted: true, version: "v1" });
    });
  }

  it("does not require a verifier", async () => {
    const opts = setup();
    writeFileSync(
      join(opts.workflowDir, "plain.ts"),
      `
export const name = "versioned";
export const description = "No verifier";
export async function execute(ctx) { return ctx.done("done"); }
`,
    );
    const result = await runWorkflowDirect(opts);
    expect(result.result).toMatchObject({ type: "done", summary: "done" });
    expect(result.verifier).toBeUndefined();
  });

  it("preserves missing-definition errors", async () => {
    await expect(runWorkflowDirect(setup())).rejects.toBeInstanceOf(WorkflowHandlerUnavailable);
  });

  it("rejects duplicate effective names with catalog diagnostics", async () => {
    const opts = setup();
    for (const entry of ["a", "b"]) {
      writeFileSync(
        join(opts.workflowDir, `${entry}.ts`),
        `
export const name = "versioned";
export const description = "Ambiguous definition";
export async function execute() { throw new Error("must not execute"); }
`,
      );
    }
    await expect(runWorkflowDirect(opts)).rejects.toThrow('Ambiguous agent workflow name "versioned"');
  });
});
