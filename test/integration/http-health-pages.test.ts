import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer, { type HTTPRequest } from "puppeteer-core";
import { getDb, closeDb } from "../../src/lib/db/connection.js";
import { insertWorkflowRun } from "../../src/lib/db/workflows.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
import { createWorkflowDiagnostics } from "../../src/lib/workflow-diagnostics.js";
import { createMetricService } from "../../src/lib/metrics.js";
import { saveExecutionUsage } from "../../src/lib/db/execution-usage.js";
import { createExecutionUsage } from "@may-agent/sdk/runtime";
import { preparationFixture, observeReply, usageReply } from "../fixtures/execution-usage.js";

const chrome = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((path) => path && existsSync(path));
const skipBrowser = process.env.E2E_NO_UI === "1" || !chrome;
if (process.env.CI && skipBrowser) throw new Error("Health page browser coverage requires Chrome and E2E_NO_UI unset");
if (skipBrowser) console.warn("Health page browser test skipped: Chrome unavailable or E2E_NO_UI=1");

describe("served workflow and metric health pages", () => {
  let root: string;
  let child: ChildProcess;
  let stopped: Promise<void>;
  let base: string;
  let now: number;
  const markup = '<img src=x onerror="window.healthInjected=true">';

  test("public attempt reports count retained failures and follow exact execution identity", async () => {
    getDb(root).prepare(`INSERT INTO app_task_attempts
      (app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
      VALUES ('research', 'failed-attempt', 'report', 1, 'failed', ?, ?)`).run(now - 500,
      JSON.stringify({ handler: "executor:conversation", startedAt: new Date(now - 500).toISOString(),
        finishedAt: new Date(now - 100).toISOString(), sessionId: "step-upload", failureReason: "SettlementFailed" }));
    getDb(root).prepare(`UPDATE sessions SET status = 'done', error = NULL WHERE sessionId = 'step-upload'`).run();
    for (const retired of ["/api/agents/health", "/api/agents/activity", "/api/agents/timeline", "/api/stats", "/api/agents/worker/detail"]) {
      expect((await fetch(`${base}${retired}`)).status).toBe(404);
    }
    // Model completion can coexist with rejected Task settlement.
    const response = await fetch(`${base}/api/task-attempts?appId=research&end=${now}&windowMs=1000`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: true, current: { totals: { terminal: 1, failed: 1, failurePercent: 100 } } });
    const exact = await fetch(`${base}/api/task-attempts?appId=research&taskId=report&attemptId=failed-attempt`);
    expect(exact.status).toBe(200);
    expect(await exact.json()).toMatchObject({ available: true, attemptId: "failed-attempt", sessionId: "step-upload" });
    expect((await fetch(`${base}/api/task-attempts?end=${now}`)).status).toBe(400);
  });

  beforeEach(async () => {
    now = Date.now() - 1000;
    root = mkdtempSync(join(tmpdir(), "may-http-health-"));
    const projects = join(root, "projects");
    cpSync(resolve(import.meta.dir, "../../packages/webui/static"), join(projects, "platform", "ui"), {
      recursive: true,
    });
    const db = getDb(root);
    for (const preparer of ["full", `brief.ts ${markup}`]) {
      const usage = createExecutionUsage({ ...preparationFixture, preparer,
        entryHash: preparer === "full" ? null : "synthetic-entry-hash" });
      observeReply(usage, usageReply());
      saveExecutionUsage(db, { id: preparer, sessionId: "step-upload", appId: "research", agent: "worker",
        workflowRunId: "wr_7", configuredModel: "fixture/model-a", startedAt: now - 10000 }, usage.snapshot(), "done", now - 9000);
    }
    ["done", "done", "done", "done", "done", "done", "error", "error", "blocked", "interrupted", "error"].forEach(
      (status, i) => {
        insertWorkflowRun(root, {
          runId: `wr_${i}`,
          workflow: "report",
          task: `Prepare a synthetic report ${markup}`,
          status,
          startedAt: now - 15000,
          endedAt: now - 1000 + i,
          depth: i === 10 ? 2 : 1,
          parentSessionId: null,
          parentWorkflowRunId: i === 10 ? "wr_7" : null,
          result_reason: status === "error" ? `Upload rejected\n${markup}` : null,
          result_summary: status === "done" ? "Report prepared" : null,
          resumedFromRunId: null,
          sourcePath: "agents/worker/workflows/report.ts",
          sourceScope: "agent",
          entryContentHash: "synthetic-source-hash",
        });
      },
    );
    createWorkflowDiagnostics(root, "wr_7")("error", `Original upload failure: ${markup}`);
    db.prepare(
      `INSERT INTO sessions(sessionId, agent, task, status, workflowRunId, stepLabel, startedAt, endedAt, error)
      VALUES ('step-upload', 'worker', 'Upload the report', 'error', 'wr_7', 'upload', ?, ?, ?)`,
    ).run(now - 1200, now - 1000, `Upload failed: ${markup}`);
    const metrics = createMetricService({ getDb: () => db });
    metrics.define({
      id: "workflow.error-count-24h",
      name: `Errors " ${markup}`,
      type: "gauge",
      measureInterval: 300000,
      unit: "runs",
      description: "Retained top-level errors in a rolling 24-hour window",
      threshold: 1,
      alertOp: ">",
    });
    const times = [now - 3600000, now - 3300000, now - 900000];
    for (const [i, at] of times.entries())
      metrics.record("workflow.error-count-24h", i + 1, { measuredAt: at, sampleSize: 10, note: markup });
    // A late arrival must not become the current observation.
    metrics.record("workflow.error-count-24h", 999, { measuredAt: now - 7200000 });
    metrics.define({
      id: "runtime.daemon-heartbeat-stale",
      name: "Unmeasured Host observation",
      measureInterval: 300000,
    });
    db.prepare(
      `INSERT INTO events(event_type, source, owner, metric_id, timestamp, data) VALUES ('metric.measurement.failed', 'test', 'test', 'workflow.error-count-24h', ?, ?)`,
    ).run(
      now - 600000,
      JSON.stringify({ metricId: "workflow.error-count-24h", reason: `source unavailable ${markup}` }),
    );

    child = spawnFixtureProcess(
      [resolve(import.meta.dir, "../fixtures/http-server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        env: {
          ...process.env,
          PROJECT_ROOT: root,
          PROJECTS_ROOT: projects,
          AGENTS_ROOT: join(root, "agents"),
          SHARED_ROOT: join(root, "shared"),
          DAEMON_INSTANCE: "health-test",
          DAEMON_AGENT: "may",
        },
      },
    );
    stopped = new Promise((done) => child.once("close", () => done()));
    let logs = "";
    let timer: ReturnType<typeof setTimeout>;
    try {
      base = await new Promise<string>((ready, reject) => {
        timer = setTimeout(() => reject(new Error(`HTTP startup timeout: ${logs}`)), 10000);
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`HTTP exited (${code}): ${logs}`)));
        child.stderr!.on("data", (chunk) => {
          logs += String(chunk);
        });
        child.stdout!.on("data", (chunk) => {
          logs += String(chunk);
          const port = logs.match(/url:\s+http:\/\/localhost:(\d+)/)?.[1];
          if (port) ready(`http://127.0.0.1:${port}`);
        });
      });
    } finally {
      clearTimeout(timer!);
    }
  });

  afterEach(async () => {
    child?.kill("SIGKILL");
    await stopped;
    if (root) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("HTTP reads real retained outcomes, current samples, bounded history and error facts without a daemon", async () => {
    async function read(path: string, status = 200) {
      const res = await fetch(base + path, { signal: AbortSignal.timeout(5000) });
      expect(res.status).toBe(status);
      return res.json();
    }
    const report = await read("/api/workflow-health?runs=true&outcome=error");
    expect(report.totals).toMatchObject({
      finished: 10,
      done: 6,
      error: 2,
      blocked: 1,
      interrupted: 1,
      successRate: 0.6,
    });
    expect(report.runs.map((r: { runId: string }) => r.runId)).toEqual(["wr_7", "wr_6"]);
    const data = await read("/api/metrics");
    const usage = await read("/api/context-usage");
    expect(usage.invocations).toBe(2);
    expect(usage.groups[0]).toMatchObject({ meanInput: 10, meanCacheRead: 100, meanCacheWrite: 20, meanOutput: 5 });
    expect((await read("/api/context-usage?preparer=full")).invocations).toBe(1);
    expect((await read("/api/context-usage?agent=missing")).groups).toEqual([]);
    await read("/api/context-usage?days=91", 400);
    expect(data.metrics.find((m: { id: string }) => m.id === "workflow.error-count-24h")).toMatchObject({
      current: 3,
      freshness: "stale",
      collectionFailure: { afterLastSample: true },
    });
    expect(data.metrics.find((m: { id: string }) => m.id === "runtime.daemon-heartbeat-stale")).toMatchObject({
      current: null,
      freshness: "missing",
      updated_at: null,
    });
    const live = await read("/api/liveness");
    expect(live.summary).toMatchObject({ openAlerts: 0, openAlertsTruncated: false });
    const history = await read("/api/metrics/workflow.error-count-24h/history?days=14");
    expect(history.snapshots).toHaveLength(4);
    expect(history.failures).toHaveLength(1);
    const metricEvidence = await read("/api/metrics/workflow.error-count-24h/evidence");
    expect(metricEvidence).toMatchObject({ available: true, metricId: "workflow.error-count-24h", freshness: "stale", latest: { value: 3 } });
    expect(metricEvidence.collectionFailures).toHaveLength(1);
    const db = getDb(root);
    db.prepare(
      "INSERT INTO metric_alerts(id, metric_id, alert_type, message, created_at) VALUES (42, 'workflow.error-count-24h', 'threshold', 'Repeated failures', ?)",
    ).run(now - 100);
    // Historical rows remain readable even though this type has no current producer.
    const legacyJudgment = (alertId: number | null, timestamp: number, verdict: string) => Number(db.prepare(
      `INSERT INTO events(event_type, source, owner, metric_id, alert_id, timestamp, data)
       VALUES ('metric.alert_judged', 'fixture', 'app:legacy', 'workflow.error-count-24h', ?, ?, ?)`,
    ).run(alertId === null ? null : String(alertId), timestamp, JSON.stringify({ verdict })).lastInsertRowid);
    legacyJudgment(42, now - 101, "before-alert");
    legacyJudgment(43, now, "different-alert");
    expect((await read("/api/metrics")).alerts.find((alert: { alertId: number }) => alert.alertId === 42)?.latestJudgment)
      .toBeNull();
    const fallbackId = legacyJudgment(null, now - 99, "historical-metric-fallback");
    let historicalAlerts = await read("/api/metrics");
    expect(historicalAlerts.alerts.find((alert: { alertId: number }) => alert.alertId === 42)?.latestJudgment).toEqual({
      eventId: fallbackId, owner: "app:legacy", timestamp: now - 99, verdict: "historical-metric-fallback",
    });
    legacyJudgment(42, now - 95, "superseded");
    const latestId = legacyJudgment(42, now - 95, "latest-exact-alert");
    const expectedHistorical = { eventId: latestId, owner: "app:legacy", timestamp: now - 95, verdict: "latest-exact-alert" };
    historicalAlerts = await read("/api/metrics");
    expect(historicalAlerts.alerts.find((alert: { alertId: number }) => alert.alertId === 42)?.latestJudgment)
      .toEqual(expectedHistorical);
    expect(historicalAlerts.metrics.find((metric: { id: string }) => metric.id === "workflow.error-count-24h")?.latestJudgment)
      .toEqual(expectedHistorical);
    expect((await read("/api/liveness")).alerts.find((alert: { alertId: number }) => alert.alertId === 42)?.latestJudgment)
      .toEqual(expectedHistorical);
    const decision = {
      version: 1,
      metricId: "workflow.error-count-24h",
      alertId: 42,
      disposition: "investigate",
      reason: "Repeated admission failure",
      evidence: ["input:example"],
      linkedTask: { appId: "platform", taskId: "repair/admission" },
    };
    db.prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
      VALUES ('platform', 'accepted-decision', 'owner-review', 1, 'completed', ?, ?)`,
    ).run(
      now - 90,
      JSON.stringify({
        finishedAt: new Date(now - 80).toISOString(),
        acceptedResult: { state: "waiting", facts: [`metric-disposition:${JSON.stringify(decision)}`] },
      }),
    );
    const breach = await read("/api/metrics/workflow.error-count-24h/evidence?alertId=42");
    expect(breach.dispositions[0]).toMatchObject({ appId: "platform", taskId: "owner-review", decision });
    legacyJudgment(42, now + 1, "newer-legacy-row-cannot-replace-accepted-disposition");
    const alerts = await read("/api/metrics");
    expect(alerts.alerts.find((alert: { alertId: number }) => alert.alertId === 42)?.latestJudgment).toMatchObject({
      disposition: "investigate",
      linkedTask: decision.linkedTask,
      source: {
        kind: "accepted-task-result",
        appId: "platform",
        taskId: "owner-review",
        attemptId: "accepted-decision",
      },
    });
    expect((await read("/api/metrics/missing/evidence")).available).toBe(false);
    await read("/api/metrics/example/evidence?windowMs=0", 400);
    const mutation = await fetch(base + "/api/metrics/example/evidence", { method: "POST", signal: AbortSignal.timeout(5000) });
    expect(mutation.status).toBe(405);
    const facts = (await read("/api/workflow-runs/wr_7")).workflowFacts;
    expect(facts.childRunIds).toEqual(["wr_10"]);
    expect(facts.steps[0]).toMatchObject({ sessionId: "step-upload", status: "error" });
    expect(facts.diagnostics.entries[0].message).toContain("Original upload failure");
    expect((await read("/api/workflow-runs/wr_6")).workflowFacts.diagnostics.state).toBe("unavailable");
    await read("/api/workflow-health?days=100000", 400);
    await read("/api/metrics/example/history?days=NaN", 400);
  });

  test("steering rejects invalid and missing targets without touching installed state", async () => {
    for (const [path, body, status] of [

      ["/api/alerts/0/resolve", { reason: "fixture" }, 404],
      ["/api/alerts/notanumber/resolve", { reason: "fixture" }, 400],
    ] as const) {
      const response = await fetch(base + path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
      });
      expect(response.status).toBe(status);
      expect((await response.json()).error).toBeTruthy();
    }
    const liveness = await fetch(base + "/api/liveness", { signal: AbortSignal.timeout(5000) });
    expect(liveness.status).toBe(200);
    expect(Array.isArray((await liveness.json()).alerts)).toBe(true);
  });

  test("alert list limits do not claim an unlisted metric has no alert or hide its exact detail", async () => {
    const db = getDb(root);
    const insert = db.prepare("INSERT INTO metric_alerts(metric_id, message, created_at) VALUES (?, ?, ?)");
    const target = "runtime.daemon-heartbeat-stale";
    async function liveAlerts(count: number, truncated: boolean) {
      const response = await fetch(base + "/api/liveness", { signal: AbortSignal.timeout(5000) });
      expect(response.status).toBe(200);
      const live = await response.json();
      expect(live.summary).toMatchObject({ openAlerts: count, openAlertsTruncated: truncated });
      expect(live.alerts).toHaveLength(count);
      return live;
    }
    try {
      await liveAlerts(0, false);
      insert.run("workflow.error-count-24h", "synthetic oldest alert", now - 3000);
      insert.run(target, "synthetic latest alert", now - 2000);
      stateTransaction(db, () => {
        for (let i = 0; i < 18; i++) {
          db.run("INSERT INTO metrics (id, status, owner) VALUES (?, 'active', 'zz-fixture')", [`sample.flood-${i}`]);
          insert.run(`sample.flood-${i}`, "synthetic alert flood", now - 1000 + i);
        }
      });
      await liveAlerts(20, false);
      db.run("INSERT INTO metrics (id, status, owner) VALUES (?, 'active', 'zz-fixture')", ["sample.flood-18"]);
      insert.run("sample.flood-18", "synthetic alert flood", now - 1000 + 18);
      await liveAlerts(20, true);
      stateTransaction(db, () => {
        for (let i = 19; i < 501; i++) {
          db.run("INSERT INTO metrics (id, status, owner) VALUES (?, 'active', 'zz-fixture')", [`sample.flood-${i}`]);
          insert.run(`sample.flood-${i}`, "synthetic alert flood", now - 1000 + i);
        }
      });
      const cappedLive = await liveAlerts(20, true);
      expect(cappedLive.alerts).toHaveLength(20);
      const listResponse = await fetch(base + "/api/metrics", { signal: AbortSignal.timeout(5000) });
      expect(listResponse.status).toBe(200);
      const list = await listResponse.json();
      expect(list.alertsTruncated).toBe(true);
      expect(list.metrics.find((m: { id: string }) => m.id === target).alertOpen).toBeNull();
      const detailResponse = await fetch(base + "/api/metrics?id=" + target, { signal: AbortSignal.timeout(5000) });
      expect(detailResponse.status).toBe(200);
      const detail = await detailResponse.json();
      expect(detail.metrics[0]).toMatchObject({ alertOpen: true, alertMessage: "synthetic latest alert" });
      expect(detail.alertsTruncated).toBe(false);
      expect(detail.alerts).toHaveLength(1);

      stateTransaction(db, () => {
        db.run("INSERT INTO sessions(sessionId, agent, task, status, startedAt) VALUES ('early-agent', 'quiet-agent', 'Work', 'done', ?)", [now - 2_000]);
        for (let i = 0; i < 2_001; i++) {
          db.run("INSERT INTO sessions(sessionId, agent, task, status, startedAt) VALUES (?, 'busy-agent', 'Flood', 'done', ?)", [`flood-${i}`, now - 1_000 + i]);
        }
      });
      const floodedLive = await (await fetch(base + "/api/liveness", { signal: AbortSignal.timeout(5000) })).json();
      expect(floodedLive.summary.activityRowsTruncated).toBe(true);
      const quietRow = floodedLive.agents.find((a: { name: string }) => a.name === "quiet-agent");
      expect(quietRow).toMatchObject({ sessionCount: 1, lastSessionAt: now - 2_000, lastStatus: "done" });
    } finally {
      db.prepare("DELETE FROM sessions WHERE sessionId = 'early-agent' OR sessionId LIKE 'flood-%'").run();
      db.prepare("DELETE FROM metric_alerts WHERE message IN ('synthetic oldest alert', 'synthetic latest alert', 'synthetic alert flood')").run();
    }
  });

  test.skipIf(skipBrowser)(
    "agent and project health stay incomplete when metric definitions exceed the global cap",
    async () => {
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      const db = getDb(root);
      const metrics = createMetricService({ getDb: () => db });
      const project = join(root, "projects", "cap-fixture");
      const visible = { id: "metric-cap.visible", owner: "aa-cap-visible", threshold: 1, alertOp: ">" as const };
      const hidden = { id: "metric-cap.hidden", owner: "zz-cap-hidden", project: "cap-fixture", threshold: 1, alertOp: ">" as const };
      const ids = [visible.id, hidden.id];
      try {
        mkdirSync(project, { recursive: true });
        writeFileSync(join(project, "project.md"), "---\nid: cap-fixture\nowner: zz-cap-hidden\nstatus: active\n---\n# Synthetic cap fixture\n");
        metrics.define(visible);
        metrics.record(visible.id, 0);
        const existing = (db.prepare("SELECT COUNT(*) AS count FROM metrics WHERE status = 'active'").get() as { count: number }).count;
        stateTransaction(db, () => {
          for (let i = existing; i < 500; i++) {
            const id = `metric-cap.fill.${i}`;
            ids.push(id);
            metrics.define({ id, owner: "cap-filler" });
          }
        });
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", (request) => void (request.url().startsWith(base) ? request.continue() : request.abort()));
        async function readSurfaces(owner: string) {
          await page.goto(base, { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#liveness-projects .project-health-item");
          const projectText = await page.$eval("#liveness-projects", (el) => el.textContent || "");
          await page.goto(base + "/agents/" + owner, { waitUntil: "domcontentloaded" });
          const overview = `#agents-content button[onclick="switchAgentSubTab('overview')"]`;
          await page.waitForSelector(overview);
          await page.click(overview);
          await page.waitForSelector("#agent-subtab-body h3");
          return { projectText, agentText: await page.$eval("#agent-subtab-body", (el) => el.textContent || "") };
        }
        async function readMetrics(query = "") {
          const response = await fetch(base + "/api/metrics" + query, { signal: AbortSignal.timeout(5000) });
          expect(response.status).toBe(200);
          return response.json();
        }
        async function failureSummary() {
          await page.goto(base + "/metrics", { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#metrics-alerts p");
          return page.$eval("#metrics-alerts p", (el) => el.textContent || "");
        }
        // Recover the seeded failure so an omitted failure would look like zero.
        metrics.record("workflow.error-count-24h", 0, { measuredAt: now });
        // Exactly 500 is complete; an empty owner/project can still be reported honestly.
        const complete = await readMetrics();
        expect(complete.metrics).toHaveLength(500);
        expect(complete.truncated).toBe(false);
        const empty = await readSurfaces(hidden.owner);
        expect(empty.agentText).toContain("No metrics owned.");
        expect(empty.projectText).toContain("no project metrics");
        expect(empty.agentText + empty.projectText).not.toContain("Partial metric data");
        expect(await failureSummary()).toContain("0 measurements with a failure after the last sample.");

        metrics.define(hidden);
        metrics.record(hidden.id, 2, { measuredAt: now - 1 });
        const failure = db.prepare(`INSERT INTO events(event_type, source, metric_id, timestamp, data)
          VALUES ('metric.measurement.failed', 'test', ?, ?, ?)`);
        failure.run(hidden.id, now, JSON.stringify({ metricId: hidden.id, reason: "Synthetic omitted failure" }));
        const capped = await readMetrics();
        expect(capped.metrics).toHaveLength(500);
        expect(capped.truncated).toBe(true);
        expect(capped.metrics.some((metric: { id: string }) => metric.id === hidden.id)).toBe(false);
        expect((await readMetrics("?id=" + hidden.id)).metrics[0]).toMatchObject({
          id: hidden.id, thresholdBreached: true, collectionFailure: { afterLastSample: true },
        });
        expect(await failureSummary()).toContain("0 measurements with a failure after the last sample among 500 shown definitions (partial list).");
        failure.run(visible.id, Date.now(), JSON.stringify({ metricId: visible.id, reason: "Synthetic visible failure" }));
        expect(await failureSummary()).toContain("1 measurements with a failure after the last sample among 500 shown definitions (partial list).");
        for (const [owner, visibleValue] of [[hidden.owner, null], [visible.owner, 0], [visible.owner, 2]] as const) {
          if (visibleValue !== null) {
            metrics.define({ ...visible, project: "cap-fixture" });
            metrics.record(visible.id, visibleValue);
          }
          const { projectText, agentText } = await readSurfaces(owner);
          for (const text of [projectText, agentText]) {
            expect(text).toContain("Partial metric data");
            expect(text).not.toContain("No metrics owned.");
            expect(text).not.toContain("no project metrics");
            expect(text).not.toContain("No registered project metrics yet.");
            expect(text).not.toContain("no threshold breaches");
          }
          expect(agentText).toContain(`${visibleValue === null ? 0 : 1} shown`);
          if (visibleValue === 2) {
            expect(projectText).toContain("1 alert shown");
            expect(agentText).toContain("1 breached shown");
          }
        }
      } finally {
        stateTransaction(db, () => {
          for (const id of ids) {
            db.prepare("DELETE FROM metric_snapshots WHERE metric_id = ?").run(id);
            db.prepare("DELETE FROM metrics WHERE id = ?").run(id);
          }
        });
        rmSync(project, { recursive: true, force: true });
        await browser.close();
      }
    }, 30000,
  );

  test.skipIf(skipBrowser)(
    "disabled rules suppress only derived warnings, not retained alerts, across HTTP and project cards",
    async () => {
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      const db = getDb(root);
      const metrics = createMetricService({ getDb: () => db });
      const id = "session.error-rate-6h";
      const project = join(root, "projects", "policy-fixture");
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, "project.md"), "---\nid: policy-fixture\nowner: worker\nstatus: active\n---\n# Synthetic policy fixture\n");
      const definition = { id, owner: "worker", project: "policy-fixture", threshold: 5, alertOp: ">" as const, measureInterval: 300000 };
      try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", (request) => void (request.url().startsWith(base) ? request.continue() : request.abort()));
        for (const [disabled, retained, value] of [
          [false, false, 7], [false, false, 1], [true, false, 7],
          [true, true, 7], [true, true, 1], [false, true, 1],
        ] as const) {
          db.prepare("DELETE FROM metric_alerts WHERE metric_id = ?").run(id);
          metrics.define(definition);
          metrics.record(id, value);
          if (retained) {
            db.prepare("INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, 'manual', 'Existing alert still needs resolution', ?)").run(id, now);
          }
          // Changing policy must not resolve the existing alert as a side effect.
          metrics.define({ ...definition, config: { alert: { disabled } } });
          const response = await fetch(base + "/api/metrics?id=" + id, { signal: AbortSignal.timeout(5000) });
          expect(response.status).toBe(200);
          const metric = (await response.json()).metrics.find((m: { id: string }) => m.id === id);
          expect(metric).toMatchObject({ alertsDisabled: disabled, alertOpen: retained,
            thresholdBreached: value > 5 });
          const expectedWarning = retained || (!disabled && value > 5);
          await page.goto(base, { waitUntil: "domcontentloaded" });
          const projectChip = `.project-metric-chip[title^="${id}"]`;
          // Reconnect may refresh this panel between browser calls. Capture one
          // rendered snapshot instead of crossing separate redraws with $eval.
          const health = await page.waitForFunction((chipSelector) => {
            const chip = document.querySelector(chipSelector);
            const projects = document.querySelector("#liveness-projects");
            if (!chip || !projects) return null;
            return { chip: chip.classList.contains("alerting"),
              project: !!projects.querySelector(".project-health-alert") };
          }, {}, projectChip);
          expect(await health.jsonValue()).toEqual({ chip: expectedWarning, project: expectedWarning });
          await health.dispose();
          if (disabled) {
            await page.goto(base + "/metrics/" + id, { waitUntil: "domcontentloaded" });
            await page.waitForSelector("#metrics-recent h2");
            const detail = await page.$eval("#metrics-recent", (el) => el.textContent || "");
            expect(detail).toContain("Alerts disabled");
            expect(detail.includes("Open alert:")).toBe(retained);
          }
        }
      } finally {
        for (const table of ["metric_alerts", "metric_snapshots"]) db.prepare(`DELETE FROM ${table} WHERE metric_id = ?`).run(id);
        db.prepare("DELETE FROM metrics WHERE id = ?").run(id);
        rmSync(project, { recursive: true, force: true });
        await browser.close();
      }
    }, 30000,
  );

  test.skipIf(skipBrowser)(
    "Overview and Agents open the routed session inspector and its agent link survives dashboard retirement",
    async () => {
      const db = getDb(root);
      db.prepare(`INSERT INTO sessions(sessionId, agent, task, status, startedAt, endedAt)
        VALUES ('retained-parent', 'worker', 'Prepare report', 'done', ?, ?)`)
        .run(now - 2000, now - 1500);
      db.prepare("UPDATE sessions SET parentSessionId = 'retained-parent' WHERE sessionId = 'step-upload'").run();
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        const requests: string[] = [];
        page.on("pageerror", error => errors.push(String(error)));
        await page.setRequestInterception(true);
        page.on("request", request => {
          if (!request.url().startsWith(base)) return void request.abort();
          requests.push(new URL(request.url()).pathname);
          void request.continue();
        });
        await page.goto(base, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#workflow-overview [data-workflow-outcomes]");
        await page.waitForSelector("#liveness-panel .heartbeat-dot.error");
        expect(await page.$("#legacy-dashboard")).toBeNull();
        await page.click("#liveness-panel .heartbeat-dot.error");
        await page.waitForSelector("#session-detail-panel .session-inspector");
        expect(new URL(page.url()).pathname).toBe("/sessions/step-upload");
        expect(await page.evaluate("currentInspectedSession")).toBe("step-upload");
        expect(await page.$eval("#chat", el => el.classList.contains("hidden"))).toBe(true);
        expect(await page.$("#session-followup-anchor")).toBeNull();
        await page.click('#session-detail-panel .meta-grid a[href="/sessions/retained-parent"]');
        await page.waitForFunction(() => document.querySelector("#session-detail-panel h3")?.textContent === "retained-parent");
        expect(new URL(page.url()).pathname).toBe("/sessions/retained-parent");
        expect(await page.evaluate("currentInspectedSession")).toBe("retained-parent");
        expect(await page.$("#session-followup-anchor")).toBeNull();
        await page.click('#session-detail-panel a[href="/agents/worker"]');
        await page.waitForSelector("#agents-content #agent-subtab-body");
        expect(new URL(page.url()).pathname).toBe("/agents/worker");
        expect(await page.$eval("#chat", el => el.classList.contains("hidden"))).toBe(true);
        await page.click('#agents-content button[onclick="switchAgentSubTab(\'overview\')"]');
        await page.waitForSelector('#agent-subtab-body [onclick*="step-upload"]');
        await page.click('#agent-subtab-body [onclick*="step-upload"]');
        await page.waitForFunction(() => document.querySelector("#session-detail-panel h3")?.textContent === "step-upload");
        expect(new URL(page.url()).pathname).toBe("/sessions/step-upload");
        expect(await page.evaluate("currentInspectedSession")).toBe("step-upload");
        expect(await page.$("#session-followup-anchor")).toBeNull();
        await page.evaluate("loadSessionDetail('step-upload')");
        expect(await page.$("#session-followup-anchor")).toBeNull();
        await page.goBack();
        await page.waitForSelector('#agent-subtab-body [onclick*="step-upload"]');
        expect(new URL(page.url()).pathname).toBe("/agents/worker");
        expect(requests.filter(path => ["/api/agents/health", "/api/agents/activity", "/api/agents/timeline", "/api/stats", "/api/agents/worker/detail"].includes(path))).toEqual([]);
        expect(errors).toEqual([]);
      } finally { await browser.close(); }
    }, 30000,
  );

  test.skipIf(skipBrowser)("an inspector background read keeps its content visible until replacement", async () => {
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      await page.goto(base + "/sessions/step-upload", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#session-detail-panel .session-inspector");
      await page.evaluate("sessionDetailRead?.promise");
      getDb(root).prepare("UPDATE sessions SET outcome=? WHERE sessionId=?").run("Obsolete buffered outcome", "step-upload");
      const staleSnapshot = await (await fetch(base + "/api/sessions/step-upload")).json();
      await page.evaluate(() => {
        const snapshots: string[] = [];
        (window as unknown as { inspectorSnapshots: string[] }).inspectorSnapshots = snapshots;
        const panel = document.getElementById("session-detail-panel")!;
        new MutationObserver(() => snapshots.push(panel.textContent || "")).observe(panel, { childList: true });
      });
      let capture: ((request: HTTPRequest) => void) | null = null;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
      let rejectTranscript = false;
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (rejectTranscript && new URL(request.url()).pathname === "/api/sessions/step-upload/transcript") {
          void request.respond({ status: 500, contentType: "application/json", body: '{"error":"Fixture transcript unavailable"}' });
        } else if (capture && new URL(request.url()).pathname === "/api/sessions/step-upload") {
          capture(request); capture = null;
        } else void request.continue();
      });
      const pending = page.evaluate("loadSessionDetail('step-upload')");
      void pending.catch(() => {}); // Teardown may close the page after a failed assertion.
      const held = await intercepted;
      expect(await page.$eval("#session-detail-panel h3", el => el.textContent)).toBe("step-upload");
      expect(await page.$("#session-followup-anchor")).toBeNull();
      getDb(root).prepare("UPDATE sessions SET outcome=? WHERE sessionId=?").run("Newest saved outcome", "step-upload");
      await page.evaluate("void loadSessionDetail('step-upload')");
      await held.respond({ status: 200, contentType: "application/json", body: JSON.stringify(staleSnapshot) });
      await pending;
      expect(await page.$("#session-followup-anchor")).toBeNull();
      expect(await page.$eval("#session-detail-panel", el => el.textContent)).toContain("Newest saved outcome");
      expect(await page.evaluate("window.inspectorSnapshots.join('\\n')")).not.toContain("Obsolete buffered outcome");
      rejectTranscript = true;
      await page.evaluate("loadSessionDetail('step-upload')");
      expect(await page.$eval("#session-detail-panel h3", el => el.textContent)).toBe("step-upload");
      expect(await page.$("#session-followup-anchor")).toBeNull();
      expect(await page.$eval("[data-session-read-error]", el => el.textContent)).toContain("Fixture transcript unavailable");
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser)(
    "late diagnostic wakes cannot reopen a session after navigation",
    async () => {
      getDb(root).prepare(`INSERT INTO sessions(sessionId, agent, task, status, startedAt, endedAt)
        VALUES ('other-session', 'worker', 'Another report', 'done', ?, ?)`)
        .run(now - 2000, now - 1500);
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", request => { if (!request.url().startsWith(base)) void request.abort(); else void request.continue(); });
        for (const route of ["/", "/metrics", "/agents", "/sessions/other-session"]) {
          await page.goto(base + "/sessions/step-upload", { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#session-detail-panel .session-inspector");
          await page.evaluate("sessionDetailRead?.promise");
          const result = await page.evaluate(async route => {
            const ui = window as unknown as { routeTo(route: string): void; loadSessionDetail(id: string): Promise<void> };
            ui.routeTo(route);
            await ui.loadSessionDetail("step-upload");
            return location.pathname;
          }, route);
          expect(result).toBe(route);
        }
        await page.goto(base + "/sessions/step-upload", { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#session-detail-panel .session-inspector");
        const [response] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === "/api/sessions/step-upload"),
          page.evaluate("loadSessionDetail('step-upload')"),
        ]);
        expect(response.status()).toBe(200);
        expect(await page.$("#session-followup-anchor")).toBeNull();
        expect(new URL(page.url()).pathname).toBe("/sessions/step-upload");
      } finally { await browser.close(); }
    }, 30000,
  );

  test.skipIf(skipBrowser)(
    "retained workflow outcome cards keep their visual hierarchy at desktop and mobile widths",
    async () => {
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", request => { if (!request.url().startsWith(base)) void request.abort(); else void request.continue(); });
        for (const width of [1280, 600, 400]) {
          await page.setViewport({ width, height: 900 });
          for (const [route, selector] of [["/", "#workflow-overview"], ["/metrics", "#metrics-workflows"]]) {
            await page.goto(base + route, { waitUntil: "domcontentloaded" });
            const handle = await page.waitForFunction((sel) => {
              const found = Array.from(document.querySelectorAll(sel + " .health-card"));
              if (!found.length || document.styleSheets.length === 0) return null;
              return found.map(card => {
                const style = getComputedStyle(card);
                const label = getComputedStyle(card.querySelector(".health-label")!);
                const value = getComputedStyle(card.querySelector(".health-value")!);
                return { border: parseFloat(style.borderTopWidth), padding: parseFloat(style.paddingTop),
                  labelSize: parseFloat(label.fontSize), valueSize: parseFloat(value.fontSize), weight: Number(value.fontWeight) };
              });
            }, {}, selector);
            const cards = await handle.jsonValue();
            await handle.dispose();
            expect(cards).toHaveLength(5);
            for (const card of cards) {
              expect(card.border).toBeGreaterThan(0);
              expect(card.padding).toBeGreaterThan(0);
              expect(card.valueSize).toBeGreaterThan(card.labelSize);
              expect(card.weight).toBeGreaterThanOrEqual(600);
            }
          }
        }
      } finally { await browser.close(); }
    }, 30000,
  );

  test.skipIf(skipBrowser)(
    "delayed session and review-note reads cannot replace a newer route or redirect it",
    async () => {
      getDb(root).prepare(`INSERT INTO sessions(sessionId, agent, task, status, startedAt, endedAt)
        VALUES ('other-session', 'worker', 'Another report', 'done', ?, ?)`)
        .run(now - 2000, now - 1500);
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        const dialogs: string[] = [];
        page.on("pageerror", error => errors.push(String(error)));
        page.on("dialog", dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
        let capture: { path: string; resolve(request: HTTPRequest): void } | null = null;
        await page.setRequestInterception(true);
        page.on("request", request => {
          if (!request.url().startsWith(base)) void request.abort();
          else if (capture && new URL(request.url()).pathname === capture.path) {
            const held = capture;
            capture = null;
            held.resolve(request);
          } else void request.continue();
        });
        for (const fail of [false, true]) {
          await page.goto(base + "/sessions/step-upload", { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#session-detail-panel .session-inspector");
          const intercepted = new Promise<HTTPRequest>(resolve => {
            capture = { path: "/api/sessions/step-upload", resolve };
          });
          const pending = page.evaluate("loadSessionDetail('step-upload')");
          const held = await intercepted;
          const route = fail ? "/metrics" : "/sessions/other-session";
          await page.evaluate(route => (window as unknown as { routeTo(route: string): void }).routeTo(route), route);
          if (fail) await page.waitForSelector("#metrics-workflows [data-workflow-outcomes]");
          else await page.waitForFunction(() => document.querySelector("#session-detail-panel h3")?.textContent === "other-session");
          const previous = await page.$eval("#session-detail-panel", el => el.querySelector("h3")?.textContent ?? null);
          if (fail) await held.respond({ status: 500, contentType: "application/json", body: '{"error":"late session read failure"}' });
          else await held.continue();
          await pending;
          expect(new URL(page.url()).pathname).toBe(route);
          expect(await page.$eval("#session-detail-panel", el => el.querySelector("h3")?.textContent ?? null)).toBe(previous);
          expect(await page.$eval("#session-detail-panel", el => el.textContent)).not.toContain("late session read failure");
          if (!fail) {
            expect(await page.evaluate("currentInspectedSession")).toBe("other-session");
            expect(await page.$("#session-followup-anchor")).toBeNull();
          }
        }
        expect(errors).toEqual([]);
        expect(dialogs).toEqual([]);
      } finally { await browser.close(); }
    }, 30000,
  );

  test.skipIf(skipBrowser)(
    "browser reconciles a selected outcome with exact runs and shows real-time history and safe diagnostics",
    async () => {
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        const requests: string[] = [];
        let failMetrics = false;
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("request", (request) => {
          if (request.url().startsWith(base + "/api/")) requests.push(new URL(request.url()).pathname);
        });
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (!request.url().startsWith(base)) void request.abort();
          else if (failMetrics && new URL(request.url()).pathname === "/api/metrics")
            void request.respond({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "synthetic metric read outage" }),
            });
          else void request.continue();
        });
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(base, { waitUntil: "domcontentloaded" });
        // Served client fallback comparisons and labels must match Host evaluation,
        // including equality. Normal metric pages use the Host's thresholdBreached.
        const boundaries = await page.evaluate(() => {
          const ui = window as unknown as {
            metricBreached(metric: Record<string, unknown>): boolean;
            metricHealthyOperator(metric: Record<string, unknown>): string;
          };
          return [">", "above", ">=", "<", "below", "<=", undefined].map(alert_op => ({
            breached: [99, 100, 101].map(current => ui.metricBreached({ current, threshold: 100, alert_op })),
            healthy: ui.metricHealthyOperator({ alert_op }),
          }));
        });
        expect(boundaries).toEqual([
          { breached: [false, false, true], healthy: "≤" },
          { breached: [false, false, true], healthy: "≤" },
          { breached: [false, true, true], healthy: "<" },
          { breached: [true, false, false], healthy: "≥" },
          { breached: [true, false, false], healthy: "≥" },
          { breached: [true, true, false], healthy: ">" },
          { breached: [true, false, false], healthy: "≥" },
        ]);
        await page.waitForSelector("#workflow-overview [data-workflow-outcomes]");
        expect(await page.$eval("#workflow-overview", (el) => el.textContent)).toContain("60.0% successful execution");
        await page.waitForFunction(() =>
          document.querySelector("#liveness-panel")?.textContent?.includes("No retained observation"),
        );
        await page.waitForFunction(() =>
          document.querySelector("#liveness-measurement-problems")?.textContent?.includes("source unavailable"),
        );
        expect(await page.$eval("#liveness-panel", (el) => el.textContent)).not.toContain("✓ healthy");
        expect(await page.$eval("#liveness-panel .breach-badge", (el) => el.textContent)).toBe("No open alerts");
        const db = getDb(root);
        const alert = (i: number) => {
          const id = `zz-fixture.alert-${i}`;
          db.run("INSERT INTO metrics (id, status, owner) VALUES (?, 'active', 'zz-fixture')", [id]);
          db.run("INSERT INTO metric_alerts(metric_id, message, created_at) VALUES (?, 'synthetic browser alert boundary', ?)", [id, now + i]);
        };
        for (let i = 0; i < 21; i++) {
          alert(i);
          if (![3, 4, 19, 20].includes(i)) continue;
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForSelector("#liveness-panel .breach-badge");
          expect(await page.$eval("#liveness-panel .breach-badge", (el) => el.textContent))
            .toBe(i === 20 ? "More than 20 open alerts · showing newest 4"
              : `${i + 1} open alerts${i > 3 ? " · showing newest 4" : ""}`);
          expect(await page.$$("#liveness-panel .liveness-alert")).toHaveLength(4);
        }
        await page.waitForSelector("#workflow-overview [data-workflow-outcomes]");
        await page.waitForFunction(() =>
          document.querySelector("#overview-tasks")?.textContent?.includes("Task read unavailable"),
        );
        expect(requests.filter((path) => path.endsWith("/history"))).toHaveLength(0);
        const selected = await page.$eval(
          '#workflow-overview a[href*="outcome=error"]',
          (el) => {
            // A background refresh can replace the rolling-window card between
            // separate browser calls. Compare the URL of the anchor we click.
            const anchor = el as HTMLAnchorElement;
            const href = anchor.href;
            anchor.click();
            return href;
          },
        );
        await page.waitForFunction(() =>
          document.querySelector("#metrics-workflows")?.textContent?.includes("Matching runs · 2"),
        );
        const expectedWindow = new URL(selected).searchParams;
        const actualWindow = new URL(page.url()).searchParams;
        expect(actualWindow.get("start")).toBe(expectedWindow.get("start"));
        expect(actualWindow.get("end")).toBe(expectedWindow.get("end"));
        expect(await page.$eval("#metrics-workflows", (el) => el.textContent)).toContain("60.0% successful execution");
        await page.waitForSelector("#metrics-context [data-context-comparison]");
        const contextText = await page.$eval("#metrics-context", (el) => el.textContent || "");
        expect(contextText).toContain("130");
        expect(contextText).toContain("100 cache read");
        expect(contextText).toContain("20 cache write");
        expect(contextText).toContain("$0.0400");
        expect(contextText).toContain("not an invoice");
        expect(contextText).toContain(markup);
        expect(await page.$("#metrics-context img")).toBeNull();
        await page.click('#metrics-context a[href*="preparer=full"]');
        await page.waitForFunction(() => document.querySelector("#metrics-context")?.textContent?.includes("1 recorded invocations"));
        expect(await page.$$eval("[data-context-comparison] tbody tr", rows => rows.length)).toBe(1);
        await page.$$eval('#metrics-context form input:not([type="hidden"])', inputs => {
          for (const input of inputs) (input as HTMLInputElement).value = '';
        });
        await page.click('#metrics-context form button');
        await page.waitForFunction(() => document.querySelector("#metrics-context")?.textContent?.includes("2 recorded invocations"));
        expect(new URL(page.url()).searchParams.has('agent')).toBe(false);
        expect(await page.$$eval("[data-context-comparison] tbody tr", rows => rows.length)).toBe(2);
        await page.goto(base + '/metrics?agent=missing', { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.querySelector("#metrics-context")?.textContent?.includes("No context usage observations"));
        await page.goto(selected, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#metrics-workflows [data-workflow-outcomes]");
        stateTransaction(db, () => {
          for (let i = 21; i < 500; i++) alert(i);
        });
        for (const count of [500, 501]) {
          if (count === 501) alert(500);
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForSelector("#metrics-alerts p");
          expect(await page.$eval("#metrics-alerts p", (el) => el.textContent))
            .toStartWith(count === 500 ? "500 open alerts;" : "More than 500 open alerts;");
          expect(await page.$$eval("#metrics-alerts .health-warning", (rows) =>
            rows.filter((row) => row.textContent?.includes("synthetic browser alert boundary")).length,
          )).toBe(20);
          expect(await page.$eval("#metrics-alerts", (el) => el.textContent)).toContain("Showing newest 20 alerts");
        }
        await page.waitForFunction(() =>
          document.querySelector("#metrics-workflows")?.textContent?.includes("Matching runs · 2"),
        );
        await page.waitForSelector("#metric-search");
        expect(requests.filter((path) => path.endsWith("/history"))).toHaveLength(0);
        await page.type("#metric-search", "workflow.error");
        expect(await page.$$eval("[data-metric-search]:not([hidden])", (rows) => rows.length)).toBe(1);
        expect(await page.$eval("#metrics-workflows a[href=\"/api/workflow-runs/wr_7\"]", (el) => el.textContent)).toBe("wr_7");
        await page.goto(base + "/metrics/workflow.error-count-24h", { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#metrics-recent svg");
        expect(await page.$eval("#metrics-recent", (el) => el.textContent)).toContain("stale");
        expect(await page.$eval("#metrics-recent", (el) => el.textContent)).toContain("source unavailable");
        const samples = await page.$$eval("#metrics-recent [data-sample-time]", (dots) =>
          dots.map((dot) => ({
            time: Number(dot.getAttribute("data-sample-time")),
            x: Number(dot.getAttribute("cx")),
          })),
        );
        expect(samples).toHaveLength(4);
        // Equal values or irregular cadence never turn this into an index axis.
        expect((samples[3]!.x - samples[2]!.x) / (samples[2]!.x - samples[1]!.x)).toBeCloseTo(8, 0);
        expect(await page.$("#metrics-recent img")).toBeNull();
        expect(
          await page.evaluate(() => (window as unknown as { healthInjected?: boolean }).healthInjected),
        ).toBeUndefined();
        expect(errors).toEqual([]);
        // Optional local visual inspection; never captures installation data.
        if (process.env.TEST_SCREENSHOT_DIR) {
          mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: join(process.env.TEST_SCREENSHOT_DIR, "metric-history.png"), fullPage: true });
          await page.goto(base + "/metrics", { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#metrics-workflows [data-workflow-outcomes]");
          await page.screenshot({
            path: join(process.env.TEST_SCREENSHOT_DIR, "workflow-comparison.png"),
            fullPage: true,
          });
        }
        // Metric detail keeps the full day even when only a small part has data.
        const metrics = createMetricService({ getDb: () => db });
        metrics.define({ id: "handler.success-rate", type: "gauge" });
        for (const hoursAgo of [6, 5])
          metrics.record("handler.success-rate", 0.9, { measuredAt: now - hoursAgo * 3600000 });
        const [history] = await Promise.all([
          page.waitForResponse(
            (response) => new URL(response.url()).pathname === "/api/metrics/handler.success-rate/history",
          ),
          page.goto(base + "/metrics/handler.success-rate", { waitUntil: "domcontentloaded" }),
        ]);
        expect(history.status()).toBe(200);
        const { window: historyWindow } = await history.json();
        expect(historyWindow.end - historyWindow.start).toBe(86400000);
        await page.waitForSelector("#metrics-recent [data-sample-time]");
        const plot = await page.$eval("#metrics-recent svg", (svg) => {
          const axis = svg.querySelector("line")!;
          return {
            start: Number(axis.getAttribute("x1")),
            end: Number(axis.getAttribute("x2")),
            samples: Array.from(svg.querySelectorAll("[data-sample-time]"), (dot) => ({
              time: Number(dot.getAttribute("data-sample-time")),
              x: Number(dot.getAttribute("cx")),
            })),
          };
        });
        expect(plot.samples).toHaveLength(2);
        for (const sample of plot.samples)
          expect((sample.x - plot.start) / (plot.end - plot.start))
            .toBeCloseTo((sample.time - historyWindow.start) / (historyWindow.end - historyWindow.start), 4);
        expect(errors).toEqual([]);
        failMetrics = true;
        await page.goto(base + "/metrics", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() =>
          document.querySelector("#metrics-by-owner")?.textContent?.includes("synthetic metric read outage"),
        );
        await page.waitForSelector("#metrics-workflows [data-workflow-outcomes]");
        expect(await page.$eval("#metrics-workflows", (el) => el.textContent)).toContain("60.0% successful execution");
      } finally {
        getDb(root).prepare("DELETE FROM metric_alerts WHERE message = 'synthetic browser alert boundary'").run();
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)(
    "Overview and Metrics render top-down Host pillars, App cards, and escaped scorecards",
    async () => {
      expect((await fetch(`${base}/api/observability`, { method: "POST" })).status).toBe(405);
      expect((await fetch(`${base}/api/observability?days=91`)).status).toBe(400);

      const db = getDb(root);
      const scorecard = {
        version: 1,
        targetKind: "app",
        appId: "research",
        taskId: `report ${markup}`,
        agent: "worker",
        cohort: `cohort ${markup}`,
        rubricVersion: "app-rubric-v1",
        dimensions: {
          outcomeValue: 4,
          correctnessAndEvidence: 3,
          autonomyAndRecovery: 3,
          efficiency: 4,
          humanCoordination: "not_applicable",
        },
      };
      db.prepare(
        `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
         VALUES ('research', 'scored-attempt', 'report', 1, 'completed', ?, ?)`,
      ).run(
        now - 400,
        JSON.stringify({
          finishedAt: new Date(now - 200).toISOString(),
          acceptedResult: { state: "converged", facts: [`scorecard:${JSON.stringify(scorecard)}`] },
        }),
      );

      const metricsSvc = createMetricService({ getDb: () => db });
      metricsSvc.define({ id: "quality.success", owner: "research", measureInterval: 300_000 });
      metricsSvc.record("quality.success", 0.98, { measuredAt: now - 300 });

      const summaryRes = await fetch(`${base}/api/observability?days=1`);
      expect(summaryRes.status).toBe(200);
      const summary = await summaryRes.json();
      expect(summary.host.improvementWorkflow).toBeNull();
      const researchSummary = summary.apps.find((a: { appId: string }) => a.appId === "research");
      expect(researchSummary?.improvementWorkflow).toBeNull();
      expect(researchSummary?.metrics.defined).toBe(1);
      expect(researchSummary?.scorecard).toMatchObject({
        status: "scored",
        sampleSize: 1,
        confidence: "low-sample",
      });
      const metricsListRes = await fetch(`${base}/api/metrics?id=quality.success`);
      expect(metricsListRes.status).toBe(200);
      expect((await metricsListRes.json()).metrics[0]?.scope).toEqual({
        kind: "app",
        appId: "research",
      });

      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      db.prepare(
        "INSERT INTO metric_alerts(id, metric_id, alert_type, message, created_at) VALUES (901, 'workflow.error-count-24h', 'threshold', 'Host invariant breach', ?)",
      ).run(now - 500);
      db.prepare(
        `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
         VALUES
           ('research', 'codex-run-1', 'report-codex', 1, 'running', ?, ?),
           ('research', 'wf-blocked-att', 'report-wf-gate', 1, 'completed', ?, ?)`,
      ).run(
        now - 1_800_000,
        JSON.stringify({ owner: "worker", handler: "executor:codex-goal" }),
        now - 1_200_000,
        JSON.stringify({
          owner: "worker",
          handler: "workflow:research/gate",
          finishedAt: new Date(now - 1_100_000).toISOString(),
        }),
      );
      db.prepare(
        `INSERT INTO workflow_runs(runId, workflow, task, status, app_id, attempt_id, startedAt, endedAt)
         VALUES ('wr-blocked-1', 'research/gate', 'gate check', 'blocked', 'research', 'wf-blocked-att', ?, ?)`,
      ).run(now - 1_200_000, now - 1_100_000);
      db.prepare(
        `INSERT INTO app_inbox_items(id, app_id, source_kind, source_id, input_kind, input_data, status, created_at, updated_at)
         VALUES ('hum-steer-1', 'research', 'human', 'web-ui', 'steer', '{}', 'done', ?, ?)`,
      ).run(now - 900_000, now - 900_000);
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        const metricsRequests: string[] = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (!request.url().startsWith(base)) return void request.abort();
          metricsRequests.push(new URL(request.url()).pathname + new URL(request.url()).search);
          void request.continue();
        });

        await page.goto(base, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#liveness-panel .timeline-ruler");
        await page.waitForSelector('#top-down-overview [data-host-summary]');
        await page.waitForSelector('#top-down-overview [data-app-card="research"]');
        const overviewText = await page.$eval("#top-down-overview", (el) => el.textContent || "");
        expect(overviewText).toContain("Host Platform (Agent Harness)");
        expect(overviewText).not.toContain("alex/develop-host-change");
        expect(await page.$$eval('#top-down-overview svg[data-trend-spark]', (svgs) => svgs.length)).toBeGreaterThanOrEqual(10);
        expect(await page.$eval('#top-down-overview [data-app-card="research"]', (el) => el.textContent || "")).toContain(
          "low-sample (n=1)",
        );
        // Unified Activity Timeline renders native Codex duration bar, blocked workflow bar, human ◆ pin, and alert rail at top of Overview.
        expect(await page.$("#liveness-panel .timeline-bar.kind-codex.running")).not.toBeNull();
        expect(await page.$("#liveness-panel .timeline-bar.kind-workflow.blocked")).not.toBeNull();
        expect(await page.$("#liveness-panel .timeline-pin.kind-human")).not.toBeNull();
        expect(await page.$("#liveness-panel .timeline-alert-rail")).not.toBeNull();
        // R-01 & unified alert strip: rendered once on Overview (in #liveness-panel, not duplicated in #top-down-overview).
        expect(
          await page.$eval('#top-down-overview [data-host-summary] a.breach-badge', (el) => el.getAttribute("href")),
        ).toBe("/metrics");
        expect(await page.$("#top-down-overview [data-active-alerts]")).toBeNull();
        const stripText = await page.$eval("#liveness-panel [data-active-alerts]", (el) => el.textContent || "");
        expect(stripText).toContain("Host · Owner: system:host");
        expect(stripText).toContain("No recorded handling");
        expect(stripText).not.toContain("Routed to");

        metricsRequests.length = 0;
        await page.goto(base + "/metrics", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('#metrics-top-down [data-app-card="research"]');
        expect(await page.$eval("#metrics-top-down [data-active-alerts]", (el) => el.textContent || "")).toContain(
          "Host · Owner: system:host",
        );
        await page.waitForSelector("#metrics-workflows [data-workflow-outcomes]");
        await page.waitForSelector("#metrics-context");
        // R-02: /metrics aligns all three panels on the shared default window (days=1) and exact end boundary.
        const panelEnds = new Set<string | null>();
        for (const pathname of ["/api/observability", "/api/context-usage", "/api/workflow-health"]) {
          const matched = metricsRequests.find((req) => req.startsWith(pathname + "?"));
          expect(matched).toBeTruthy();
          const params = new URL("http://x" + matched!).searchParams;
          expect(params.get("days")).toBe("1");
          panelEnds.add(params.get("end"));
        }
        expect(panelEnds.size).toBe(1);
        const metricsTopText = await page.$eval('#metrics-top-down [data-app-card="research"]', (el) => el.textContent || "");
        expect(metricsTopText).toContain("Outcome value (35%)");
        expect(metricsTopText).toContain("4.0/4");
        expect(await page.$eval("#metrics-alerts", (el) => el.textContent || "")).toContain(
          "[Host · Owner: system:host · No recorded handling]",
        );
        await page.click('#metrics-top-down [data-drilldown-link="research"]');
        await page.waitForSelector('#metrics-top-down [data-app-drilldown="research"]');
        const drillParams = new URL(page.url()).searchParams;
        expect(drillParams.get("start")).toBeTruthy();
        expect(drillParams.get("end")).toBeTruthy();
        expect(metricsRequests.some((req) => req === "/api/metrics?appId=research")).toBe(true);
        const showAllHref = await page.$eval(
          '#metrics-top-down [data-app-drilldown="research"] a.td-window-btn',
          (el) => el.getAttribute("href") || "",
        );
        expect(new URL("http://x" + showAllHref).searchParams.get("start")).toBe(drillParams.get("start"));
        expect(new URL("http://x" + showAllHref).searchParams.get("end")).toBe(drillParams.get("end"));
        const drillText = await page.$eval('#metrics-top-down [data-app-drilldown="research"]', (el) => el.textContent || "");
        expect(drillText).toContain("1. Contributing Tasks");
        expect(drillText).toContain("worker");
        // quality.success (different ID prefix from owner 'research') remains visible under research drill-down!
        await page.waitForSelector("#metrics-by-owner [data-metric-search]");
        expect(await page.$$eval("#metrics-by-owner [data-metric-search]:not([hidden])", (rows) => rows.map((r) => r.textContent || "").join("\n"))).toContain(
          "quality.success",
        );
        expect(await page.$("#metrics-top-down img")).toBeNull();
        expect(
          await page.evaluate(() => (window as unknown as { healthInjected?: boolean }).healthInjected),
        ).toBeUndefined();
        expect(errors).toEqual([]);
      } finally {
        db.prepare("DELETE FROM metric_alerts WHERE id = 901").run();
        db.prepare("DELETE FROM workflow_runs WHERE runId = 'wr-blocked-1'").run();
        db.prepare("DELETE FROM app_task_attempts WHERE attempt_id IN ('codex-run-1', 'wf-blocked-att')").run();
        db.prepare("DELETE FROM app_inbox_items WHERE id = 'hum-steer-1'").run();
        db.prepare("DELETE FROM metric_snapshots WHERE metric_id = 'quality.success'").run();
        db.prepare("DELETE FROM metrics WHERE id = 'quality.success'").run();
        await browser.close();
      }
    },
    30000,
  );

  test("agent and liveness routes resolve non-stem App IDs, deduplicate linked running sessions, filter assigned Tasks pre-limit, and exclude retained idle chats", async () => {
    const db = getDb(root);
    const appDir = join(root, "projects", "canary-dir.app");
    const specDir = join(appDir, "agents", "canary-spec");
    const idleDir = join(appDir, "agents", "idle-chat-agent");
    mkdirSync(specDir, { recursive: true });
    mkdirSync(idleDir, { recursive: true });
    writeFileSync(join(appDir, "app.ts"), 'export default { id: "canary-domain", agent: "worker" };\n');
    writeFileSync(
      join(specDir, "agent.json"),
      JSON.stringify({ name: "canary-spec", description: "Specialist in non-stem App dir", model: "gpt-5" }),
    );
    writeFileSync(
      join(idleDir, "agent.json"),
      JSON.stringify({ name: "idle-chat-agent", description: "Idle chat holder", model: "gpt-5" }),
    );

    try {
      // 1. Persisted idle chat session from 10h ago has no live process after restart -> excluded from running counts & 4h window.
      db.prepare(
        `INSERT INTO sessions(sessionId, agent, task, kind, status, startedAt)
         VALUES ('retained-idle-chat', 'idle-chat-agent', 'Old chat', 'chat', 'idle', ?)`,
      ).run(now - 10 * 3_600_000);

      // 2. Running Task + running Attempt + linked running Session for canary-spec -> runningNow === 1 (not 2).
      db.prepare(
        `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
         VALUES ('canary-domain', 'spec-task-1', 1, 1, 1, 'running', 'normal', 0, 1, ?, ?)`,
      ).run(now - 5_000, JSON.stringify({ spec: { agent: "canary-spec", outcome: "Run canary check" }, status: {} }));
      db.prepare(
        `INSERT INTO sessions(sessionId, agent, task, app_id, task_id, attempt_id, status, startedAt)
         VALUES ('spec-running-sess', 'canary-spec', 'Run canary check', 'canary-domain', 'spec-task-1', 'spec-att-1', 'running', ?)`,
      ).run(now - 5_000);
      db.prepare(
        `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
         VALUES ('canary-domain', 'spec-att-1', 'spec-task-1', 1, 'running', ?, ?)`,
      ).run(now - 5_000, JSON.stringify({ owner: "canary-spec", sessionId: "spec-running-sess" }));

      // 3. Occupy 85 newer open Tasks under 'worker' so global LIMIT 80 would evict 'spec-task-1' if filtered post-limit.
      stateTransaction(db, () => {
        const ins = db.prepare(
          `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
           VALUES ('canary-domain', ?, 1, 1, 1, 'pending', 'normal', 1, 1, ?, ?)`,
        );
        for (let i = 0; i < 85; i++) {
          ins.run(`worker-flood-${i}`, now - 100 + i, JSON.stringify({ spec: { agent: "worker", outcome: "Flood" }, status: {} }));
        }
      });

      const agentsRes = await fetch(`${base}/api/agents`);
      expect(agentsRes.status).toBe(200);
      const agentsBody = (await agentsRes.json()) as Array<Record<string, unknown>>;
      const specCard = agentsBody.find((a) => a.name === "canary-spec");
      expect(specCard).toMatchObject({
        localApp: "canary-domain",
        runningNow: 1,
      });
      const idleCard = agentsBody.find((a) => a.name === "idle-chat-agent");
      expect(idleCard).toMatchObject({
        localApp: "canary-domain",
        runningNow: 0,
      });

      // Gym facts: k=2 omitting trialPassRatio -> scenario pass^2 badge; k=4 -> pass^4 badge (never pass^3).
      db.prepare(
        `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
         VALUES
           ('canary-domain', 'gym-k2-att', 'spec-task-1', 1, 'completed', ?, ?),
           ('canary-domain', 'gym-k4-att', 'spec-task-1', 1, 'completed', ?, ?)`,
      ).run(
        now - 2_000,
        JSON.stringify({
          finishedAt: new Date(now - 1_500).toISOString(),
          acceptedResult: {
            state: "converged",
            facts: [
              `gym-comparison:${JSON.stringify({
                version: 1,
                agent: "canary-spec",
                benchmark: "spec-suite",
                trialsPerScenario: 2,
                scenarioCount: 4,
                passedScenariosHatK: 2,
                candidatePassHatKRatio: 0.5,
                verdict: "hold",
              })}`,
              `gym-comparison:${JSON.stringify({
                version: 1,
                agent: "idle-chat-agent",
                benchmark: "chat-suite",
                trialsPerScenario: 4,
                scenarioCount: 4,
                passedScenariosHatK: 3,
                candidatePassHatKRatio: 0.75,
                trialPassRatio: 0.875,
                verdict: "candidate-supported",
              })}`,
            ],
          },
        }),
        now - 1_000,
        JSON.stringify({
          finishedAt: new Date(now - 500).toISOString(),
          acceptedResult: {
            state: "converged",
            facts: [
              `gym-comparison:${JSON.stringify({
                version: 1,
                agent: "canary-spec",
                benchmark: "spec-suite",
                trialsPerScenario: 2,
                scenarioCount: 4,
                candidatePassHatKRatio: null,
              })}`,
            ],
          },
        }),
      );

      const aboutRes = await fetch(`${base}/api/agents/canary-spec/about`);
      expect(aboutRes.status).toBe(200);
      const aboutBody = (await aboutRes.json()) as {
        assignedTasks: Array<{ appId: string; taskId: string }>;
        gym: { status: string; trialsPerScenario: number; passHatKRatio: number; trialPassRatio: number | null; passHat3Ratio: number | null };
      };
      expect(aboutBody.assignedTasks).toEqual([
        expect.objectContaining({ appId: "canary-domain", taskId: "spec-task-1" }),
      ]);
      expect(aboutBody.gym).toMatchObject({
        status: "sub_3_trials",
        trialsPerScenario: 2,
        passHatKRatio: 0.5,
        trialPassRatio: null,
        passHat3Ratio: null,
      });

      if (!skipBrowser && chrome) {
        const browser = await puppeteer.launch({
          executablePath: chrome,
          headless: true,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        });
        try {
          const page = await browser.newPage();
          await page.goto(`${base}/agents`, { waitUntil: "networkidle2" });
          await page.waitForSelector(".agent-roster-card");
          const agentsText = await page.$eval("#agents-content", (el) => el.textContent || "");
          expect(agentsText).toContain("Gym pass^2 · 50%");
          expect(agentsText).toContain("▲ Gym pass^4 75%");
          expect(agentsText).not.toContain("Gym pass³ 75%");

          await page.goto(`${base}/agents/canary-spec`, { waitUntil: "networkidle2" });
          await page.waitForSelector(".agent-eval-compare-grid");
          const detailText = await page.$eval("#agents-content", (el) => el.textContent || "");
          expect(detailText).toContain("3-trial pass³ is unmeasured");
          expect(detailText).not.toContain("promotion requires");
        } finally {
          await browser.close();
        }
      }

      const livenessRes = await fetch(`${base}/api/liveness?hours=4`);
      expect(livenessRes.status).toBe(200);
      const livenessBody = (await livenessRes.json()) as {
        summary: { activeSessions: number; activeRunning: number };
        timeline: { agentLanes: Array<{ id: string; runningCount: number; totalCount: number }> };
      };
      // Only spec-running-sess is running; retained-idle-chat is NOT counted in activeSessions or activeRunning or 4h lane!
      expect(livenessBody.summary.activeSessions).toBe(1);
      expect(livenessBody.summary.activeRunning).toBe(1);
      const idleLane = livenessBody.timeline.agentLanes.find((l) => l.id === "idle-chat-agent");
      expect(idleLane).toMatchObject({ runningCount: 0, totalCount: 0 });
    } finally {
      db.prepare("DELETE FROM app_task_attempts WHERE app_id = 'canary-domain'").run();
      db.prepare("DELETE FROM app_tasks WHERE app_id = 'canary-domain'").run();
      db.prepare("DELETE FROM sessions WHERE sessionId IN ('retained-idle-chat', 'spec-running-sess')").run();
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
