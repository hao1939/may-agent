import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import puppeteer from "puppeteer-core";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(import.meta.dirname, "../../aks-rp-e2e");
const browserPath =
  process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome";
const selectedPathIds = [
  "path.managedsystem.rest-add-existing.minimal-rest",
  "path.managedsystem.mode-immutability",
  "path.managedsystem.delete-existing",
];

type PostedComment = {
  path?: string;
  comment?: string;
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

async function waitFor(assertion: () => boolean, message: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
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

describe("project UI replanning buttons e2e", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;
  const comments: PostedComment[] = [];

  beforeAll(async () => {
    const port = await getFreePort();
    server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/" || url.pathname === "/index.html") {
          return new Response(await projectFile(".app/ui/index.html"), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        if (
          url.pathname === "/projects/aks-rp-e2e/ui/feature" ||
          url.pathname === "/projects/aks-rp-e2e/ui/feature/" ||
          url.pathname === "/projects/aks-rp-e2e/ui/feature/index.html"
        ) {
          return new Response(await projectFile(".app/ui/feature/index.html"), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        if (
          url.pathname === "/kanban" ||
          url.pathname === "/kanban/" ||
          url.pathname === "/kanban/index.html"
        ) {
          return new Response(await projectFile(".app/ui/kanban/index.html"), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        if (
          url.pathname === "/quality-panel.js" ||
          url.pathname === "/projects/aks-rp-e2e/ui/quality-panel.js"
        ) {
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

        if (
          url.pathname === "/kanban/kanban.js" ||
          url.pathname === "/projects/aks-rp-e2e/kanban/kanban.js"
        ) {
          return new Response(await projectFile(".app/ui/kanban/kanban.js"), {
            headers: {
              "content-type": "application/javascript; charset=utf-8",
            },
          });
        }

        if (url.pathname.startsWith("/projects/aks-rp-e2e/")) {
          const relative = decodeURIComponent(
            url.pathname.replace(/^\/projects\/aks-rp-e2e\//, ""),
          );
          if (
            relative === "model/knowledge-map/views/path-summary.json" ||
            relative === "specs/index.json" ||
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

        if (url.pathname === "/api/projects/content") {
          return jsonResponse({
            content: await projectFile(".app/project.json"),
          });
        }

        if (url.pathname === "/api/projects/artifact") {
          const file = url.searchParams.get("file") || "";
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
            ![
              "model/knowledge-map/model.json",
              "model/knowledge-map/views/path-summary.json",
              "specs/index.json",
              ".app/tasks/tree.json",
              "tasks/tree.json",
            ].includes(file)
          ) {
            return jsonResponse({ error: `Unexpected artifact ${file}` }, 404);
          }
          if (file === "tasks/tree.json")
            return jsonResponse({
              content: await projectFile(".app/tasks/tree.json"),
            });
          return jsonResponse({ content: await projectFile(file) });
        }

        if (url.pathname === "/api/projects/comment" && req.method === "POST") {
          comments.push((await req.json()) as PostedComment);
          return jsonResponse({ ok: true });
        }

        if (url.pathname === "/api/events" && req.method === "POST") {
          const body = (await req.json()) as Record<string, unknown>;
          const params =
            body.params && typeof body.params === "object"
              ? (body.params as Record<string, unknown>)
              : {};
          const data =
            body.data && typeof body.data === "object"
              ? (body.data as Record<string, unknown>)
              : {};
          const eventParams =
            data.params && typeof data.params === "object"
              ? (data.params as Record<string, unknown>)
              : params;
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

  test("submits aks-explorer replan/live prompts and keeps local-command as prefill only", async () => {
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
      await page.goto(server.url.toString(), { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".aks-replan-row input", { timeout: 10_000 });
      const pageText = await page.$eval(
        "#quality-panel",
        (el) => el.textContent || "",
      );
      expect(pageText).toContain("AKS input/expectation knowledge workspace");
      expect(pageText).toContain("Selected Workbench");
      expect(pageText).toContain("Review Inputs");
      expect(pageText).toContain("Feature Explorer");
      expect(pageText).not.toContain("Project Task Tree");
      expect(pageText).not.toContain("Kanban Board");
      const kanbanHref = await page.$eval(
        'a[href$="/ui/kanban/"], a[href="kanban/"]',
        (el) => (el as HTMLAnchorElement).getAttribute("href") || "",
      );
      expect(kanbanHref).toContain("kanban");
      await page.waitForSelector(".aks-replan-row input", { timeout: 10_000 });

      for (const pathId of selectedPathIds) {
        const clicked = await page.evaluate((id) => {
          const row = [...document.querySelectorAll(".aks-replan-row")].find(
            (el) => el.textContent?.includes(id),
          );
          const input = row?.querySelector("input");
          if (!input) return false;
          (input as HTMLInputElement).click();
          return true;
        }, pathId);
        expect(clicked, `missing replan path checkbox ${pathId}`).toBe(true);
        await page.waitForFunction(
          (ids) => {
            const selected = JSON.parse(
              sessionStorage.getItem("aksSelectedReplanPathIds") || "[]",
            );
            return ids.every((id: string) => selected.includes(id));
          },
          {},
          selectedPathIds.slice(0, selectedPathIds.indexOf(pathId) + 1),
        );
      }

      const clickButton = async (label: string) => {
        const clicked = await page.evaluate((text) => {
          const button = [...document.querySelectorAll("button")].find(
            (el) => el.textContent?.trim() === text,
          );
          if (!button) return false;
          (button as HTMLButtonElement).click();
          return true;
        }, label);
        expect(clicked, `missing button ${label}`).toBe(true);
      };

      await clickButton("Ask aks-explorer To Replan");
      await waitFor(
        () => comments.length === 1,
        "replan prompt was not posted",
      );
      expect(comments[0]?.path).toBe("projects/aks-rp-e2e");
      expect(comments[0]?.comment).toContain(
        "[resume] Replan aks-rp-e2e for selected knowledge paths:",
      );
      expect(comments[0]?.comment).toContain(
        "\n\n- path.managedsystem.rest-add-existing.minimal-rest",
      );
      for (const pathId of selectedPathIds) {
        expect(comments[0]?.comment).toContain(`- ${pathId}`);
      }
      expect(
        await page.$eval(
          "#project-comment",
          (el) => (el as HTMLInputElement).value,
        ),
      ).toBe("");

      await clickButton("Ask aks-explorer To Run Live");
      await waitFor(
        () => comments.length === 2,
        "live run prompt was not posted",
      );
      expect(comments[1]?.path).toBe("projects/aks-rp-e2e");
      expect(comments[1]?.comment).toContain(
        "Run the selected aks-rp-e2e replanned test live",
      );
      expect(comments[1]?.comment).toContain("AKS_RP_E2E_DRY_RUN=0");
      for (const pathId of selectedPathIds) {
        expect(comments[1]?.comment).toContain(`- ${pathId}`);
      }

      await clickButton("Use Local Command");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(comments).toHaveLength(2);
      const localCommand = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );
      expect(localCommand).toContain(
        "bun model/tools/src/replan-feature-paths.ts",
      );
      expect(localCommand).toContain(
        "bun test .app/e2e/replanning-flow.test.ts",
      );
      for (const pathId of selectedPathIds) {
        expect(localCommand).toContain(pathId);
      }

      await clickButton("Clear");
      await page.waitForFunction(() => {
        const selected = JSON.parse(
          sessionStorage.getItem("aksSelectedReplanPathIds") || "[]",
        );
        return Array.isArray(selected) && selected.length === 0;
      });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".aks-replan-row input")].filter(
            (input) => (input as HTMLInputElement).checked,
          ).length === 0,
      );
      const checkedCount = await page.$$eval(
        ".aks-replan-row input",
        (inputs) =>
          inputs.filter((input) => (input as HTMLInputElement).checked).length,
      );
      expect(checkedCount).toBe(0);
      expect(comments).toHaveLength(2);
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("renders dedicated task kanban page and posts task steering comments", async () => {
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
      await page.goto(new URL("/kanban/", server.url).toString(), {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector('[data-testid="kanban-page"]', {
        timeout: 10_000,
      });
      await page.waitForSelector('[data-testid="kanban-board"]', {
        timeout: 10_000,
      });
      await page.waitForSelector('[data-testid="task-breakdown"]', {
        timeout: 10_000,
      });
      await page.waitForSelector('[data-testid="task-detail"]', {
        timeout: 10_000,
      });

      const text = await page.$eval(
        '[data-testid="kanban-page"]',
        (el) => el.textContent || "",
      );
      expect(text).toContain("Current Work");
      expect(text).toContain("Kanban Board");
      expect(text).toContain("Planning");
      expect(text).toContain("Backlog");
      expect(text).toContain("In Progress");
      expect(text).toContain("Archive");
      expect(text).toContain("Task Tree");
      expect(text).toContain("Talk With The Agent");

      const tree = JSON.parse(await projectFile(".app/tasks/tree.json"));
      const tasks = Object.values(tree.tasks ?? {}) as Array<{
        id?: string;
        status?: string;
        kind?: string;
        children?: string[];
      }>;
      const leafWorkflowTasks = tasks.filter(
        (task) =>
          task.id !== tree.root_task_id && !(task.children ?? []).length,
      );
      const planningCount = leafWorkflowTasks.filter(
        (task) =>
          ["frontier_replan", "domain_planner"].includes(task.kind || "") &&
          ["proposed", "ready", "active"].includes(task.status || ""),
      ).length;
      const activeCount = leafWorkflowTasks.filter(
        (task) =>
          task.status === "active" &&
          !["frontier_replan", "domain_planner"].includes(task.kind || ""),
      ).length;
      const planningLaneCount = await page.$eval(
        '[data-testid="kanban-planning"] .pill',
        (el) => el.textContent || "",
      );
      expect(Number(planningLaneCount)).toBe(planningCount);
      const inProgressCount = await page.$eval(
        '[data-testid="kanban-in-progress"] .pill',
        (el) => el.textContent || "",
      );
      expect(Number(inProgressCount)).toBe(activeCount);
      const proposedLeafCount = leafWorkflowTasks.filter(
        (task) => task.status === "proposed",
      ).length;
      const backlogCount = await page.$eval(
        '[data-testid="kanban-backlog"] .pill',
        (el) => el.textContent || "",
      );
      expect(Number(backlogCount)).toBe(proposedLeafCount);
      const activePlanningCount = leafWorkflowTasks.filter(
        (task) =>
          ["frontier_replan", "domain_planner"].includes(task.kind || "") &&
          task.status === "active",
      ).length;
      const readyLeafCount = leafWorkflowTasks.filter(
        (task) =>
          task.status === "ready" &&
          !["frontier_replan", "domain_planner"].includes(task.kind || ""),
      ).length;
      const warning = await page.$$(
        '[data-testid="planning-empty-backlog-warning"]',
      );
      expect(warning.length).toBe(
        activePlanningCount > 0 &&
          proposedLeafCount === 0 &&
          readyLeafCount === 0 &&
          activeCount === 0
          ? 1
          : 0,
      );
      const backlogText = await page.$eval(
        '[data-testid="kanban-backlog"]',
        (el) => el.textContent || "",
      );
      expect(backlogText).not.toContain("projectLearn AKS input space");

      const rowsBeforeCollapse = await page.$$eval(
        '[data-testid="task-breakdown"] .tree-row',
        (rows) => rows.length,
      );
      await page.click('[data-testid="tree-toggle"]');
      const rowsAfterCollapse = await page.$$eval(
        '[data-testid="task-breakdown"] .tree-row',
        (rows) => rows.length,
      );
      expect(rowsAfterCollapse).toBeLessThan(rowsBeforeCollapse);
      const collapsedSummary = await page.$eval(
        '[data-testid="tree-summary"]',
        (el) => el.textContent || "",
      );
      expect(collapsedSummary).toContain("hidden");
      const statusChips = await page.$$eval(
        '[data-testid="tree-summary"] .summary-chip',
        (chips) => chips.map((chip) => chip.textContent || ""),
      );
      expect(statusChips.length).toBeGreaterThan(0);
      expect(statusChips.some((text) => /\d+/.test(text))).toBe(true);

      await page.click('[data-testid="task-breakdown"] .tree-row');
      const splitClicked = await page.evaluate(() => {
        const button = [...document.querySelectorAll("button")].find(
          (el) => el.textContent?.trim() === "Split",
        );
        if (!button) return false;
        (button as HTMLButtonElement).click();
        return true;
      });
      expect(splitClicked).toBe(true);
      const textareaValue = await page.$eval(
        '[data-testid="steer-textarea"]',
        (el) => (el as HTMLTextAreaElement).value,
      );
      expect(textareaValue).toContain("[task-steer] aks-rp-e2e task");
      expect(textareaValue).toContain("action: split");

      const before = comments.length;
      await page.click('[data-testid="send-steering"]');
      await waitFor(
        () => comments.length === before + 1,
        "kanban steering comment was not posted",
      );
      expect(comments.at(-1)?.path).toBe("projects/aks-rp-e2e");
      expect(comments.at(-1)?.comment).toContain("action: split");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("renders project snapshot band with goal, status counts, frontier, and kanban link", async () => {
    const browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server!.port}/`, {
        waitUntil: "networkidle0",
      });

      // Wait for snapshot to be populated
      await page.waitForSelector("#project-snapshot", { timeout: 10_000 });

      // Goal text is present
      const goalText = await page.$eval(
        "#snapshot-goal",
        (el) => el.textContent || "",
      );
      expect(goalText.length).toBeGreaterThan(10);
      expect(goalText.toLowerCase()).toContain("aks");

      // Status counts are rendered
      const countsHtml = await page.$eval(
        "#snapshot-counts",
        (el) => el.innerHTML || "",
      );
      expect(countsHtml).toContain("pass");
      expect(countsHtml).toContain("fail");
      expect(countsHtml).toContain("blocked");
      expect(countsHtml).toContain("unknown");
      // At least one count is a number
      const countNumbers = await page.$$eval("#snapshot-counts strong", (els) =>
        els.map((el) => el.textContent),
      );
      expect(countNumbers.length).toBe(4);
      expect(countNumbers.every((n) => /^\d+$/.test(n || ""))).toBe(true);

      // Frontier text mentions at least one feature
      const frontierText = await page.$eval(
        "#snapshot-frontier",
        (el) => el.textContent || "",
      );
      expect(frontierText).toContain("Frontier:");

      // Kanban link present in snapshot
      const kanbanLink = await page.$eval(
        "#project-snapshot a[href*='kanban']",
        (el) => el.textContent || "",
      );
      expect(kanbanLink).toContain("kanban");

      // Snapshot does NOT duplicate task execution state (no task IDs, no worker names)
      const snapshotFull = await page.$eval(
        "#project-snapshot",
        (el) => el.textContent || "",
      );
      expect(snapshotFull).not.toContain("worker");
      expect(snapshotFull).not.toContain("aks-explorer");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("Feature Explorer is primary review surface with open, select, review, challenge, suggest actions", async () => {
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
      await page.goto(server.url.toString(), { waitUntil: "networkidle0" });

      // Feature Explorer title is rendered
      await page.waitForSelector('[data-testid="feature-explorer-title"]', {
        timeout: 10_000,
      });
      const explorerTitle = await page.$eval(
        '[data-testid="feature-explorer-title"]',
        (el) => el.textContent || "",
      );
      expect(explorerTitle).toBe("Feature Explorer");

      // Attention Queue is now a collapsed drawer (not the main surface)
      const attentionDrawer = await page.$(
        "details.aks-drawer .aks-drawer-summary",
      );
      const drawerTexts = await page.$$eval(
        "details.aks-drawer .aks-drawer-summary, details.aks-drawer summary.aks-drawer-summary",
        (els) => els.map((el) => el.textContent || ""),
      );
      const hasAttentionDrawer = drawerTexts.some((t) =>
        t.includes("Attention Queue"),
      );
      expect(hasAttentionDrawer).toBe(true);

      // Feature Explorer has the action columns: Open, Select, Audit, Suggest
      const explorerText = await page.evaluate(() => {
        const el = document
          .querySelector('[data-testid="feature-explorer-title"]')
          ?.closest("div[style]");
        return el?.parentElement?.textContent || "";
      });
      // The table and rows have Open/Select/Audit/Suggest buttons
      const actionButtons = await page.$$eval(
        "button.aks-btn, label.aks-btn",
        (els) => els.map((el) => el.textContent?.trim() || ""),
      );
      expect(actionButtons).toContain("Open");
      expect(actionButtons).toContain("Audit");
      expect(actionButtons).toContain("Suggest");

      // Select a feature group checkbox
      const selectLabels = await page.$$(
        "label.aks-btn input[type='checkbox']",
      );
      expect(selectLabels.length).toBeGreaterThan(0);
      await selectLabels[0].click();
      await page.waitForFunction(
        () => {
          const selected = JSON.parse(
            sessionStorage.getItem("aksSelectedFeatureIds") || "[]",
          );
          return selected.length === 1;
        },
        { timeout: 5_000 },
      );
      const selectedFeatures = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("aksSelectedFeatureIds") || "[]"),
      );
      expect(selectedFeatures).toHaveLength(1);

      // Open a feature page
      const openClicked = await page.evaluate(() => {
        const btn = [
          ...document.querySelectorAll("button.aks-btn-primary"),
        ].find((el) => el.textContent?.trim() === "Open");
        if (!btn) return false;
        (btn as HTMLButtonElement).click();
        return true;
      });
      expect(openClicked).toBe(true);

      // Feature page renders with review actions
      await page.waitForFunction(
        () => document.querySelector(".aks-feature-page") !== null,
        { timeout: 5_000 },
      );
      const featurePageText = await page.$eval(
        ".aks-feature-page",
        (el) => el.textContent || "",
      );
      expect(featurePageText).toContain("Ask aks-explorer To Audit");
      expect(featurePageText).toContain("Manual Verify");
      expect(featurePageText).toContain("Suggest As Next");
      expect(featurePageText).toContain("Challenge Verdict");
      expect(featurePageText).toContain("Feature Contract");

      // Challenge action prefills comment
      const beforeComments = comments.length;
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button.aks-btn")].find(
          (el) => el.textContent?.trim() === "Challenge Verdict",
        );
        if (btn) (btn as HTMLButtonElement).click();
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const commentValue = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );
      expect(commentValue).toContain("[resume] Challenge");
      // Should not have posted (prefill only)
      expect(comments.length).toBe(beforeComments);

      // Back button returns to explorer
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button.aks-btn")].find(
          (el) => el.textContent?.trim() === "Back To Knowledge Map",
        );
        if (btn) (btn as HTMLButtonElement).click();
      });
      await page.waitForSelector('[data-testid="feature-explorer-title"]', {
        timeout: 5_000,
      });
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("Selected Workbench routes feature-only selections to review/plan and spec-backed to replan", async () => {
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
      await page.goto(server.url.toString(), { waitUntil: "networkidle0" });

      // Selected Workbench is rendered
      await page.waitForSelector('[data-testid="selected-workbench-title"]', {
        timeout: 10_000,
      });
      const title = await page.$eval(
        '[data-testid="selected-workbench-title"]',
        (el) => el.textContent || "",
      );
      expect(title).toBe("Selected Workbench");

      // Path-Level Replan section exists (reached through Selected Workbench)
      await page.waitForSelector('[data-testid="replan-builder"]', {
        timeout: 10_000,
      });
      const replanText = await page.$eval(
        '[data-testid="replan-builder"]',
        (el) => el.textContent || "",
      );
      expect(replanText).toContain("Path-Level Replan");

      // Select a feature using the checkbox in the Selected Workbench
      const workbench = await page.$('[data-testid="selected-workbench"]');
      expect(workbench).not.toBeNull();
      const checkbox = await workbench!.$('input[type="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        await page.waitForFunction(
          () => {
            const selected = JSON.parse(
              sessionStorage.getItem("aksSelectedFeatureIds") || "[]",
            );
            return selected.length >= 1;
          },
          { timeout: 5_000 },
        );

        // Re-render happens; check which primary button appears
        await new Promise((resolve) => setTimeout(resolve, 300));
        const workbenchButtons = await page.$$eval(
          '[data-testid="selected-workbench"] button.aks-btn-primary',
          (els) => els.map((el) => el.textContent?.trim() || ""),
        );
        // Should be either "Replan Selected" (if spec-backed) or "Review / Plan Selected" (if no specs)
        const hasReplan = workbenchButtons.includes("Replan Selected");
        const hasReviewPlan = workbenchButtons.includes(
          "Review / Plan Selected",
        );
        expect(hasReplan || hasReviewPlan).toBe(true);

        // If "Review / Plan Selected" is shown, clicking it prefills without posting
        if (hasReviewPlan) {
          const beforeCount = comments.length;
          await page.evaluate(() => {
            const btn = [
              ...document.querySelectorAll(
                '[data-testid="selected-workbench"] button.aks-btn-primary',
              ),
            ].find((el) => el.textContent?.trim() === "Review / Plan Selected");
            if (btn) (btn as HTMLButtonElement).click();
          });
          await new Promise((resolve) => setTimeout(resolve, 200));
          const prefilled = await page.$eval(
            "#project-comment",
            (el) => (el as HTMLInputElement).value,
          );
          expect(prefilled).toContain("[resume] Review");
          // Prefill only, not posted
          expect(comments.length).toBe(beforeCount);
        }

        // Clear selection
        await page.evaluate(() => {
          const btn = [
            ...document.querySelectorAll(
              '[data-testid="selected-workbench"] button',
            ),
          ].find((el) => el.textContent?.trim() === "Clear Selection");
          if (btn) (btn as HTMLButtonElement).click();
        });
        await page.waitForFunction(
          () => {
            const selected = JSON.parse(
              sessionStorage.getItem("aksSelectedFeatureIds") || "[]",
            );
            return selected.length === 0;
          },
          { timeout: 5_000 },
        );
      }
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("opens reusable feature page through stable hash route", async () => {
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
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });
      const featureText = await page.$eval(
        "#quality-panel",
        (el) => el.textContent || "",
      );
      expect(featureText).toContain("ManagedSystem Pool");
      expect(featureText).toContain("Feature Contract");
      expect(featureText).toContain("Feature Review");
      expect(featureText).toContain("Test Specs");

      const hash = await page.evaluate(() => window.location.hash);
      expect(hash).toBe("#/feature/managedsystem-pool");

      const storedFeature = await page.evaluate(() =>
        sessionStorage.getItem("aksSelectedFeatureId"),
      );
      expect(storedFeature).toBe("managedsystem-pool");

      const clickedBack = await page.evaluate(() => {
        const button = [...document.querySelectorAll("button")].find(
          (el) => el.textContent?.trim() === "Back To Knowledge Map",
        );
        if (!button) return false;
        (button as HTMLButtonElement).click();
        return true;
      });
      expect(clickedBack).toBe(true);
      await page.waitForSelector('[data-testid="feature-explorer-title"]', {
        timeout: 10_000,
      });
      const clearedHash = await page.evaluate(() => window.location.hash);
      expect(clearedHash).toBe("");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("feature page renders ManagedSystem Pool contract, input/expectation paths, verification, results, and review actions", async () => {
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

      // Direct feature route for ManagedSystem Pool
      await page.goto(
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });
      const text = await page.$eval(
        ".aks-feature-page",
        (el) => el.textContent || "",
      );

      // Feature contract section
      expect(text).toContain("Feature Contract");
      expect(text).toContain("Purpose / Intent");
      expect(text).toContain("Current Claim");
      expect(text).toContain("Current Gap");
      expect(text).toContain("Source References By Role");
      expect(text).toContain("Constraints");

      // Input/expectation paths with ManagedSystem-specific paths
      expect(text).toContain("Knowledge Paths");
      expect(text).toContain("ManagedSystem Pool");
      // Check for specific path varieties
      expect(text).toContain("ARM REST");
      expect(text).toContain("Mode Immutability");
      expect(text).toContain("Delete Existing");
      // Behavior alignment data
      expect(text).toContain("Behavior Alignment");
      expect(text).toContain("Selected Inputs");

      // Verification section: test specs listed
      expect(text).toContain("Test Specs");
      expect(text).toContain("spec.managedsystem");

      // Results section
      expect(text).toContain("Tests And Judgments");
      // Pass and fail results present for ManagedSystem
      expect(text).toContain("pass");
      expect(text).toContain("fail");

      // Review actions — human input actions
      await page.waitForSelector('[data-testid="feature-input-actions"]', {
        timeout: 5_000,
      });
      const inputActions = await page.$eval(
        '[data-testid="feature-input-actions"]',
        (el) => el.textContent || "",
      );
      expect(inputActions).toContain("Add Reference");
      expect(inputActions).toContain("Add Expected Behavior");
      expect(inputActions).toContain("Mark Source of Truth");
      expect(inputActions).toContain("Suggest Missing Path");
      expect(inputActions).toContain("Make Feature Next");

      // Review actions — verification review actions
      await page.waitForSelector('[data-testid="feature-review-actions"]', {
        timeout: 5_000,
      });
      const reviewActions = await page.$eval(
        '[data-testid="feature-review-actions"]',
        (el) => el.textContent || "",
      );
      expect(reviewActions).toContain("Review Spec");
      expect(reviewActions).toContain("Review Script");
      expect(reviewActions).not.toContain("Approve Local Check");
      expect(reviewActions).not.toContain("Run Local Check");
      expect(reviewActions).not.toContain("Run Local Preflight");
      expect(reviewActions).toContain("Request REST Staging Replay");
      expect(reviewActions).toContain("Classify Result");
      expect(reviewActions).toContain("Approve Model Update");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("feature page action prompts include feature/path context and do not trigger live mutation", async () => {
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
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });

      const beforeComments = comments.length;

      // Test each action button prefills with context but does not post
      const actionsToTest = [
        { label: "Add Reference", expectInPrompt: "managedsystem-pool" },
        {
          label: "Add Expected Behavior",
          expectInPrompt: "managedsystem-pool",
        },
        { label: "Review Spec", expectInPrompt: "managedsystem-pool" },
        {
          label: "Request REST Staging Replay",
          expectInPrompt: "approval request",
        },
        {
          label: "Approve Model Update",
          expectInPrompt: "Model status changes require evidence",
        },
        {
          label: "Generate Test Script",
          expectInPrompt: "Generate a REST-first test script",
        },
      ];

      for (const action of actionsToTest) {
        await page.evaluate((label) => {
          const btn = [...document.querySelectorAll("button.aks-btn")].find(
            (el) => el.textContent?.trim() === label,
          );
          if (btn) (btn as HTMLButtonElement).click();
        }, action.label);
        await new Promise((resolve) => setTimeout(resolve, 150));
        const val = await page.$eval(
          "#project-comment",
          (el) => (el as HTMLInputElement).value,
        );
        expect(val, `${action.label} should prefill with context`).toContain(
          action.expectInPrompt,
        );
        // None should have posted a comment
        expect(comments.length, `${action.label} should not post`).toBe(
          beforeComments,
        );
      }

      // Verify staging request prompt warns about not executing
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button.aks-btn")].find(
          (el) => el.textContent?.trim() === "Request REST Staging Replay",
        );
        if (btn) (btn as HTMLButtonElement).click();
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const stagingPrompt = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );
      expect(stagingPrompt).toContain("NOT execute");
      expect(stagingPrompt).not.toContain("DRY_RUN=0");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("dedicated feature page reviews full test specs and triggers one gated test request", async () => {
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
      await page.waitForSelector(
        '[data-testid="dedicated-feature-test-page"]',
        { timeout: 10_000 },
      );
      await page.waitForSelector('[data-testid="feature-test-spec-card"]', {
        timeout: 10_000,
      });

      const pageText = await page.$eval(
        '[data-testid="dedicated-feature-test-page"]',
        (el) => el.textContent || "",
      );
      expect(pageText).toContain("ManagedSystem Pool Test Specs And Results");
      expect(pageText).toContain("User Scenario");
      expect(pageText).toContain("Expectation Brief");
      expect(pageText).toContain("Execution Method");
      expect(pageText).toContain("Review Test Spec");
      expect(pageText).toContain("Test Lifecycle");
      expect(pageText).toContain("Execution Variants");
      expect(pageText).toContain("env: staging");
      expect(pageText).toContain("surface: REST");
      expect(pageText).toContain("linked runs");
      expect(pageText).toContain("run_fixture_managedsystem");
      expect(pageText).toContain("runner: passed");
      expect(pageText).toContain("diagnosis: product_pass");
      await page.waitForSelector('[data-testid="feature-test-runs-panel"]', {
        timeout: 5_000,
      });
      const runsPanelText = await page.$eval(
        '[data-testid="feature-test-runs-panel"]',
        (el) => el.textContent || "",
      );
      expect(runsPanelText).toContain("Triggered Test Progress");
      expect(runsPanelText).toContain("run_fixture_managedsystem");
      expect(runsPanelText).toContain("Check Result");
      expect(runsPanelText).toContain("diagnosis: product_pass");
      expect(pageText).toContain("ManagedSystem pool add-existing lifecycle");
      expect(pageText).toContain(
        "ManagedSystem field rejection matrix for user-controlled pool mutations",
      );
      expect(pageText).toContain("Test Cases");
      expect(pageText).toContain("Operations");
      expect(pageText).toContain("Assertions");
      expect(pageText).toContain("Cleanup");
      expect(pageText).toContain("Trigger Test");
      expect(pageText).toContain("Check Result");
      expect(pageText).not.toContain("Run Local Check");

      const cliCreateCardText = await page.evaluate(() => {
        const card = [
          ...document.querySelectorAll(
            '[data-testid="feature-test-spec-card"]',
          ),
        ].find((el) =>
          el.textContent?.includes(
            "spec.managedsystem.cli-create-default-payload",
          ),
        );
        return card?.textContent || "";
      });
      expect(cliCreateCardText).toBe("");

      const standaloneCardText = await page.evaluate(() => {
        const card = [
          ...document.querySelectorAll(
            '[data-testid="feature-test-spec-card"]',
          ),
        ].find((el) =>
          el.textContent?.includes(
            "spec.managedsystem.standalone-e2ev3-enable",
          ),
        );
        return card?.textContent || "";
      });
      expect(standaloneCardText).toBe("");

      const restCardText = await page.evaluate(() => {
        const card = [
          ...document.querySelectorAll(
            '[data-testid="feature-test-spec-card"]',
          ),
        ].find((el) =>
          el.textContent?.includes(
            "spec.managedsystem.rest-add-existing.minimal-rest",
          ),
        );
        return card?.textContent || "";
      });
      expect(restCardText).toContain(
        "ManagedSystem pool add-existing lifecycle",
      );
      expect(restCardText).toContain("target.staging-rest-request");

      expect(restCardText).not.toContain("Review Request");

      const beforeCount = comments.length;
      const clickedRestSpec = await page.evaluate(() => {
        const card = [
          ...document.querySelectorAll(
            '[data-testid="feature-test-spec-card"]',
          ),
        ].find((el) =>
          el.textContent?.includes(
            "spec.managedsystem.rest-add-existing.minimal-rest",
          ),
        );
        const button = card?.querySelector(
          '[data-testid="trigger-feature-test"]',
        ) as HTMLButtonElement | null;
        if (!button) return false;
        button.click();
        return true;
      });
      expect(clickedRestSpec).toBe(true);
      await waitFor(
        () => comments.length === beforeCount + 1,
        "single test request was not posted",
      );
      const requestBody = comments[comments.length - 1] as unknown as {
        type?: string;
        action?: string;
        data?: {
          project?: string;
          projectPath?: string;
          reason?: string;
          action?: string;
          params?: {
            featureId?: string;
            specId?: string;
            selectedPathIds?: string[];
            runMode?: string;
            liveRun?: boolean;
            gatedLiveRun?: boolean;
            prompt?: string;
          };
        };
      };
      expect(requestBody.type).toBe("project.execution.requested");
      expect(requestBody.data?.project).toBe("aks-rp-e2e");
      expect(requestBody.data?.projectPath).toBe("projects/aks-rp-e2e");
      expect(requestBody.data?.reason).toBe("feature-test.requested");
      expect(requestBody.data?.action).toBe("execute-run");
      expect(requestBody.data?.params?.featureId).toBe("managedsystem-pool");
      expect(requestBody.data?.params?.specId).toBe(
        "spec.managedsystem.rest-add-existing.minimal-rest",
      );
      expect(requestBody.data?.params?.selectedPathIds).toContain(
        "path.managedsystem.rest-add-existing.minimal-rest",
      );
      expect(requestBody.data?.params?.runMode).toBe(
        "gated-rest-staging-replay",
      );
      expect(requestBody.data?.params?.liveRun).toBe(true);
      expect(requestBody.data?.params?.gatedLiveRun).toBe(true);
      expect(requestBody.data?.params?.prompt).toContain(
        "project-owner workflow",
      );
      expect(requestBody.data?.params?.prompt).toContain(
        "Before mutation, verify owner preflight",
      );
      expect(requestBody.data?.params?.prompt).toContain(
        "executionSurface: typescript-js-rest-replay",
      );

      await page.waitForSelector('[data-testid="aks-receipt"]', {
        timeout: 10_000,
      });
      const receipt = await page.$eval(
        '[data-testid="aks-receipt"]',
        (el) => el.textContent || "",
      );
      expect(receipt).toContain("trigger-test");
      expect(receipt).toContain("queued");
      expect(receipt).toContain("req_test_managedsystem");

      const resultText = await page.evaluate(() => {
        const card = [
          ...document.querySelectorAll(
            '[data-testid="feature-test-spec-card"]',
          ),
        ].find((el) =>
          el.textContent?.includes(
            "spec.managedsystem.rest-add-existing.minimal-rest",
          ),
        );
        return card?.querySelector(".feature-result-panel")?.textContent || "";
      });
      expect(resultText).toContain("Test request linked");
      expect(resultText).toContain("req_test_managedsystem");
      expect(resultText).toContain("run_test_managedsystem");
      expect(resultText).toContain("feature-test.requested");
      expect(resultText).toContain("test-workflow-run");
      expect(resultText).toContain("Task Kanban");
      expect(resultText).toContain("Mapped Spec And Feature Model State");
      expect(resultText).toContain("agentPool.type.virtualMachines");
      expect(resultText).toContain("agentPool.nodeTaints.criticalAddonsOnly");
      expect(resultText).not.toContain(
        "agentPool.managedsystem.azureManagedNodes",
      );
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("explorer-to-feature navigation works via Open button and preserves route", async () => {
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

      // Start at the explorer (map view)
      await page.goto(server.url.toString(), { waitUntil: "networkidle0" });
      await page.waitForSelector('[data-testid="feature-explorer-title"]', {
        timeout: 10_000,
      });

      // Find and click the Open button for any feature row
      const opened = await page.evaluate(() => {
        const buttons = [
          ...document.querySelectorAll("button.aks-btn-primary"),
        ];
        const openBtn = buttons.find((el) => el.textContent?.trim() === "Open");
        if (!openBtn) return null;
        // Get the feature id from the row context
        (openBtn as HTMLButtonElement).click();
        return true;
      });
      expect(opened).toBe(true);

      // Should navigate to a feature page
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });
      const hash = await page.evaluate(() => window.location.hash);
      expect(hash).toMatch(/^#\/feature\/.+$/);

      // Feature page has the expected sections
      const pageText = await page.$eval(
        ".aks-feature-page",
        (el) => el.textContent || "",
      );
      expect(pageText).toContain("Feature Contract");
      expect(pageText).toContain("Knowledge Paths");
      expect(pageText).toContain("Back To Knowledge Map");

      // Navigate back
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button.aks-btn")].find(
          (el) => el.textContent?.trim() === "Back To Knowledge Map",
        );
        if (btn) (btn as HTMLButtonElement).click();
      });
      await page.waitForSelector('[data-testid="feature-explorer-title"]', {
        timeout: 10_000,
      });
      const clearedHash = await page.evaluate(() => window.location.hash);
      expect(clearedHash).toBe("");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("path detail page shows verification pipeline and path-level review actions", async () => {
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

      // Navigate to ManagedSystem Pool feature first
      await page.goto(
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });

      // Click "Open Path" on the first knowledge path
      const pathOpened = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button.aks-btn")].find(
          (el) => el.textContent?.trim() === "Open Path",
        );
        if (!btn) return false;
        (btn as HTMLButtonElement).click();
        return true;
      });
      expect(pathOpened).toBe(true);

      // Wait for path detail page
      await page.waitForSelector('[data-testid="verification-pipeline"]', {
        timeout: 10_000,
      });
      const pathText = await page.$eval(
        ".aks-feature-page",
        (el) => el.textContent || "",
      );

      // Verification pipeline stages
      expect(pathText).toContain("Verification Pipeline");
      expect(pathText).toContain("Test Spec");
      expect(pathText).toContain("Run Plan");
      expect(pathText).toContain("Replay Script");
      expect(pathText).toContain("Internal Preflight");
      expect(pathText).not.toContain("Run Local Check");
      expect(pathText).toContain("Execution Gate");
      expect(pathText).toContain("Model Verdict");

      // Input shape detail
      await page.waitForSelector('[data-testid="input-shape-detail"]', {
        timeout: 5_000,
      });
      const inputText = await page.$eval(
        '[data-testid="input-shape-detail"]',
        (el) => el.textContent || "",
      );
      expect(inputText).toContain("Input Shape");

      // Path-level review actions
      await page.waitForSelector('[data-testid="path-review-actions"]', {
        timeout: 5_000,
      });
      const pathActions = await page.$eval(
        '[data-testid="path-review-actions"]',
        (el) => el.textContent || "",
      );
      expect(pathActions).toContain("Review Spec");
      expect(pathActions).toContain("Review Script");
      expect(pathActions).not.toContain("Approve Local Check");
      expect(pathActions).not.toContain("Run Local Check");
      expect(pathActions).not.toContain("Run Local Preflight");
      expect(pathActions).toContain("Request REST Staging Replay");
      expect(pathActions).toContain("Classify Result");
      expect(pathActions).toContain("Approve Model Update");

      // Path review action prefills with path context, not mutation
      const beforeComments = comments.length;
      await page.evaluate(() => {
        const btn = [
          ...document.querySelectorAll(
            '[data-testid="path-review-actions"] button',
          ),
        ].find((el) => el.textContent?.trim() === "Review Spec");
        if (btn) (btn as HTMLButtonElement).click();
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const specPrompt = await page.$eval(
        "#project-comment",
        (el) => (el as HTMLInputElement).value,
      );
      expect(specPrompt).toContain("[resume] Review");
      expect(specPrompt).toContain("path.");
      expect(comments.length).toBe(beforeComments);
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("receipt appears after successful submitAksRpE2eProjectComment", async () => {
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
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });
      await page.evaluate(() => {
        (window as any).submitAksRpE2eProjectComment(
          "audit feature managedsystem-pool (managedsystem-pool)",
        );
      });
      await page.waitForSelector('[data-testid="aks-receipt"]', {
        timeout: 10_000,
      });
      const receipt = await page.$eval(
        '[data-testid="aks-receipt"]',
        (el) => el.textContent || "",
      );
      expect(receipt).toContain("audit");
      expect(receipt).toContain("requested");
      expect(receipt).toContain("feature: managedsystem-pool");
      expect(receipt).toContain("owner: aks-explorer");
      expect(receipt).toMatch(/\d{4}-\d{2}-\d{2}/);
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("error receipt appears after failed submitAksRpE2eProjectComment (HTTP 500)", async () => {
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
        if (requestUrl.pathname === "/api/projects/comment") {
          request.respond({
            status: 500,
            contentType: "application/json",
            body: '{"error":"Internal Server Error"}',
          });
        } else if (requestUrl.origin === server?.url.origin) {
          request.continue();
        } else {
          request.abort();
        }
      });
      if (!server) throw new Error("test server did not start");
      await page.goto(
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });
      await page.evaluate(() => {
        (window as any).submitAksRpE2eProjectComment(
          "audit feature managedsystem-pool (managedsystem-pool)",
        );
      });
      await page.waitForSelector('[data-testid="aks-receipt"]', {
        timeout: 10_000,
      });
      const receipt = await page.$eval(
        '[data-testid="aks-receipt"]',
        (el) => el.textContent || "",
      );
      expect(receipt).toContain("error");
      expect(receipt).toContain("\u2717");
      expect(receipt).toContain("Recovery:");
      expect(receipt).toContain("owner: aks-explorer");
    } finally {
      await browser.close();
    }
  }, 30_000);

  test("paths in generated or internally-preflighted state do NOT show Verified badge; staging-evidence paths do", async () => {
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

      // Navigate to ManagedSystem Pool feature page (contains paths in diverse verification states)
      await page.goto(
        new URL("/#/feature/managedsystem-pool", server.url).toString(),
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForSelector(".aks-feature-page", { timeout: 10_000 });

      // Wait for knowledge path cards to render.
      await page.waitForSelector(".aks-path-stack .aks-audit-box button", {
        timeout: 10_000,
      });

      const pathCards = await page.evaluate(() => {
        return [
          ...document.querySelectorAll(".aks-path-stack > .aks-audit-box"),
        ]
          .map((el, index) => ({
            index,
            text: (el.textContent || "").replace(/\s+/g, " ").trim(),
            hasOpenPath: !![...el.querySelectorAll("button")].find(
              (btn) => btn.textContent?.trim() === "Open Path",
            ),
          }))
          .filter((card) => card.hasOpenPath);
      });

      expect(pathCards.length).toBeGreaterThan(0);

      const nonVerifiedCardLabels = [
        "spec-only",
        "local-check-only",
        "no-evidence",
      ];
      const nonVerifiedCards = pathCards.filter((card) =>
        nonVerifiedCardLabels.some((label) => card.text.includes(label)),
      );
      expect(
        nonVerifiedCards.length,
        "expected at least one path in a non-staging verification state",
      ).toBeGreaterThan(0);

      for (const card of nonVerifiedCards) {
        expect(
          card.text,
          "non-staging path card should not show staging-evidence",
        ).not.toContain("staging-evidence");
        const hasAllowedLabel = nonVerifiedCardLabels.some((label) =>
          card.text.includes(label),
        );
        expect(
          hasAllowedLabel,
          "path card should show spec-only, local-check-only, or no-evidence",
        ).toBe(true);
      }

      const verifiedCards = pathCards.filter((card) =>
        card.text.includes("staging-evidence"),
      );
      expect(
        verifiedCards.length,
        "expected at least one staging-evidence path",
      ).toBeGreaterThan(0);

      // Now navigate to a specific non-staging path and verify path detail page label.
      const generatedPath = nonVerifiedCards[0];
      const pathDetailOpened = await page.evaluate((cardIndex) => {
        const card = [
          ...document.querySelectorAll(".aks-path-stack > .aks-audit-box"),
        ][cardIndex];
        const openBtn = [...(card?.querySelectorAll("button") || [])].find(
          (btn) => btn.textContent?.trim() === "Open Path",
        );
        if (openBtn) {
          (openBtn as HTMLButtonElement).click();
          return true;
        }
        return false;
      }, generatedPath.index);
      expect(
        pathDetailOpened,
        "should be able to open the generated path detail page",
      ).toBe(true);

      // Wait for path detail page with verification pipeline
      await page.waitForSelector('[data-testid="verification-pipeline"]', {
        timeout: 10_000,
      });

      // On the path detail page, the verification metric should NOT contain 'Verified' or 'Staging Verified'
      const pathPageText = await page.$eval(
        ".aks-feature-page",
        (el) => el.textContent || "",
      );
      // The verification metric shows the state label
      expect(pathPageText).toContain("verification");
      // Must contain one of the allowed non-verified labels
      const pathVerificationLabel = await page.evaluate(() => {
        // Find the verification metric value (miniMetric renders as aks-kicker + value)
        const kickers = [...document.querySelectorAll(".aks-kicker")];
        const verKicker = kickers.find(
          (el) => el.textContent?.trim() === "verification",
        );
        if (!verKicker) return "";
        // The value is the adjacent/sibling element
        const parent = verKicker.parentElement;
        return parent?.textContent?.replace("verification", "").trim() || "";
      });

      const nonVerifiedPathLabels = [
        "Missing",
        "Generated",
        "Needs Review",
        "Internal Preflight",
        "Execution Gated",
      ];
      const hasAllowedPathLabel = nonVerifiedPathLabels.some((label) =>
        pathVerificationLabel.includes(label),
      );
      expect(
        hasAllowedPathLabel,
        `path detail verification should be non-verified, got: ${pathVerificationLabel}`,
      ).toBe(true);
      expect(pathVerificationLabel).not.toContain("Staging Verified");
    } finally {
      await browser.close();
    }
  }, 30_000);
});
