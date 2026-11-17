import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";

test.skipIf(!existsSync(chrome))(
  "Task home reads status honestly, isolates failures and refreshes without starting work",
  async () => {
    const home = "/projects/aks-rp-e2e.app/ui/";
    const ids = [
      "workstream/compiler",
      "workstream/spec-fixer",
      "workstream/knowledge",
      "domain/kubernetes-version-support/1.38",
      "domain/platform-initiated-upgrade/verification-benchmark",
    ];
    const task = (taskId: string, status: string, extra = {}) => ({
      appId: "aks-rp-e2e",
      taskId,
      status,
      updatedAt: Date.now() - 3_600_000,
      ...extra,
    });
    const fixtures = new Map<string, unknown>([
      [
        ids[0],
        task(ids[0], "running", {
          progress: {
            stage: "compile",
            message: "Compiling selected inputs",
            updatedAt: Date.now() - 120_000,
          },
        }),
      ],
      [ids[1], task(ids[1], "idle", { summary: "Verified merged delivery" })],
      [
        ids[2],
        task(ids[2], "waiting", {
          summary: "Awaiting source question",
          humanAction: { requestedAction: "Supply a focused question" },
        }),
      ],
      [
        ids[3],
        task(ids[3], "attention", {
          waitingOn: [
            {
              kind: "condition",
              type: "human.review",
              subject: "gallery-access",
            },
          ],
        }),
      ],
    ]);
    fixtures.set(ids[4], task(ids[4], "running", { summary: "Building the PIU benchmark" }));
    const reads: string[] = [],
      writes: string[] = [],
      errors: string[] = [];
    let gate: Promise<void> | undefined;
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(request) {
        const url = new URL(request.url);
        if (request.method !== "GET") {
          writes.push(request.method);
          return new Response("Forbidden", { status: 405 });
        }
        if (
          [home, home.slice(0, -1), home + "index.html"].includes(url.pathname)
        )
          return new Response(
            Bun.file(new URL("../ui/index.html", import.meta.url)),
            { headers: { "Content-Type": "text/html" } },
          );
        if (url.pathname === home + "app.js")
          return new Response(
            Bun.file(new URL("../ui/app.js", import.meta.url)),
            { headers: { "Content-Type": "text/javascript" } },
          );
        if (url.pathname === "/api/task") {
          expect(url.searchParams.get("appId")).toBe("aks-rp-e2e");
          const id = url.searchParams.get("taskId")!;
          reads.push(id);
          if (gate) await gate;
          const fixture = fixtures.get(id);
          return fixture === null
            ? new Response("Unavailable", { status: 503 })
            : Response.json(fixture);
        }
        return new Response("Not found", { status: 404 });
      },
    });
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      page.on("pageerror", (error) => errors.push(String(error)));
      // Exercise polling/visibility deterministically, without waiting 20 seconds.
      await page.evaluateOnNewDocument(() => {
        const originalInterval = window.setInterval;
        window.setInterval = ((
          fn: () => void,
          delay: number,
          ...args: unknown[]
        ) => {
          if (delay === 20_000) {
            (window as any).pollTaskCards = fn;
            return 1;
          }
          return originalInterval(fn, delay, ...args);
        }) as typeof window.setInterval;
        const timeout = AbortSignal.timeout.bind(AbortSignal);
        AbortSignal.timeout = () => timeout(500);
      });
      const base = `http://127.0.0.1:${server.port}`;
      const wait = () =>
        page.waitForFunction(
          () =>
            !(document.querySelector("#refresh") as HTMLButtonElement)
              ?.disabled,
        );
      const badges = () =>
        page.$$eval(".badge", (nodes) => nodes.map((node) => node.textContent));
      const refresh = async () => {
        await page.click("#refresh");
        await wait();
      };
      await page.goto(base + home, { waitUntil: "networkidle0" });
      await wait();
      expect(await badges()).toEqual([
        "Busy · running",
        "Idle",
        "Waiting",
        "Needs attention",
        "Busy · running",
      ]);
      expect(await page.$eval(".latest", (node) => node.textContent)).toBe(
        "Compiling selected inputs",
      );
      expect(
        await page.$eval(".activity", (node) => node.textContent),
      ).toContain("Progress reported 2m ago");
      expect(
        await page.$$eval("details", (nodes) =>
          nodes.map((node) => ({
            hidden: node.hidden,
            text: node.textContent,
          })),
        ),
      ).toMatchObject([
        { hidden: true },
        { hidden: true },
        {
          hidden: false,
          text: expect.stringContaining("Supply a focused question"),
        },
        { hidden: false, text: expect.stringContaining("gallery-access") },
        { hidden: true },
      ]);
      const links = await page.$$eval("a[data-task-id]", (nodes) =>
        nodes.map((node) => ({
          id: (node as HTMLElement).dataset.taskId,
          href: (node as HTMLAnchorElement).href,
        })),
      );
      expect(links.map((link) => link.id)).toEqual(ids);
      for (const link of links)
        expect(new URL(link.href).searchParams.get("taskId")).toBe(link.id!);

      fixtures.set(ids[0], null);
      fixtures.set(ids[1], task("wrong-task", "idle"));
      fixtures.set(
        ids[2],
        task(ids[2], "future-status", {
          summary: '<img src=x onerror="window.unsafe=true">',
        }),
      );
      fixtures.set(ids[3], task(ids[3], "constructor"));
      await refresh();
      expect(await badges()).toEqual([
        "Status unavailable",
        "Status unavailable",
        "future-status",
        "constructor",
        "Busy · running",
      ]);
      expect(await page.$$(".task-state img")).toHaveLength(0);
      expect(
        await page.$eval("#refresh-status", (node) => node.textContent),
      ).toContain("2 task statuses unavailable");

      fixtures.set(ids[0], task(ids[0], "running"));
      fixtures.set(ids[1], task(ids[1], "idle"));
      await refresh();
      expect((await badges())[0]).toBe("Busy · running");
      expect(await page.$eval(".latest", (node) => node.textContent)).toBe(
        "No report available.",
      );
      expect(
        await page.$eval(".activity", (node) => node.textContent),
      ).toContain("Task updated 1h ago");

      let release!: () => void;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const before = reads.length;
      await page.evaluate(() => {
        (window as any).pollTaskCards();
        (window as any).pollTaskCards();
      });
      await page.waitForFunction(
        () =>
          (document.querySelector("#refresh") as HTMLButtonElement).disabled,
      );
      await wait(); // The real fetch abort path must clear previous Busy labels.
      expect(reads.length - before).toBe(ids.length);
      expect(await badges()).toEqual(Array(ids.length).fill("Status unavailable"));
      release();
      gate = undefined;
      await refresh();
      expect((await badges())[0]).toBe("Busy · running");

      const visibleReads = reads.length;
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        (window as any).pollTaskCards();
      });
      expect(reads.length).toBe(visibleReads);
      fixtures.set(
        ids[0],
        task(ids[0], "waiting", { summary: "Waiting for merge" }),
      );
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await wait();
      expect((await badges())[0]).toBe("Waiting");
      await page.setViewport({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      for (const route of [home.slice(0, -1), home + "index.html"]) {
        await page.goto(base + route, { waitUntil: "networkidle0" });
        await wait();
        expect(await badges()).toHaveLength(ids.length);
        expect((await badges())[0]).toBe("Waiting");
      }
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      server.stop(true);
    }
  },
  30_000,
);
