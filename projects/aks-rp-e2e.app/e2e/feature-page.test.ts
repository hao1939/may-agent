/**
 * project-feature-page.test.ts — Dedicated feature page display and interaction tests
 *
 * Covers:
 * - /projects/aks-rp-e2e/ui/feature?id=managedsystem-pool renders without quality-panel load errors
 * - Feature brief: title, purpose, metrics, confidence, recommended next move, reference links
 * - Scenario/input/expectation paths and spec cards
 * - Per-spec actions: Generate Test Script, Request REST Staging Replay, Review Script
 * - Actions create scoped project-owner requests via comment prefill without direct mutation
 * - Evidence section
 * - No "Run Local Check" button shown
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import puppeteer from "puppeteer-core";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(import.meta.dirname, "../../aks-rp-e2e");
const browserPath =
  process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome";

type PostedComment = { path?: string; comment?: string };
type SpecIndexFixture = {
  specs: Array<Record<string, unknown>>;
  specFiles: string[];
  specByFile: Map<string, Record<string, unknown>>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function projectFile(path: string) {
  if (path.startsWith(".app/"))
    return readFile(join(appRoot, path.slice(".app/".length)), "utf8");
  return readFile(join(projectRoot, path), "utf8");
}

let specIndexFixture: SpecIndexFixture | null = null;

async function buildSpecIndexFixture(): Promise<SpecIndexFixture> {
  if (specIndexFixture) return specIndexFixture;
  const featuresRoot = join(projectRoot, "features");
  const entries = await readdir(featuresRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const specFiles = entries
    .filter((entry) => {
      const fullPath = join(entry.parentPath, entry.name);
      return entry.isFile() && /\/specs\/[^/]+\.json$/.test(fullPath);
    })
    .map((entry) => join(entry.parentPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
  const specs: Array<Record<string, unknown>> = [];
  const specByFile = new Map<string, Record<string, unknown>>();
  for (const file of specFiles) {
    const spec = JSON.parse(await readFile(file, "utf8")) as Record<
      string,
      unknown
    >;
    const specFile = basename(file);
    const normalized = { ...spec, file: specFile };
    specs.push(normalized);
    specByFile.set(specFile, normalized);
  }
  specIndexFixture = {
    specs,
    specFiles: specs.map((spec) => String(spec.file || "")),
    specByFile,
  };
  return specIndexFixture;
}

async function testSpecIndexContent() {
  const fixture = await buildSpecIndexFixture();
  return JSON.stringify({
    specs: fixture.specs,
    specFiles: fixture.specFiles,
  });
}

async function testSpecFileContent(file: string) {
  const fixture = await buildSpecIndexFixture();
  const spec = fixture.specByFile.get(basename(file));
  if (!spec) throw new Error(`Spec fixture not found: ${file}`);
  return JSON.stringify(spec);
}

async function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

describe("dedicated feature page — managedsystem-pool", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;
  const comments: PostedComment[] = [];

  beforeAll(async () => {
    const port = await getFreePort();
    server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      async fetch(req) {
        const url = new URL(req.url);

        // Feature page routes
        if (
          url.pathname === "/projects/aks-rp-e2e/ui/feature" ||
          url.pathname === "/projects/aks-rp-e2e/ui/feature/" ||
          url.pathname === "/projects/aks-rp-e2e/ui/feature/index.html"
        ) {
          return new Response(await projectFile(".app/ui/feature/index.html"), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        // JS assets
        if (url.pathname === "/projects/aks-rp-e2e/ui/quality-panel.js") {
          return new Response(await projectFile(".app/ui/quality-panel.js"), {
            headers: {
              "content-type": "application/javascript; charset=utf-8",
            },
          });
        }
        if (
          url.pathname ===
          "/projects/aks-rp-e2e/ui/feature/scenario-path-table.js"
        ) {
          return new Response(
            await projectFile(".app/ui/feature/scenario-path-table.js"),
            {
              headers: {
                "content-type": "application/javascript; charset=utf-8",
              },
            },
          );
        }

        // Direct project file routes for path-summary and test-specs
        if (url.pathname.startsWith("/projects/aks-rp-e2e/")) {
          const relative = decodeURIComponent(
            url.pathname.replace(/^\/projects\/aks-rp-e2e\//, ""),
          );
          if (relative === "specs/index.json") {
            return new Response(await testSpecIndexContent(), {
              headers: { "content-type": "application/json; charset=utf-8" },
            });
          }
          if (/^specs\/[^/]+\.json$/.test(relative)) {
            try {
              return new Response(
                await testSpecFileContent(relative.replace(/^specs\//, "")),
                {
                  headers: {
                    "content-type": "application/json; charset=utf-8",
                  },
                },
              );
            } catch {
              return new Response("not found", { status: 404 });
            }
          }
          if (
            relative === "model/knowledge-map/views/path-summary.json" ||
            /^scenarios\/test-specs\/[^/]+\.json$/.test(relative)
          ) {
            try {
              return new Response(await projectFile(relative), {
                headers: { "content-type": "application/json; charset=utf-8" },
              });
            } catch {
              return new Response("not found", { status: 404 });
            }
          }
        }

        // Project artifact API
        if (url.pathname === "/api/projects/artifact") {
          const file = url.searchParams.get("file") || "";

          // Test run index
          if (file === "runs/index.jsonl") {
            return jsonResponse({
              content: `${JSON.stringify({
                kind: "run",
                requestId: "req_fixture_managedsystem",
                runId: "run_fixture_managedsystem",
                featureId: "managedsystem-pool",
                specId: "spec.managedsystem.rest-add-existing.minimal-rest",
                featurePathIds: [
                  "path.managedsystem.rest-add-existing.minimal-rest",
                ],
                target: {
                  environment: "staging",
                  surface: "REST",
                  executor: "typescript-js-rest-replay",
                },
                status: "passed",
                phase: "diagnosed",
                createdAt: "2026-06-08T00:00:00.000Z",
                updatedAt: "2026-06-08T00:03:00.000Z",
                workflowRunId: "fixture-workflow-run",
                statusPath:
                  "runs/executions/run_fixture_managedsystem/status.json",
                resultPath:
                  "runs/executions/run_fixture_managedsystem/result.json",
                diagnosisPath:
                  "runs/executions/run_fixture_managedsystem/diagnosis.json",
                summaryPath:
                  "runs/executions/run_fixture_managedsystem/summary.md",
              })}\n`,
            });
          }
          if (
            file === "runs/executions/run_fixture_managedsystem/status.json"
          ) {
            return jsonResponse({
              content: JSON.stringify({ status: "passed", phase: "diagnosed" }),
            });
          }
          if (
            file === "runs/executions/run_fixture_managedsystem/result.json"
          ) {
            return jsonResponse({
              content: JSON.stringify({
                status: "passed",
                assertions: [
                  { id: "assert.managedsystem.ready", verdict: "pass" },
                ],
                cleanup: { status: "completed" },
              }),
            });
          }
          if (
            file === "runs/executions/run_fixture_managedsystem/diagnosis.json"
          ) {
            return jsonResponse({
              content: JSON.stringify({
                diagnosis: "product_pass",
                runnerStatus: "passed",
                modelImpact: {
                  featureId: "managedsystem-pool",
                  specId: "spec.managedsystem.rest-add-existing.minimal-rest",
                  proposedStatus: "pass",
                  evidence: "run_fixture_managedsystem",
                },
              }),
            });
          }
          if (file === "runs/executions/run_fixture_managedsystem/summary.md") {
            return jsonResponse({
              content:
                "# Fixture runner summary\n\nManagedSystem REST add-existing passed.",
            });
          }
          if (file.startsWith("features/") && file.endsWith(".yaml")) {
            try {
              return jsonResponse({ content: await projectFile(file) });
            } catch {
              return jsonResponse({ error: `Not found: ${file}` }, 404);
            }
          }
          if (
            [
              "model/knowledge-map/model.json",
              "model/knowledge-map/views/path-summary.json",
            ].includes(file)
          ) {
            return jsonResponse({ content: await projectFile(file) });
          }
          if (file === "specs/index.json")
            return jsonResponse({
              content: await testSpecIndexContent(),
            });
          if (/^specs\/[^/]+\.json$/.test(file))
            return jsonResponse({
              content: await testSpecFileContent(file.replace(/^specs\//, "")),
            });
          return jsonResponse({ error: `Unexpected artifact ${file}` }, 404);
        }

        // Comment endpoint
        if (url.pathname === "/api/projects/comment" && req.method === "POST") {
          comments.push((await req.json()) as PostedComment);
          return jsonResponse({ ok: true });
        }

        // Events endpoint (for trigger-test)
        if (url.pathname === "/api/events" && req.method === "POST") {
          const body = (await req.json()) as Record<string, unknown>;
          const data =
            body.data && typeof body.data === "object"
              ? (body.data as Record<string, unknown>)
              : {};
          const eventParams =
            data.params && typeof data.params === "object"
              ? (data.params as Record<string, unknown>)
              : {};
          if (eventParams.source === "feature-page") {
            comments.push(body as PostedComment);
            return jsonResponse({
              ok: true,
              triggered: true,
              eventType: body.type,
              reason: data.reason,
              workflowStarted: true,
              workflowRunId: "test-workflow-run",
              featureTestRequest: {
                requestId: "req_test_managedsystem",
                runId: "run_test_managedsystem",
                status: "queued",
                phase: "owner-workflow-started",
                workflowRunId: "test-workflow-run",
              },
            });
          }
          return jsonResponse(
            {
              error: "event endpoint disabled for this event in this test mock",
            },
            404,
          );
        }

        return new Response("not found", { status: 404 });
      },
    });
  });

  afterAll(() => {
    server?.stop(true);
  });

  // ── Test 1: Feature page renders without errors ──

  test("feature page renders with brief, specs, actions, evidence, and no load errors", async () => {
    const browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === server?.url.origin) request.continue();
        else request.abort();
      });
      if (!server) throw new Error("test server did not start");

      await page.goto(
        new URL(
          "/projects/aks-rp-e2e/ui/feature?id=managedsystem-pool",
          server.url,
        ).toString(),
        { waitUntil: "domcontentloaded" },
      );

      // Feature brief renders
      await page.waitForSelector('[data-testid="feature-brief"]', {
        timeout: 10_000,
      });
      const briefText = await page.$eval(
        '[data-testid="feature-brief"]',
        (el) => el.textContent || "",
      );
      expect(briefText).toContain("ManagedSystem Pool");
      expect(briefText).toContain("Feature Brief");
      expect(briefText).toContain("paths");
      expect(briefText).toContain("specs");
      expect(briefText).toContain("pass");
      expect(briefText).toContain("open");

      // Confidence metric
      await page.waitForSelector('[data-testid="feature-brief-confidence"]', {
        timeout: 5_000,
      });
      const confidenceText = await page.$eval(
        '[data-testid="feature-brief-confidence"]',
        (el) => el.textContent || "",
      );
      expect(confidenceText).toContain("confidence");
      expect(confidenceText).toMatch(/high|medium|low/);

      // Recommended next move
      await page.waitForSelector('[data-testid="feature-brief-next-move"]', {
        timeout: 5_000,
      });
      const nextMoveText = await page.$eval(
        '[data-testid="feature-brief-next-move"]',
        (el) => el.textContent || "",
      );
      expect(nextMoveText).toContain("Recommended Next Move");
      // Next move derives from path status — should contain actionable language
      expect(nextMoveText.length).toBeGreaterThan(30);

      // Reference links
      expect(briefText).toContain("Feature Packet");
      expect(briefText).toContain("Task Kanban");
      expect(briefText).toContain("Feature Explorer");

      // Spec cards render
      await page.waitForSelector('[data-testid="feature-test-spec-card"]', {
        timeout: 10_000,
      });
      const specCardCount = await page.$$eval(
        '[data-testid="feature-test-spec-card"]',
        (els) => els.length,
      );
      expect(specCardCount).toBeGreaterThan(0);

      // Dedicated test workspace renders
      await page.waitForSelector(
        '[data-testid="dedicated-feature-test-page"]',
        { timeout: 10_000 },
      );
      const workspaceText = await page.$eval(
        '[data-testid="dedicated-feature-test-page"]',
        (el) => el.textContent || "",
      );
      expect(workspaceText).toContain(
        "ManagedSystem Pool Test Specs And Results",
      );

      // Per-spec actions exist
      expect(workspaceText).toContain("Trigger Test");
      expect(workspaceText).toContain("Check Result");
      expect(workspaceText).toContain("Generate Test Script");
      expect(workspaceText).toContain("Request REST Staging Replay");
      expect(workspaceText).toContain("Review Script");

      // No forbidden elements
      expect(workspaceText).not.toContain("Run Local Check");
      expect(briefText).not.toContain("Run Local Check");

      // Evidence / run info visible
      expect(workspaceText).toContain("run_fixture_managedsystem");

      // No JS errors from quality-panel load (ignore 404s from mock server and CDN scripts)
      const criticalErrors = consoleErrors.filter(
        (e) =>
          !e.includes("net::ERR_FAILED") &&
          !e.includes("marked") &&
          !e.includes("404") &&
          !e.includes("Failed to load resource"),
      );
      expect(criticalErrors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 30_000);

  // ── Test 2: Generate Test Script interaction ──

  test("Generate Test Script prefills a scoped prompt without direct mutation", async () => {
    const browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === server?.url.origin) request.continue();
        else request.abort();
      });
      if (!server) throw new Error("test server did not start");

      await page.goto(
        new URL(
          "/projects/aks-rp-e2e/ui/feature?id=managedsystem-pool",
          server.url,
        ).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector('[data-testid="feature-test-spec-card"]', {
        timeout: 10_000,
      });

      // Record comment count before clicking
      const beforeCount = comments.length;

      // Click Generate Test Script on the first spec card that has the button
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector(
          '[data-testid="spec-generate-script"]',
        ) as HTMLButtonElement | null;
        if (!btn) return false;
        btn.click();
        return true;
      });
      expect(clicked).toBe(true);

      // Wait for comment input to be prefilled
      await page.waitForFunction(
        () => {
          const input = document.getElementById(
            "project-comment",
          ) as HTMLInputElement | null;
          return input && input.value.length > 20;
        },
        { timeout: 5_000 },
      );

      const promptValue = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );

      // Prompt must scope to a specific spec
      expect(promptValue).toContain("spec.managedsystem.");
      // Prompt references aks-explorer as owner
      expect(promptValue).toContain("aks-explorer");
      // Prompt warns no cloud mutation
      expect(promptValue).toContain("does NOT execute cloud mutation");
      // Prompt mentions script generation
      expect(promptValue).toContain("Generate");
      // Prompt includes knowledge paths
      expect(promptValue).toContain("path.");
      // Prompt mentions gate checks
      expect(promptValue).toContain("DRY_RUN");

      // No comment was actually submitted (no direct mutation)
      expect(comments.length).toBe(beforeCount);
    } finally {
      await browser.close();
    }
  }, 30_000);

  // ── Test 3: Request REST Staging Replay interaction ──

  test("Request REST Staging Replay prefills an approval request without direct execution", async () => {
    const browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === server?.url.origin) request.continue();
        else request.abort();
      });
      if (!server) throw new Error("test server did not start");

      await page.goto(
        new URL(
          "/projects/aks-rp-e2e/ui/feature?id=managedsystem-pool",
          server.url,
        ).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector('[data-testid="feature-test-spec-card"]', {
        timeout: 10_000,
      });

      const beforeCount = comments.length;

      const clicked = await page.evaluate(() => {
        const btn = document.querySelector(
          '[data-testid="spec-request-staging"]',
        ) as HTMLButtonElement | null;
        if (!btn) return false;
        btn.click();
        return true;
      });
      expect(clicked).toBe(true);

      await page.waitForFunction(
        () => {
          const input = document.getElementById(
            "project-comment",
          ) as HTMLInputElement | null;
          return input && input.value.length > 20;
        },
        { timeout: 5_000 },
      );

      const promptValue = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );

      // Prompt is an approval request, not direct execution
      expect(promptValue).toContain("approval request");
      expect(promptValue).toContain("not a direct execution");
      // Prompt scopes to a spec
      expect(promptValue).toContain("spec.managedsystem.");
      // Prompt lists prerequisites
      expect(promptValue).toContain("Prerequisites");
      // Prompt mentions ALLOW_CLOUD_MUTATION gate
      expect(promptValue).toContain("ALLOW_CLOUD_MUTATION");
      // Prompt says not to execute
      expect(promptValue).toContain("Do NOT execute");

      // No comment was submitted
      expect(comments.length).toBe(beforeCount);
    } finally {
      await browser.close();
    }
  }, 30_000);

  // ── Test 4: Review Script interaction ──

  test("Review Script prefills a script review prompt scoped to the spec", async () => {
    const browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === server?.url.origin) request.continue();
        else request.abort();
      });
      if (!server) throw new Error("test server did not start");

      await page.goto(
        new URL(
          "/projects/aks-rp-e2e/ui/feature?id=managedsystem-pool",
          server.url,
        ).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector('[data-testid="feature-test-spec-card"]', {
        timeout: 10_000,
      });

      const beforeCount = comments.length;

      const clicked = await page.evaluate(() => {
        const btn = document.querySelector(
          '[data-testid="spec-review-script"]',
        ) as HTMLButtonElement | null;
        if (!btn) return false;
        btn.click();
        return true;
      });
      expect(clicked).toBe(true);

      await page.waitForFunction(
        () => {
          const input = document.getElementById(
            "project-comment",
          ) as HTMLInputElement | null;
          return input && input.value.length > 20;
        },
        { timeout: 5_000 },
      );

      const promptValue = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );

      // Prompt is for reviewing a script
      expect(promptValue).toContain("Review");
      // Scoped to the spec
      expect(promptValue).toContain("spec.managedsystem.");
      // Mentions cleanup safety
      expect(promptValue).toContain("cleanup");
      // Mentions gate checks
      expect(promptValue).toContain("DRY_RUN");
      expect(promptValue).toContain("ALLOW_CLOUD_MUTATION");

      // No comment was submitted
      expect(comments.length).toBe(beforeCount);
    } finally {
      await browser.close();
    }
  }, 30_000);
});
