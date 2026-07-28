import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowRunner } from "./workflow-tool.js";

describe("workflow execution timeout", () => {
  it("cancels the active step and rejects late workflow effects", async () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-timeout-"));
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    writeFileSync(
      join(workflowDir, "timeout.ts"),
      `
export const name = "timeout";
export const description = "Timeout test workflow";
export async function execute(ctx) {
  try {
    await ctx.runAgent("worker", "wait forever");
  } catch {}
  ctx.emit({ type: "test.late-effect" });
  return ctx.done("late completion");
}
`,
    );

    let workflowRunId = "";
    let resolveStep!: (result: any) => void;
    let cancelled = 0;
    const manager = {
      callAgent: (_agent: string, _task: string, opts: { workflowRunId?: string }) => {
        workflowRunId = opts.workflowRunId ?? "";
        return new Promise((resolve) => {
          resolveStep = resolve;
        });
      },
      status: () =>
        workflowRunId
          ? [{ sessionId: "step-session", workflowRunId }]
          : [],
      cancel: (sessionId: string) => {
        expect(sessionId).toBe("step-session");
        cancelled += 1;
        resolveStep({
          sessionId,
          status: "interrupted",
          lastAssistantText: null,
          messages: [],
          duration: "0s",
          outputDir: "",
        });
      },
    } as any;
    const events: Array<{ type?: string }> = [];
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      agentName: "owner",
      executionTimeoutMs: 10,
      onEvent: (event) => events.push(event),
    });

    const result = await runner.run("timeout", "test");
    await Bun.sleep(20);

    expect(result.type).toBe("error");
    expect(result.type === "error" ? result.error : "").toContain('Workflow "timeout" timed out after 10ms');
    expect(cancelled).toBe(1);
    expect(events.some((event) => event.type === "test.late-effect")).toBe(false);
  });
});
