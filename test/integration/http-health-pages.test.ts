import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer, { type HTTPRequest } from "puppeteer-core";
import { getDb, closeDb } from "../../src/lib/db/connection.js";
import { insertWorkflowRun } from "../../src/lib/db/workflows.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
import { createWorkflowDiagnostics } from "../../src/lib/workflow-diagnostics.js";
import { createMetricService } from "../../src/lib/metrics.js";

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

  beforeEach(async () => {
    now = Date.now() - 1000;
    root = mkdtempSync(join(tmpdir(), "may-http-health-"));
    const projects = join(root, "projects");
    cpSync(resolve(import.meta.dir, "../../packages/webui/static"), join(projects, "platform", "ui"), {
      recursive: true,
    });
    const db = getDb(root);
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
    // A late arrival changes the old cache but must not become the displayed current.
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

    child = spawn(
      "bun",
      [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
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

  test("HTTP reads real retained outcomes, current samples, bounded history and error evidence without a daemon", async () => {
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
    expect(data.metrics.find((m: { id: string }) => m.id === "workflow.error-count-24h")).toMatchObject({
      current: 3,
      freshness: "stale",
      collectionFailure: { afterLastSample: true },
    });
    const live = await read("/api/liveness");
    expect(live.vitals[0]).toMatchObject({ current: null, freshness: "missing", updatedAt: null });
    const history = await read("/api/metrics/workflow.error-count-24h/history?days=14");
    expect(history.snapshots).toHaveLength(4);
    expect(history.failures).toHaveLength(1);
    const evidence = (await read("/api/loop-trace?workflowRunId=wr_7")).workflowEvidence;
    expect(evidence.childRunIds).toEqual(["wr_10"]);
    expect(evidence.steps[0]).toMatchObject({ sessionId: "step-upload", status: "error" });
    expect(evidence.diagnostics.entries[0].message).toContain("Original upload failure");
    expect((await read("/api/loop-trace?workflowRunId=wr_6")).workflowEvidence.diagnostics.state).toBe("unavailable");
    await read("/api/workflow-health?days=100000", 400);
    await read("/api/metrics/example/history?days=NaN", 400);
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
      insert.run(target, "synthetic oldest alert", now - 3000);
      insert.run(target, "synthetic latest alert", now - 2000);
      for (let i = 0; i < 501; i++) {
        insert.run("workflow.error-count-24h", "synthetic alert flood", now - 1000 + i);
        if (i === 17) await liveAlerts(20, false);
        if (i === 18) await liveAlerts(20, true);
      }
      const cappedLive = await liveAlerts(20, true);
      expect(cappedLive.vitals.find((m: { id: string }) => m.id === target).alertOpen).toBeNull();
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
      expect(detail.alerts).toHaveLength(2);
    } finally {
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
    "disabled rules suppress only derived warnings, not retained alerts, across HTTP and project/vital cards",
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
          if (retained) metrics.alert(id, "Existing alert still needs resolution");
          // Changing policy must not resolve the existing alert as a side effect.
          metrics.define({ ...definition, config: { alert: { disabled } } });
          const response = await fetch(base + "/api/liveness", { signal: AbortSignal.timeout(5000) });
          expect(response.status).toBe(200);
          const vital = (await response.json()).vitals.find((m: { id: string }) => m.id === id);
          expect(vital).toMatchObject({ alertsDisabled: disabled, alertOpen: retained,
            thresholdBreached: value > 5, breached: !disabled && value > 5 });
          const expectedWarning = retained || (!disabled && value > 5);
          await page.goto(base, { waitUntil: "domcontentloaded" });
          const vitalCard = `.vital-card[title^="${id}"]`;
          const projectChip = `.project-metric-chip[title^="${id}"]`;
          await page.waitForSelector(vitalCard);
          await page.waitForSelector(projectChip);
          expect(await page.$eval(vitalCard, (el) => el.classList.contains("alerting"))).toBe(expectedWarning);
          expect(await page.$eval(projectChip, (el) => el.classList.contains("alerting"))).toBe(expectedWarning);
          expect(await page.$eval("#liveness-projects", (el) => !!el.querySelector(".project-health-alert"))).toBe(expectedWarning);
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
    "route changes clear finished trace evidence and fence delayed success and error responses",
    async () => {
      const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      try {
        const page = await browser.newPage();
        let capture: ((request: HTTPRequest) => void) | null = null;
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (!request.url().startsWith(base)) void request.abort();
          else if (capture && new URL(request.url()).searchParams.get("workflowRunId") === "wr_7") capture(request);
          else void request.continue();
        });
        await page.goto(base + "/events?workflowRunId=wr_7#loop-trace", { waitUntil: "domcontentloaded" });
        await page.waitForSelector("[data-workflow-evidence]");
        await page.evaluate("routeTo('/events')");
        expect(await page.$eval("#loop-trace-content", (el) => el.textContent)).toBe("");
        for (const [route, fail] of [["/events", false], ["/metrics", true], ["/events?workflowRunId=wr_6", false]] as const) {
          const intercepted = new Promise<HTTPRequest>((resolveRequest) => { capture = resolveRequest; });
          // Keep the real loader promise so assertions wait for its rendering/catch, not a sleep.
          const pending = page.evaluate("loadLoopTrace({ workflowRunId: 'wr_7' })");
          const held = await intercepted;
          capture = null;
          await page.evaluate(`routeTo(${JSON.stringify(route)})`);
          if (route === "/metrics") await page.evaluate("routeTo('/events')");
          const selectedRun = route.includes("wr_6");
          if (selectedRun) await page.waitForSelector("[data-workflow-evidence]");
          if (fail) await held.respond({ status: 500, contentType: "application/json", body: '{"error":"late trace failure"}' });
          else await held.continue();
          await pending;
          const text = await page.$eval("#loop-trace-content", (el) => el.textContent || "");
          expect(text).not.toContain("wr_7");
          expect(text).not.toContain("late trace failure");
          if (selectedRun) expect(text).toContain("wr_6");
          else expect(text).toBe("");
        }
        await page.evaluate("openLoopTrace({ workflowRunId: 'wr_7' })");
        await page.waitForSelector("[data-workflow-evidence]");
        expect(await page.$eval("#loop-trace-content", (el) => el.textContent)).toContain("wr_7");
        const event = getDb(root).prepare("SELECT id FROM events WHERE event_type = 'metric.measurement.failed' LIMIT 1").get() as { id: number };
        await page.evaluate(`routeTo('/events/${event.id}#loop-trace')`);
        await page.waitForFunction((id) => document.querySelector("#loop-trace-content")?.textContent?.includes(`event:${id}`), {}, event.id);
        // A workflow selection takes precedence over an Event-page trace anchor.
        await page.evaluate(`routeTo('/events/${event.id}?workflowRunId=wr_7#loop-trace')`);
        await page.waitForSelector("[data-workflow-evidence]");
        expect(await page.$eval("#loop-trace-content", (el) => el.textContent)).toContain("workflow:wr_7");
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
        const alert = db.prepare("INSERT INTO metric_alerts(metric_id, message, created_at) VALUES ('workflow.error-count-24h', 'synthetic browser alert boundary', ?)");
        for (let i = 0; i < 21; i++) {
          alert.run(now + i);
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
          (el) => (el as HTMLAnchorElement).href,
        );
        await page.click('#workflow-overview a[href*="outcome=error"]');
        await page.waitForFunction(() =>
          document.querySelector("#metrics-workflows")?.textContent?.includes("Matching runs · 2"),
        );
        const expectedWindow = new URL(selected).searchParams;
        const actualWindow = new URL(page.url()).searchParams;
        expect(actualWindow.get("start")).toBe(expectedWindow.get("start"));
        expect(actualWindow.get("end")).toBe(expectedWindow.get("end"));
        expect(await page.$eval("#metrics-workflows", (el) => el.textContent)).toContain("60.0% successful execution");
        stateTransaction(db, () => {
          for (let i = 21; i < 500; i++) alert.run(now + i);
        });
        for (const count of [500, 501]) {
          if (count === 501) alert.run(now + 500);
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
        await page.click('#metrics-workflows a[href*="workflowRunId=wr_7"]');
        expect(new URL(page.url()).hash).toBe("#loop-trace");
        await page.waitForSelector("[data-workflow-evidence]");
        await page.waitForFunction(() => {
          const target = document.getElementById("loop-trace")?.getBoundingClientRect();
          return target && target.top >= 0 && target.top < window.innerHeight;
        });
        const text = await page.$eval("[data-workflow-evidence]", (el) => el.textContent);
        expect(text).toContain("Original upload failure");
        expect(text).toContain("wr_10");
        expect(text).toContain(markup);
        expect(await page.$("[data-workflow-evidence] img")).toBeNull();
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
        // The legacy panels label a full day, even when only a small part has data.
        const metrics = createMetricService({ getDb: () => db });
        metrics.define({ id: "handler.success-rate", type: "gauge" });
        for (const hoursAgo of [6, 5])
          metrics.record("handler.success-rate", 0.9, { measuredAt: now - hoursAgo * 3600000 });
        await page.goto(base, { waitUntil: "domcontentloaded" });
        const historyResponse = page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/metrics/handler.success-rate/history",
        );
        await page.click("#legacy-dashboard summary");
        const history = await historyResponse;
        expect(history.status()).toBe(200);
        const { window: historyWindow } = await history.json();
        expect(historyWindow.end - historyWindow.start).toBe(86400000);
        await page.waitForSelector("#health-graphs [data-sample-time]");
        const plot = await page.$eval("#health-graphs svg", (svg) => {
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
});
