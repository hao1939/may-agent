import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../lib/requests.js";
import { daemonAgentInternals } from "./daemon-agents.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("daemon Task executor compatibility", () => {
  it("retains the trial Codex executor alias only while a Task can still need it", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-daemon-executor-alias-"));
    roots.push(persistDir);
    const db = getDb(persistDir);
    const insert = db.prepare(
      `INSERT INTO app_tasks(
         app_id, task_id, generation, resource_version, observed_generation, phase,
         lane, changed, ready, updated_at, resource_json
       ) VALUES (?, ?, 1, 1, 0, 'pending', 'normal', 0, 0, 1, ?)`,
    );

    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();
    insert.run("sample", "current", JSON.stringify({ spec: { executor: "codex-goal" } }));
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();
    insert.run("sample", "trial", JSON.stringify({ spec: { executor: "codex-goal-poc", mode: "achieve" } }));
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeTrue();

    db.prepare("UPDATE app_tasks SET phase = 'converged' WHERE app_id = 'sample' AND task_id = 'trial'").run();
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();

    db.prepare("UPDATE app_tasks SET resource_json = ? WHERE app_id = 'sample' AND task_id = 'trial'").run(
      JSON.stringify({ spec: { executor: "codex-goal-poc", mode: "maintain" } }),
    );
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeTrue();

    db.prepare(
      `INSERT INTO app_task_cancellations(app_id, task_id, requested_at, reason, cancellation_json)
       VALUES ('sample', 'trial', 1, 'done', '{}')`,
    ).run();
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();
  });
});
