import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import { attachControlSocket, type ControlSocket, type ControlEvent } from "../../packages/control/src/server.js";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { HumanTaskService, type HumanTaskStatus } from "../../src/app/human-task-service.js";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";

const chrome = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((path) => path && existsSync(path));
const skipBrowser = process.env.E2E_NO_UI === "1" || !chrome;
if (process.env.CI && skipBrowser) throw new Error("Task board browser coverage requires Chrome and E2E_NO_UI unset");
if (skipBrowser) console.warn("Task board browser test skipped: Chrome unavailable or E2E_NO_UI=1");

describe("HTTP human Task reads and board", () => {
  let root: string;
  let db: SqliteDb;
  let control: ControlSocket;
  let child: ChildProcess;
  let stopped: Promise<void>;
  let base: string;
  let service: HumanTaskService;
  let conversation: { messages: any[]; activeTurn?: { id: string; revision: number } };
  let published: any[];
  let rejectPublish: boolean;
  let rejectConversationRead: boolean;
  let listeners: Set<(event: ControlEvent) => void>;
  let subscribed: ReturnType<typeof Promise.withResolvers<void>>;

  beforeEach(async () => {
    conversation = { messages: [], activeTurn: { id: "turn-one", revision: 7 } };
    published = [];
    rejectPublish = false;
    rejectConversationRead = false;
    listeners = new Set();
    subscribed = Promise.withResolvers<void>();
    root = mkdtempSync(join(tmpdir(), "may-http-tasks-"));
    db = openStateDb(join(root, "may.db"));
    const projects = join(root, "projects");
    mkdirSync(join(projects, "sample.app"), { recursive: true });
    writeFileSync(
      join(projects, "sample.app", "project.json"),
      JSON.stringify({ id: "alpha.app", owner: "test", status: "active", goal: "Fixture" }),
    );
    cpSync(resolve(import.meta.dir, "../../packages/webui/static"), join(projects, "platform", "ui"), {
      recursive: true,
    });
    service = new HumanTaskService(db, { snapshot: () => ({ entries: [] }) } as never);
    control = await attachControlSocket({
      socketPath: daemonSocketPath(root, { instance: "task-test", interfaceAgent: "may" }),
      getSessionId: () => "fixture",
      getStatus: () => [],
      emitEvent: () => {},
      subscribeEvents: (listener) => { listeners.add(listener); subscribed.resolve(); return () => listeners.delete(listener); },
      getAppConversation: (appId, conversationId, options) => {
        if (appId !== "may" || conversationId !== "may:primary" || options?.limit !== 30) throw new Error("Invalid conversation read");
        if (rejectConversationRead) throw new Error("fixture Conversation storage unavailable");
        return conversation;
      },
      publishEvent: (event) => {
        published.push(event);
        if (rejectPublish) throw new Error("fixture persistence unavailable");
        if (event.type === "conversation.turn.stop.requested") {
          conversation.activeTurn = { id: "turn-two", revision: 8 };
        } else if (event.type === "conversation.message.created") {
          conversation.messages.push({ id: event.idempotencyKey, author: { kind: "human" }, text: event.data.text });
        }
        return { eventId: published.length, eventType: event.type, delivery: "accepted" };
      },
      agentName: "may",
      instance: "task-test",
      listTasks: (options) =>
        service.listTasks({ ...options, status: options?.status as HumanTaskStatus[] | undefined }),
      getTask: (input) => service.getTask(input),
      // SDK routes remain separate and keep their existing response shape.
      listAppTasks: () => ({ items: [{ id: "sdk-task", status: "done" }] }),
      getAppTask: () => ({ id: "sdk-task", status: "done" }),
    });
    child = spawn(
      "bun",
      [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PROJECT_ROOT: root,
          AGENTS_ROOT: root,
          SHARED_ROOT: root,
          PROJECTS_ROOT: projects,
          DAEMON_INSTANCE: "task-test",
          DAEMON_AGENT: "may",
        },
      },
    );
    stopped = new Promise((done) => child.once("close", () => done()));
    let logs = "";
    let timer: ReturnType<typeof setTimeout>;
    try {
      base = await new Promise<string>((ready, reject) => {
        timer = setTimeout(() => reject(new Error(`HTTP startup timed out: ${logs}`)), 10_000);
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`HTTP exited (${code}): ${logs}`)));
        child.stderr!.on("data", (chunk) => {
          logs += chunk.toString();
        });
        child.stdout!.on("data", (chunk) => {
          logs += chunk.toString();
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
    control?.close();
    db?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function task(id: string, n: number, phase = "pending", appId = "alpha") {
    const resource = {
      metadata: { id, generation: 2, resourceVersion: 3 },
      spec: {
        parentId: "root",
        outcome: `Full goal ${id}: ${"detail ".repeat(30)}`,
        acceptance: ["Exact result verified"],
        mode: "maintain",
        owner: "test",
      },
      status: { observedGeneration: 2, phase, summary: `Observe ${id}`, updatedAt: new Date(n).toISOString() },
    };
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
      VALUES (?, ?, 2, 3, 2, ?, 'normal', 0, 0, ?, ?)`,
    ).run(appId, id, phase, n, JSON.stringify(resource));
  }

  async function read(path: string, status = 200) {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(5_000) });
    expect(res.status).toBe(status);
    return res.json();
  }

  test("HTTP forwards bounded human reads to the real control socket, without changing SDK reads", async () => {
    task("work/a ?&", 10, "converged");
    task("work/b", 9);
    task("work/a ?&", 11, "waiting", "other");
    expect((await read("/api/projects/detail?path=projects/sample.app")).app.appId).toBe("alpha");
    const first = await read("/api/tasks?appId=alpha&limit=1");
    expect(first).toEqual(service.listTasks({ appId: "alpha", limit: 1 }));
    expect(first.items[0]).toMatchObject({ taskId: "work/a ?&", status: "up-to-date", terminal: false });
    expect(
      (await read(`/api/tasks?appId=alpha&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`)).items[0].taskId,
    ).toBe("work/b");
    expect(await read(`/api/task?${new URLSearchParams({ appId: "alpha", taskId: "work/a ?&" })}`)).toEqual(
      service.getTask({ appId: "alpha", taskId: "work/a ?&" }),
    );
    expect((await read("/api/tasks?appId=alpha&status=waiting")).items).toEqual([]);
    expect(await read("/api/apps/alpha/tasks")).toEqual({ items: [{ id: "sdk-task", status: "done" }] });
    expect(await read("/api/apps/alpha/tasks/sdk-task")).toEqual({ id: "sdk-task", status: "done" });
  });

  test("reports invalid, missing, and unavailable reads without fabricating empty or completed Tasks", async () => {
    await read("/api/tasks", 400);
    await read("/api/task?appId=alpha", 400);
    await read("/api/task?appId=alpha&taskId=missing", 404);
    for (const query of [
      "limit=0",
      "limit=101",
      "limit=no",
      "cursor=invalid",
      "status=healthy",
      "status=",
      "includeDone=yes",
    ]) {
      await read(`/api/tasks?appId=alpha&${query}`, 400);
    }
    control.close();
    await read("/api/tasks?appId=alpha", 503);
    await read("/api/task?appId=alpha&taskId=missing", 503);
  });

  test("HTTP Conversation reads forward exact identity and bounded options", async () => {
    expect(await read("/api/conversation?appId=may&conversationId=may%3Aprimary")).toEqual(conversation);
    await read("/api/conversation?appId=may", 400);
    await read("/api/conversation?conversationId=may%3Aprimary", 400);
    rejectConversationRead = true;
    expect(await read("/api/conversation?appId=may&conversationId=may%3Aprimary", 503)).toMatchObject({ error: "fixture Conversation storage unavailable" });
    rejectConversationRead = false;
    expect(await read("/api/conversation?appId=may&conversationId=may%3Aprimary")).toEqual(conversation);
    expect(published).toHaveLength(0);
    control.close();
    await read("/api/conversation?appId=may&conversationId=may%3Aprimary", 503);
  });

  test.skipIf(skipBrowser)("May browser Stop retains its observed target and draft, then admits a correction to Conversation", async () => {
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/may`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("#chat-stop")!.disabled);
      // HTTP Conversation readiness does not imply that the WebSocket proxy
      // has subscribed to control events yet. Emit only after that exact boundary.
      await subscribed.promise;
      await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
      for (const listener of listeners) {
        listener({ type: "status", activeAgents: [{ agent: "worker", sessionId: "other-session", status: "running" }] });
        listener({ type: "text", data: { sessionId: "other-session" }, text: "Other session text" });
        listener({ type: "handler.failed", data: { appId: "other-app", taskId: "work", stage: "execute", error: "Diagnostic survives May chat", disposition: "not-retrying" } });
      }
      await page.waitForFunction(() => document.querySelector("#feed-list")!.textContent!.includes("Diagnostic survives May chat"));
      expect(await page.evaluate("activeSessions.some(s => s.sessionId === 'other-session')")).toBe(true);
      expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Other session text");
      await page.type("#chat-input", "Discuss costs before implementing");
      await page.click("#chat-stop");
      await page.waitForFunction(() => document.body.textContent!.includes("Stop request accepted"));
      expect(published[0]).toMatchObject({ type: "conversation.turn.stop.requested", target: { appId: "may" },
        data: { conversationId: "may:primary", turnId: "turn-one", expectedRevision: 7 } });
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Discuss costs before implementing");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#chat-input")!.value === "");
      expect(published.at(-1)).toMatchObject({ type: "conversation.message.created", target: { appId: "may" },
        data: { conversationId: "may:primary", text: "Discuss costs before implementing", author: { kind: "human" } } });
      rejectPublish = true;
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("#chat-stop")!.disabled);
      await page.click("#chat-stop");
      await page.waitForFunction(() => document.body.textContent!.includes("Stop was not confirmed"));
      expect(published.at(-1).data.turnId).toBe("turn-two");
      await page.type("#chat-input", "Keep this correction");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.body.textContent!.includes("Message was not confirmed"));
      const unconfirmed = published.at(-1);
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Keep this correction");
      rejectPublish = false;
      await page.click("#chat-send");
      await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#chat-input")!.value === "");
      expect(published.at(-1)).toEqual(unconfirmed);
      rejectConversationRead = true;
      for (const listener of listeners) listener({ type: "conversation.updated", data: { appId: "may", conversationId: "may:primary" } });
      await page.waitForFunction(() => document.querySelector("#chat-status")!.textContent!.includes("storage unavailable"));
      // Drop the actual notification connection while the HTTP control route
      // remains usable. Its normal reconnect must later recover a lost wake.
      await page.evaluate("ws.close()");
      await page.waitForFunction("ws === null");
      expect(await page.$eval("#chat-stop", el => (el as HTMLButtonElement).disabled)).toBe(false);
      const stoppedOverHttp = page.waitForResponse(response => response.url() === `${base}/api/events` && response.request().method() === "POST");
      await page.click("#chat-stop");
      expect((await stoppedOverHttp).status()).toBe(201);
      expect(published.at(-1)).toMatchObject({ type: "conversation.turn.stop.requested",
        data: { turnId: "turn-two", expectedRevision: 8 } });
      rejectConversationRead = false;
      conversation.activeTurn = undefined;
      for (const listener of listeners) listener({ type: "conversation.updated", data: { appId: "may", conversationId: "may:primary" } });
      await page.waitForFunction(() => document.querySelector<HTMLButtonElement>("#chat-stop")!.disabled);
      expect(published.some(event => event.type === "session.cancel.requested" || event.type === "session.steer.requested")).toBe(false);
    } finally { await browser.close(); }
  });

  test.skipIf(skipBrowser)(
    "served browser pages, opens exact off-page Tasks, steers exact identity, and rejects stale responses",
    async () => {
      for (let n = 0; n < 35; n++) task(`work/${n}`, n, n === 0 ? "converged" : "pending");
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5_000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${base}/projects/sample/tasks`, { waitUntil: "domcontentloaded" });
        try {
          await page.waitForSelector(".kanban-card", { timeout: 10_000 });
        } catch (error) {
          throw new Error(
            `${String(error)}\n${await page.$eval("body", (el) => el.textContent)}\n${errors.join("\n")}`,
          );
        }
        expect(await page.$$eval(".kanban-card", (cards) => cards.length)).toBe(30);
        await page.type("#project-task-filter", "work/34");
        expect(
          await page.$$eval(
            ".kanban-card",
            (cards) => cards.filter((c) => getComputedStyle(c).display !== "none").length,
          ),
        ).toBe(1);
        await page.click("#project-tasks-next");
        await page.waitForFunction(() => document.querySelectorAll(".kanban-card").length === 5);
        expect(await page.$eval(".kanban-shell", (el) => el.textContent)).toContain("Page 2");
        await page.evaluate("showTaskDetail('work/34')");
        await page.waitForSelector("#kanban-steer-text");
        await page.evaluate("prefillTaskSteering('audit')");
        const prompt = await page.$eval("#kanban-steer-text", (el) => (el as HTMLTextAreaElement).value);
        expect(prompt).toContain("project: alpha\ntask: work/34");
        expect(prompt).toContain("detail ".repeat(30));

        // Capture ingress without admitting model-backed work in the fixture.
        await page.setRequestInterception(true);
        let ingress: Record<string, unknown> | undefined;
        page.on("request", (request) => {
          if (request.method() === "POST" && request.url().endsWith("/api/events")) {
            ingress = JSON.parse(request.postData()!);
            void request.respond({ status: 200, contentType: "application/json", body: '{"ok":true,"eventId":123}' });
          } else void request.continue();
        });
        await page.evaluate("sendProjectSteering()");
        expect(ingress).toMatchObject({
          type: "project.owner.requested",
          target: { appId: "alpha", taskId: "work/34" },
        });

        // Delay only the browser response; the genuine HTTP/socket reads above
        // cover authority. Closing or selecting a newer detail must win.
        await page.evaluate(`window.originalTaskFetch = window.fetch;
        window.fetch = (url, init) => String(url).includes('taskId=delayed')
          ? new Promise(resolve => { window.finishDelayedTask = () => resolve(new Response(JSON.stringify({ appId: 'alpha', taskId: 'delayed', outcome: 'STALE RESULT', status: 'done', terminal: true }), {status:200})); })
          : window.originalTaskFetch(url, init);
        void showTaskDetail('delayed');`);
        await page.evaluate("closeTaskDetail(); window.finishDelayedTask()");
        expect(await page.$eval("#task-detail-drawer", (el) => el.classList.contains("hidden"))).toBe(true);
        await page.evaluate("void showTaskDetail('delayed')");
        await page.evaluate("showTaskDetail('work/0')");
        await page.evaluate("window.finishDelayedTask()");
        expect(await page.$eval("#task-detail-drawer", (el) => el.textContent)).toContain("up-to-date");
        expect(await page.$eval("#task-detail-drawer", (el) => el.textContent)).not.toContain("STALE RESULT");
        await page.evaluate("window.fetch = window.originalTaskFetch");
        db.prepare(
          `INSERT INTO app_task_cancellations(app_id, task_id, requested_at, reason, cancellation_json)
          VALUES ('alpha', 'work/34', 100, 'fixture', ?)`,
        ).run(
          JSON.stringify({
            appId: "alpha",
            taskId: "work/34",
            generation: 2,
            resourceVersion: 4,
            outcome: "Cancelled goal",
            summary: "Stopped by operator",
            reason: "fixture",
            cancelledAt: new Date(100).toISOString(),
          }),
        );
        await page.click("#project-task-history");
        await page.waitForFunction(() =>
          document.querySelector(".kanban-board")?.textContent?.includes("Cancelled goal"),
        );
        await page.evaluate("showTaskDetail('work/34')");
        expect(await page.$eval("#task-detail-drawer", (el) => el.textContent)).toContain("Stopped by operator");
        expect(await page.$("#kanban-steer-text")).toBeNull();
        await page.select("#project-task-status", "waiting");
        await page.waitForFunction(() =>
          document.querySelector(".kanban-shell")?.textContent?.includes("No Tasks in this page/filter."),
        );
        expect(await page.$eval(".kanban-shell", (el) => el.textContent)).toContain("Page 1");
        // Even when a project change reuses the same DOM node, an older page
        // response cannot restore the old App or its steering target.
        await page.evaluate(`window.boardElement = projectTaskBoard.el;
          window.fetch = (url, init) => String(url).startsWith('/api/tasks?appId=alpha')
            ? new Promise(resolve => { window.finishOldPage = () => resolve(new Response(JSON.stringify({ items: [] }), {status:200})); })
            : window.originalTaskFetch(url, init);
          window.oldPageRead = renderProjectKanban(window.boardElement); void 0;`);
        await page.evaluate(`_projectDetailPath = 'projects/other.app';
          _currentProjectDetail = { app: { appId: 'other' } };
          renderProjectKanban(window.boardElement);`);
        await page.evaluate("window.finishOldPage(); window.oldPageRead");
        expect(await page.$eval(".kanban-shell h3", (el) => el.textContent)).toBe("other Tasks");
        await page.evaluate(`_projectDetailPath = 'projects/sample.app';
          _currentProjectDetail = { app: { appId: 'alpha' } };
          window.oldPageRead = renderProjectKanban(window.boardElement); void 0;`);
        await page.evaluate("loadProjectTab('project')");
        await page.evaluate("window.finishOldPage(); window.oldPageRead");
        expect(await page.$(".kanban-shell")).toBeNull();
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
});
