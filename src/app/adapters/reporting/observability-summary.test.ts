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
  resolveAppCatalog,
} from "./observability-summary.js";
import { readMetricObservations } from "./metric-observations.js";
import { STALE_ACTIVE_SOURCE_QUERY } from "../../metric-source-measurement.js";
import { HOST_HARNESS_METRICS, buildAppEvolutionMetrics } from "./evolution-metrics.js";

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
    for (const [appId, agent] of [
      ["may", "may"],
      ["alex", "alex"],
      ["aks-rp-e2e", "aks-explorer"],
      ["scout-knowledge-lib", "scout"],
    ] as const) {
      const dir = join(projectsRoot, `${appId}.app`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(dir + "/app.ts", `export default { id: "${appId}", agent: "${agent}" };\n`);
    }
  });

  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("classifies metrics from declarations and catalog without Host hardcoding", () => {
    const catalog = resolveAppCatalog({ projectsRoot });
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
    // Disabled App on disk with retained active DB Task rows is excluded from active cards (R-10),
    // and nested subscription/task `id:` literals before `defineApp({...})` never masquerade as App IDs.
    writeFileSync(
      join(projectsRoot, "may.app", "app.ts"),
      `const sub = { id: "evaluation-intake", agent: "sub-agent" };\nexport default defineApp({ subscriptions: [sub], id: "may", agent: "may" });\n`,
    );
    expect(resolveAppCatalog({ projectsRoot }).installedIds).toEqual([
      "aks-rp-e2e",
      "alex",
      "may",
      "scout-knowledge-lib",
    ]);
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
    const catalog = resolveAppCatalog({ projectsRoot, loadedApps });
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
       VALUES ('wf-only', 'att-wf-1', 'hygiene', 1, 'completed', ?, '{"owner":"wf-agent","handler":"workflow:hygiene"}')`,
    ).run(now - 50_000);
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
});
