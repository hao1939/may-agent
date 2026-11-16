import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditWorkflows,
  discoverStaticWorkflows,
  formatWorkflowAuditMarkdown,
} from "../../scripts/audit-workflows.ts";

test("discoverStaticWorkflows finds all 24 canonical and re-exported workflows with zero contract errors", () => {
  const workflows = discoverStaticWorkflows(process.cwd());
  expect(workflows.length).toBe(24);
  const canonical = workflows.filter((w) => !w.isReexport);
  const reexports = workflows.filter((w) => w.isReexport);
  expect(canonical.length).toBe(21);
  expect(reexports.length).toBe(3);

  for (const wf of workflows) {
    expect(wf.hasValidContract, `${wf.path} errors: ${wf.contractErrors.join(", ")}`).toBe(true);
    if (!wf.isReexport) {
      expect(wf.pairedTestPath).toBeTruthy();
    }
  }
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
