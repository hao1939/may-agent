/**
 * workflow-resolver-precedence.test.ts
 *
 * Verifies the workflow file resolver honors precedence:
 *   project > agent.
 *
 * When the same workflow name (file) appears in more than one source
 * directory, the project-scoped one wins, then the agent-specific one.
 * shared/workflows is intentionally ignored.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createWorkflowTool } from "./workflow-tool.ts";

function workflowSource(label: string) {
  return `
export const name = "demo";
export const description = "demo from ${label}";
export async function execute(ctx: any) {
  return ctx.done("ran ${label}");
}
`;
}

describe("workflow resolver precedence (project > agent)", () => {
  let root: string;
  let projectDir: string;
  let agentDir: string;
  let sharedDir: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "wf-prec-"));
    projectDir = join(root, "projects/p1/workflows");
    agentDir = join(root, "agents/may/workflows");
    sharedDir = join(root, "shared/workflows");
    for (const d of [projectDir, agentDir, sharedDir]) mkdirSync(d, { recursive: true });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function clearFiles() {
    rmSync(join(projectDir, "demo.ts"), { force: true });
    rmSync(join(agentDir, "demo.ts"), { force: true });
    rmSync(join(sharedDir, "demo.ts"), { force: true });
  }

  function makeTool(opts: { project?: boolean; agent?: boolean; shared?: boolean }) {
    clearFiles();
    if (opts.project) writeFileSync(join(projectDir, "demo.ts"), workflowSource("project"));
    if (opts.agent) writeFileSync(join(agentDir, "demo.ts"), workflowSource("agent"));
    if (opts.shared) writeFileSync(join(sharedDir, "demo.ts"), workflowSource("shared"));

    return createWorkflowTool({
      manager: {} as any,
      workflowDir: agentDir,
      projectWorkflowDir: opts.project ? projectDir : undefined,
    });
  }

  async function listDemoDescription(tool: ReturnType<typeof createWorkflowTool>): Promise<string | undefined> {
    const res = await tool.execute("call-1", { action: "list" });
    const text = res.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    const demo = parsed.workflows?.find((w: any) => w.name === "demo");
    return demo?.description;
  }

  it("uses project dir when same-named workflow exists in project and agent", async () => {
    const tool = makeTool({ project: true, agent: true, shared: true });
    expect(await listDemoDescription(tool)).toBe("demo from project");
  });

  it("falls back to agent when no project workflow is present", async () => {
    const tool = makeTool({ project: false, agent: true, shared: true });
    expect(await listDemoDescription(tool)).toBe("demo from agent");
  });

  it("does not list shared workflows when neither project nor agent has the workflow", async () => {
    const tool = makeTool({ project: false, agent: false, shared: true });
    expect(await listDemoDescription(tool)).toBeUndefined();
  });
});
