import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowTool } from "./workflow-tool.js";
import { readWorkflowFacts } from "./workflow-facts.js";
import { closeDb } from "./requests.js";

const cases = (["done", "blocked", "error", "interrupted"] as const)
  .flatMap((status) => [false, true].map((nested) => ({ status, nested })));

test.each(cases)("retains contribution output and facts: $status / nested=$nested", async ({ status, nested }) => {
  const root = mkdtempSync(join(tmpdir(), "may-handoff-evidence-"));
  const workflowDir = join(root, "workflows");
  mkdirSync(workflowDir);
  writeFileSync(join(workflowDir, "child.ts"), `
export const name = "child";
export const description = "A bounded contribution with evidence";
export async function execute(ctx) {
  return { ...ctx.done("narrow contribution"), status: ctx.input.status,
    output: { draft: "retained.md" }, facts: { checked: true } };
}`);
  writeFileSync(join(workflowDir, "parent.ts"), `
export const name = "parent";
export const description = "Caller retains the contribution";
export async function execute(ctx) { return ctx.workflows.run("child", ctx.input); }
`);
  try {
    const tool = createWorkflowTool({ manager: {} as never, workflowDir, persistDir: root });
    const response = await tool.execute("call", { action: "run", name: nested ? "parent" : "child", input: { status } });
    const text = response.content[0];
    if (text.type !== "text") throw new Error("Missing result text");
    const result = JSON.parse(text.text);
    const payload = { output: { draft: "retained.md" }, facts: { checked: true } };
    expect(result).toMatchObject({ kind: "workflow", status, summary: "narrow contribution", ...payload });
    closeDb(root);
    const evidence = readWorkflowFacts(root, result.id)!;
    expect(evidence.run).toMatchObject({ status, result_payload: { kind: "result", state: "available", value: payload } });
    expect(evidence.childRunIds).toHaveLength(nested ? 1 : 0);
    if (nested) {
      expect(evidence.childRunIds[0]).not.toBe(result.id);
      expect(readWorkflowFacts(root, evidence.childRunIds[0])!.run).toMatchObject({
        status, result_payload: { kind: "result", state: "available", value: payload },
      });
    }
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
