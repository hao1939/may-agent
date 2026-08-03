import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import puppeteer from "puppeteer-core";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const browserPath =
  process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome";

const retiredMetricIds = [
  "aks-rp-e2e.task.blocked-actionable-count",
  "aks-rp-e2e.task.capacity-underfilled-with-gaps",
  "aks-rp-e2e.task.no-work-with-gaps",
  "aks-rp-e2e.task.completed-24h",
  "aks-rp-e2e.task.stale-active-with-gaps",
  "aks-rp-e2e.planner.slow-count-24h",
  "aks-rp-e2e.process.task.review-not-applied-count",
];

const activeMetrics = [
  {
    id: "aks-rp-e2e.task.active-count",
    status: "active",
    current: 2,
    priority: "P1",
    description: "Active work count",
  },
  {
    id: "aks-rp-e2e.task.ready-count",
    status: "active",
    current: 3,
    priority: "P1",
    description: "Runnable backlog count",
  },
  {
    id: "aks-rp-e2e.task.blocked-count",
    status: "active",
    current: 1,
    priority: "P1",
    description: "Waiting leaf count",
  },
  {
    id: "aks-rp-e2e.planner.timeout-24h",
    status: "active",
    current: 1,
    threshold: 0,
    alert_op: ">",
    priority: "P2",
    description: "Planner timeout streak in the last 24h",
    alertOpen: true,
  },
];

const closedMetrics = retiredMetricIds.map((id) => ({
  id,
  status: "closed",
  current: 99,
  priority: "P0",
  description: `${id} should stay retired`,
}));

const historyByMetricId = new Map(
  activeMetrics.map((metric) => [
    metric.id,
    {
      snapshots: [
        { value: Math.max(0, Number(metric.current) - 1), measured_at: 1 },
        { value: metric.current, measured_at: 2 },
      ],
    },
  ]),
);

const taskTree = {
  updated_at: "2026-07-27T09:25:32.145Z",
  root_task_id: "aks-root",
  active_task_ids: ["task/active"],
  tasks: {
    "aks-root": {
      id: "aks-root",
      outcome: "AKS app root",
      phase: "pending",
      children: ["task/active", "task/backlog", "task/waiting"],
    },
    "task/active": {
      id: "task/active",
      outcome: "Active task",
      phase: "running",
      owner: "app-ops",
      children: [],
      trace: {
        assigned_at: "2026-07-27T09:00:00.000Z",
        worker_started_at: "2026-07-27T09:01:00.000Z",
      },
    },
    "task/backlog": {
      id: "task/backlog",
      outcome: "Backlog task",
      phase: "pending",
      owner: "app-ops",
      children: [],
      readiness: { state: "ready" },
    },
    "task/waiting": {
      id: "task/waiting",
      outcome: "Waiting task",
      phase: "waiting",
      owner: "app-ops",
      children: [],
      blocker: "External approval",
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function appFile(path: string) {
  return readFile(join(appRoot, path), "utf8");
}

async function getFreePort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate local port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolvePort(port);
      });
    });
  });
}

describe("kanban metrics contract", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;
  let baseUrl = "";
  const historyRequests: string[] = [];

  beforeAll(async () => {
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      async fetch(req) {
        const url = new URL(req.url);

        if (
          url.pathname === "/projects/aks-rp-e2e.app/ui/kanban/" ||
          url.pathname === "/projects/aks-rp-e2e.app/ui/kanban/index.html"
        ) {
          return new Response(await appFile("ui/kanban/index.html"), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        if (url.pathname === "/projects/aks-rp-e2e.app/ui/kanban/kanban.js") {
          return new Response(await appFile("ui/kanban/kanban.js"), {
            headers: {
              "content-type": "application/javascript; charset=utf-8",
            },
          });
        }

        if (url.pathname === "/api/metrics") {
          return jsonResponse({
            metrics: [...activeMetrics, ...closedMetrics],
            alerts: [
              {
                metricId: "aks-rp-e2e.planner.timeout-24h",
                message: "Planner timeout alert should stay visible",
              },
              {
                metricId: "aks-rp-e2e.planner.slow-count-24h",
                message: "Retired planner slow alert should be hidden",
              },
            ],
          });
        }

        const historyMatch = url.pathname.match(
          /^\/api\/metrics\/(.+)\/history$/,
        );
        if (historyMatch) {
          const metricId = decodeURIComponent(historyMatch[1] || "");
          historyRequests.push(metricId);
          return jsonResponse(
            historyByMetricId.get(metricId) || { snapshots: [] },
          );
        }

        if (url.pathname === "/api/projects/artifact") {
          const file = url.searchParams.get("file") || "";
          if (file === ".state/tasks/tree.json") {
            return jsonResponse({ content: JSON.stringify(taskTree) });
          }
          if (file === ".state/tasks/kanban.json") {
            return new Response("not found", { status: 404 });
          }
        }

        return new Response("not found", { status: 404 });
      },
    });
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("renders only active supported metrics and filters retired closed alerts", async () => {
    const browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/projects/aks-rp-e2e.app/ui/kanban/`, {
        waitUntil: "networkidle0",
      });
      await page.waitForSelector(
        '[data-metric-id="aks-rp-e2e.planner.timeout-24h"]',
      );

      const metricIds = await page.$$eval(".metric-tile", (tiles) =>
        tiles
          .map((tile) => tile.getAttribute("data-metric-id") || "")
          .filter(Boolean),
      );
      expect(metricIds.sort()).toEqual(
        activeMetrics.map((metric) => metric.id).sort(),
      );
      for (const retiredId of retiredMetricIds) {
        expect(metricIds).not.toContain(retiredId);
      }

      const metricsText = await page.$eval(
        '[data-testid="project-metrics"]',
        (node) => node.textContent || "",
      );
      expect(metricsText).toContain("Planner timeouts");
      expect(metricsText).not.toContain("Planner slow");
      expect(metricsText).not.toContain("Done 24h");
      expect(metricsText).not.toContain("Underfilled");
      expect(metricsText).not.toContain("No work");
      expect(metricsText).toContain(
        "Planner timeout alert should stay visible",
      );
      expect(metricsText).not.toContain(
        "Retired planner slow alert should be hidden",
      );

      expect(historyRequests.sort()).toEqual(
        activeMetrics.map((metric) => metric.id).sort(),
      );
      for (const retiredId of retiredMetricIds) {
        expect(historyRequests).not.toContain(retiredId);
      }
    } finally {
      await browser.close();
    }
  });
});
