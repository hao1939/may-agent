import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { discoverStaticWorkflows } from "../../../scripts/audit-workflows.js";
import {
  buildRuntimePatternAuditPacket,
  execute,
  workflowInventoryRootFromAppRoot,
} from "./runtime-pattern-audit.js";

test("runtime-pattern-audit bundles with dependencies inside the Alex release closure", async () => {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "runtime-pattern-audit.ts")],
    target: "bun",
    external: ["@may-agent/sdk", "@may-agent/sdk/app"],
  });

  expect(result.success).toBe(true);
  expect(result.logs).toEqual([]);
  const bundledSource = await result.outputs[0]?.text();
  expect(bundledSource).toContain("projects/alex.app/scripts/audit-workflows.ts");
  expect(bundledSource).not.toContain("// scripts/audit-workflows.ts");
});

test("runtime-pattern-audit resolves the installed sibling-App inventory from an App-scoped workspace", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-pattern-audit-installed-"));
  try {
    const projectsRoot = join(root, "definitions", "projects");
    const appRoots = [
      { app: "alex.app", agent: "evaluator", workflow: "runtime-pattern-audit" },
      { app: "may.app", agent: "may", workflow: "task-delivery" },
    ];
    for (const fixture of appRoots) {
      const appDir = join(projectsRoot, fixture.app);
      const workflowDir = join(appDir, "agents", fixture.agent, "workflows");
      mkdirSync(workflowDir, { recursive: true });
      writeFileSync(
        join(appDir, "app.ts"),
        `export default { task: () => ({ intent: { workflow: "${fixture.workflow}" } }) };\n`,
      );
      writeFileSync(
        join(workflowDir, `${fixture.workflow}.ts`),
        `export const name = "${fixture.workflow}";\nexport const description = "Fixture workflow";\nexport async function execute() {}\n`,
      );
      writeFileSync(join(workflowDir, `${fixture.workflow}.test.ts`), "// paired test\n");
    }

    const appRoot = join(projectsRoot, "alex.app");
    const inventoryRoot = workflowInventoryRootFromAppRoot(appRoot);
    expect(inventoryRoot).toBe(join(root, "definitions"));
    expect(
      discoverStaticWorkflows(inventoryRoot).map(({ appId, name }) => `${appId}:${name}`),
    ).toEqual(["alex:runtime-pattern-audit", "may:task-delivery"]);

    const projectRoot = join(root, "workspaces", "alex");
    const outputRoot = join(projectRoot, ".state", "output");
    mkdirSync(projectRoot, { recursive: true });
    const ctx = createTestAppWorkflowContext({
      workflow: "runtime-pattern-audit",
      input: { prompt: "Audit runtime patterns" },
      workspace: {
        appRoot,
        projectRoot,
        root: projectRoot,
        output: outputRoot,
      },
    });
    const res = await execute(ctx);
    expect(res.status).toBe("done");
    expect(res.summary).toContain("across 2 workflows");
    const snapshotDir = join(outputRoot, "workflow-audits");
    expect(res.output).toMatchObject({
      state: "converged",
      result: {
        latestTotals: { workflows: 2, canonicalWorkflows: 2 },
        snapshotPaths: {
          jsonPath: join(snapshotDir, "latest.json"),
          markdownPath: join(snapshotDir, "latest.md"),
        },
      },
      facts: expect.arrayContaining(["workflows:2"]),
    });
    expect(existsSync(join(snapshotDir, "latest.json"))).toBe(true);
    expect(existsSync(join(snapshotDir, "latest.md"))).toBe(true);
    expect(existsSync(join(inventoryRoot, ".state"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime-pattern-audit compares latest and preceding windows deterministically", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-pattern-audit-"));
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
      'export const name = "sample-flow";\nexport const description = "Sample workflow";\nexport async function execute() {}\n',
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
    const windowMs = 3 * 3_600_000;
    const insert = db.prepare(
      "INSERT INTO workflow_runs (runId, app_id, projectId, workflow, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    // Preceding window [now - 6h, now - 3h): 2 done, 0 error
    insert.run("wr_prev_1", "sample", "sample", "sample-flow", "done", now - 5 * 3_600_000, now - 5 * 3_600_000 + 1_000);
    insert.run("wr_prev_2", "sample", "sample", "sample-flow", "done", now - 4 * 3_600_000, now - 4 * 3_600_000 + 1_000);
    // Latest window [now - 3h, now): 1 done, 2 error
    insert.run("wr_curr_1", "sample", "sample", "sample-flow", "done", now - 2 * 3_600_000, now - 2 * 3_600_000 + 1_000);
    insert.run("wr_curr_err1", "sample", "sample", "sample-flow", "error", now - 3_600_000, now - 3_600_000 + 500);
    insert.run("wr_curr_err2", "sample", "sample", "sample-flow", "error", now - 1_800_000, now - 1_800_000 + 500);
    db.close();

    const packet = buildRuntimePatternAuditPacket({
      rootDir: root,
      dbPath,
      now,
      latestWindowMs: windowMs,
      compareWindowMs: windowMs,
    });

    expect(packet.dbAvailable).toBe(true);
    expect(packet.precedingTotals).toMatchObject({
      finishedRuns: 2,
      doneRuns: 2,
      errorRuns: 0,
    });
    expect(packet.latestTotals).toMatchObject({
      finishedRuns: 3,
      doneRuns: 1,
      errorRuns: 2,
    });
    expect(packet.regressions).toEqual([
      {
        appId: "sample",
        agent: "owner",
        workflow: "sample-flow",
        latestFinished: 3,
        latestError: 2,
        latestBlocked: 0,
        precedingFinished: 2,
        precedingError: 0,
        precedingBlocked: 0,
        errorDelta: 2,
        blockedDelta: 0,
        sampleRunIds: ["wr_curr_err2", "wr_curr_err1"],
      },
    ]);

    const ctx = createTestAppWorkflowContext({
      workflow: "runtime-pattern-audit",
      input: { prompt: "Audit runtime patterns", data: {
        rootDir: root,
        dbPath,
        now,
        latestWindowMs: windowMs,
        compareWindowMs: windowMs,
        persistSnapshot: true,
      } },
    });
    const res = await execute(ctx);
    expect(res.status).toBe("done");
    expect(res.summary).toContain("1 signal(s), 1 workflow delta(s)");
    expect(res.output).toMatchObject({
      state: "converged",
      result: {
        generatedAt: now,
        latestTotals: { workflows: expect.any(Number) },
      },
      requests: [
        {
          localKey: expect.stringMatching(/^workflow-audit:[0-9a-f]{16}$/),
          target: { appId: "alex" },
          input: {
            kind: "message",
            data: {
              message: expect.stringContaining("Workflow audit detected 1 attention signal(s)"),
            },
          },
        },
      ],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
