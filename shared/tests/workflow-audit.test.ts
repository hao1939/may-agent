import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditWorkflows,
  checkWorkflowAstSafety,
  discoverStaticWorkflows,
  formatWorkflowAuditMarkdown,
} from "../../scripts/audit-workflows.ts";
import { listTargets } from "@may-agent/sdk/standalone";
import { Check } from "typebox/value";
import * as ts from "typescript";

test("discoverStaticWorkflows finds all 26 canonical and re-exported workflows with zero contract errors", () => {
  const workflows = discoverStaticWorkflows(process.cwd());
  expect(workflows.length).toBe(26);
  const canonical = workflows.filter((w) => !w.isReexport);
  const reexports = workflows.filter((w) => w.isReexport);
  expect(canonical.length).toBe(24);
  expect(reexports.length).toBe(2);

  for (const wf of workflows) {
    expect(wf.hasValidContract, `${wf.path} errors: ${wf.contractErrors.join(", ")}`).toBe(true);
    if (!wf.isReexport) {
      expect(wf.pairedTestPath).toBeTruthy();
    }
  }
});

const configuredCallableTargets = [
  "alex/alex",
  "alex/bob",
  "alex/compare-candidate",
  "alex/develop-change",
  "alex/diagnose-improvement",
  "alex/evaluation-report-reader",
  "alex/evaluator",
  "alex/gym",
  "alex/judge",
  "alex/learn-from-daily-work",
  "alex/metric-review",
  "alex/pull-request-wait",
  "alex/runtime-pattern-audit",
  "alex/task-disposition-review",
  "alex/task-outcome-review",
  "alex/task-outcome-selector",
  "alex/tech-lead",
  "alex/workload-review",
  "may/bounded-cleanup",
  "may/evaluation-report-intake",
  "may/improvement-activation-follow-up",
  "may/may",
  "may/metric-follow-through",
  "may/metric-response",
  "may/prepare-improvement-approval",
  "may/revise-assignment",
  "sample/sample-reviewer",
  "scout-knowledge-lib/knowledge-planner",
  "scout-knowledge-lib/library-health",
  "scout-knowledge-lib/scout",
  "scout-knowledge-lib/scout-assess-source",
  "scout-knowledge-lib/scout-daily-digest",
  "scout-knowledge-lib/scout-explore",
] as const;

async function callableTargets(projectsRoot: string) {
  return listTargets({
    cwd: process.cwd(),
    projectRoot: process.cwd(),
    projectsRoot,
    globalAgentsRoot: join(process.cwd(), "agents"),
    sharedRoot: join(process.cwd(), "shared"),
    timeoutMs: 120_000,
  });
}

function sourceInventoryFixture(disabledApps: readonly string[] = []) {
  const root = mkdtempSync(join(tmpdir(), "workflow-source-inventory-"));
  const projectsRoot = join(root, "projects");
  mkdirSync(projectsRoot);
  for (const app of ["alex.app", "may.app", "sample.app", "scout-knowledge-lib.app"]) {
    const source = join(process.cwd(), "projects", app);
    const fixture = join(projectsRoot, app);
    mkdirSync(fixture);
    symlinkSync(join(source, "app.ts"), join(fixture, "app.ts"));
    symlinkSync(join(source, "agents"), join(fixture, "agents"), "dir");
    if (disabledApps.includes(app)) writeFileSync(join(fixture, ".disabled"), "");
  }
  return { root, projectsRoot };
}

test("all 33 source targets expose only canonical names and callable envelopes", async () => {
  const fixture = sourceInventoryFixture();
  try {
    const targets = await callableTargets(fixture.projectsRoot);
    expect(targets.map((target) => target.name)).toEqual(configuredCallableTargets);
    for (const target of targets) {
      expect(target.name.split("/")).toHaveLength(2);
      expect(target.description.trim().length, target.name).toBeGreaterThan(0);
      expect(JSON.stringify(target.inputSchema), target.name).toContain('"prompt"');
      expect(Check(target.inputSchema, { data: {} }), `${target.name} accepted a missing prompt`).toBe(false);
      expect(Check(target.inputSchema, { task: "legacy" }), `${target.name} accepted a retired task field`).toBe(false);
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("configured discovery omits targets from explicitly disabled Apps", async () => {
  const fixture = sourceInventoryFixture(["sample.app"]);
  try {
    const targets = await callableTargets(fixture.projectsRoot);
    expect(targets.map((target) => target.name)).toEqual(
      configuredCallableTargets.filter((name) => name !== "sample/sample-reviewer"),
    );
    expect(targets.some((target) => target.name.startsWith("sample/"))).toBe(false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("checkWorkflowAstSafety flags process.exit, blocking sync child_process calls, and retired ctx APIs", () => {
  const badSource = ts.createSourceFile(
    "unsafe.ts",
    `
      import { spawnSync } from "node:child_process";
      export async function execute(ctx: any) {
        spawnSync("git", ["status"]);
        await ctx.callAgent("bob", "do work");
        process.exit(1);
      }
    `,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations = checkWorkflowAstSafety(badSource);
  expect(violations).toEqual([
    "forbidden blocking spawnSync() call in workflow module",
    "retired ctx.callAgent API used (use unified ctx.call instead)",
    "forbidden process.exit() call in workflow module",
  ]);
});

test("auditWorkflows aggregates SQLite workflow_runs telemetry and emits anomaly signals", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-audit-test-"));
  try {
    const appDir = join(root, "projects/sample.app");
    const wfDir = join(appDir, "agents/owner/workflows");
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(
      join(appDir, "app.ts"),
      'export default { task: () => ({ intent: { workflow: "sample-flow" } }) };\n',
    );
    writeFileSync(
      join(wfDir, "sample-flow.ts"),
      'export const name = "sample-flow";\nexport const description = "Sample workflow";\nexport const executionTimeoutMs = 10_000;\nexport async function execute() {}\n',
    );
    writeFileSync(join(wfDir, "sample-flow.test.ts"), "// paired test\n");

    const dbPath = join(root, "may.db");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE workflow_runs (
        runId TEXT PRIMARY KEY,
        app_id TEXT,
        projectId TEXT,
        workflow TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER
      );
    `);

    const now = 1_795_000_000_000;
    const insert = db.prepare(
      "INSERT INTO workflow_runs (runId, app_id, projectId, workflow, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    // 2 done, 2 error (50% error rate >= 25% threshold), max duration 9,000ms (>= 85% of 10,000ms timeout)
    insert.run("wr_1", "sample", "sample", "sample-flow", "done", now - 20_000, now - 11_000);
    insert.run("wr_2", "sample", "sample", "sample-flow", "done", now - 30_000, now - 28_000);
    insert.run("wr_3", "sample", "sample", "sample-flow", "error", now - 40_000, now - 39_000);
    insert.run("wr_4", "sample", "sample", "sample-flow", "error", now - 50_000, now - 49_000);
    db.close();

    const report = auditWorkflows({
      rootDir: root,
      dbPath,
      now,
      windowMs: 3_600_000,
    });

    expect(report.dbAvailable).toBe(true);
    expect(report.totals).toMatchObject({
      workflows: 1,
      canonicalWorkflows: 1,
      reexportWorkflows: 0,
      contractErrors: 0,
      finishedRuns: 4,
      doneRuns: 2,
      errorRuns: 2,
      blockedRuns: 0,
    });

    expect(report.workflows[0]?.runtime).toMatchObject({
      finished: 4,
      done: 2,
      error: 2,
      successRate: 0.5,
      maxDurationMs: 9000,
      recentFailedRunIds: ["wr_3", "wr_4"],
    });

    const codes = report.signals.map((s) => s.code);
    expect(codes).toContain("high-error-rate");
    expect(codes).toContain("timeout-approaching");

    const markdown = formatWorkflowAuditMarkdown(report);
    expect(markdown).toContain("# Workflow Audit Report");
    expect(markdown).toContain("`sample-flow`");
    expect(markdown).toContain("`high-error-rate`");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
