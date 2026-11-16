import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  buildRuntimePatternAuditPacket,
  execute,
} from "./runtime-pattern-audit.js";

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
      input: {
        rootDir: root,
        dbPath,
        now,
        latestWindowMs: windowMs,
        compareWindowMs: windowMs,
        persistSnapshot: true,
      },
    });
    const res = await execute(ctx);
    expect(res.status).toBe("done");
    expect(res.summary).toContain("1 signal(s), 1 workflow delta(s)");
    expect(res.output).toMatchObject({
      state: "converged",
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
