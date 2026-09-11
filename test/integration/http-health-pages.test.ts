import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import { getDb, closeDb } from "../../src/lib/db/connection.js";
import { insertWorkflowRun } from "../../src/lib/db/workflows.js";
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
  const now = Date.now() - 1000;
  const markup = '<img src=x onerror="window.healthInjected=true">';

  beforeAll(async () => {
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

  afterAll(async () => {
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
    const target = "workflow.error-count-24h";
    try {
      insert.run(target, "synthetic oldest alert", now - 3000);
      insert.run(target, "synthetic latest alert", now - 2000);
      for (let i = 0; i < 501; i++) insert.run("runtime.daemon-heartbeat-stale", "synthetic alert flood", now - 1000 + i);
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
        await page.waitForSelector("#metric-search");
        expect(requests.filter((path) => path.endsWith("/history"))).toHaveLength(0);
        await page.type("#metric-search", "workflow.error");
        expect(await page.$$eval("[data-metric-search]:not([hidden])", (rows) => rows.length)).toBe(1);
        await page.click('#metrics-workflows a[href*="workflowRunId=wr_7"]');
        await page.waitForSelector("[data-workflow-evidence]");
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
        failMetrics = true;
        await page.goto(base + "/metrics", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() =>
          document.querySelector("#metrics-by-owner")?.textContent?.includes("synthetic metric read outage"),
        );
        await page.waitForSelector("#metrics-workflows [data-workflow-outcomes]");
        expect(await page.$eval("#metrics-workflows", (el) => el.textContent)).toContain("60.0% successful execution");
      } finally {
        await browser.close();
      }
    },
    30000,
  );
});
