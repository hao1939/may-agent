import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { buildAuditTask, create, selectAuditCandidates } from "./project-creative-audit.js";
import type { ProjectInfo } from "../../../shared/lib/project-health.ts";

const roots: string[] = [];

function makeRoot(): { root: string; projectsRoot: string } {
  const root = join(tmpdir(), `project-creative-audit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const projectsRoot = join(root, "projects");
  mkdirSync(projectsRoot, { recursive: true });
  roots.push(root);
  return { root, projectsRoot };
}

function writeProject(projectsRoot: string, slug: string, content: string): string {
  const dir = join(projectsRoot, slug);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "project.md");
  writeFileSync(file, content, "utf-8");
  return file;
}

function projectContent(id: string, status = "active"): string {
  return `---
id: ${id}
owner: may
status: ${status}
---

# ${id}

## Tasks
- id: inspect
  status: ready
  result: null
  assignee: may
  goal: Inspect the project.
  depends_on: []
  attempts: 0
`;
}

function makeCtx(root: string, projectsRoot: string) {
  const emitted: Array<{ type: string; data?: Record<string, unknown>; envelope?: Record<string, unknown> }> = [];
  const runs: Array<{ workflow: string; task: string; opts?: Record<string, unknown> }> = [];
  const ctx = {
    agentName: "may",
    sdk: {
      paths: { root, projects: projectsRoot },
      query: {
        workflowRuns: () => ({ rows: [] }),
      },
      emit: (type: string, data?: Record<string, unknown>, envelope?: Record<string, unknown>) => {
        emitted.push({ type, data, envelope });
      },
      log: () => {},
      runWorkflow: async (workflow: string, task: string, opts?: Record<string, unknown>) => {
        runs.push({ workflow, task, opts });
        return { status: "done", runId: "wr_audit" };
      },
    },
  } as any;
  return { ctx, emitted, runs };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("project-creative-audit handler", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("dispatches one proposal-only audit workflow without mutating project files", async () => {
    const { root, projectsRoot } = makeRoot();
    const projectFile = writeProject(projectsRoot, "audit-me", projectContent("audit-me"));
    const before = readFileSync(projectFile, "utf-8");
    const { ctx, emitted, runs } = makeCtx(root, projectsRoot);

    await create(ctx, {
      name: "project-creative-audit",
      enabled: true,
      handler: "project-creative-audit",
      handlerConfig: { cooldownMs: 60_000, maxProjectsPerRun: 1 },
    } as any)();
    await flushPromises();

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      workflow: "project-creative-audit",
      opts: { source: "may", projectId: "may/audit-me" },
    });
    expect(runs[0].task).toContain("proposal-only audit");
    expect(runs[0].task).toContain('"projectPath": "projects/audit-me"');
    expect(readFileSync(projectFile, "utf-8")).toBe(before);
    expect(emitted).toContainEqual({
      type: "handler.workflow_dispatched",
      data: expect.objectContaining({
        handler: "project-creative-audit",
        projectId: "may/audit-me",
        projectPath: "projects/audit-me",
      }),
      envelope: undefined,
    });
  });

  it("honors cooldown for timer scans but lets explicit targeted audits through", async () => {
    const { root, projectsRoot } = makeRoot();
    writeProject(projectsRoot, "a", projectContent("a"));
    writeProject(projectsRoot, "b", projectContent("b", "waiting"));
    mkdirSync(join(root, ".state"), { recursive: true });
    writeFileSync(join(root, ".state", "project-creative-audit.json"), JSON.stringify({
      projects: {
        "projects/a": { lastAuditAt: Date.now() },
        "projects/b": { lastAuditAt: Date.now() },
      },
    }), "utf-8");
    const { ctx, runs } = makeCtx(root, projectsRoot);
    const handler = create(ctx, {
      name: "project-creative-audit",
      enabled: true,
      handler: "project-creative-audit",
      handlerConfig: { cooldownMs: 6 * 60 * 60_000, maxProjectsPerRun: 1 },
    } as any);

    await handler();
    await flushPromises();
    expect(runs).toHaveLength(0);

    await handler({ type: "trigger.project-creative-audit", data: { projectPath: "projects/b" } } as any);
    await flushPromises();
    expect(runs).toHaveLength(1);
    expect(runs[0].opts).toMatchObject({ projectId: "may/b" });
  });

  it("does not turn an untargeted non-timer event into a broad scan", async () => {
    const { root, projectsRoot } = makeRoot();
    writeProject(projectsRoot, "a", projectContent("a"));
    const { ctx, emitted, runs } = makeCtx(root, projectsRoot);

    await create(ctx, {
      name: "project-creative-audit",
      enabled: true,
      handler: "project-creative-audit",
      handlerConfig: { cooldownMs: 60_000, maxProjectsPerRun: 1 },
    } as any)({ type: "project.health.finding", data: { data: { code: "owner_judgment_needed" } } } as any);
    await flushPromises();

    expect(runs).toHaveLength(0);
    expect(emitted).toContainEqual({
      type: "handler.skipped",
      data: expect.objectContaining({
        handler: "project-creative-audit",
        reason: "non-timer audit trigger missing projectPath",
      }),
      envelope: undefined,
    });
  });

  it("uses canonical event data as the target project", async () => {
    const { root, projectsRoot } = makeRoot();
    writeProject(projectsRoot, "a", projectContent("a"));
    writeProject(projectsRoot, "b", projectContent("b", "waiting"));
    const { ctx, runs } = makeCtx(root, projectsRoot);

    await create(ctx, {
      name: "project-creative-audit",
      enabled: true,
      handler: "project-creative-audit",
      handlerConfig: { cooldownMs: 60_000, maxProjectsPerRun: 1 },
    } as any)({
      type: "project.health.finding",
      source: "project-steward",
      owner: "agent:may",
      data: { projectPath: "projects/a", code: "owner_judgment_needed" },
    } as any);
    await flushPromises();

    expect(runs).toHaveLength(1);
    expect(runs[0].opts).toMatchObject({ projectId: "may/a" });
  });

  it("selects candidates by broad project-review priority, not fixed issue codes", () => {
    const now = Date.now();
    const projects: ProjectInfo[] = [
      {
        relPath: "projects/clean-active",
        projectFile: "/tmp/clean-active/project.md",
        content: projectContent("clean-active"),
        status: "active",
        owner: "may",
        blockerReason: "",
        workflow: "project",
      },
      {
        relPath: "projects/waiting",
        projectFile: "/tmp/waiting/project.md",
        content: projectContent("waiting", "waiting"),
        status: "waiting",
        owner: "may",
        blockerReason: "",
        workflow: "project",
      },
    ];

    const candidates = selectAuditCandidates(projects, { projects: {} }, now, 60_000);
    expect(candidates[0].project.relPath).toBe("projects/waiting");
    expect(candidates[0].reason).toContain("project is waiting");

    const targeted = selectAuditCandidates(projects, { projects: {} }, now, 60_000, "projects/clean-active");
    expect(targeted.map((candidate) => candidate.project.relPath)).toEqual(["projects/clean-active"]);

    const task = buildAuditTask(candidates[0], "timer.tick");
    expect(task).toContain("fixed rule might miss");
    expect(task).toContain("owner/project loop reviews suggestions before applying");
  });
});
