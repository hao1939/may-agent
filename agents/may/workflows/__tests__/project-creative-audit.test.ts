import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { execute } from "../project-creative-audit.ts";

const roots: string[] = [];

function makeProject(): { root: string; projectDir: string; projectFile: string } {
  const root = join(tmpdir(), `project-creative-audit-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const projectDir = join(root, "projects", "demo");
  mkdirSync(projectDir, { recursive: true });
  const projectFile = join(projectDir, "project.md");
  writeFileSync(projectFile, `---
id: demo
owner: may
status: active
---

# Demo
`, "utf-8");
  roots.push(root);
  return { root, projectDir, projectFile };
}

function task(projectDir: string): string {
  return [
    "[project-creative-audit] Review one project.",
    "",
    "## Project Audit Request",
    "```json",
    JSON.stringify({
      projectId: "may/demo",
      projectPath: "projects/demo",
      projectDir,
      owner: "may",
      status: "active",
      trigger: "timer.tick",
      selectionReason: "project is active",
    }, null, 2),
    "```",
  ].join("\n");
}

describe("project-creative-audit workflow", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("appends a proposal comment and nudges the normal project loop", async () => {
    const { projectDir, projectFile } = makeProject();
    const before = readFileSync(projectFile, "utf-8");
    const emitted: Array<Record<string, unknown>> = [];
    const dispatched: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const agentTasks: string[] = [];
    const ctx = {
      task: task(projectDir),
      runAgent: async (_agent: string, agentTask: string) => {
        agentTasks.push(agentTask);
        return {
          sessionId: "s_audit",
          status: "done",
          lastAssistantText: "Finding: task goal is vague.\nEvidence: project.md has no task section.\nSuggested owner action: add one concrete ready task.\nConfidence: medium",
          messages: [],
          duration: "1s",
          outputDir: "",
        };
      },
      emit: (event: Record<string, unknown>) => emitted.push(event),
      dispatchEvent: (type: string, data?: Record<string, unknown>) => dispatched.push({ type, data }),
      done: (summary: string) => ({ type: "done", summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate", reason, context }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({ type: "done" });
    expect(agentTasks[0]).toContain("Do not edit project files directly");
    expect(readFileSync(projectFile, "utf-8")).toBe(before);
    const discussion = readFileSync(join(projectDir, "discussion.md"), "utf-8");
    expect(discussion).toContain("Project creative audit suggestion");
    expect(discussion).toContain("proposal-only fallback review");
    expect(discussion).toContain("s_audit");
    expect(discussion).toContain("Suggested owner action");
    expect(emitted).toContainEqual(expect.objectContaining({
      type: "project.audit.suggested",
      projectId: "may/demo",
      projectPath: "projects/demo",
    }));
    expect(dispatched).toContainEqual({
      type: "project.nudge",
      data: expect.objectContaining({
        projectId: "may/demo",
        projectPath: "projects/demo",
        comment: true,
      }),
    });
  });
});
