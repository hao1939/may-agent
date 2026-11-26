import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExecutionUsage } from "@may-agent/sdk/runtime";
import { observeReply, preparationFixture, usageReply } from "../../../../test/fixtures/execution-usage.js";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { saveExecutionUsage } from "../../../lib/db/execution-usage.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { createMetricService } from "../../../lib/metrics.js";
import { EventBus } from "../../core/events/bus.js";
import {
  classifyMetricScope,
  describeOpenAlert,
  observabilitySummaryQuery,
  probeAzureCliAuthHeadroom,
  readAgentCapabilityRollups,
  readObservabilitySummary,
  resolveAppCatalog,
  resolveObservabilityCatalog,
  runBoundedDiskCacheHygiene,
} from "./observability-summary.js";
import { readMetricHistory, readMetricObservations } from "./metric-observations.js";
import {
  attachMetricSourceMeasurement,
  measureSourceMetrics,
  STALE_ACTIVE_SOURCE_QUERY,
} from "../../metric-source-measurement.js";
import { HOST_AUTH_REMAINING_METRIC_ID, HOST_HARNESS_METRICS, buildAppEvolutionMetrics } from "./evolution-metrics.js";

describe("top-down Host vs. Apps observability summary", () => {
  let db: SqliteDb;
  let root: string;
  let projectsRoot: string;
  const now = 2_000_000_000_000;
  const defaultLoadedApps = [
    { id: "may", owner: "may" },
    { id: "alex", owner: "alex" },
    { id: "aks-rp-e2e", owner: "aks-explorer" },
    { id: "scout-knowledge-lib", owner: "scout" },
  ];

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
    root = mkdtempSync(join(tmpdir(), "may-obs-summary-"));
    projectsRoot = join(root, "projects");
    mkdirSync(projectsRoot, { recursive: true });
  });

  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("classifies metrics from declarations and catalog without Host hardcoding", () => {
    const catalog = resolveAppCatalog({ projectsRoot, loadedApps: defaultLoadedApps });
    expect(classifyMetricScope({ id: "may.daemon-sql-time-percent", owner: "may" }, catalog)).toEqual({
      kind: "host",
    });
    expect(classifyMetricScope({ id: "may.unresolved-input-recovery-count", owner: "may" }, catalog)).toEqual({
      kind: "host",
    });
    expect(classifyMetricScope({ id: "workflow.error-count-24h", owner: "system:host" }, catalog)).toEqual({
      kind: "host",
    });
    expect(
      classifyMetricScope(
        { id: "may.evaluation-unfinished-review-age-seconds", owner: "may", project: "alex" },
        catalog,
      ),
    ).toEqual({
      kind: "app",
      appId: "alex",
    });
    // Renamed evaluation App resolves without any Host code edits (R-04).
    const renamedCatalog = resolveAppCatalog({
      loadedApps: [
        { id: "may", owner: "may" },
        { id: "evaluation-canary", owner: "evaluator" },
      ],
    });
    expect(
      classifyMetricScope(
        { id: "may.evaluation-unfinished-review-age-seconds", owner: "may", project: "evaluation-canary" },
        renamedCatalog,
      ),
    ).toEqual({
      kind: "app",
      appId: "evaluation-canary",
    });
    // Prefix different from declared owner resolves identically across /api/metrics and /api/observability (R-03).
    const researchCatalog = resolveAppCatalog({ loadedApps: [{ id: "research", owner: "researcher" }] });
    expect(classifyMetricScope({ id: "quality.success", owner: "researcher" }, researchCatalog)).toEqual({
      kind: "app",
      appId: "research",
    });
    expect(classifyMetricScope({ id: "scout.knowledge-preamble-coverage", owner: "scout" }, catalog)).toEqual({
      kind: "app",
      appId: "scout-knowledge-lib",
    });
    expect(classifyMetricScope({ id: "aks-rp-e2e.pr-conflict-count", project: "aks-rp-e2e.app" }, catalog)).toEqual({
      kind: "app",
      appId: "aks-rp-e2e",
    });
    expect(classifyMetricScope({ id: "may.request-fulfillment-rate", owner: "may" }, catalog)).toEqual({
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
         ('in-stuck', 'may', 'system', 'bus', 'event', '{}', 'pending', ?, ?, ?)`,
    ).run(
      now - 900_000,
      now - 900_000,
      now - 800_000,
      now - 800_000,
      JSON.stringify({ "input-admission": { failures: 2, firstFailedAt: now - 1_200_000 } }),
      now - 5_000_000,
      now - 1_200_000,
    );

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
        owner: "aks-explorer",
        sessionId: "sess-aks-1",
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
      loadedApps: defaultLoadedApps,
      hostImprovementWorkflow: "alex/develop-host-change",
      appImprovementWorkflows: { "aks-rp-e2e": "alex/develop-change" },
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
      loadedApps: defaultLoadedApps,
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
      loadedApps: defaultLoadedApps,
      now,
    });
    expect(scoutAfterClose.apps[0]?.outcomes).toMatchObject({
      openTasksTotal: 0,
      closedTasksWindow: 1,
    });
    expect(scoutAfterClose.host.recovery.expiredLeasesCount).toBe(1); // Only may's active running task, not closed scout task

    const agentRollup = readAgentCapabilityRollups(db, now)("aks-explorer");
    expect(agentRollup.scorecard7d.score).toBe(91.7);

    // Prometheus TSDB rules: 12-bucket trends preserve null on 0/0 empty exposure, counter zeroInit, and minSampleSize alert gate.
    expect(summary.host.trends.harnessBurdenRatio.points).toHaveLength(12);
    expect(aks.trends?.spinRatio.points.some((p) => p.v === null && p.n === 0)).toBe(true);
    expect(aks.trends?.costPerOutcomeUsd.current).not.toBeNull();
    expect(scout.trends?.costPerOutcomeUsd.current).toBeNull(); // 0 outcomes -> null (no_exposure), never $0!

    metrics.define({ id: "test.counter_total", type: "counter", config: { zeroInit: true } });
    expect(metrics.get("test.counter_total")?.current).toBe(0);

    metrics.define({
      id: "test.ratio_min_exposure",
      type: "gauge",
      threshold: 0.5,
      alertOp: ">",
      config: { alert: { minSampleSize: 5 } },
    });
    metrics.record("test.ratio_min_exposure", 0.9, { sampleSize: 2, measuredAt: now - 1 });
    expect(metrics.evaluate("test.ratio_min_exposure")[0]).toMatchObject({ status: "unknown" });
    metrics.record("test.ratio_min_exposure", 0.9, { sampleSize: 5, measuredAt: now });
    expect(metrics.evaluate("test.ratio_min_exposure")[0]).toMatchObject({ status: "breached" });
  });

  test("executes all Host and App evolution SQL source queries with 0/0 empty-exposure and no_exposure freshness safety", () => {
    const allDefs = [...HOST_HARNESS_METRICS, ...buildAppEvolutionMetrics("aks-rp-e2e", "aks-explorer")];
    for (const def of allDefs) {
      if (!def.sourceQuery) continue;
      const emptyRow = db.prepare(def.sourceQuery).get() as { value: number | null; sampleSize: number };
      expect(emptyRow.sampleSize).toBe(0);
      if (def.unit === "ratio" || def.unit === "usd" || def.unit === "seconds") {
        expect(emptyRow.value).toBeNull(); // Prometheus 0/0 empty exposure -> NULL, never fake 0 or 1!
      } else {
        expect(emptyRow.value).toBe(0); // Outcomes count in empty window is 0
      }
    }

    // no_exposure check updates lastNoExposureAt so STALE_ACTIVE_SOURCE_QUERY does not false-alert.
    const wallNow = Date.now();
    const metrics = createMetricService({ getDb: () => db, now: () => wallNow });
    metrics.define({
      id: "aks-rp-e2e.cost_per_outcome_usd_7d",
      measureInterval: 900_000,
      config: { lastNoExposureAt: wallNow - 60_000 },
    });
    db.run("UPDATE metrics SET created_at = ? WHERE id = 'aks-rp-e2e.cost_per_outcome_usd_7d'", [wallNow - 7_200_000]);
    expect(db.prepare(STALE_ACTIVE_SOURCE_QUERY).get()).toMatchObject({ value: 0 });
    const obs = readMetricObservations(db, wallNow, ["aks-rp-e2e.cost_per_outcome_usd_7d"]);
    expect(obs.metrics[0]).toMatchObject({ freshness: "fresh", noExposure: true, current: null });
  });

  test("covers PR #627 regressions: catalog parity, disabled Apps, rubric validation, multi-App dedup, attempt owner, recovery stages, single lease, and workflow-only offload", () => {
    const metrics = createMetricService({ getDb: () => db, now: () => now });
    // Disabled App on disk with retained active DB Task rows is excluded from active cards (R-10).
    const disabledDir = join(projectsRoot, "retired-app.app");
    mkdirSync(disabledDir, { recursive: true });
    writeFileSync(join(disabledDir, "app.ts"), 'export default { id: "retired-app", agent: "retired-owner" };\n');
    writeFileSync(join(disabledDir, ".disabled"), "");
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
       VALUES ('retired-app', 'ghost/1', 1, 1, 1, 'running', 'normal', 0, 0, ?, '{"status":{"phase":"running"}}')`,
    ).run(now - 10_000);

    // Loaded daemon catalog maps directory evaluation.app -> definition.id 'evaluation-canary' (R-09) and owner 'researcher' -> 'research' (R-03).
    const loadedApps = [
      { id: "evaluation-canary", owner: "evaluator" },
      { id: "research", owner: "researcher" },
      { id: "wf-only", owner: "wf-agent" },
    ];
    metrics.define({ id: "quality.success", owner: "researcher", measureInterval: 300_000 });
    metrics.record("quality.success", 0.99, { measuredAt: now - 1_000 });
    const catalog = resolveObservabilityCatalog(db, { projectsRoot, loadedApps });
    expect(readMetricObservations(db, now, ["quality.success"], catalog).metrics[0]?.scope).toEqual({
      kind: "app",
      appId: "research",
    });

    // Task + mirrored current attempt expired lease counts ONCE, not twice (R-13), and interrupted counts as terminal (R-11).
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, lease_until, current_attempt_id, updated_at, resource_json)
       VALUES ('research', 't-reassigned', 1, 2, 1, 'running', 'normal', 0, 0, ?, 'att-running', ?, '{"spec":{"agent":"replacement-agent"},"status":{"phase":"running"}}')`,
    ).run(now - 5_000, now - 5_000);
    db.prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, lease_until, started_at, attempt_json)
       VALUES
         ('research', 'att-running', 't-reassigned', 1, 'running', ?, ?, '{"owner":"replacement-agent","handler":"executor:codex-goal"}'),
         ('research', 'att-old-fail', 't-reassigned', 1, 'failed', NULL, ?, '{"owner":"original-agent","handler":"executor:codex-goal","finishedAt":"' || ? || '"}'),
         ('research', 'att-interrupted', 't-reassigned', 1, 'interrupted', NULL, ?, '{"owner":"original-agent","handler":"executor:codex-goal","finishedAt":"' || ? || '"}')`,
    ).run(
      now - 5_000,
      now - 20_000,
      now - 40_000,
      new Date(now - 35_000).toISOString(),
      now - 30_000,
      new Date(now - 25_000).toISOString(),
    );

    // Recovery stages: recovered admission is ignored; done item with unresolved input-feedback counts and uses firstFailedAt (R-12).
    db.prepare(
      `INSERT INTO app_inbox_items(id, app_id, source_kind, source_id, input_kind, input_data, status, recovery_json, created_at, updated_at)
       VALUES
         ('rec-resolved', 'research', 'system', 'bus', 'event', '{}', 'pending', ?, ?, ?),
         ('rec-done-feedback', 'research', 'system', 'bus', 'event', '{}', 'done', ?, ?, ?)`,
    ).run(
      JSON.stringify({ "input-admission": { failures: 1, firstFailedAt: now - 900_000, recoveredAt: now - 800_000 } }),
      now - 1_000_000,
      now - 800_000,
      JSON.stringify({ "input-feedback": { failures: 3, firstFailedAt: now - 120_000 } }),
      now - 9_000_000,
      now - 120_000,
    );

    // Workflow-only App: 1 workflow attempt + 1 workflow_run + 0 agent calls => 0 agent invocations, 100% offload (R-14).
    db.prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
       VALUES ('wf-only', 'att-wf-1', 'hygiene', 1, 'completed', ?, ?)`,
    ).run(
      now - 50_000,
      JSON.stringify({ owner: "wf-agent", handler: "workflow:hygiene", finishedAt: new Date(now - 40_000).toISOString() }),
    );
    db.prepare(
      `INSERT INTO workflow_runs(runId, workflow, task, app_id, status, startedAt, endedAt, parentWorkflowRunId)
       VALUES ('wr-wf-1', 'wf-only/hygiene', 'clean', 'wf-only', 'done', ?, ?, NULL)`,
    ).run(now - 50_000, now - 40_000);

    // Unsupported rubricVersion rejected (R-06), and two Apps with identical (taskId, cohort) don't collide on shared agent (R-07).
    const badRubric = {
      version: 1,
      appId: "research",
      taskId: "shared-task",
      agent: "shared-agent",
      cohort: "c1",
      rubricVersion: "unsupported-v99",
      dimensions: { outcomeValue: 0, correctnessAndEvidence: 0, autonomyAndRecovery: 0, efficiency: 0, humanCoordination: 0 },
    };
    const appAScore = {
      version: 1,
      appId: "research",
      taskId: "shared-task",
      agent: "shared-agent",
      cohort: "c1",
      rubricVersion: "app-rubric-v1",
      dimensions: { outcomeValue: 4, correctnessAndEvidence: 0, autonomyAndRecovery: 4, efficiency: 4, humanCoordination: 4 },
    };
    const appBScore = {
      version: 1,
      appId: "evaluation-canary",
      taskId: "shared-task",
      agent: "shared-agent",
      cohort: "c1",
      rubricVersion: "app-rubric-v1",
      dimensions: { outcomeValue: 4, correctnessAndEvidence: 4, autonomyAndRecovery: 4, efficiency: 4, humanCoordination: 4 },
    };
    db.prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
       VALUES ('evaluation-canary', 'att-scores', 'eval-run', 1, 'completed', ?, ?)`,
    ).run(
      now - 15_000,
      JSON.stringify({
        owner: "evaluator",
        handler: "workflow:eval",
        finishedAt: new Date(now - 10_000).toISOString(),
        acceptedResult: {
          state: "converged",
          facts: [
            `scorecard:${JSON.stringify(badRubric)}`,
            `scorecard:${JSON.stringify(appAScore)}`,
            `scorecard:${JSON.stringify(appBScore)}`,
          ],
        },
      }),
    );

    const summary = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=1"), now),
      projectsRoot,
      stateDir: root,
      loadedApps,
      now,
    });

    expect(summary.apps.map((a) => a.appId)).toEqual(["evaluation-canary", "research", "wf-only"]);
    expect(summary.host.plumbing.terminalTaskAttemptsWindow).toBe(4); // completed + failed + interrupted
    expect(summary.host.recovery).toMatchObject({
      unresolvedInputRecoveryCount: 1,
      oldestInputRecoveryAgeMs: 120_000, // from firstFailedAt, not created_at
      expiredLeasesCount: 1, // Task + mirrored current attempt counted once
    });

    const wfOnly = summary.apps.find((a) => a.appId === "wf-only")!;
    expect(wfOnly.costAndLeverage).toMatchObject({
      agentInvocationsWindow: 0,
      workflowRunsWindow: 1,
      workflowOffloadShare: 1,
    });

    const research = summary.apps.find((a) => a.appId === "research")!;
    expect(research.metrics.defined).toBe(1); // quality.success attributed to research
    expect(research.scorecard).toMatchObject({ status: "scored", gated: true, score: 25, sampleSize: 1 }); // unsupported-v99 ignored

    // Drill-down preserves historical attempt owner 'original-agent' after Task reassignment to 'replacement-agent' (R-08).
    const detail = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=1&appId=research"), now),
      projectsRoot,
      stateDir: root,
      loadedApps,
      now,
    }).appDetail!;
    expect(detail.agents.find((a) => a.agent === "original-agent")).toMatchObject({
      invocationsWindow: 2,
      errorsWindow: 1,
    });

    // Multi-App agent rollup preserves both Apps' identical (taskId, cohort) and keeps App A's gate (R-07).
    const sharedRollup = readAgentCapabilityRollups(db, now)("shared-agent");
    expect(sharedRollup.scorecard7d).toMatchObject({
      sampleSize: 2,
      gated: true,
      score: 25,
    });
  });

  test("covers round-3 review regressions: async cache hygiene preserves owned checkouts, generic Host defaults, numeric->no_exposure->numeric, aligned finish-window cohorts, auth failure vs unconfigured, streak minSampleSize, and APP_ROOT discovery", async () => {
    // 1. Bounded async cache hygiene prunes only disposable cache entries within maxEntries and NEVER deletes old clean Git checkouts.
    const cacheDir = join(root, "go-cache");
    mkdirSync(cacheDir, { recursive: true });
    for (let i = 0; i < 6; i++) {
      mkdirSync(join(cacheDir, `shard-${i}`), { recursive: true });
      writeFileSync(join(cacheDir, `shard-${i}`, "blob"), "cached");
    }
    const worktreesDir = join(root, "workspace-worktrees");
    const ownedCheckout = join(worktreesDir, "owned-task-wt");
    mkdirSync(ownedCheckout, { recursive: true });
    execFileSync("git", ["-C", ownedCheckout, "init", "-q"]);
    execFileSync("git", ["-C", ownedCheckout, "config", "user.email", "test@example.com"]);
    execFileSync("git", ["-C", ownedCheckout, "config", "user.name", "Test"]);
    writeFileSync(join(ownedCheckout, "README.md"), "important task state\n");
    execFileSync("git", ["-C", ownedCheckout, "add", "README.md"]);
    execFileSync("git", ["-C", ownedCheckout, "commit", "-q", "-m", "init"]);
    writeFileSync(join(ownedCheckout, ".gitignore"), "recovery.json\n");
    execFileSync("git", ["-C", ownedCheckout, "add", ".gitignore"]);
    execFileSync("git", ["-C", ownedCheckout, "commit", "-q", "-m", "ignore"]);
    writeFileSync(join(ownedCheckout, "recovery.json"), '{"recoverable":true}\n');
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    utimesSync(ownedCheckout, threeDaysAgo, threeDaysAgo);

    const hygiene = await runBoundedDiskCacheHygiene({
      now,
      cacheDir,
      maxEntries: 3,
      deadlineMs: 2_000,
      ignoreCooldown: true,
    });
    expect(hygiene).toEqual({ prunedEntries: 3, stoppedByBudget: true });
    expect(existsSync(join(ownedCheckout, "recovery.json"))).toBe(true); // Old, clean, owned checkout retained!

    // 2. Host defaults stay generic (no alex/may hardcoding), unjudged system alerts don't claim routing, and absent Apps hide workflows.
    for (const def of HOST_HARNESS_METRICS) {
      expect(def.owner).toBe("system:host");
      expect((def.config as { handler?: unknown } | undefined)?.handler).toBeUndefined();
    }
    expect(
      describeOpenAlert({
        alertId: 77,
        metricId: "event.unhandled-signal-count-1h",
        owner: "system:host",
        message: "Unhandled signal",
      }),
    ).toMatchObject({
      scope: { kind: "host" },
      declaredOwner: "system:host",
      declaredHandler: null,
      handler: "system:host",
      handlingStatus: "No recorded handling",
      linkedTask: null,
    });
    const noAlexSummary = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=1"), now),
      projectsRoot,
      stateDir: root,
      loadedApps: [{ id: "billing", owner: "cashier" }],
      hostImprovementWorkflow: "alex/develop-host-change",
      appImprovementWorkflows: { billing: "alex/develop-change" },
      now,
    });
    expect(noAlexSummary.host.improvementWorkflow).toBeNull();
    expect(noAlexSummary.apps[0]?.improvementWorkflow).toBeNull();

    // 3. numeric -> no_exposure -> numeric clears obsolete current value while preserving history and failure timestamps.
    let clockTs = now - 300_000;
    const ms = createMetricService({ getDb: () => db, now: () => clockTs });
    ms.define({ id: "billing.spin_ratio_24h", owner: "cashier", project: "billing", measureInterval: 900_000 });
    db.prepare(
      `INSERT INTO events(event_type, source, owner, metric_id, timestamp, data)
       VALUES ('metric.measurement.failed', 'test', 'system:host', 'billing.spin_ratio_24h', ?, '{"reason":"transient earlier"}')`,
    ).run(now - 400_000);
    ms.record("billing.spin_ratio_24h", 0.5, { sampleSize: 4, measuredAt: now - 300_000 });
    expect(readMetricObservations(db, now - 250_000, ["billing.spin_ratio_24h"]).metrics[0]).toMatchObject({
      current: 0.5,
      noExposure: false,
      freshness: "fresh",
      collectionFailure: { afterLastSample: false },
    });
    // Newer no_exposure check supersedes current numeric sample without erasing historical snapshot or reviving old failure.
    clockTs = now - 100_000;
    db.run("UPDATE metrics SET config = json_set(COALESCE(config, '{}'), '$.lastNoExposureAt', ?) WHERE id = 'billing.spin_ratio_24h'", [
      now - 100_000,
    ]);
    expect(readMetricObservations(db, now - 50_000, ["billing.spin_ratio_24h"]).metrics[0]).toMatchObject({
      current: null,
      observation: null,
      noExposure: true,
      freshness: "fresh",
      collectionFailure: { afterLastSample: false },
    });
    expect(ms.get("billing.spin_ratio_24h")?.observation).toBeNull();
    expect(readMetricHistory(db, "billing.spin_ratio_24h", { start: now - 500_000, end: now }).snapshots).toHaveLength(1);
    // Subsequent numeric sample restores current observation.
    clockTs = now - 10_000;
    ms.record("billing.spin_ratio_24h", 0.25, { sampleSize: 8, measuredAt: now - 10_000 });
    expect(readMetricObservations(db, now, ["billing.spin_ratio_24h"]).metrics[0]).toMatchObject({
      current: 0.25,
      noExposure: false,
      freshness: "fresh",
      collectionFailure: { afterLastSample: false },
    });

    // 4. Streak minSampleSize rejects [1, 1, 5] and only breaches after 3 consecutive >= 5 snapshots.
    ms.define({
      id: "test.sustained_exposure",
      type: "gauge",
      threshold: 0.8,
      alertOp: "<",
      config: { alert: { mode: "sustained", consecutive: 3, minSampleSize: 5 } },
    });
    for (const [idx, n] of [
      [1, 1],
      [2, 1],
      [3, 5],
    ] as const) {
      clockTs = now - (10 - idx) * 1_000;
      ms.record("test.sustained_exposure", 0.4, { sampleSize: n, measuredAt: clockTs });
      expect(ms.evaluate("test.sustained_exposure")[0]?.status).toBe("unknown");
    }
    for (const idx of [4, 5] as const) {
      clockTs = now - (10 - idx) * 1_000;
      ms.record("test.sustained_exposure", 0.4, { sampleSize: 5, measuredAt: clockTs });
    }
    expect(ms.evaluate("test.sustained_exposure")[0]?.status).toBe("breached");

    // 5. Shared Host finish-window cohort (started 25h ago, settled 1h ago) + strict `< end` cutoff exclusion.
    const liveNow = Date.now();
    const cohortDb = openDatabase(":memory:");
    applyDbSchema(cohortDb);
    try {
      cohortDb
        .prepare(
          `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, accepted_result_state, started_at, attempt_json)
           VALUES
             ('billing', 'cross-boundary-settled', 't1', 1, 'completed', 'converged', ?, ?),
             ('billing', 'at-cut-failed', 't1', 1, 'failed', NULL, ?, ?),
             ('billing', 'after-cut-failed', 't1', 1, 'failed', NULL, ?, ?)`,
        )
        .run(
          liveNow - 25 * 3_600_000,
          JSON.stringify({ finishedAt: new Date(liveNow - 3_600_000).toISOString(), acceptedResult: { state: "converged" } }),
          liveNow - 10_000,
          JSON.stringify({ finishedAt: new Date(liveNow).toISOString() }),
          liveNow - 10_000,
          JSON.stringify({ finishedAt: new Date(liveNow + 60_000).toISOString() }),
        );
      const pinned = readObservabilitySummary(cohortDb, {
        query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
        projectsRoot,
        stateDir: root,
        loadedApps: [{ id: "billing", owner: "cashier" }],
        now: liveNow,
      });
      // Pinned window [liveNow - 24h, liveNow) includes cross-boundary settled and excludes both at-cut & after-cut failures!
      expect(pinned.host.plumbing).toMatchObject({ terminalTaskAttemptsWindow: 1, failedTaskAttemptsWindow: 0 });
      expect(pinned.host.trends.settlementIntegrity).toMatchObject({ current: 1, sampleSize: 1 });
      expect(pinned.apps[0]?.outcomes.convergedMilestonesWindow).toBe(1);
      expect(pinned.apps[0]?.blockers.failedAttemptsWindow).toBe(0);

      // Remove at-cut row (which is < wall clock once 1ms elapses) and verify live SQL queries match Host tile (1 settled, after-cut excluded).
      cohortDb.prepare("DELETE FROM app_task_attempts WHERE attempt_id = 'at-cut-failed'").run();
      const settlementSql = HOST_HARNESS_METRICS.find((m) => m.id === "host.settlement_integrity_ratio")!.sourceQuery!;
      const burdenSql = HOST_HARNESS_METRICS.find((m) => m.id === "host.harness_burden_ratio")!.sourceQuery!;
      expect(cohortDb.prepare(settlementSql).get()).toMatchObject({ value: 1, sampleSize: 1 });
      expect(cohortDb.prepare(burdenSql).get()).toMatchObject({ value: 0, sampleSize: 1 });
    } finally {
      cohortDb.close();
    }

    // 6. Configured auth sensor with unreadable/malformed cache records failure (not no_exposure), and APP_ROOT != STATE_DIR registers loaded Apps only.
    const srvHost = join(root, "srv-host");
    const dataState = join(root, "data-state");
    const badAzureDir = join(root, "bad-azure");
    mkdirSync(join(srvHost, "projects", "evaluation.app"), { recursive: true });
    writeFileSync(
      join(srvHost, "projects", "evaluation.app", "app.ts"),
      'export default { id: "evaluation-canary", agent: "evaluator" };\n',
    );
    mkdirSync(join(srvHost, "projects", "broken.app"), { recursive: true });
    writeFileSync(join(srvHost, "projects", "broken.app", "app.ts"), 'throw new Error("broken module");\n');
    mkdirSync(dataState, { recursive: true });
    mkdirSync(badAzureDir, { recursive: true });

    const prevAppRoot = process.env.APP_ROOT;
    const prevStateDir = process.env.STATE_DIR;
    const prevProjectsRoot = process.env.PROJECTS_ROOT;
    const prevAzureDir = process.env.AZURE_CONFIG_DIR;
    process.env.APP_ROOT = srvHost;
    process.env.STATE_DIR = dataState;
    delete process.env.PROJECTS_ROOT;
    process.env.AZURE_CONFIG_DIR = badAzureDir;
    try {
      const bus = new EventBus();
      const collector = attachMetricSourceMeasurement({ bus, persistDir: dataState });
      await collector.idle();
      const stateDb = getDb(dataState);
      const registeredIds = (stateDb.prepare("SELECT id FROM metrics ORDER BY id").all() as Array<{ id: string }>).map(
        (r) => r.id,
      );
      expect(registeredIds).toContain("evaluation-canary.verified_outcomes_24h");
      expect(registeredIds.some((id) => id.startsWith("evaluation."))).toBe(false);
      expect(registeredIds.some((id) => id.startsWith("broken."))).toBe(false);

      // Unconfigured Azure dir -> quiet no_exposure
      const unconf = await measureSourceMetrics({
        bus,
        persistDir: dataState,
        isDue: (m) => m.id === HOST_AUTH_REMAINING_METRIC_ID,
      });
      expect(unconf.failures).toEqual([]);
      expect(unconf.skipped).toEqual([HOST_AUTH_REMAINING_METRIC_ID]);

      // Malformed configured cache -> collection failure, does NOT advance lastNoExposureAt!
      const beforeCfg = (
        stateDb.prepare("SELECT config FROM metrics WHERE id = ?").get(HOST_AUTH_REMAINING_METRIC_ID) as { config: string }
      ).config;
      writeFileSync(join(badAzureDir, "msal_token_cache.json"), "{not-valid-json");
      const brokenAuth = await measureSourceMetrics({
        bus,
        persistDir: dataState,
        measuredAt: now + 60_000,
        isDue: (m) => m.id === HOST_AUTH_REMAINING_METRIC_ID,
      });
      expect(brokenAuth.failures).toEqual([
        { id: HOST_AUTH_REMAINING_METRIC_ID, reason: expect.stringContaining("malformed") },
      ]);
      const afterCfg = (
        stateDb.prepare("SELECT config FROM metrics WHERE id = ?").get(HOST_AUTH_REMAINING_METRIC_ID) as { config: string }
      ).config;
      expect(afterCfg).toBe(beforeCfg);
    } finally {
      if (prevAppRoot === undefined) delete process.env.APP_ROOT;
      else process.env.APP_ROOT = prevAppRoot;
      if (prevStateDir === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = prevStateDir;
      if (prevProjectsRoot === undefined) delete process.env.PROJECTS_ROOT;
      else process.env.PROJECTS_ROOT = prevProjectsRoot;
      if (prevAzureDir === undefined) delete process.env.AZURE_CONFIG_DIR;
      else process.env.AZURE_CONFIG_DIR = prevAzureDir;
      closeDb(dataState);
    }
  });

  test("round-4 review regressions: incremental hygiene, no_exposure persistence across define(), complete cost pricing, and drill-down attribution", async () => {
    const now = 1_780_200_000_000;
    const projectsRoot = join(root, "projects-r4");
    for (const [id, owner] of [
      ["alpha", "owner-alpha"],
      ["beta", "owner-beta"],
    ] as const) {
      mkdirSync(join(projectsRoot, `${id}.app`), { recursive: true });
      writeFileSync(join(projectsRoot, `${id}.app`, "app.ts"), `export default { id: "${id}", agent: "${owner}" };\n`);
    }

    // 1. Incremental cache hygiene bounds descendant file removals inside a single deep directory (never recursive rm).
    const deepCacheDir = join(root, "deep-cache");
    const singleShard = join(deepCacheDir, "shard-deep", "nested");
    mkdirSync(singleShard, { recursive: true });
    for (let i = 0; i < 20; i++) {
      writeFileSync(join(singleShard, `obj-${i}.o`), "payload");
    }
    const deepHygiene = await runBoundedDiskCacheHygiene({
      now,
      cacheDir: deepCacheDir,
      maxEntries: 5,
      deadlineMs: 2_000,
      ignoreCooldown: true,
    });
    expect(deepHygiene).toEqual({ prunedEntries: 5, stoppedByBudget: true });
    expect(readdirSync(singleShard)).toHaveLength(15);

    // 2. recordNoExposure clears stored current, survives define()/reload, stays monotonic, and resets consecutive streaks.
    const r4Db = openDatabase(":memory:");
    applyDbSchema(r4Db);
    try {
      let clockTs = now - 60_000;
      const ms = createMetricService({ getDb: () => r4Db, now: () => clockTs });
      const def = {
        id: "alpha.streak_guard",
        owner: "owner-alpha",
        project: "alpha",
        type: "gauge" as const,
        threshold: 0.5,
        alertOp: ">" as const,
        measureInterval: 900_000,
        config: { alert: { mode: "sustained", consecutive: 3, minSampleSize: 2 } },
      };
      ms.define(def);
      ms.record(def.id, 0.9, { sampleSize: 4, measuredAt: now - 50_000 });
      ms.record(def.id, 0.9, { sampleSize: 4, measuredAt: now - 40_000 });
      expect(r4Db.prepare("SELECT current FROM metrics WHERE id = ?").get(def.id)).toEqual({ current: 0.9 });

      // Record no_exposure at now - 30s -> clears stored current while stamping updated_at.
      ms.recordNoExposure(def.id, now - 30_000);
      expect(r4Db.prepare("SELECT current, updated_at FROM metrics WHERE id = ?").get(def.id)).toEqual({
        current: null,
        updated_at: now - 30_000,
      });

      // Out-of-order older no_exposure timestamp cannot rewind lastNoExposureAt.
      ms.recordNoExposure(def.id, now - 45_000);
      const storedCfg = JSON.parse(
        (r4Db.prepare("SELECT config FROM metrics WHERE id = ?").get(def.id) as { config: string }).config,
      ) as { lastNoExposureAt?: number };
      expect(storedCfg.lastNoExposureAt).toBe(now - 30_000);

      // Re-defining on startup/reload preserves lastNoExposureAt and never resurrects stale breach.
      ms.define(def);
      expect(r4Db.prepare("SELECT current FROM metrics WHERE id = ?").get(def.id)).toEqual({ current: null });
      expect(ms.evaluate(def.id)[0]?.status).toBe("unknown");

      // Post-gap single breach cannot bridge with the 2 pre-gap breaches to satisfy consecutive=3!
      clockTs = now - 10_000;
      ms.record(def.id, 0.9, { sampleSize: 4, measuredAt: clockTs });
      expect(ms.evaluate(def.id)[0]?.status).toBe("unknown");
      clockTs = now - 5_000;
      ms.record(def.id, 0.9, { sampleSize: 4, measuredAt: clockTs });
      expect(ms.evaluate(def.id)[0]?.status).toBe("unknown");
      clockTs = now - 1_000;
      ms.record(def.id, 0.9, { sampleSize: 4, measuredAt: clockTs });
      expect(ms.evaluate(def.id)[0]?.status).toBe("breached");

      // 3. Partial pricing coverage yields null costPerOutcomeUsd (both SQL and summary), while 100% pricing emits exact ratio.
      const start = now - 86_400_000;
      r4Db
        .prepare(
          `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, accepted_result_state, started_at, attempt_json)
           VALUES
             ('alpha', 'att-priced', 't-a', 1, 'completed', 'converged', ?, ?),
             ('alpha', 'att-45d-settled', 't-old', 1, 'completed', 'converged', ?, ?)`,
        )
        .run(
          now - 3_600_000,
          JSON.stringify({
            owner: "owner-alpha",
            sessionId: "sess-priced",
            finishedAt: new Date(now - 1_800_000).toISOString(),
            acceptedResult: { state: "converged" },
          }),
          now - 45 * 86_400_000,
          JSON.stringify({
            owner: "owner-alpha",
            sessionId: "sess-old",
            finishedAt: new Date(now - 2_000_000).toISOString(),
            acceptedResult: { state: "converged" },
          }),
        );
      r4Db
        .prepare(
          `INSERT INTO execution_usage(id, session_id, agent, app_id, attempt_id, configured_model, preparer, models, outcome, started_at, updated_at, data)
           VALUES ('u-priced', 'sess-priced', 'owner-alpha', 'alpha', 'att-priced', 'gpt-5', 'full', '[]', 'done', ?, ?, ?)`,
        )
        .run(
          now - 3_600_000,
          now - 1_800_000,
          JSON.stringify({
            totals: { replies: 1, measuredReplies: 1, estimatedCostReplies: 1, estimatedCost: 0.4, input: 100, output: 50 },
          }),
        );

      const fullPricedSummary = readObservabilitySummary(r4Db, {
        query: { start, end: now, appId: "alpha" },
        projectsRoot,
        stateDir: root,
        loadedApps: [
          { id: "alpha", owner: "owner-alpha" },
          { id: "beta", owner: "owner-beta" },
        ],
        now,
      });
      // 45d-old started attempt settled in window is included in BOTH Host cohort and App outcomes (2 converged total).
      expect(fullPricedSummary.host.plumbing.terminalTaskAttemptsWindow).toBe(2);
      expect(fullPricedSummary.apps[0]?.outcomes.convergedMilestonesWindow).toBe(2);
      expect(fullPricedSummary.apps[0]?.costAndLeverage.completePricingCoverage).toBe(true);
      expect(fullPricedSummary.apps[0]?.trends?.costPerOutcomeUsd.current).toBe(0.2);

      // Adding an unpriced execution_usage row makes costPerOutcomeUsd null instead of reporting partial spend as complete.
      r4Db
        .prepare(
          `INSERT INTO execution_usage(id, session_id, agent, app_id, configured_model, preparer, models, outcome, started_at, updated_at, data)
           VALUES ('u-unpriced', 'sess-unpriced', 'usage-only-specialist', 'alpha', 'gpt-5', 'full', '[]', 'done', ?, ?, ?)`,
        )
        .run(
          now - 2_400_000,
          now - 2_000_000,
          JSON.stringify({
            totals: { replies: 1, measuredReplies: 1, estimatedCostReplies: 0, estimatedCost: 0, input: 100, output: 50 },
          }),
        );
      const mixedPricedSummary = readObservabilitySummary(r4Db, {
        query: { start, end: now, appId: "alpha" },
        projectsRoot,
        stateDir: root,
        loadedApps: [
          { id: "alpha", owner: "owner-alpha" },
          { id: "beta", owner: "owner-beta" },
        ],
        now,
      });
      expect(mixedPricedSummary.apps[0]?.costAndLeverage.completePricingCoverage).toBe(false);
      expect(mixedPricedSummary.apps[0]?.trends?.costPerOutcomeUsd.current).toBeNull();
      const alphaEvoDefs = buildAppEvolutionMetrics("alpha", "owner-alpha");
      const costSql = alphaEvoDefs.find((d) => d.id === "alpha.cost_per_outcome_usd_7d")!.sourceQuery!;
      const liveMixedDb = openDatabase(":memory:");
      applyDbSchema(liveMixedDb);
      try {
        const liveTs = Date.now();
        liveMixedDb
          .prepare(
            `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
             VALUES ('alpha', 'a1', 't1', 1, 'completed', ?, ?)`,
          )
          .run(
            liveTs - 60_000,
            JSON.stringify({
              finishedAt: new Date(liveTs - 30_000).toISOString(),
              acceptedResult: { state: "converged" },
            }),
          );
        liveMixedDb
          .prepare(
            `INSERT INTO execution_usage(id, session_id, agent, app_id, attempt_id, configured_model, preparer, models, outcome, started_at, updated_at, data)
             VALUES
               ('u1', 's1', 'owner-alpha', 'alpha', 'a1', 'gpt-5', 'full', '[]', 'done', ?, ?, ?),
               ('u2', 's2', 'owner-alpha', 'alpha', NULL, 'gpt-5', 'full', '[]', 'done', ?, ?, ?)`,
          )
          .run(
            liveTs - 60_000,
            liveTs - 30_000,
            JSON.stringify({ totals: { replies: 1, measuredReplies: 1, estimatedCostReplies: 1, estimatedCost: 0.5 } }),
            liveTs - 50_000,
            liveTs - 20_000,
            JSON.stringify({ totals: { replies: 1, measuredReplies: 1, estimatedCostReplies: 0, estimatedCost: 0 } }),
          );
        expect(liveMixedDb.prepare(costSql).get()).toMatchObject({
          value: null,
          sampleSize: 0,
          note: '{"pricedExecutions":1,"unpricedExecutions":1,"outcomes":1}',
        });
        liveMixedDb.prepare("DELETE FROM execution_usage WHERE id = 'u2'").run();
        expect(liveMixedDb.prepare(costSql).get()).toMatchObject({
          value: 0.5,
          sampleSize: 1,
          note: '{"pricedExecutions":1,"unpricedExecutions":0,"outcomes":1}',
        });
      } finally {
        liveMixedDb.close();
      }

      // 4. Drill-down prefers app_id over projectId, keeps failed attempt errors whose session started before start, and rolls up usage-only Apps.
      r4Db
        .prepare(
          `INSERT INTO sessions(sessionId, agent, task, app_id, projectId, status, startedAt, endedAt)
           VALUES
             ('cross-app-sess', 'owner-alpha', 'cross-app check', 'alpha', 'beta', 'done', ?, ?),
             ('pre-window-err-sess', 'owner-alpha', 'long running task', 'alpha', 'alpha', 'error', ?, ?)`,
        )
        .run(now - 5_000, now - 4_000, start - 3_600_000, now - 1_000);
      r4Db
        .prepare(
          `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
           VALUES ('alpha', 'cross-window-fail', 't-err', 1, 'failed', ?, ?)`,
        )
        .run(
          start - 3_600_000,
          JSON.stringify({
            owner: "owner-alpha",
            sessionId: "pre-window-err-sess",
            finishedAt: new Date(now - 1_000).toISOString(),
          }),
        );
      r4Db
        .prepare(
          `INSERT INTO workflow_runs(runId, workflow, task, status, app_id, projectId, startedAt, endedAt)
           VALUES ('wf-cross', 'alpha/check', 'check alpha', 'done', 'alpha', 'beta', ?, ?)`,
        )
        .run(now - 6_000, now - 5_000);

      const betaSummary = readObservabilitySummary(r4Db, {
        query: { start, end: now, appId: "beta" },
        projectsRoot,
        stateDir: root,
        loadedApps: [
          { id: "alpha", owner: "owner-alpha" },
          { id: "beta", owner: "owner-beta" },
        ],
        now,
      });
      // Session & workflow with app_id='alpha' + projectId='beta' are NOT double-counted into beta!
      expect(betaSummary.appDetail?.agents).toEqual([]);
      expect(betaSummary.appDetail?.workflows).toEqual([]);

      const alphaSummary2 = readObservabilitySummary(r4Db, {
        query: { start, end: now, appId: "alpha" },
        projectsRoot,
        stateDir: root,
        loadedApps: [
          { id: "alpha", owner: "owner-alpha" },
          { id: "beta", owner: "owner-beta" },
        ],
        now,
      });
      // Attempt failing inside window whose session started before `start` still counts its failure!
      expect(alphaSummary2.appDetail?.agents.find((a) => a.agent === "owner-alpha")?.errorsWindow).toBe(1);

      // Usage-only specialist appears in readAgentCapabilityRollups apps7d!
      const rollups = readAgentCapabilityRollups(r4Db, now);
      expect(rollups("usage-only-specialist").apps7d).toEqual(["alpha"]);

      // 5. readMetricObservations scopes by appId BEFORE row limit and derives historical DB catalog when appCatalog is omitted.
      for (let i = 0; i < 12; i++) {
        ms.define({ id: `aaa-filler.m-${String(i).padStart(2, "0")}`, owner: "system:host" });
      }
      ms.define({ id: "zzz-beta.custom_metric", owner: "owner-beta" });
      ms.record("zzz-beta.custom_metric", 42, { measuredAt: now - 100 });
      const betaCatalog = resolveObservabilityCatalog(r4Db, {
        projectsRoot,
        loadedApps: [
          { id: "alpha", owner: "owner-alpha" },
          { id: "beta", owner: "owner-beta" },
        ],
        filterAppId: "beta",
      });
      const scopedObs = readMetricObservations(r4Db, now, undefined, betaCatalog, {
        scopeAppId: "beta",
        limit: 5,
      });
      expect(scopedObs.metrics.map((m) => m.id)).toEqual(["zzz-beta.custom_metric"]);
      expect(scopedObs.truncated).toBe(false);

      // Historical App in DB (`alpha`) is recognized even when readMetricObservations is called without a prebuilt catalog.
      ms.define({ id: "alpha.latency_custom", owner: "unmapped-agent" });
      const defaultCatalogObs = readMetricObservations(r4Db, now, ["alpha.latency_custom"]);
      expect(defaultCatalogObs.metrics[0]?.scope).toEqual({ kind: "app", appId: "alpha" });

      // 6. Covering finish-time & recovery indexes eliminate full-table scans on app_task_attempts and app_inbox_items,
      // and MSAL cache with RefreshToken + empty AccessToken reports 'refreshable' (quiet no_exposure, never false failure).
      for (const m of [
        HOST_HARNESS_METRICS.find((d) => d.id === "host.settlement_integrity_ratio")!,
        HOST_HARNESS_METRICS.find((d) => d.id === "host.harness_burden_ratio")!,
        ...alphaEvoDefs.filter((d) => d.id !== "alpha.workflow_offload_ratio_24h"),
      ]) {
        const plan = (r4Db.prepare(`EXPLAIN QUERY PLAN ${m.sourceQuery}`).all() as Array<{ detail: string }>)
          .map((p) => p.detail)
          .join(" | ");
        expect(plan).toContain("idx_app_task_attempts_finished_ms");
      }
      const refreshAzureDir = join(root, "refresh-azure");
      mkdirSync(refreshAzureDir, { recursive: true });
      writeFileSync(
        join(refreshAzureDir, "msal_token_cache.json"),
        JSON.stringify({ AccessToken: {}, RefreshToken: { rt1: { target: "scope" } }, Account: { a1: {} } }),
      );
      expect(probeAzureCliAuthHeadroom(now, refreshAzureDir)).toEqual({
        provider: "azure-cli",
        state: "refreshable",
        expiresAt: null,
      });

      // Explicit expired account with no refresh or access token records a 0-second validity sample (not a collection failure).
      const expiredNullDir = join(root, "expired-null-azure");
      const expiredNullState = join(root, "expired-null-state");
      mkdirSync(expiredNullDir, { recursive: true });
      mkdirSync(expiredNullState, { recursive: true });
      writeFileSync(
        join(expiredNullDir, "msal_token_cache.json"),
        JSON.stringify({ AccessToken: {}, RefreshToken: {}, Account: { a1: {} } }),
      );
      expect(probeAzureCliAuthHeadroom(now, expiredNullDir)).toMatchObject({
        provider: "azure-cli",
        state: "expired",
        expiresAt: null,
      });
      const prevAz = process.env.AZURE_CONFIG_DIR;
      process.env.AZURE_CONFIG_DIR = expiredNullDir;
      try {
        const expBus = new EventBus();
        const expCollector = attachMetricSourceMeasurement({ bus: expBus, persistDir: expiredNullState });
        await expCollector.idle();
        const expRes = await measureSourceMetrics({
          bus: expBus,
          persistDir: expiredNullState,
          measuredAt: now,
          isDue: (m) => m.id === HOST_AUTH_REMAINING_METRIC_ID,
        });
        expect(expRes.failures).toEqual([]);
        expect(expRes.measured).toEqual([HOST_AUTH_REMAINING_METRIC_ID]);
        const expDb = getDb(expiredNullState);
        expect(expDb.prepare("SELECT current FROM metrics WHERE id = ?").get(HOST_AUTH_REMAINING_METRIC_ID)).toEqual({
          current: 0,
        });
      } finally {
        if (prevAz === undefined) delete process.env.AZURE_CONFIG_DIR;
        else process.env.AZURE_CONFIG_DIR = prevAz;
        closeDb(expiredNullState);
      }
    } finally {
      r4Db.close();
    }
  });

  test("separates Host settlement defects from graceful restart requeues and App handler failures across SQL collectors and summary", () => {
    const liveNow = Date.now();
    const boundaryDb = openDatabase(":memory:");
    applyDbSchema(boundaryDb);
    try {
      const ins = boundaryDb.prepare(
        `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
         VALUES (?, ?, ?, 1, ?, ?, ?)`,
      );
      // 1. Cleanly settled attempt
      ins.run(
        "alex",
        "att-settled",
        "t-ok",
        "completed",
        liveNow - 60_000,
        JSON.stringify({ finishedAt: new Date(liveNow - 50_000).toISOString(), acceptedResult: { state: "converged" } }),
      );
      // 2. Graceful daemon restart requeue (interrupted) -> churn only, NOT settlement failure
      ins.run(
        "aks-rp-e2e",
        "att-restart-requeue",
        "t-k8s",
        "interrupted",
        liveNow - 55_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 45_000).toISOString(),
          failureReason: "previous-runtime-attempt-requeued",
        }),
      );
      // 3. Explicit human stop (interrupted) -> neither settlement failure nor involuntary harness churn
      ins.run(
        "may",
        "att-owner-stop",
        "t-chat",
        "interrupted",
        liveNow - 52_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 42_000).toISOString(),
          failureReason: "owner-stopped",
        }),
      );
      // 4. App/model handler execution failure & blocked result -> App spin/blocker, NOT Host defect
      ins.run(
        "alex",
        "att-model-loop",
        "t-loop",
        "failed",
        liveNow - 48_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 38_000).toISOString(),
          failureReason: "HandlerExecutionFailed",
          summary: "<end_of_image><end_of_image>",
        }),
      );
      ins.run(
        "alex",
        "att-handler-blocked",
        "t-blocked",
        "failed",
        liveNow - 46_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 36_000).toISOString(),
          failureReason: "handler-blocked",
        }),
      );

      const settlementSql = HOST_HARNESS_METRICS.find((m) => m.id === "host.settlement_integrity_ratio")!.sourceQuery!;
      const burdenSql = HOST_HARNESS_METRICS.find((m) => m.id === "host.harness_burden_ratio")!.sourceQuery!;

      // With 0 Host-owned failures: Host settlement integrity is 100% (1/1), while harness burden is 1/5 = 0.2 (the 1 restart requeue).
      expect(boundaryDb.prepare(settlementSql).get()).toMatchObject({ value: 1, sampleSize: 1 });
      expect(boundaryDb.prepare(burdenSql).get()).toMatchObject({ value: 0.2, sampleSize: 5 });

      const healthyHostSummary = readObservabilitySummary(boundaryDb, {
        query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
        projectsRoot: join(root, "projects"),
        stateDir: root,
        loadedApps: [
          { id: "alex", owner: "alex" },
          { id: "aks-rp-e2e", owner: "aks-explorer" },
          { id: "may", owner: "may" },
        ],
        now: liveNow,
      });
      expect(healthyHostSummary.host.plumbing).toMatchObject({
        terminalTaskAttemptsWindow: 5,
        hostFailedAttemptsWindow: 0,
        preemptedAttemptsWindow: 1,
        failedTaskAttemptsWindow: 2,
      });
      expect(healthyHostSummary.host.trends.settlementIntegrity).toMatchObject({ current: 1, sampleSize: 1 });
      expect(healthyHostSummary.host.trends.harnessBurdenRatio).toMatchObject({ current: 0.2, sampleSize: 5 });
      // Meanwhile, App 'alex' truthfully records its 2 failed handler attempts and 2/3 = 0.6667 spin ratio!
      const alexCard = healthyHostSummary.apps.find((a) => a.appId === "alex")!;
      expect(alexCard.blockers.failedAttemptsWindow).toBe(2);
      expect(alexCard.trends?.spinRatio).toMatchObject({ current: 0.6667, sampleSize: 3 });

      // 5. Real Host settlement failure ('HandlerResultSettlementFailed') immediately lowers Host settlement integrity to 1/2 = 0.5!
      ins.run(
        "alex",
        "att-settlement-bug",
        "t-settle-err",
        "failed",
        liveNow - 30_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 20_000).toISOString(),
          failureReason: "HandlerResultSettlementFailed",
        }),
      );
      expect(boundaryDb.prepare(settlementSql).get()).toMatchObject({ value: 0.5, sampleSize: 2 });
      expect(boundaryDb.prepare(burdenSql).get()).toMatchObject({ value: 2 / 6, sampleSize: 6 });

      const degradedHostSummary = readObservabilitySummary(boundaryDb, {
        query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
        projectsRoot: join(root, "projects"),
        stateDir: root,
        loadedApps: [
          { id: "alex", owner: "alex" },
          { id: "aks-rp-e2e", owner: "aks-explorer" },
          { id: "may", owner: "may" },
        ],
        now: liveNow,
      });
      expect(degradedHostSummary.host.plumbing).toMatchObject({
        terminalTaskAttemptsWindow: 6,
        hostFailedAttemptsWindow: 1,
        preemptedAttemptsWindow: 1,
        failedTaskAttemptsWindow: 3,
      });
      expect(degradedHostSummary.host.trends.settlementIntegrity).toMatchObject({ current: 0.5, sampleSize: 2 });
      expect(degradedHostSummary.host.trends.harnessBurdenRatio).toMatchObject({ current: 0.3333, sampleSize: 6 });

      // 6. Repaired completed attempt carrying acceptedResult + running-without-current-attempt-requeued is counted once (mutually exclusive)
      // in Host settlement integrity while preserving per-App accepted-result outcome counts, and WorkspaceFinalizationFailed counts as Host failure.
      ins.run(
        "alex",
        "att-repaired-completed",
        "t-repaired",
        "completed",
        liveNow - 25_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 15_000).toISOString(),
          acceptedResult: { state: "converged" },
          failureReason: "running-without-current-attempt-requeued",
        }),
      );
      ins.run(
        "alex",
        "att-ws-finalize-err",
        "t-ws-fin",
        "failed",
        liveNow - 22_000,
        JSON.stringify({
          finishedAt: new Date(liveNow - 12_000).toISOString(),
          failureReason: "WorkspaceFinalizationFailed",
        }),
      );
      // 1 clean settled + 3 Host failures (HandlerResultSettlementFailed + running-without-current-attempt-requeued + WorkspaceFinalizationFailed) = sampleSize 4, value 0.25!
      expect(boundaryDb.prepare(settlementSql).get()).toMatchObject({ value: 0.25, sampleSize: 4 });
      const repairedSummary = readObservabilitySummary(boundaryDb, {
        query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
        projectsRoot: join(root, "projects"),
        stateDir: root,
        loadedApps: [
          { id: "alex", owner: "alex" },
          { id: "aks-rp-e2e", owner: "aks-explorer" },
          { id: "may", owner: "may" },
        ],
        now: liveNow,
      });
      expect(repairedSummary.host.trends.settlementIntegrity).toMatchObject({ current: 0.25, sampleSize: 4 });
      // App 'alex' still counts both converged accepted results (att-settled + att-repaired-completed = 2)!
      expect(repairedSummary.apps.find((a) => a.appId === "alex")?.outcomes.convergedMilestonesWindow).toBe(2);

      // 7. Per-App failure_ratio_24h alerts on sustained App/workflow failures (>20%, consecutive=2, minSampleSize=5)
      // while staying 0% on healthy waiting/interrupted turns, excluding Host failures, and avoiding linked-workflow double counts.
      for (let i = 0; i < 5; i++) {
        ins.run(
          "aks-rp-e2e",
          `aks-wait-${i}`,
          "t-k8s",
          "completed",
          liveNow - 20_000 + i,
          JSON.stringify({
            finishedAt: new Date(liveNow - 10_000 + i).toISOString(),
            acceptedResult: { state: "waiting" },
          }),
        );
      }
      const aksFailDef = buildAppEvolutionMetrics("aks-rp-e2e", "aks-explorer").find(
        (d) => d.id === "aks-rp-e2e.failure_ratio_24h",
      )!;
      expect(aksFailDef).toMatchObject({
        owner: "aks-explorer",
        project: "aks-rp-e2e",
        threshold: 0.2,
        alertOp: ">",
      });
      // 5 waiting attempts + 1 interrupted restart requeue -> 0 failures out of 5 evaluated runs (0.0, quiet)!
      expect(boundaryDb.prepare(aksFailDef.sourceQuery!).get()).toMatchObject({ value: 0, sampleSize: 5 });

      // On 'alex': 1 clean settled + 2 App failed (att-model-loop, att-handler-blocked); Host failures (att-settlement-bug,
      // att-repaired-completed, att-ws-finalize-err) are excluded! Add 1 standalone error workflow + 1 standalone done workflow
      // + 1 linked error workflow (with attempt_id -> NOT double-counted) => (2 + 1) / (3 + 2) = 3 / 5 = 0.6!
      boundaryDb
        .prepare(
          `INSERT INTO workflow_runs(runId, workflow, task, status, app_id, attempt_id, startedAt, endedAt)
           VALUES
             ('wf-standalone-err', 'alex/audit', 'audit', 'error', 'alex', NULL, ?, ?),
             ('wf-standalone-ok', 'alex/check', 'check', 'done', 'alex', NULL, ?, ?),
             ('wf-linked-dup', 'alex/dup', 'dup', 'error', 'alex', 'att-model-loop', ?, ?)`,
        )
        .run(
          liveNow - 19_000,
          liveNow - 9_000,
          liveNow - 18_000,
          liveNow - 8_000,
          liveNow - 17_000,
          liveNow - 7_000,
        );
      const alexFailDef = buildAppEvolutionMetrics("alex", "alex").find((d) => d.id === "alex.failure_ratio_24h")!;
      const alexSample = boundaryDb.prepare(alexFailDef.sourceQuery!).get() as { value: number; sampleSize: number };
      expect(alexSample).toMatchObject({ value: 0.6, sampleSize: 5 });

      let evalClock = liveNow - 5_000;
      const evalMs = createMetricService({ getDb: () => boundaryDb, now: () => evalClock });
      evalMs.define(alexFailDef);
      evalMs.record(alexFailDef.id, alexSample.value, { sampleSize: alexSample.sampleSize, measuredAt: evalClock });
      expect(evalMs.evaluate(alexFailDef.id)[0]?.status).toBe("unknown"); // consecutive: 2 requires 2 samples
      evalClock = liveNow - 1_000;
      evalMs.record(alexFailDef.id, alexSample.value, { sampleSize: alexSample.sampleSize, measuredAt: evalClock });
      expect(evalMs.evaluate(alexFailDef.id)[0]?.status).toBe("breached");

      const withAppAlert = readObservabilitySummary(boundaryDb, {
        query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
        projectsRoot: join(root, "projects"),
        stateDir: root,
        loadedApps: [
          { id: "alex", owner: "alex" },
          { id: "aks-rp-e2e", owner: "aks-explorer" },
          { id: "may", owner: "may" },
        ],
        now: liveNow,
      });
      expect(withAppAlert.apps.find((a) => a.appId === "aks-rp-e2e")?.trends?.failureRatio).toMatchObject({
        current: 0,
        sampleSize: 5,
      });
      expect(withAppAlert.apps.find((a) => a.appId === "alex")?.trends?.failureRatio).toMatchObject({
        current: 0.6,
        sampleSize: 5,
      });
      expect(withAppAlert.alerts).toContainEqual(
        expect.objectContaining({
          metricId: "alex.failure_ratio_24h",
          scope: { kind: "app", appId: "alex" },
          declaredOwner: "alex",
          declaredHandler: "alex",
        }),
      );

      // 8. Unresolved input-admission / result / feedback recovery boundaries contribute to settlement exposure
      // both when 0 Task attempts exist (0/1 = 0, sampleSize = 1) and alongside 1 settled attempt (1/2 = 0.5, sampleSize = 2).
      const recOnlyDb = openDatabase(":memory:");
      applyDbSchema(recOnlyDb);
      try {
        recOnlyDb
          .prepare(
            `INSERT INTO app_inbox_items(id, app_id, source_kind, source_id, input_kind, input_data, status, recovery_json, created_at, updated_at)
             VALUES ('stuck-adm-1', 'alex', 'human', 'web-ui', 'message', '{}', 'pending', ?, ?, ?)`,
          )
          .run(
            JSON.stringify({ "input-admission": { failures: 2, firstFailedAt: liveNow - 10_000, error: "transient" } }),
            liveNow - 10_000,
            liveNow - 5_000,
          );
        expect(recOnlyDb.prepare(settlementSql).get()).toMatchObject({ value: 0, sampleSize: 1 });
        expect(recOnlyDb.prepare(burdenSql).get()).toMatchObject({ value: 1, sampleSize: 1 });
        const recOnlySummary = readObservabilitySummary(recOnlyDb, {
          query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
          projectsRoot: join(root, "projects"),
          stateDir: root,
          loadedApps: [{ id: "alex", owner: "alex" }],
          now: liveNow,
        });
        expect(recOnlySummary.host.trends.settlementIntegrity).toMatchObject({ current: 0, sampleSize: 1 });
        expect(recOnlySummary.host.trends.harnessBurdenRatio).toMatchObject({ current: 1, sampleSize: 1 });

        // Add 1 settled attempt -> 1 / (1 + 1) = 0.5, sampleSize = 2 across both SQL collector and summary!
        recOnlyDb
          .prepare(
            `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
             VALUES ('alex', 'att-ok-1', 't-1', 1, 'completed', ?, ?)`,
          )
          .run(
            liveNow - 8_000,
            JSON.stringify({
              finishedAt: new Date(liveNow - 4_000).toISOString(),
              acceptedResult: { state: "converged" },
            }),
          );
        expect(recOnlyDb.prepare(settlementSql).get()).toMatchObject({ value: 0.5, sampleSize: 2 });
        expect(recOnlyDb.prepare(burdenSql).get()).toMatchObject({ value: 0.5, sampleSize: 2 });
        const mixedRecSummary = readObservabilitySummary(recOnlyDb, {
          query: { start: liveNow - 86_400_000, end: liveNow, appId: null },
          projectsRoot: join(root, "projects"),
          stateDir: root,
          loadedApps: [{ id: "alex", owner: "alex" }],
          now: liveNow,
        });
        expect(mixedRecSummary.host.trends.settlementIntegrity).toMatchObject({ current: 0.5, sampleSize: 2 });
        expect(mixedRecSummary.host.trends.harnessBurdenRatio).toMatchObject({ current: 0.5, sampleSize: 2 });
      } finally {
        recOnlyDb.close();
      }
      // 7. Wave 4: Agent Live Scorecard (app-rubric-v1) + Gym pass^3 vs sub-3-trial rollups via idx_gym_comparison_attempts.
      const gymDb = openDatabase(":memory:");
      applyDbSchema(gymDb);
      try {
        gymDb
          .prepare(
            `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
             VALUES
               ('alex', 'gym-pass3', 'comparison/may-v2', 1, 'completed', ?, ?),
               ('alex', 'gym-k1', 'comparison/scout-v1', 1, 'completed', ?, ?),
               ('alex', 'gym-unaccepted', 'comparison/draft', 1, 'failed', ?, ?),
               ('alex', 'eval-may', 'review/may-1', 1, 'completed', ?, ?)`,
          )
          .run(
            liveNow - 20_000,
            JSON.stringify({
              finishedAt: new Date(liveNow - 15_000).toISOString(),
              acceptedResult: {
                state: "converged",
                facts: [
                  `gym-comparison:${JSON.stringify({
                    version: 1,
                    agent: "may",
                    candidate: "may-cand-v2",
                    benchmark: "outcome-coordination",
                    model: "gemini-4-argon",
                    trialsPerScenario: 3,
                    scenarioCount: 4,
                    passedScenariosHatK: 3,
                    baselinePassHatKRatio: 0.5,
                    candidatePassHatKRatio: 0.75,
                    trialPassRatio: 0.9167,
                    verdict: "candidate-supported",
                  })}`,
                ],
              },
            }),
            liveNow - 30_000,
            JSON.stringify({
              finishedAt: new Date(liveNow - 25_000).toISOString(),
              acceptedResult: {
                state: "converged",
                facts: [
                  `gym-comparison:${JSON.stringify({
                    version: 1,
                    agent: "scout",
                    candidate: "scout-dev",
                    benchmark: "research-evidence",
                    model: "gemini-4-argon",
                    trialsPerScenario: 1,
                    scenarioCount: 4,
                    passedScenariosHatK: 4,
                    baselinePassHatKRatio: 0.75,
                    candidatePassHatKRatio: 1,
                    trialPassRatio: 1,
                    verdict: "candidate-supported",
                  })}`,
                ],
              },
            }),
            liveNow - 10_000,
            JSON.stringify({
              finishedAt: new Date(liveNow - 5_000).toISOString(),
              unacceptedDraft: [
                `gym-comparison:${JSON.stringify({
                  version: 1,
                  agent: "bob",
                  trialsPerScenario: 3,
                  scenarioCount: 4,
                  candidatePassHatKRatio: 1,
                })}`,
              ],
            }),
            liveNow - 12_000,
            JSON.stringify({
              finishedAt: new Date(liveNow - 8_000).toISOString(),
              acceptedResult: {
                state: "converged",
                facts: [
                  `scorecard:${JSON.stringify({
                    version: 1,
                    targetKind: "app",
                    appId: "may",
                    taskId: "input/req-1",
                    agent: "may",
                    cohort: "req-1@g1",
                    rubricVersion: "app-rubric-v1",
                    dimensions: {
                      outcomeValue: 4,
                      correctnessAndEvidence: 4,
                      autonomyAndRecovery: 3,
                      efficiency: 4,
                      humanCoordination: 4,
                    },
                  })}`,
                ],
              },
            }),
          );
        const gymPlan = (
          gymDb
            .prepare(
              `EXPLAIN QUERY PLAN SELECT attempt_id FROM app_task_attempts WHERE instr(attempt_json, 'gym-comparison:') > 0 AND COALESCE(CAST(unixepoch(json_extract(attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER), started_at) >= 0`,
            )
            .all() as Array<{ detail: string }>
        )
          .map((p) => p.detail)
          .join(" | ");
        expect(gymPlan).toContain("idx_gym_comparison_attempts");

        const agentCaps = readAgentCapabilityRollups(gymDb, liveNow);
        const mayCap = agentCaps("may");
        expect(mayCap.scorecard7d).toMatchObject({ status: "scored", sampleSize: 1, gated: false });
        expect(mayCap.gym).toMatchObject({
          status: "pass_hat_3",
          benchmark: "outcome-coordination",
          trialsPerScenario: 3,
          scenarioCount: 4,
          passedScenariosHatK: 3,
          passHat3Ratio: 0.75,
          passHatKRatio: 0.75,
          verdict: "candidate-supported",
        });
        const scoutCap = agentCaps("scout");
        expect(scoutCap.gym).toMatchObject({
          status: "sub_3_trials",
          trialsPerScenario: 1,
          passHat3Ratio: null,
          passHatKRatio: 1,
          trialPassRatio: 1,
        });
        expect(agentCaps("bob").gym).toMatchObject({ status: "not_run", passHat3Ratio: null });
      } finally {
        gymDb.close();
      }
    } finally {
      boundaryDb.close();
    }
  });
});
