import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectWorkflowDefinition } from "./workflow-tool.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function workflow(source: string): string {
  const root = mkdtempSync(join(tmpdir(), "may-workflow-metadata-"));
  roots.push(root);
  const dir = join(root, "workflows");
  mkdirSync(dir);
  writeFileSync(join(dir, "sample.ts"), source);
  return dir;
}

describe("workflow workspace metadata", () => {
  it("defaults ordinary workflows to the shared app workspace", async () => {
    const dir = workflow(`
      export const name = "sample";
      export const description = "sample workflow";
      export async function execute(ctx) { return ctx.done("done"); }
    `);
    expect(await inspectWorkflowDefinition(dir, "sample")).toMatchObject({
      available: true,
      workspace: "shared",
    });
  });

  it("exposes the task-worktree convention before workflow execution", async () => {
    const dir = workflow(`
      export const name = "sample";
      export const description = "sample workflow";
      export const workspace = "task";
      export async function execute(ctx) { return ctx.done("done"); }
    `);
    expect(await inspectWorkflowDefinition(dir, "sample")).toMatchObject({
      available: true,
      workspace: "task",
    });
  });

  it("allows a task-worktree workflow to choose its integration branch", async () => {
    const dir = workflow(`
      export const name = "sample";
      export const description = "sample workflow";
      export const workspace = { kind: "task", baseBranch: "main" };
      export async function execute(ctx) { return ctx.done("done"); }
    `);
    expect(await inspectWorkflowDefinition(dir, "sample")).toMatchObject({
      available: true,
      workspace: { kind: "task", baseBranch: "main" },
    });
  });

  it("rejects unknown workspace modes as a catalog diagnostic", async () => {
    const dir = workflow(`
      export const name = "sample";
      export const description = "sample workflow";
      export const workspace = "agent";
      export async function execute(ctx) { return ctx.done("done"); }
    `);
    const result = await inspectWorkflowDefinition(dir, "sample");
    expect(result.available).toBe(false);
    expect(result.error).toContain('workspace\' as "shared", "task", or { kind: "task", baseBranch }');
  });
});
