import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import type { ControlEvent } from "../../packages/control/src/server.js";
import { startWebUI, type DaemonHttpServices } from "../../src/app/http/server.js";
import { HumanTaskService } from "../../src/app/human-task-service.js";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { appendSessionMessage, ensureSessionDir } from "../../src/lib/persistence.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { taskInputIdempotencyKey } from "../../src/app/http/task-input.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { createEventInterface } from "../../src/app/core/events/interface.js";

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
  let server: ReturnType<typeof startWebUI>;
  let services: DaemonHttpServices;
  let base: string;
  let service: HumanTaskService;
  let registry: AppRegistry;
  let conversation: {
    messages: any[];
    topics?: any[];
    requests?: any[];
    activeTurn?: { id: string; revision: number };
    lastReadTopicId?: string;
  };
  let published: any[];
  let acceptedPublications: Map<string, { eventId: number; eventType: string; delivery: "accepted" }>;
  let onPublish: ((event: any) => void) | undefined;
  let rejectPublish: boolean;
  let rejectConversationRead: boolean;
  let rejectAppRead: boolean;
  let listeners: Set<(event: ControlEvent) => void>;
  let activeStatus: any[];

  beforeEach(async () => {
    conversation = { messages: [], activeTurn: { id: "turn-one", revision: 7 } };
    published = [];
    acceptedPublications = new Map();
    onPublish = undefined;
    rejectPublish = false;
    rejectConversationRead = false;
    rejectAppRead = false;
    listeners = new Set();
    activeStatus = [];
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
    registry = new AppRegistry(async () => []);
    service = new HumanTaskService(db, registry);
    services = {
      getStatus: () => ({ sessions: activeStatus, activeWork: activeStatus.length > 0 }),
      events: {
        subscribe: (_filter, listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        get: () => undefined,
        publish: (event) => publish(event),
      } as never,
      getAppConversation: (appId, conversationId, options) => {
        if (appId !== "support" || conversationId !== "retained-room" || options?.limit !== 30) throw new Error("Invalid conversation read");
        if (rejectConversationRead) throw new Error("fixture Conversation storage unavailable");
        conversation.lastReadTopicId = options?.topicId;
        const messages = options?.topicId
          ? conversation.messages.filter((message) => message.metadata?.topicId === options.topicId)
          : conversation.messages.slice(-options.limit);
        return { ...conversation, messages };
      },
      listApps: (appId) => {
        if (rejectAppRead) throw new Error("fixture App reads unavailable");
        return service.listApps(appId);
      },
      listTasks: (options) => service.listTasks(options as never),
      getTask: (input) => service.getTask(input),
    };
    function publish(event: any) {
        published.push(event);
        onPublish?.(event);
        if (rejectPublish) throw new Error("fixture persistence unavailable");
        const key = String(event.idempotencyKey || "");
        const replay = acceptedPublications.get(key);
        if (replay) return replay;
        if (event.type === "conversation.turn.stop.requested") {
          conversation.activeTurn = { id: "turn-two", revision: 8 };
        } else if (event.type === "conversation.message.created") {
          conversation.messages.push({
            id: event.idempotencyKey,
            author: { kind: "human" },
            text: event.data.text,
            ...(event.data.context ? { context: event.data.context } : {}),
          });
        }
        const receipt = { eventId: acceptedPublications.size + 1, eventType: event.type, delivery: "accepted" as const };
        acceptedPublications.set(key, receipt);
        return receipt;
    }
    await startWeb();
  });

  async function startWeb(conversationApp = "support", conversationId = "retained-room") {
    const previous = { PROJECT_ROOT: process.env.PROJECT_ROOT, AGENTS_ROOT: process.env.AGENTS_ROOT, SHARED_ROOT: process.env.SHARED_ROOT, PROJECTS_ROOT: process.env.PROJECTS_ROOT };
    Object.assign(process.env, { PROJECT_ROOT: root, AGENTS_ROOT: root, SHARED_ROOT: root, PROJECTS_ROOT: join(root, "projects") });
    server = startWebUI({ stateDir: root, hostname: "127.0.0.1", port: 0, services,
      interface: { agent: "helper", appId: conversationApp, conversationId } });
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    base = `http://127.0.0.1:${server.port}`;
  }

  afterEach(() => {
    server?.stop(true);
    db?.close();
    closeDb(root);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function task(id: string, n: number, phase = "pending", appId = "alpha") {
    const resource = {
      metadata: { id, generation: 2, resourceVersion: 3 },
      spec: {
        parentId: "root",
        outcome: `Full goal ${id}: ${"detail ".repeat(30)}`,
        acceptance: ["Exact result verified"],
        owner: "test",
      },
      status: { observedGeneration: 2, phase, summary: `Observe ${id}`, updatedAt: new Date(n).toISOString() },
    };
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready, updated_at, resource_json)
      VALUES (?, ?, 2, 3, 2, ?, 'normal', 0, 0, ?, ?)`,
    ).run(appId, id, phase, n, JSON.stringify(resource));
    const digest = createHash("sha256")
      .update(`task-reference-v1\0${Buffer.byteLength(appId, "utf8")}:${appId}\0${Buffer.byteLength(id, "utf8")}:${id}`)
      .digest("hex");
    db.prepare(
      `INSERT OR IGNORE INTO app_task_refs(digest, prefix8, prefix16, app_id, task_id, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(digest, digest.slice(0, 8), digest.slice(0, 16), appId, id, n);
  }

  async function read(path: string, status = 200) {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(5_000) });
    expect(res.status).toBe(status);
    return res.json();
  }

  function seedChat(agent = "helper") {
    const sessionId = `${agent}-old-session`;
    db.prepare("INSERT INTO sessions (sessionId, agent, task, status, kind, source, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(sessionId, agent, "Earlier conversation", "idle", "chat", "web-ui", Date.now());
    return sessionId;
  }

  test.each([false, true])("Task input replay after upgrade and generation change retains the accepted receipt (legacy=%s)", async (legacy) => {
    task("work/feedback", 1);
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const unsubscribe = bus.subscribeDurableRoute(() => ({ accepted: true, by: "fixture-input", route: "direct" }));
    const events = createEventInterface({ bus, db: getDb(root), hasApp: () => true,
      validateAppInput: () => {}, });
    const message = "Preserve the accepted operation";
    const idempotencyKey = "accepted-before-refresh";
    const data = {
      targetTaskId: "work/feedback",
      ...(legacy ? {} : { targetTaskGeneration: 1 }),
      input: { kind: "message", data: { message, context: { intent: "task-feedback", taskId: "work/feedback", expectedGeneration: 1 } } },
      source: { kind: "human", id: `web-task:${idempotencyKey}` }, channel: "web-ui",
    };
    const receipt = events.publish({ type: "app.input.requested", target: { appId: "alpha" }, data,
      idempotencyKey: taskInputIdempotencyKey("alpha", "work/feedback", idempotencyKey) }, { source: "web-ui" });
    const send = (text = message) => fetch(base + "/api/task/input", { method: "POST",
      headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ appId: "alpha", taskId: "work/feedback", expectedGeneration: 1, message: text, idempotencyKey }) });
    try {
      // The current Task is generation 2; only the retained exact receipt can accept this retry.
      const response = await send();
      expect(response.status).toBe(202);
      expect(await response.json()).toMatchObject({ accepted: true, eventId: receipt.eventId, generation: 1, replayed: true });
      expect((await send("Different feedback")).status).toBe(409);
      expect(published).toHaveLength(0);
    } finally { unsubscribe(); }
  });

  async function notificationBarrier(page: Page) {
    await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
    // The status reply follows subscriptions and notifications on the same socket.
    await page.evaluate(() => new Promise<void>((done, reject) => {
      const socket = globalThis.eval("ws") as WebSocket;
      const timer = setTimeout(() => {
        socket.removeEventListener("message", receive);
        reject(new Error("Notification status response timed out"));
      }, 5000);
      function receive(event: MessageEvent) {
        const frame = JSON.parse(event.data);
        if (frame.type !== "status") return;
        clearTimeout(timer);
        socket.removeEventListener("message", receive);
        done();
      }
      socket.addEventListener("message", receive);
      socket.send(JSON.stringify({ type: "status" }));
    }));
  }

  async function reconnect(page: Page) {
    await page.evaluate(() => new Promise<void>(done => {
      const socket = globalThis.eval("ws") as WebSocket;
      socket.addEventListener("close", () => done(), { once: true });
      socket.close();
    }));
    // Exercise the production reconnect timer, with no fixed sleep or retry.
    await notificationBarrier(page);
  }

  test.skipIf(skipBrowser)("Overview refreshes its retained panels on lifecycle changes and after missed events during reconnect", async () => {
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const paths: string[] = [];
      page.on("request", request => paths.push(new URL(request.url()).pathname));
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#workflow-overview [data-workflow-outcomes]");
      await page.waitForSelector("#overview-tasks .health-note");
      await notificationBarrier(page);
      paths.length = 0;
      task("new-live-work", 10, "running");
      for (const listener of listeners) listener({ type: "session.start", data: { sessionId: "new-live-session", agent: "worker" } });
      await page.waitForFunction(() => document.querySelector("#overview-tasks")?.textContent?.includes("new-live-work"));
      expect(paths).toContain("/api/liveness");
      expect(paths).toContain("/api/workflow-health");
      expect(paths).toContain("/api/tasks");
      task("work-while-disconnected", 11, "running");
      await reconnect(page);
      await page.waitForFunction(() => document.querySelector("#overview-tasks")?.textContent?.includes("work-while-disconnected"));
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser)(
    "routed inspector reloads saved transcript and outcome after an offline completion",
    async () => {
      const sessionId = seedChat("worker");
      ensureSessionDir(root, sessionId);
      appendSessionMessage(root, sessionId, {
        role: "user",
        content: "Initial inspector transcript",
        timestamp: Date.now(),
      });
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(7000);
        await page.goto(`${base}/sessions/${sessionId}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() =>
          document.querySelector("#session-detail-panel")?.textContent?.includes("Initial inspector transcript"),
        );
        await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
        await page.evaluate("ws.close()");
        await page.waitForFunction("ws === null");
        db.prepare("UPDATE sessions SET status='done', endedAt=?, outcome=? WHERE sessionId=?").run(
          Date.now(),
          "Completed while offline",
          sessionId,
        );
        appendSessionMessage(root, sessionId, {
          role: "assistant",
          content: [{ type: "text", text: "Saved offline answer" }],
          timestamp: Date.now(),
        });
        await page.waitForFunction(() => {
          const text = document.querySelector("#session-detail-panel")?.textContent || "";
          return text.includes("Saved offline answer") && text.includes("Completed while offline");
        });
        expect(await page.evaluate("currentInspectedSession")).toBe(sessionId);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  async function installApps(...ids: string[]) {
    await registry.reload(undefined, async () => ids.map((id) => ({
      appDir: join(root, "projects", `${id}.app`),
      definition: {
        id, version: 1, agent: "worker", inputSchema: { type: "object" },
        description: `Reviews <${id}> evidence`,
      },
    })));
  }

  test("App catalog reuses installed registry and Task counts independently of saved project files", async () => {
    writeFileSync(join(root, "projects", "sample.app", ".disabled"), "");
    const outside = join(root, "projects", "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "project.json"), JSON.stringify({ id: "outside", status: "active" }));
    await installApps("bare", "idle");
    task("running", 10, "running", "bare");
    task("waiting", 11, "waiting", "bare");
    task("review", 12, "attention", "bare");
    expect(await read("/api/apps")).toEqual(service.listApps());
    expect(await read("/api/apps")).toEqual([
      expect.objectContaining({ id: "bare", runningTasks: 1, waitingTasks: 1, attentionTasks: 1 }),
      expect.objectContaining({ id: "idle", runningTasks: 0, waitingTasks: 0, attentionTasks: 0 }),
    ]);
    expect((await read("/api/projects")).map((project: { name: string }) => project.name).sort())
      .toEqual(["alpha.app", "outside"]);
    // Removing an App from the registry takes effect even while its Task rows remain.
    await installApps("idle");
    expect((await read("/api/apps")).map((app: { id: string }) => app.id)).toEqual(["idle"]);
    await installApps();
    expect(await read("/api/apps")).toEqual([]);
    rejectAppRead = true;
    expect(await read("/api/apps", 503)).toEqual({ error: "fixture App reads unavailable" });
    rejectAppRead = false;
    await installApps("restored");
    expect(await read("/api/apps")).toEqual(service.listApps());
    expect((await fetch(base + "/api/apps", { method: "POST" })).status).toBe(405);
    expect(published).toEqual([]);
    rejectAppRead = true;
    expect(await read("/api/apps", 503)).toHaveProperty("error");
  });

  test.skipIf(skipBrowser)("browser separates loaded Apps from saved projects and distinguishes empty from unavailable", async () => {
    await installApps("bare", "idle");
    task("running", 10, "running", "bare");
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/projects`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('#installed-apps [data-app-id="bare"]');
      expect(await page.$$eval("#installed-apps tbody tr", (rows) => rows.map((row) => row.textContent)))
        .toEqual(["bareReviews <bare> evidenceworker100", "idleReviews <idle> evidenceworker000"]);
      expect(await page.$eval("#saved-projects", (el) => el.textContent)).toContain("Saved project status");
      expect(await page.$eval("#saved-projects", (el) => el.textContent)).toContain("alpha.app");
      expect(await page.$eval("#installed-apps", (el) => el.textContent)).not.toContain("alpha.app");
      expect(await page.$$("#installed-apps bare")).toHaveLength(0); // Descriptions are escaped text.
      await installApps("idle");
      await page.evaluate("loadProjects()");
      expect(await page.$$eval("#installed-apps [data-app-id]", (rows) => rows.map((row) => row.getAttribute("data-app-id"))))
        .toEqual(["idle"]);
      rejectAppRead = true;
      await page.evaluate("loadProjects()");
      expect(await page.$eval("#installed-apps", (el) => el.textContent)).toContain("Loaded Apps unavailable");
      expect(await page.$eval("#installed-apps", (el) => el.textContent)).not.toContain("No Apps loaded");
      expect(await page.$eval("#saved-projects", (el) => el.textContent)).toContain("alpha.app");
      rejectAppRead = false;
      await installApps();
      await page.evaluate("loadProjects()");
      expect(await page.$eval("#installed-apps", (el) => el.textContent)).toContain("No Apps loaded");
      // A metadata endpoint failure cannot hide the installed catalog.
      await installApps("bare");
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/api/projects") {
          void request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "metadata unavailable" }) });
        } else void request.continue();
      });
      await page.evaluate("loadProjects()");
      expect(await page.$('#installed-apps [data-app-id="bare"]')).not.toBeNull();
      expect(await page.$eval("#projects-content", (el) => el.textContent)).toContain("Saved projects unavailable: metadata unavailable");
      await page.click('#installed-apps [data-app-id="bare"] a');
      await page.waitForSelector(".kanban-shell h3");
      expect(await page.$eval(".kanban-shell h3", (el) => el.textContent)).toBe("bare Tasks");
      expect(await page.$$eval(".kanban-card", (cards) => cards.length)).toBe(1);

      // Even when sample.app/project.json declares id: "alpha.app", clicking Loaded App "sample"
      // opens "sample" Tasks rather than "alpha", slash-containing App IDs open their exact Tasks,
      // and App IDs ending in ".app" (e.g. "billing.app" alongside "billing") preserve their exact path.
      mkdirSync(join(root, "projects", "billing.app"), { recursive: true });
      writeFileSync(join(root, "projects", "billing.app", "project.json"), JSON.stringify({ id: "billing", owner: "test", status: "active" }));
      mkdirSync(join(root, "projects", "billing.app.app"), { recursive: true });
      writeFileSync(join(root, "projects", "billing.app.app", "project.json"), JSON.stringify({ id: "billing.app", owner: "test", status: "active" }));
      await installApps("sample", "team/slash", "billing", "billing.app");
      task("billing-plain-only", 15, "running", "billing");
      task("billing-app-only", 16, "waiting", "billing.app");
      task("sample-only", 13, "running", "sample");
      task("slash-only", 14, "waiting", "team/slash");
      await page.evaluate("routeTo('/projects')");
      await page.waitForSelector('#installed-apps [data-app-id="sample"] a');
      await page.click('#installed-apps [data-app-id="sample"] a');
      await page.waitForFunction(() => document.querySelector(".kanban-shell h3")?.textContent === "sample Tasks");
      expect(await page.$eval(".kanban-board", (el) => el.textContent)).toContain("sample-only");
      await page.evaluate("routeTo('/projects')");
      await page.waitForSelector('#installed-apps [data-app-id="team/slash"] a');
      await page.click('#installed-apps [data-app-id="team/slash"] a');
      await page.waitForFunction(() => document.querySelector(".kanban-shell h3")?.textContent === "team/slash Tasks");
      expect(await page.$eval(".kanban-board", (el) => el.textContent)).toContain("slash-only");
      await page.evaluate("routeTo('/projects')");
      let commentBody: any = null;
      await page.evaluate("window.originalCommentFetch = window.fetch; window.fetch = (url, init) => String(url).endsWith('/api/projects/comment') ? (window.lastCommentBody = JSON.parse(init.body), Promise.resolve(new Response(JSON.stringify({ ok: true, triggered: true, projectId: 'billing.app' }), { status: 202 }))) : window.originalCommentFetch(url, init);");
      await page.waitForSelector('#installed-apps [data-app-id="billing.app"] a');
      await page.click('#installed-apps [data-app-id="billing.app"] a');
      await page.waitForFunction(() => document.querySelector(".kanban-shell h3")?.textContent === "billing.app Tasks");
      const boardText = await page.$eval(".kanban-board", (el) => el.textContent);
      expect(boardText).toContain("billing-app-only");
      expect(boardText).not.toContain("billing-plain-only");
      await page.click(".kanban-card");
      await page.waitForFunction(() => document.querySelector("#task-detail-drawer")?.textContent?.includes("Full goal billing-app-only"));
      expect(await page.$eval("#task-detail-drawer", (el) => el.classList.contains("hidden"))).toBe(false);
      expect(await page.evaluate("_projectDetailPath")).toBe("projects/billing.app.app");
      await page.type("#project-comment", "Comment for billing.app");
      await page.evaluate("addProjectComment()");
      commentBody = await page.evaluate("window.lastCommentBody");
      expect(commentBody).toMatchObject({ path: "projects/billing.app.app", comment: "Comment for billing.app" });
    } finally {
      await browser.close();
    }
  });

  test("HTTP binds bounded human reads to their owner without changing SDK reads", async () => {
    task("work/a ?&", 10, "converged");
    task("work/b", 9);
    task("work/a ?&", 11, "waiting", "other");
    expect((await read("/api/projects/detail?path=projects/sample.app")).app.appId).toBe("alpha");
    const first = await read("/api/tasks?appId=alpha&limit=1");
    expect(first).toEqual(service.listTasks({ appId: "alpha", limit: 1 }));
    expect(first.items[0]).toMatchObject({ taskId: "work/a ?&", status: "idle", terminal: false });
    expect(
      (await read(`/api/tasks?appId=alpha&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`)).items[0].taskId,
    ).toBe("work/b");
    expect(await read(`/api/task?${new URLSearchParams({ appId: "alpha", taskId: "work/a ?&" })}`)).toEqual(
      service.getTask({ appId: "alpha", taskId: "work/a ?&" }),
    );
    const refView = service.getTask({ appId: "alpha", taskId: "work/a ?&" })!;
    expect(await read(`/api/task?${new URLSearchParams({ ref: refView.ref })}`)).toEqual(
      service.getTask({ ref: refView.ref }),
    );
    expect(await read(`/api/task?${new URLSearchParams({ appId: "alpha", taskId: "work/a ?&", acceptedEvidence: "true", evidenceLimit: "1" })}`)).toEqual(
      service.getTask({ appId: "alpha", taskId: "work/a ?&", acceptedEvidence: { limit: 1 } }),
    );
    await read("/api/task?appId=alpha&taskId=work%2Fa&evidenceLimit=1", 400);
    await read("/api/task?ref=", 400);
    await read("/api/task?ref=00000000", 404);
    expect((await read("/api/tasks?appId=alpha&status=waiting")).items).toEqual([]);
    expect(await read("/api/tasks?allApps=true&status=running&status=waiting&limit=8"))
      .toEqual(service.listTasks({ status: ["running", "waiting"], limit: 8 }));
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
    services.listTasks = () => { throw new Error("fixture Task read unavailable"); };
    services.getTask = () => { throw new Error("fixture Task read unavailable"); };
    await read("/api/tasks?appId=alpha", 503);
    await read("/api/task?appId=alpha&taskId=missing", 503);
  });

  test("HTTP Conversation reads forward exact identity and bounded options", async () => {
    conversation.messages = Array.from({ length: 35 }, (_, index) => ({
      id: `recent-${index}`,
      author: { kind: "agent" },
      text: `Recent ${index}`,
    }));
    const recent = await read("/api/conversation?appId=support&conversationId=retained-room");
    expect(recent.messages).toHaveLength(30);
    expect(recent.messages[0].id).toBe("recent-5");
    await read("/api/conversation?appId=support", 400);
    await read("/api/conversation?conversationId=retained-room", 400);
    rejectConversationRead = true;
    expect(await read("/api/conversation?appId=support&conversationId=retained-room", 503)).toMatchObject({ error: "fixture Conversation storage unavailable" });
    rejectConversationRead = false;
    const recovered = await read("/api/conversation?appId=support&conversationId=retained-room");
    expect(recovered).toMatchObject({ activeTurn: conversation.activeTurn });
    expect(recovered.messages).toEqual(conversation.messages.slice(-30));
    expect(published).toHaveLength(0);
    rejectConversationRead = true;
    await read("/api/conversation?appId=support&conversationId=retained-room", 503);
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
        expect(await page.$('[data-tab="learning"]')).toBeNull();
        expect(await page.$$eval(".tab-btn", (buttons) => buttons.map((button) => button.textContent))).not.toContain("Learning");
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
        const detailLabels = await page.$$eval("#task-detail-drawer .task-detail-grid b", (labels) =>
          labels.map((label) => label.textContent),
        );
        expect(detailLabels).toContain("Mechanism");
        expect(detailLabels).not.toContain("Mode");
        await page.type("#kanban-steer-text", "Focus on the edge case");

        // Capture ingress without admitting model-backed work in the fixture.
        await page.setRequestInterception(true);
        let ingress: Record<string, unknown> | undefined;
        page.on("request", (request) => {
          if (request.method() === "POST" && request.url().endsWith("/api/task/input")) {
            ingress = JSON.parse(request.postData()!);
            void request.respond({ status: 202, contentType: "application/json", body: '{"accepted":true,"eventId":123,"generation":2}' });
          } else void request.continue();
        });
        await page.evaluate("sendProjectSteering()");
        expect(ingress).toMatchObject({
          appId: "alpha",
          taskId: "work/34",
          expectedGeneration: 2,
          message: "Focus on the edge case",
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
        expect(await page.$eval("#task-detail-drawer", (el) => el.textContent)).toContain("idle");
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
  test.skipIf(skipBrowser)("May browser Stop retains its observed target and draft, then admits a correction to Conversation", async () => {
    seedChat();
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/helper`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("#chat-stop")!.disabled);
      // HTTP readiness does not prove the notification subscription is active.
      // A status response on the same ordered socket follows the page's subscribe.
      await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
      await page.evaluate(() => new Promise<void>((resolve, reject) => {
        const socket = globalThis.eval("ws") as WebSocket;
        const timer = setTimeout(() => {
          socket.removeEventListener("message", onMessage);
          reject(new Error("Notification status response timed out"));
        }, 5000);
        const onMessage = (event: MessageEvent) => {
          const frame = JSON.parse(event.data);
          if (frame.type !== "status") return;
          clearTimeout(timer);
          socket.removeEventListener("message", onMessage);
          resolve();
        };
        socket.addEventListener("message", onMessage);
        socket.send(JSON.stringify({ type: "status" }));
      }));
      await page.evaluate("window.fixtureDiagnostics = []; busSubscribe('handler.failed', event => window.fixtureDiagnostics.push(event))");
      for (const listener of listeners) {
        listener({ type: "status", activeAgents: [{ agent: "worker", sessionId: "other-session", status: "running" }] });
        listener({ type: "text", data: { sessionId: "other-session" }, text: "Other session text" });
        listener({ type: "handler.failed", data: { appId: "other-app", taskId: "work", stage: "execute", error: "Diagnostic survives May chat", disposition: "not-retrying" } });
      }
      await page.waitForFunction("window.fixtureDiagnostics.some(event => event.data.error === 'Diagnostic survives May chat')");
      expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Other session text");
      await page.type("#chat-input", "Discuss costs before implementing");
      await page.click("#chat-stop");
      await page.waitForFunction(() => document.body.textContent!.includes("Stop request accepted"));
      expect(published[0]).toMatchObject({ type: "conversation.turn.stop.requested", target: { appId: "support" },
        data: { conversationId: "retained-room", turnId: "turn-one", expectedRevision: 7 } });
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Discuss costs before implementing");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#chat-input")!.value === "");
      // Publication clears the draft before the send's Conversation refresh finishes.
      // A later click during that refresh is still ignored as a duplicate send.
      await page.waitForFunction("!maySendPending");
      expect(published.at(-1)).toMatchObject({ type: "conversation.message.created", target: { appId: "support" },
        data: { conversationId: "retained-room", text: "Discuss costs before implementing", author: { kind: "human" } } });
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
      for (const listener of listeners) listener({ type: "conversation.updated", data: { appId: "support", conversationId: "retained-room" } });
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
      for (const listener of listeners) listener({ type: "conversation.updated", data: { appId: "support", conversationId: "retained-room" } });
      await page.waitForFunction(() => document.querySelector<HTMLButtonElement>("#chat-stop")!.disabled);
      expect(published.some(event => event.type === "session.cancel.requested" || event.type === "session.steer.requested")).toBe(false);

      // Open Requests and Task chips stay bounded but make omitted identities navigable.
      conversation.requests = Array.from({ length: 7 }, (_, index) => ({
        id: `req_${index + 1}`,
        status: "open",
        scope: index === 0 ? "Verify <img src=x onerror=window.fixtureUnsafe=true> release" : `Ask ${index + 1}`,
        taskRefs: index === 0
          ? Array.from({ length: 4 }, (__, taskIndex) => ({ appId: "alpha", taskId: `work/${taskIndex}`, ref: `ref0000${taskIndex}` }))
          : [],
      }));
      conversation.messages.push({
        id: "agent-msg-1",
        author: { kind: "agent", id: "helper" },
        text: "Started <script>window.fixtureUnsafe=true</script> verification.",
        metadata: { taskRefs: [{ appId: "alpha", taskId: "work/0", ref: "8f12ac90" }] },
      });
      await page.evaluate("void refreshMayConversation()");
      await page.waitForSelector('#conversation-context-bar [data-request-id="req_1"]');
      expect(await page.$eval("#conversation-context-bar", el => el.textContent)).toContain("showing 1-6");
      expect(await page.$("#conversation-context-bar img")).toBeNull();
      expect(await page.$("#chat-messages script")).toBeNull();
      expect(await page.evaluate("Boolean(window.fixtureUnsafe)")).toBe(false);
      await page.click('#conversation-context-bar [data-task-ref-page] button[title="Next Task references"]');
      expect(await page.$eval('#conversation-context-bar [data-request-id="req_1"]', el => el.textContent)).toContain("alpha · ref00003");
      await page.click('#conversation-context-bar [data-request-page] button:last-child');
      await page.waitForSelector('#conversation-context-bar [data-request-id="req_7"]');
      expect(await page.$eval("#conversation-context-bar", el => el.textContent)).toContain("showing 7-7");
      await page.click('#conversation-context-bar [data-request-page] button:first-child');
      expect(await page.$eval('#chat-messages [data-task-ref="alpha:work/0"]', el => el.textContent)).toContain("Task alpha · 8f12ac90");
      expect(await page.$('#chat-messages [data-focus-task="alpha:work/0"]')).toBeNull();
      await page.type("#chat-input", "Check the edge case on this Task");

      // Accept the event durably, then lose only the browser acknowledgement.
      const beforeLostAckMessages = conversation.messages.length;
      const beforeLostAckPublications = published.length;
      await page.evaluate(`window.fixtureOriginalFetch = window.fetch;
        window.fixtureLoseMessageAck = true;
        window.fetch = async (url, init) => {
          const response = await window.fixtureOriginalFetch(url, init);
          if (window.fixtureLoseMessageAck && String(url).endsWith('/api/events') && JSON.parse(init.body).type === 'conversation.message.created') {
            window.fixtureLoseMessageAck = false;
            window.fixtureLostAckObserved = true;
            throw new Error('fixture acknowledgement lost after acceptance');
          }
          return response;
        };`);
      await page.click("#chat-send");
      await page.waitForFunction("window.fixtureLostAckObserved && !maySendPending");
      expect(published.length).toBe(beforeLostAckPublications + 1);
      const firstAttempt = published.at(-1);
      expect(firstAttempt.type).toBe("conversation.message.created");
      expect(conversation.messages).toHaveLength(beforeLostAckMessages + 1);
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Check the edge case on this Task");

      // Retrying unchanged text keeps the unknown operation identity; replay is deduplicated.
      const beforeReplayPublications = published.length;
      await page.click("#chat-send");
      await page.waitForFunction('document.querySelector("#chat-input").value === ""');
      expect(published.length).toBe(beforeReplayPublications + 1);
      expect(published.at(-1).idempotencyKey).toBe(firstAttempt.idempotencyKey);
      expect(conversation.messages).toHaveLength(beforeLostAckMessages + 1);
      expect(published.at(-1)).toMatchObject({
        type: "conversation.message.created",
        target: { appId: "support" },
        data: {
          conversationId: "retained-room",
          text: "Check the edge case on this Task",
          metadata: { channel: "web-ui" },
        },
      });

      // Changed text creates a distinct operation after an unknown acknowledgement.
      await page.type("#chat-input", "Changed text");
      rejectPublish = true;
      const beforeUnknown = published.length;
      const rejectedSend = page.waitForResponse(response => response.url() === `${base}/api/events` && response.status() === 503);
      await page.click("#chat-send");
      await rejectedSend;
      await page.waitForFunction("!maySendPending");
      expect(published.length).toBe(beforeUnknown + 1);
      const changedTextAttempt = published.at(-1);
      expect(changedTextAttempt.idempotencyKey).not.toBe(firstAttempt.idempotencyKey);
      rejectPublish = false;
      await page.evaluate("window.fetch = window.fixtureOriginalFetch");

      // Other-agent and historical-session views hide May's Conversation context.
      await page.evaluate("routeTo('/agents/worker')");
      await page.waitForFunction("currentAgentChat === 'worker'");
      expect(await page.$eval("#conversation-context-bar", el => getComputedStyle(el).display)).toBe("none");
      await page.evaluate("routeTo('/sessions/helper-old-session')");
      await page.waitForFunction("currentTab === 'sessions'");
      expect(await page.$eval("#conversation-context-bar", el => getComputedStyle(el).display)).toBe("none");
    } finally { await browser.close(); }
  });


  test.skipIf(skipBrowser)("specialist agents expose Overview and About with no session composer", async () => {
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      const writes: string[] = [];
      page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
      await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#agent-subtab-body");
      expect(await page.$eval("#chat", el => el.classList.contains("hidden"))).toBe(true);
      expect(await page.$eval("#agents-content", el => el.textContent)).not.toContain("Chat");
      expect(await page.$eval("#agents-content", el => el.textContent)).toContain("overview");
      expect(writes).toEqual([]);
    } finally { await browser.close(); }
  });

});
