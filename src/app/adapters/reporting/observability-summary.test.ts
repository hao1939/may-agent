import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExecutionUsage } from "@may-agent/sdk/runtime";
import { observeReply, preparationFixture, usageReply } from "../../../../test/fixtures/execution-usage.js";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { saveExecutionUsage } from "../../../lib/db/execution-usage.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { createMetricService } from "../../../lib/metrics.js";
import {
  classifyMetricScope,
  observabilitySummaryQuery,
  probeAzureCliAuthHeadroom,
  readAgentCapabilityRollups,
  readObservabilitySummary,
} from "./observability-summary.js";

describe("top-down Host vs. Apps observability summary", () => {
  let db: SqliteDb;
  let root: string;
  let projectsRoot: string;
  const now = 2_000_000_000_000;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
    root = mkdtempSync(join(tmpdir(), "may-obs-summary-"));
    projectsRoot = join(root, "projects");
    for (const appId of ["may", "alex", "aks-rp-e2e", "scout-knowledge-lib"]) {
      const dir = join(projectsRoot, `${appId}.app`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "app.ts"), "export default {};\n");
    }
  });

  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("classifies fleet may.* infrastructure metrics to Host while preserving App ownership", () => {
    const installed = new Set(["may", "alex", "aks-rp-e2e", "scout-knowledge-lib"]);
    expect(classifyMetricScope({ id: "may.daemon-sql-time-percent", owner: "may" }, installed)).toEqual({
      kind: "host",
    });
    expect(classifyMetricScope({ id: "may.unresolved-input-recovery-count", owner: "may" }, installed)).toEqual({
      kind: "host",
    });
    expect(classifyMetricScope({ id: "workflow.error-count-24h", owner: "system:host" }, installed)).toEqual({
      kind: "host",
    });
    expect(
      classifyMetricScope({ id: "may.evaluation-unfinished-review-age-seconds", owner: "alex" }, installed),
    ).toEqual({
      kind: "app",
      appId: "alex",
    });
    expect(classifyMetricScope({ id: "scout.knowledge-preamble-coverage", owner: "scout" }, installed)).toEqual({
      kind: "app",
      appId: "scout-knowledge-lib",
    });
    expect(classifyMetricScope({ id: "aks-rp-e2e.pr-conflict-count", project: "aks-rp-e2e.app" }, installed)).toEqual({
      kind: "app",
      appId: "aks-rp-e2e",
    });
    expect(classifyMetricScope({ id: "may.request-fulfillment-rate", owner: "may" }, installed)).toEqual({
      kind: "app",
      appId: "may",
    });
  });

  test("probes Azure CLI token headroom without exposing credentials", () => {
    const azDir = join(root, "azure");
    expect(probeAzureCliAuthHeadroom(now, azDir)).toEqual({
      provider: "azure-cli",
      state: "unconfigured",
      expiresAt: null,
    });
    mkdirSync(azDir, { recursive: true });
    writeFileSync(
      join(azDir, "msal_token_cache.json"),
      JSON.stringify({
        AccessToken: {
          tok1: { secret: "never-returned", expires_on: String(Math.floor((now + 3_600_000) / 1000)) },
        },
      }),
    );
    const valid = probeAzureCliAuthHeadroom(now, azDir);
    expect(valid.state).toBe("valid");
    expect(valid.expiresAt).toBe(Math.floor((now + 3_600_000) / 1000) * 1000);
    expect(JSON.stringify(valid)).not.toContain("never-returned");

    writeFileSync(
      join(azDir, "msal_token_cache.json"),
      JSON.stringify({
        AccessToken: {
          tok1: { secret: "expired-secret", expires_on: String(Math.floor((now - 60_000) / 1000)) },
        },
      }),
    );
    expect(probeAzureCliAuthHeadroom(now, azDir).state).toBe("expired");
  });

  test("aggregates Host pillars, per-App transparent observing, and gated/weighted scorecards", () => {
    const metrics = createMetricService({ getDb: () => db, now: () => now });
    metrics.define({ id: "may.daemon-sql-time-percent", owner: "may", measureInterval: 300_000 });
    metrics.record("may.daemon-sql-time-percent", 4.2, { measuredAt: now - 10_000 });
    metrics.define({ id: "task.skipped-check-rate", owner: "system:host", measureInterval: 300_000 });
    metrics.record("task.skipped-check-rate", 12.5, { measuredAt: now - 10_000 });
    metrics.define({ id: "scout.knowledge-preamble-coverage", owner: "scout", measureInterval: 300_000 });
    metrics.record("scout.knowledge-preamble-coverage", 0.95, { measuredAt: now - 10_000 });
    db.prepare(
      "INSERT INTO metric_alerts(metric_id, alert_type, message, created_at) VALUES ('may.daemon-sql-time-percent', 'threshold', 'SQL busy', ?)",
    ).run(now - 5_000);

    // Seed App Tasks, Conditions, Requests, Human Inbox inputs, Workflows, and Usage.
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, lease_until, updated_at, resource_json)
       VALUES
         ('aks-rp-e2e', 'domain/k8s-1.38', 2, 4, 2, 'waiting', 'normal', 0, 0, NULL, ?, '{"status":{"phase":"waiting"}}'),
         ('may', 'req/1', 1, 2, 1, 'running', 'human', 0, 0, ?, ?, '{"status":{"phase":"running"}}')`,
    ).run(now - 7_200_000, now - 60_000, now - 1_800_000);

    db.prepare(
      `INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json)
       VALUES ('aks-rp-e2e', 'cond-human-1', 'false', '{"spec":{"owner":"human:hao","type":"decision"}}')`,
    ).run();

    db.prepare(
      `INSERT INTO conversation_requests(app_id, conversation_id, id, revision, scope, status, task_refs, update_key, updated_at)
       VALUES
         ('may', 'primary', 'r-open', 1, 'Review PR', 'open', '[]', 'k1', ?),
         ('may', 'primary', 'r-closed', 2, 'Ship Wave 0', 'closed', '[]', 'k2', ?)`,
    ).run(now - 3_600_000, now - 600_000);

    db.prepare(
      `INSERT INTO app_inbox_items(id, app_id, source_kind, source_id, input_kind, input_data, status, recovery_json, created_at, updated_at)
       VALUES
         ('in-1', 'may', 'human', 'telegram', 'message', '{}', 'done', NULL, ?, ?),
         ('in-2', 'aks-rp-e2e', 'human', 'web-ui', 'steer', '{}', 'done', NULL, ?, ?),
         ('in-stuck', 'may', 'system', 'bus', 'event', '{}', 'pending', '{"reason":"retry"}', ?, ?)`,
    ).run(now - 900_000, now - 900_000, now - 800_000, now - 800_000, now - 1_200_000, now - 1_200_000);

    db.prepare(
      `INSERT INTO workflow_runs(runId, workflow, task, app_id, status, startedAt, endedAt, parentWorkflowRunId)
       VALUES
         ('wf-1', 'aks-rp-e2e/hygiene', 'scan', 'aks-rp-e2e', 'done', ?, ?, NULL),
         ('wf-2', 'aks-rp-e2e/validate', 'check', 'aks-rp-e2e', 'done', ?, ?, NULL),
         ('wf-3', 'aks-rp-e2e/push', 'push', 'aks-rp-e2e', 'blocked', ?, ?, NULL),
         ('wf-host-err', 'alex/slop-audit', 'audit', 'alex', 'error', ?, ?, NULL)`,
    ).run(
      now - 500_000,
      now - 400_000,
      now - 450_000,
      now - 350_000,
      now - 300_000,
      now - 200_000,
      now - 250_000,
      now - 150_000,
    );

    const usage = createExecutionUsage({ ...preparationFixture, preparer: "full", entryHash: null });
    observeReply(usage, usageReply());
    saveExecutionUsage(
      db,
      {
        id: "u-aks-1",
        sessionId: "sess-aks-1",
        appId: "aks-rp-e2e",
        agent: "aks-explorer",
        workflowRunId: null,
        configuredModel: "fixture/model-a",
        startedAt: now - 300_000,
      },
      usage.snapshot(),
      "done",
      now - 200_000,
    );

    // Seed accepted converged milestone + scorecard facts (and ensure unaccepted scorecards are ignored).
    const aksScorecard = {
      version: 1,
      targetKind: "app",
      appId: "aks-rp-e2e",
      taskId: "domain/k8s-1.38",
      agent: "aks-explorer",
      cohort: "wave-0-356-specs",
      rubricVersion: "app-rubric-v1",
      dimensions: {
        outcomeValue: 4,
        correctnessAndEvidence: 4,
        autonomyAndRecovery: 3,
        efficiency: 3,
        humanCoordination: "not_applicable",
      },
    };
    const gatedMayScorecard = {
      version: 1,
      targetKind: "app",
      appId: "may",
      taskId: "req/bad-claim",
      agent: "may",
      cohort: "req-bad-claim",
      rubricVersion: "app-rubric-v1",
      dimensions: {
        outcomeValue: 4,
        correctnessAndEvidence: 0,
        autonomyAndRecovery: 4,
        efficiency: 4,
        humanCoordination: 4,
      },
      gateReason: "Unverified completion claim",
    };
    const hostScorecard = {
      version: 1,
      targetKind: "host",
      rubricVersion: "host-rubric-v1",
      dimensions: {
        invariantReliability: 4,
        selfRecovery: 3,
        simplicity: 4,
        overheadAndCompatibility: 3,
      },
    };

    db.prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
       VALUES
         ('aks-rp-e2e', 'att-aks-1', 'domain/k8s-1.38', 2, 'completed', ?, ?),
         ('alex', 'att-eval-1', 'score/weekly', 1, 'completed', ?, ?),
         ('alex', 'att-unaccepted', 'score/draft', 1, 'failed', ?, ?)`,
    ).run(
      now - 100_000,
      JSON.stringify({
        finishedAt: new Date(now - 50_000).toISOString(),
        acceptedResult: { state: "converged", facts: [`scorecard:${JSON.stringify(aksScorecard)}`] },
      }),
      now - 90_000,
      JSON.stringify({
        finishedAt: new Date(now - 40_000).toISOString(),
        acceptedResult: {
          state: "converged",
          facts: [`scorecard:${JSON.stringify(gatedMayScorecard)}`, `scorecard:${JSON.stringify(hostScorecard)}`],
        },
      }),
      now - 80_000,
      JSON.stringify({
        finishedAt: new Date(now - 30_000).toISOString(),
        unacceptedDraft: [`scorecard:${JSON.stringify({ ...aksScorecard, appId: "scout-knowledge-lib" })}`],
      }),
    );

    const summary = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=1"), now),
      projectsRoot,
      stateDir: root,
      now,
      envProbes: {
        disk: { totalBytes: 100_000_000_000, availableBytes: 8_000_000_000, usedPercent: 92 },
        auth: { provider: "azure-cli", state: "valid", expiresAt: now + 3_600_000 },
      },
    });

    // Host checks
    expect(summary.host.improvementWorkflow).toBe("alex/develop-host-change");
    expect(summary.host.overhead).toMatchObject({
      daemonSqlTimePercent: 4.2,
      skippedCheckRatePerMin: 12.5,
    });
    expect(summary.host.recovery).toMatchObject({
      unresolvedInputRecoveryCount: 1,
      oldestInputRecoveryAgeMs: 1_200_000,
      expiredLeasesCount: 1,
    });
    expect(summary.host.headroom).toMatchObject({
      disk: { usedPercent: 92 },
      auth: { state: "valid" },
      openAlerts: 1,
    });
    expect(summary.host.scorecard).toMatchObject({
      status: "scored",
      score: 87.5,
      sampleSize: 1,
      confidence: "low-sample",
    });

    // AKS App checks (not_applicable humanCoordination renormalizes cleanly across remaining 90% weight)
    const aks = summary.apps.find((a) => a.appId === "aks-rp-e2e")!;
    expect(aks.outcomes).toMatchObject({
      convergedMilestonesWindow: 1,
      openTasksTotal: 1,
      oldestOpenAgeMs: 7_200_000,
    });
    expect(aks.blockers).toMatchObject({
      blockedWorkflowsWindow: 1,
      openHumanConditions: 1,
      openAlerts: 0,
    });
    expect(aks.humanBurden.humanInputsWindow).toBe(1);
    expect(aks.costAndLeverage).toMatchObject({
      agentInvocationsWindow: 1,
      workflowRunsWindow: 3,
      workflowOffloadShare: 0.75,
    });
    expect(aks.scorecard).toMatchObject({
      status: "scored",
      gated: false,
      sampleSize: 1,
      confidence: "low-sample",
      // (0.35*(4/4) + 0.25*(4/4) + 0.15*(3/4) + 0.15*(3/4)) / 0.90 = 0.825 / 0.90 = 91.7
      score: 91.7,
    });

    // May App checks (correctnessAndEvidence=0 gates headline score to <= 25!)
    const may = summary.apps.find((a) => a.appId === "may")!;
    expect(may.outcomes).toMatchObject({
      openRequests: 1,
      closedRequestsWindow: 1,
    });
    expect(may.blockers.openAlerts).toBe(0); // SQL alert belonged to Host, not May!
    expect(may.scorecard).toMatchObject({
      status: "scored",
      gated: true,
      score: 25,
      gateReason: "Unverified completion claim",
    });

    // Scout App checks (unaccepted failed attempt fact was ignored)
    const scout = summary.apps.find((a) => a.appId === "scout-knowledge-lib")!;
    expect(scout.metrics).toMatchObject({ defined: 1, fresh: 1 });
    expect(scout.scorecard.status).toBe("not_scored");
    expect(summary.appDetail).toBeNull();

    // Closed/cancelled Tasks in app_task_cancellations do not inflate open backlog or expired leases.
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, lease_until, updated_at, resource_json)
       VALUES ('scout-knowledge-lib', 'explore/done-1', 1, 2, 1, 'attention', 'normal', 0, 0, ?, ?, '{"spec":{"agent":"scout","goal":"Explore paper"}}')`,
    ).run(now - 90_000, now - 90_000);
    db.prepare(
      `INSERT INTO app_task_cancellations(app_id, task_id, requested_at, reason, cancellation_json)
       VALUES ('scout-knowledge-lib', 'explore/done-1', ?, 'Closed on result', '{"acceptedResultAttemptId":"att-1"}')`,
    ).run(now - 30_000);

    const aksDetail = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=1&appId=aks-rp-e2e"), now),
      projectsRoot,
      stateDir: root,
      now,
      envProbes: {
        disk: { totalBytes: 100_000_000_000, availableBytes: 8_000_000_000, usedPercent: 92 },
        auth: { provider: "azure-cli", state: "valid", expiresAt: now + 3_600_000 },
      },
    });
    expect(aksDetail.apps).toHaveLength(1);
    expect(aksDetail.appDetail?.tasks[0]).toMatchObject({
      taskId: "domain/k8s-1.38",
      status: "waiting",
      convergedWindow: 1,
    });
    expect(aksDetail.appDetail?.agents.find((a) => a.agent === "aks-explorer")?.scorecard.score).toBe(91.7);
    expect(aksDetail.appDetail?.workflows).toHaveLength(3);

    const scoutAfterClose = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=1&appId=scout-knowledge-lib"), now),
      projectsRoot,
      stateDir: root,
      now,
    });
    expect(scoutAfterClose.apps[0]?.outcomes).toMatchObject({
      openTasksTotal: 0,
      closedTasksWindow: 1,
    });
    expect(scoutAfterClose.host.recovery.expiredLeasesCount).toBe(1); // Only may's active running task, not closed scout task

    const agentRollup = readAgentCapabilityRollups(db, now)("aks-explorer");
    expect(agentRollup.scorecard7d.score).toBe(91.7);
  });
});
