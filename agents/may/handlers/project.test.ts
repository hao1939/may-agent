import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveWorkflowName } from "./project.js";
import type { ProjectInfo } from "../../../shared/lib/project-health.ts";

const roots: string[] = [];

function makeProject(root: string, slug: string, workflow = "project"): ProjectInfo {
  const projectDir = join(root, slug);
  mkdirSync(projectDir, { recursive: true });
  const projectFile = join(projectDir, "project.md");
  writeFileSync(projectFile, `---\nid: ${slug}\nowner: dev\nstatus: active\nworkflow: ${workflow}\n---\n`);
  return {
    relPath: `projects/${slug}`,
    projectFile,
    content: "",
    status: "active",
    owner: "dev",
    blockerReason: "",
    workflow,
    formatErrors: [],
  };
}

describe("project handler workflow resolution", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("maps canonical workflow: project to a slug iteration workflow when present", () => {
    const root = join(tmpdir(), `project-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const project = makeProject(root, "example-project");
    const workflowDir = join(root, "example-project", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "example-project-iteration.ts"), "export const name = 'example-project-iteration';\n");

    expect(resolveWorkflowName(project)).toBe("example-project-iteration");
  });

  it("preserves explicit non-project workflow names", () => {
    const root = join(tmpdir(), `project-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const project = makeProject(root, "example-project", "custom-workflow");

    expect(resolveWorkflowName(project)).toBe("custom-workflow");
  });

  it("returns null for workflow: project when no slug iteration workflow exists", () => {
    const root = join(tmpdir(), `project-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const project = makeProject(root, "no-workflow-project");

    expect(resolveWorkflowName(project)).toBeNull();
  });
});
