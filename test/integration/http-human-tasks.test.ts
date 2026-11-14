import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer, { type HTTPRequest, type Page } from "puppeteer-core";
import { attachControlSocket, type ControlSocket, type ControlEvent } from "../../packages/control/src/server.js";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { HumanTaskService, type HumanTaskStatus } from "../../src/app/human-task-service.js";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { appendSessionMessage, ensureSessionDir } from "../../src/lib/persistence.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
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
  let control: ControlSocket;
  let child: ChildProcess;
  let stopped: Promise<void>;
  let base: string;
  let service: HumanTaskService;
  let registry: AppRegistry;
  let conversation: { messages: any[]; activeTurn?: { id: string; revision: number } };
  let published: any[];
  let onPublish: ((event: any) => void) | undefined;
  let rejectPublish: boolean;
  let rejectConversationRead: boolean;
  let rejectAppRead: boolean;
  let listeners: Set<(event: ControlEvent) => void>;
  let activeStatus: any[];

  beforeEach(async () => {
    conversation = { messages: [], activeTurn: { id: "turn-one", revision: 7 } };
    published = [];
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
    control = await attachControlSocket({
      socketPath: daemonSocketPath(root, { instance: "task-test", interfaceAgent: "helper" }),
      getStatus: () => activeStatus,
      emitEvent: () => {},
      subscribeEvents: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      getAppConversation: (appId, conversationId, options) => {
        if (appId !== "support" || conversationId !== "retained-room" || options?.limit !== 30) throw new Error("Invalid conversation read");
        if (rejectConversationRead) throw new Error("fixture Conversation storage unavailable");
        return conversation;
      },
      publishEvent: (event) => {
        published.push(event);
        onPublish?.(event);
        if (rejectPublish) throw new Error("fixture persistence unavailable");
        if (event.type === "conversation.turn.stop.requested") {
          conversation.activeTurn = { id: "turn-two", revision: 8 };
        } else if (event.type === "conversation.message.created") {
          conversation.messages.push({ id: event.idempotencyKey, author: { kind: "human" }, text: event.data.text });
        }
        return { eventId: published.length, eventType: event.type, delivery: "accepted" };
      },
      agentName: "helper",
      instance: "task-test",
      listApps: (appId) => {
        if (rejectAppRead) throw new Error("fixture App reads unavailable");
        return service.listApps(appId);
      },
      listTasks: (options) =>
        service.listTasks({ ...options, status: options?.status as HumanTaskStatus[] | undefined }),
      getTask: (input) => service.getTask(input),
      // SDK routes remain separate and keep their existing response shape.
      listAppTasks: () => ({ items: [{ id: "sdk-task", status: "done" }] }),
      getAppTask: (_appId, _taskId, options) => ({
        id: "sdk-task", status: "done",
        ...(options?.inputKeys ? { inputEvents: options.inputKeys.map((key) => ({ key })) } : {}),
      }),
    });
    await startWeb();
  });

  async function startWeb(conversationApp = "support", conversationId = "retained-room") {
    child = spawnFixtureProcess(
      [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        env: {
          ...process.env,
          PROJECT_ROOT: root,
          AGENTS_ROOT: root,
          SHARED_ROOT: root,
          PROJECTS_ROOT: join(root, "projects"),
          DAEMON_INSTANCE: "task-test",
          AGENT: "helper", CONVERSATION_APP: conversationApp, CONVERSATION_ID: conversationId, DAEMON_AGENT: "unused-legacy",
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
  }

  afterEach(async () => {
    child?.kill("SIGKILL");
    await stopped;
    control?.close();
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
        if (frame.type !== "status" || !frame.diagnostics) return;
        clearTimeout(timer);
        socket.removeEventListener("message", receive);
        done();
      }
      socket.addEventListener("message", receive);
      socket.send(JSON.stringify({ type: "status", diagnostics: true }));
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

  test.skipIf(skipBrowser).each(["overview", "unbound", "loading", "session", "generic", "conversation"])("served %s subscribes to its own scope on fresh connection and reconnect", async (surface) => {
    seedChat("worker");
    seedChat("selected");
    const route = {
      overview: "/", unbound: "/agents/new-worker", loading: "/agents/worker",
      session: "/sessions/selected-old-session", generic: "/sessions", conversation: "/agents/helper",
    }[surface]!;
    const allowed = surface === "overview" || surface === "conversation"
      ? ["fixture", "worker-old-session", "selected-old-session"]
      : surface === "session" ? ["selected-old-session"] : surface === "generic" ? ["fixture"] : [];
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      let held: HTTPRequest | undefined;
      if (surface === "loading") {
        await page.setRequestInterception(true);
        page.on("request", request => {
          if (new URL(request.url()).pathname === "/api/agents/worker/default-session") held = request;
          else void request.continue();
        });
      }
      await page.goto(base + route, { waitUntil: "domcontentloaded" });
      if (surface === "unbound") await page.waitForFunction(() => document.querySelector("#chat-messages")?.textContent?.includes("No conversation"));
      if (surface === "loading") await page.waitForSelector("#agent-subtab-body");
      if (surface === "conversation") await page.waitForFunction("mayActiveTurn?.id === 'turn-one'");
      await notificationBarrier(page);
      await page.evaluate("window.receivedSessions = []; window.receivedConversations = []; busSubscribe('text', event => window.receivedSessions.push(event.data.sessionId)); busSubscribe('conversation.updated', event => window.receivedConversations.push(event.data.conversationId))");
      for (const again of [false, true]) {
        if (again) await reconnect(page);
        await page.evaluate("window.receivedSessions = []; window.receivedConversations = []");
        for (const listener of listeners) {
          for (const sessionId of ["fixture", "worker-old-session", "selected-old-session"]) {
            listener({ type: "text", data: { sessionId }, text: "Event payload is not a saved message" });
          }
          listener({ type: "conversation.updated", data: { appId: "support", conversationId: "retained-room" } });
        }
        await notificationBarrier(page);
        expect(await page.evaluate("window.receivedSessions")).toEqual(allowed);
        expect(await page.evaluate("window.receivedConversations")).toEqual(surface === "conversation" ? ["retained-room"] : []);
        expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Event payload is not a saved message");
      }
      if (held) await held.continue();
      if (surface === "generic") {
        ensureSessionDir(root, "selected-old-session");
        appendSessionMessage(root, "selected-old-session", { role: "user", content: "Retained generic selection", timestamp: Date.now() });
        await page.evaluate("routeTo('/sessions/selected-old-session')");
        await page.waitForFunction(() => document.querySelector("#session-detail-panel h3")?.textContent === "selected-old-session");
        await page.evaluate("routeTo('/sessions')");
        await page.waitForFunction(() => document.querySelector("#chat-messages")?.textContent?.includes("Retained generic selection"));
        expect(await page.evaluate("currentSessionId")).toBe("selected-old-session");
      }
      if (surface === "unbound") {
        await page.click('#agents-content button[onclick="switchAgentSubTab(\'overview\')"]');
        expect(await page.$eval("#chat", el => el.classList.contains("hidden"))).toBe(true);
        await page.evaluate("document.getElementById('chat-input').value = 'Inactive composer'; sendChat()");
        expect(published).toEqual([]);
      }
    } finally { await browser.close(); }
  }, 30000);

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

  test.skipIf(skipBrowser)("direct chat renders saved turns once and reconciles a turn ending during its history read", async () => {
    const sessionId = seedChat("worker");
    ensureSessionDir(root, sessionId);
    appendSessionMessage(root, sessionId, { role: "user", content: "Initial saved turn", timestamp: Date.now() });
    const snapshot = await read(`/api/sessions/${sessionId}/transcript`);
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector("#chat-messages")?.textContent?.includes("Initial saved turn"));
      await notificationBarrier(page);
      let capture: ((request: HTTPRequest) => void) | null = null;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (capture && new URL(request.url()).pathname === `/api/sessions/${sessionId}/transcript`) {
          capture(request);
          capture = null;
        } else void request.continue();
      });
      const pending = page.evaluate("switchSession('worker-old-session')");
      const held = await intercepted;
      for (const listener of listeners) listener({ type: "text", data: { sessionId }, text: "Transient output" });
      await notificationBarrier(page);
      expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Transient output");
      const submitted = new Promise<void>(done => { onPublish = done; });
      await page.type("#chat-input", "Intervening input");
      await page.click("#chat-send");
      await submitted;
      expect(published[0]).toMatchObject({ type: "session.steer.requested", target: { sessionId }, data: { message: "Intervening input" } });
      expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Intervening input");
      await page.waitForFunction(() => document.querySelector("#chat-status")?.textContent?.includes("Message accepted"));
      appendSessionMessage(root, sessionId, { role: "user", content: published[0].data.message, timestamp: Date.now() });
      appendSessionMessage(root, sessionId, { role: "assistant", content: [{ type: "text", text: "Saved response" }], timestamp: Date.now() });
      for (const listener of listeners) listener({ type: "turn_end", data: { sessionId } });
      await notificationBarrier(page);
      await held.respond({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot) });
      await pending;
      expect(await page.$$eval("#chat-messages .message-text", els => els.map(el => el.textContent))).toEqual(["Initial saved turn", "Intervening input"]);
      expect(await page.$$eval("#chat-messages .assistant-text", els => els.map(el => el.textContent))).toEqual(["Saved response"]);
      appendSessionMessage(root, sessionId, { role: "assistant", content: [{ type: "text", text: "Next saved turn" }], timestamp: Date.now() });
      for (const listener of listeners) listener({ type: "turn_end", data: { sessionId } });
      await page.waitForFunction(() => document.querySelector("#chat-messages")?.textContent?.includes("Next saved turn"));
      expect(await page.$$eval("#chat-messages .assistant-text", els => els.map(el => el.textContent))).toEqual(["Saved response", "Next saved turn"]);
      await reconnect(page);
      await page.waitForFunction(() => document.querySelector("#chat-messages")?.textContent?.includes("Next saved turn"));
      expect(await page.$$eval("#chat-messages .assistant-text", els => els.map(el => el.textContent))).toEqual(["Saved response", "Next saved turn"]);
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser)("direct chat keeps saved history and rejected drafts, and publishes without its notification socket", async () => {
    const sessionId = seedChat("worker");
    ensureSessionDir(root, sessionId);
    appendSessionMessage(root, sessionId, { role: "user", content: "Keep this saved history", timestamp: Date.now() });
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector("#chat-messages")?.textContent?.includes("Keep this saved history"));
      let capturePublish: ((request: HTTPRequest) => void) | null = null;
      let publishRequests = 0;
      let rejectDefaultRead = true;
      await page.setRequestInterception(true);
      page.on("request", request => {
        const path = new URL(request.url()).pathname;
        if (rejectDefaultRead && path === "/api/agents/worker/default-session") return void request.abort("failed");
        if (path === "/api/events") {
          publishRequests++;
          if (capturePublish) { capturePublish(request); capturePublish = null; return; }
        }
        void request.continue();
      });
      await page.evaluate("loadAgentChatThread('worker')");
      expect(await page.$eval("#chat-status", el => el.textContent)).toContain("Default thread unavailable");
      expect(await page.$eval("#chat-messages", el => el.textContent)).toContain("Keep this saved history");
      await page.evaluate("setRealtimeEnabled(false)");
      expect(await page.evaluate("ws")).toBeNull();
      rejectPublish = true;
      await page.type("#chat-input", "Keep this draft until acceptance");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.body.textContent?.includes("Message was not confirmed"));
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Keep this draft until acceptance");
      rejectPublish = false;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capturePublish = resolveRequest; });
      await page.click("#chat-send");
      const held = await intercepted;
      await page.click("#chat-send"); // An unchanged draft already awaiting admission.
      await page.$eval("#chat-input", el => { (el as HTMLInputElement).value = "A different next draft"; });
      await held.continue();
      await page.waitForFunction(() => document.querySelector("#chat-status")?.textContent?.includes("Message accepted"));
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("A different next draft");
      expect(publishRequests).toBe(2);
      expect(published).toHaveLength(2); // A failed admission attempt, then acceptance.
      expect(published[0].idempotencyKey).toBe(published[1].idempotencyKey);
      expect(published[1]).toMatchObject({ type: "session.steer.requested", target: { sessionId } });
      expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Keep this draft until acceptance");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#chat-input")?.value === "");
      expect(published).toHaveLength(3);
      expect(published[2].idempotencyKey).not.toBe(published[1].idempotencyKey);
      expect(published[2].data.message).toBe("A different next draft");
      const metadataAdmission = new Promise<HTTPRequest>(resolveRequest => { capturePublish = resolveRequest; });
      await page.$eval("#chat-input", el => { (el as HTMLInputElement).value = "Accepted during same-thread reload"; });
      const pending = page.evaluate("sendChat()");
      const heldAdmission = await metadataAdmission;
      rejectDefaultRead = false;
      await page.evaluate("loadAgentChatThread('worker')");
      await heldAdmission.continue();
      await pending;
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("");
      expect(published).toHaveLength(4);
      expect(published[3]).toMatchObject({ type: "session.steer.requested", target: { sessionId } });
      const inactiveAdmission = new Promise<HTTPRequest>(resolveRequest => { capturePublish = resolveRequest; });
      await page.$eval("#chat-input", el => { (el as HTMLInputElement).value = "Pending before leaving Chat"; });
      const leaving = page.evaluate("sendChat()");
      const inactiveHeld = await inactiveAdmission;
      await page.click('#agents-content button[onclick="switchAgentSubTab(\'about\')"]');
      await inactiveHeld.continue();
      await leaving;
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Pending before leaving Chat");
      expect(published).toHaveLength(5);
      expect(published[4]).toMatchObject({ type: "session.steer.requested", target: { sessionId } });
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser).each(["abort", "500"])(
    "returning to Chat retains and refreshes its thread after a %s default lookup failure",
    async (failure) => {
      const sessionId = seedChat("worker");
      ensureSessionDir(root, sessionId);
      appendSessionMessage(root, sessionId, { role: "user", content: "Retained thread", timestamp: Date.now() });
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("Retained thread"),
        );
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (new URL(request.url()).pathname !== "/api/agents/worker/default-session") return void request.continue();
          if (failure === "abort") void request.abort("failed");
          else
            void request.respond({
              status: 500,
              contentType: "application/json",
              body: '{"error":"fixture metadata unavailable"}',
            });
        });
        await page.evaluate("loadAgentChatThread('worker')");
        expect(await page.evaluate("currentSessionId")).toBe(sessionId);
        expect(await page.$eval("#chat-status", (el) => el.textContent)).toContain("Default thread unavailable");
        await page.click("#agents-content button[onclick=\"switchAgentSubTab('about')\"]");
        await page.click("#agents-content button[onclick=\"switchAgentSubTab('chat')\"]");
        await notificationBarrier(page);
        appendSessionMessage(root, sessionId, {
          role: "assistant",
          content: [{ type: "text", text: "Saved after returning" }],
          timestamp: Date.now(),
        });
        for (const listener of listeners) listener({ type: "turn.end", data: { sessionId } });
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("Saved after returning"),
        );
        expect(await page.evaluate("currentSessionId")).toBe(sessionId);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

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
        expect(await page.evaluate("currentSessionId")).toBe(sessionId);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)(
    "a session-start notification refreshes the picker from authoritative status immediately",
    async () => {
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/sessions`, { waitUntil: "domcontentloaded" });
        await notificationBarrier(page);
        activeStatus = [
          {
            sessionId: "started-session",
            agent: "worker",
            task: "Started chat",
            status: "running",
            kind: "chat",
            startedAt: Date.now(),
          },
        ];
        for (const listener of listeners)
          listener({
            type: "session.start",
            data: { sessionId: "started-session", agent: "worker", kind: "chat", parentSessionId: "fixture" },
          });
        await page.waitForFunction(() =>
          document.querySelector("#session-picker")?.textContent?.includes("worker (ession)"),
        );
        expect(await page.evaluate("activeSessions[0].status")).toBe("running");
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)(
    "fresh chat discovers its admitted request after the first lookup, excluding older and concurrent threads",
    async () => {
      seedChat("worker");
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction("currentSessionId === 'worker-old-session'");
        await page.click("#agents-content button[onclick=\"resetAgentChat('worker')\"]");
        let firstLookup = true;
        let observed: () => void;
        const lookup = new Promise<void>((done) => {
          observed = done;
        });
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (firstLookup && new URL(request.url()).pathname === "/api/agents/worker/default-session") {
            firstLookup = false;
            void request.respond({ status: 200, contentType: "application/json", body: '{"sessionId":null}' });
            observed();
          } else void request.continue();
        });
        await page.type("#chat-input", "Start the requested thread");
        await page.evaluate("sendChat()");
        await lookup;
        await page.$eval("#chat-input", (el) => {
          (el as HTMLInputElement).value = "Next draft while starting";
        });
        await page.evaluate("sendChat()");
        expect(published).toHaveLength(1);
        expect(await page.$eval("#chat-input", (el) => (el as HTMLInputElement).value)).toBe(
          "Next draft while starting",
        );
        await page.click("#agents-content button[onclick=\"switchAgentSubTab('about')\"]");
        await page.click("#agents-content button[onclick=\"switchAgentSubTab('chat')\"]");
        const requestId = published[0].data.requestId;
        db.prepare(
          "INSERT INTO sessions(sessionId,agent,task,status,kind,source,startedAt,requestId) VALUES(?,?,?,?,?,?,?,?)",
        ).run(
          "requested-new-session",
          "worker",
          "Requested",
          "idle",
          "chat",
          "web-ui",
          Date.now(),
          requestId || "missing-correlation",
        );
        db.prepare(
          "INSERT INTO sessions(sessionId,agent,task,status,kind,source,startedAt,requestId) VALUES(?,?,?,?,?,?,?,?)",
        ).run(
          "concurrent-newer-session",
          "worker",
          "Concurrent",
          "idle",
          "chat",
          "web-ui",
          Date.now() + 1000,
          "another-request",
        );
        ensureSessionDir(root, "requested-new-session");
        appendSessionMessage(root, "requested-new-session", {
          role: "assistant",
          content: [{ type: "text", text: "The exact requested answer" }],
          timestamp: Date.now(),
        });
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("The exact requested answer"),
        );
        expect(await page.evaluate("currentSessionId")).toBe("requested-new-session");
        expect(typeof requestId).toBe("string");
        expect(published[0].idempotencyKey).toBe(requestId);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)(
    "an unbound submission keeps one admission while the next draft changes",
    async () => {
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("No conversation"),
        );
        await page.evaluate("resetAgentChat('worker')");
        let held: HTTPRequest | undefined;
        let posts = 0;
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (request.method() === "POST" && new URL(request.url()).pathname === "/api/agents/worker/message") {
            posts++;
            if (!held) {
              held = request;
              return;
            }
          }
          void request.continue();
        });
        await page.type("#chat-input", "First accepted input");
        await page.click("#chat-send");
        await page.waitForFunction("chatPendingInput?.sending === true");
        await page.$eval("#chat-input", (el) => {
          (el as HTMLInputElement).value = "The next draft";
        });
        await page.evaluate("void sendChat()");
        expect(posts).toBe(1);
        await held!.continue();
        await page.waitForFunction("agentChatRequestId !== null");
        expect(published).toHaveLength(1);
        expect(await page.$eval("#chat-input", (el) => (el as HTMLInputElement).value)).toBe("The next draft");
        expect(await page.evaluate("agentChatRequestId")).toBe(published[0].idempotencyKey);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser).each([false, true])(
    "an admitted fresh chat survives About with a changed next draft=%s",
    async (changed) => {
      seedChat("worker");
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction("currentSessionId === 'worker-old-session'");
        await page.evaluate("resetAgentChat('worker')");
        let held: HTTPRequest | undefined;
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (request.method() === "POST" && new URL(request.url()).pathname === "/api/agents/worker/message")
            held = request;
          else void request.continue();
        });
        await page.type("#chat-input", "Accepted while About is open");
        await page.click("#chat-send");
        await page.waitForFunction("chatPendingInput?.sending === true");
        if (changed)
          await page.$eval("#chat-input", (el) => {
            (el as HTMLInputElement).value = "Keep the next draft";
          });
        await page.evaluate("switchAgentSubTab('about')");
        await held!.continue();
        await page.waitForFunction("!chatPendingInput?.sending");
        expect(await page.$eval("#chat-input", (el) => (el as HTMLInputElement).value)).toBe(
          changed ? "Keep the next draft" : "Accepted while About is open",
        );
        const requestId = published[0].idempotencyKey;
        db.prepare("UPDATE sessions SET requestId=? WHERE sessionId='worker-old-session'").run(requestId);
        ensureSessionDir(root, "worker-old-session");
        appendSessionMessage(root, "worker-old-session", {
          role: "assistant",
          content: [{ type: "text", text: "Answer to the retained admission" }],
          timestamp: Date.now(),
        });
        await page.evaluate("switchAgentSubTab('chat')");
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("Answer to the retained admission"),
        );
        expect(await page.$eval("#chat-input", (el) => (el as HTMLInputElement).value)).toBe(
          changed ? "Keep the next draft" : "",
        );
        expect(published).toHaveLength(1);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)(
    "an explicit-session admission retained through About restores the saved-turn reader",
    async () => {
      const sessionId = seedChat("worker");
      ensureSessionDir(root, sessionId);
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction("currentSessionId === 'worker-old-session'");
        let held: HTTPRequest | undefined;
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (request.method() === "POST" && new URL(request.url()).pathname === "/api/events") held = request;
          else void request.continue();
        });
        await page.type("#chat-input", "Follow up on this exact session");
        await page.click("#chat-send");
        await page.waitForFunction("chatPendingInput?.sending === true");
        await page.evaluate("switchAgentSubTab('about')");
        await held!.continue();
        await page.waitForFunction("!chatPendingInput?.sending");
        appendSessionMessage(root, sessionId, {
          role: "assistant",
          content: [{ type: "text", text: "Saved reply after hidden admission" }],
          timestamp: Date.now(),
        });
        await page.evaluate("switchAgentSubTab('chat')");
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("Saved reply after hidden admission"),
        );
        expect(await page.$eval("#chat-input", (el) => (el as HTMLInputElement).value)).toBe("");
        expect(await page.evaluate("chatTranscript.sessionId")).toBe(sessionId);
        expect(published).toMatchObject([{ type: "session.steer.requested", target: { sessionId } }]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)(
    "Reset replaces an unknown fresh admission's identity even with an unchanged draft",
    async () => {
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() =>
          document.querySelector("#chat-messages")?.textContent?.includes("No conversation"),
        );
        await page.evaluate("resetAgentChat('worker')");
        let loseResponse = true;
        await page.setRequestInterception(true);
        page.on("request", async (request) => {
          if (
            loseResponse &&
            request.method() === "POST" &&
            new URL(request.url()).pathname === "/api/agents/worker/message"
          ) {
            loseResponse = false;
            await fetch(request.url(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: request.postData(),
              signal: AbortSignal.timeout(5000),
            });
            await request.abort("failed");
          } else void request.continue();
        });
        await page.type("#chat-input", "Same draft, deliberately new chat");
        await page.click("#chat-send");
        await page.waitForFunction(() => document.body.textContent?.includes("Message was not confirmed"));
        const originalId = published[0].idempotencyKey;
        await page.evaluate("resetAgentChat('worker')");
        await page.evaluate("sendChat()");
        expect(published).toHaveLength(2);
        expect(published[1].idempotencyKey).not.toBe(originalId);
        expect(published[1].data.forceNew).toBe(true);
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.each([false, true])(
    "keyed retry recovers the exact steering publication after the default changes, large input=%s",
    async (large) => {
      const original = seedChat("worker");
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const unsubscribe = bus.subscribeDurableRoute(() => ({ accepted: true, by: "fixture-chat", route: "direct" }));
      const events = createEventInterface({
        bus,
        db: getDb(root),
        hasApp: () => false,
        hasAgent: () => true,
        hasSession: () => true,
      });
      onPublish = (event) => {
        events.publish(event, { source: "control-socket" });
      };
      const content = "Original steering input" + (large ? " detail".repeat(1000) : "");
      const requestId = "retained-steering-request";
      const send = async (message = content, agent = "worker") =>
        fetch(base + `/api/agents/${agent}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: message, requestId }),
          signal: AbortSignal.timeout(5000),
        });
      try {
        const first = await send();
        expect(first.status).toBe(200);
        expect(await first.json()).toMatchObject({ sessionId: original });
        db.prepare("INSERT INTO sessions(sessionId,agent,task,status,kind,source,startedAt) VALUES(?,?,?,?,?,?,?)").run(
          "newer-default",
          "worker",
          "Concurrent chat",
          "idle",
          "chat",
          "web-ui",
          Date.now() + 1000,
        );
        db.prepare("UPDATE sessions SET status='done' WHERE sessionId=?").run(original);
        const retry = await send();
        expect(retry.status).toBe(200);
        expect(await retry.json()).toMatchObject({ sessionId: original });
        expect(
          getDb(root).prepare("SELECT count(*) n FROM events WHERE event_type='session.steer.requested'").get(),
        ).toEqual({ n: 1 });
        expect(published.every((event) => event.target.sessionId === original)).toBe(true);
        expect((await send("Changed input")).status).toBe(409);
        expect((await send(content, "other")).status).toBe(409);
      } finally {
        unsubscribe();
      }
    },
  );

  test.skipIf(skipBrowser)("rejected fresh chat keeps its draft and Reset intent", async () => {
    seedChat("worker");
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("currentSessionId === 'worker-old-session'");
      await page.click('#agents-content button[onclick="resetAgentChat(\'worker\')"]');
      rejectPublish = true;
      await page.type("#chat-input", "Fresh chat draft");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.body.textContent?.includes("Message was not confirmed"));
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Fresh chat draft");
      expect(await page.evaluate("forceNewAgentChat")).toBe(true);
      expect(await page.evaluate("currentSessionId")).toBeNull();
      expect(published).toMatchObject([{ type: "chat.start.requested", data: { agent: "worker", forceNew: true } }]);
    } finally { await browser.close(); }
  }, 30000);

  test.each([false, true])(
    "keyed creation retry retains its original publication before any session exists, forceNew=%s",
    async (forceNew) => {
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      let deliveries = 0;
      const unsubscribe = bus.subscribeDurableRoute(() => {
        deliveries++;
        return { accepted: true, by: "fixture-chat", route: "direct" };
      });
      const events = createEventInterface({
        bus,
        db: getDb(root),
        hasApp: () => false,
        hasAgent: () => true,
        hasSession: () => true,
      });
      onPublish = (event) => {
        events.publish(event, { source: "control-socket" });
      };
      const requestId = "original-uncreated-thread";
      const url = base + "/api/agents/worker/message" + (forceNew ? "?new=true" : "");
      const send = () =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Create this exact chat", requestId }),
          signal: AbortSignal.timeout(5000),
        });
      try {
        expect((await send()).status).toBe(200);
        seedChat("worker"); // A different default appears before the original creation.
        expect((await send()).status).toBe(200);
        expect(deliveries).toBe(1);
        expect(published).toHaveLength(1);
        // Interrupted delivery still retries the immutable start, never the new default.
        getDb(root)
          .prepare(
            "UPDATE events SET delivery_status='pending', accepted_by=NULL, accepted_at=NULL WHERE idempotency_key=?",
          )
          .run(requestId);
        expect((await send()).status).toBe(200);
        expect(published).toHaveLength(2);
        expect(published[0]).toEqual(published[1]);
        expect(deliveries).toBe(2);
        expect(
          getDb(root).prepare("SELECT count(*) n FROM events WHERE event_type='chat.start.requested'").get(),
        ).toEqual({ n: 1 });
      } finally {
        unsubscribe();
      }
    },
  );

  test("request-scoped thread reads never fall back to an older or another agent's session", async () => {
    const sessionId = seedChat("worker");
    seedChat("other");
    db.prepare("UPDATE sessions SET requestId=? WHERE sessionId=?").run("requested-thread", sessionId);
    db.prepare(
      "INSERT INTO sessions(sessionId,agent,task,status,kind,source,startedAt,requestId) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      "newer-worker-evidence",
      "worker",
      "Other execution",
      "done",
      "job",
      "web-ui",
      Date.now() + 1000,
      "requested-thread",
    );
    expect(await read("/api/agents/worker/default-session?requestId=requested-thread")).toMatchObject({
      sessionId,
      requestId: "requested-thread",
    });
    expect(await read("/api/agents/worker/default-session?requestId=not-started")).toMatchObject({ sessionId: null });
    expect(await read("/api/agents/other/default-session?requestId=requested-thread")).toMatchObject({
      sessionId: null,
    });
    expect(await read("/api/agents/worker/default-session?requestId=", 400)).toMatchObject({
      error: "invalid requestId",
    });
  });

  test("failed thread storage reads cannot admit an accidental fresh chat", async () => {
    seedChat("worker");
    db.exec("ALTER TABLE sessions RENAME COLUMN agent TO unavailable_agent");
    expect(await read("/api/agents/worker/default-session", 500)).toHaveProperty("error");
    const response = await fetch(base + "/api/agents/worker/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Keep the selected conversation" }),
    });
    expect(response.status).toBe(500);
    expect(published).toEqual([]);
  });

  test("created chat retries confirm the retained publication and never infer a start from session evidence alone", async () => {
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const unsubscribe = bus.subscribeDurableRoute(() => ({ accepted: true, by: "fixture-chat", route: "direct" }));
    const events = createEventInterface({ bus, db: getDb(root), hasApp: () => false, hasAgent: () => true, hasSession: () => true });
    onPublish = event => { events.publish(event, { source: "control-socket" }); };
    const requestId = "original-creation";
    const send = () => fetch(base + "/api/agents/worker/message", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Original input", requestId }), signal: AbortSignal.timeout(5000),
    });
    try {
      expect((await send()).status).toBe(200);
      const sessionId = seedChat("worker");
      db.prepare("UPDATE sessions SET requestId=? WHERE sessionId=?").run(requestId, sessionId);
      expect((await send()).status).toBe(200);
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({ type: "chat.start.requested", idempotencyKey: requestId, data: { requestId } });
      // The fixture has no App planner. Complete that retention fence before
      // simulating an expired publication; pending evidence cannot be deleted.
      db.prepare("UPDATE events SET app_admission_pending=0 WHERE idempotency_key=?").run(requestId);
      expect(db.prepare("DELETE FROM events WHERE idempotency_key=?").run(requestId).changes).toBe(1);
      expect(db.prepare("SELECT count(*) n FROM events WHERE idempotency_key=?").get(requestId)).toEqual({ n: 0 });
      expect(await read(`/api/agents/worker/default-session?requestId=${requestId}`)).toMatchObject({ sessionId });
      const unavailable = await send();
      expect(unavailable.status).toBe(500);
      expect(await unavailable.json()).toMatchObject({ error: "Original chat publication unavailable" });
      expect(published).toHaveLength(1);
    } finally { unsubscribe(); }
  });

  test.each([false, true])("interface-agent HTTP input retains its Conversation with existing session=%s", async (existing) => {
    if (existing) {
      const sessionId = seedChat();
      expect(await read("/api/agents/helper/default-session")).toMatchObject({ sessionId });
    }
    const response = await fetch(base + "/api/agents/helper/message", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Review the migration" }),
    });
    expect(response.status).toBe(200);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: "app.input.requested", target: { appId: "support" },
      data: { conversationId: "retained-room", input: { kind: "message", data: { message: "Review the migration" } } },
    });
  });

  test("explicit session input and other agents retain direct chat", async () => {
    const sessionId = seedChat();
    seedChat("worker");
    for (const path of [`/api/sessions/${sessionId}/message`, "/api/agents/worker/message", "/api/agents/new-worker/message"]) {
      const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Follow up here" }) });
      expect(response.status).toBe(200);
    }
    expect(published).toMatchObject([
      { type: "session.steer.requested", target: { sessionId } },
      { type: "session.steer.requested", target: { sessionId: "worker-old-session" } },
      { type: "chat.start.requested", data: { agent: "new-worker" } },
    ]);
  });

  test.skipIf(skipBrowser).each(["session", "empty", "error"])("late agent default-session %s cannot redirect a routed session follow-up", async (result) => {
    seedChat("worker");
    db.prepare("INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)")
      .run("selected-session", "worker", "Selected report", "done", Date.now() - 2000, Date.now() - 1000);
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto(`${base}/sessions/selected-session`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
      // Retain the shipped loader's promise to await its success/catch after release.
      await page.evaluate(`(() => {
        const load = loadAgentChatThread;
        loadAgentChatThread = name => window.pendingAgentChat = load(name);
      })()`);
      let capture: (request: HTTPRequest) => void;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (new URL(request.url()).pathname === "/api/agents/worker/default-session") capture(request);
        else void request.continue();
      });
      await page.evaluate("routeTo('/agents/worker')");
      const held = await intercepted;
      await page.click('#agents-content button[onclick="switchAgentSubTab(\'overview\')"]');
      await page.waitForSelector('#agent-subtab-body [onclick*="selected-session"]');
      await page.click('#agent-subtab-body [onclick*="selected-session"]');
      await page.waitForFunction(() => document.querySelector("#session-detail-panel h3")?.textContent === "selected-session");
      if (result === "session") await held.continue();
      else if (result === "empty") await held.respond({ status: 200, contentType: "application/json", body: '{"sessionId":null}' });
      else await held.abort("failed");
      await page.evaluate("window.pendingAgentChat");
      expect(new URL(page.url()).pathname).toBe("/sessions/selected-session");
      await page.type("#chat-input", "Follow up on the selected report");
      const submitted = new Promise<void>(done => { onPublish = done; });
      await page.click("#chat-send");
      await submitted;
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        type: "session.steer.requested", target: { sessionId: "selected-session" },
        data: { message: "Follow up on the selected report" },
      });
      expect(await page.evaluate("currentSessionId")).toBe("selected-session");
      expect(await page.$eval("#chat-messages", el => el.textContent)).not.toContain("Failed:");
      expect(errors).toEqual([]);
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser)("agent Chat discards older loads after a subtab change, newer load or Reset", async () => {
    seedChat("worker");
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("currentSessionId === 'worker-old-session' && ws?.readyState === WebSocket.OPEN");
      let capture: ((request: HTTPRequest) => void) | null = null;
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (capture && new URL(request.url()).pathname === "/api/agents/worker/default-session") capture(request);
        else void request.continue();
      });
      for (const transition of ["overview", "newer", "reset"]) {
        const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
        const pending = page.evaluate("loadAgentChatThread('worker')");
        const held = await intercepted;
        capture = null;
        if (transition === "overview") await page.click('#agents-content button[onclick="switchAgentSubTab(\'overview\')"]');
        else if (transition === "newer") await page.evaluate("loadAgentChatThread('worker')");
        else await page.click('#agents-content button[onclick="resetAgentChat(\'worker\')"]');
        await held.respond({ status: 200, contentType: "application/json", body: '{"sessionId":"obsolete-session"}' });
        await pending;
        expect(await page.evaluate("currentSessionId")).toBe(transition === "reset" ? null : "worker-old-session");
        if (transition === "overview") {
          expect(await page.$eval("#chat", el => el.classList.contains("hidden"))).toBe(true);
          await page.click('#agents-content button[onclick="switchAgentSubTab(\'chat\')"]');
          await page.waitForFunction("currentSessionId === 'worker-old-session'");
        }
      }
      expect(await page.$eval("#chat-messages", el => el.textContent)).toContain("Chat cleared.");
      const submitted = new Promise<void>(done => { onPublish = done; });
      await page.type("#chat-input", "Start fresh with worker");
      await page.click("#chat-send");
      await submitted;
      expect(published).toMatchObject([{ type: "chat.start.requested", data: { agent: "worker", forceNew: true } }]);
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser).each(["newer-session", "worker-old-session"])("a late agent transcript cannot replace the latest selection of %s", async (selectedSession) => {
    seedChat("worker");
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/worker`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("currentSessionId === 'worker-old-session' && ws?.readyState === WebSocket.OPEN");
      await page.evaluate(`(() => {
        window.sentSubscriptions = [];
        const send = ws.send.bind(ws);
        ws.send = frame => {
          const data = JSON.parse(frame);
          if (data.type === 'subscribe') window.sentSubscriptions.push(data.sessions);
          send(frame);
        };
      })()`);
      let capture: (request: HTTPRequest) => void;
      let heldFirstTranscript = false;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
      await page.setRequestInterception(true);
      page.on("request", request => {
        const path = new URL(request.url()).pathname;
        if (path === "/api/sessions/worker-old-session/transcript" && !heldFirstTranscript) {
          heldFirstTranscript = true;
          capture(request);
        } else if (path === `/api/sessions/${selectedSession}/transcript`) void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: [{ role: "user", text: "New selected transcript" }] }) });
        else void request.continue();
      });
      const pending = page.evaluate("switchSession('worker-old-session')");
      const held = await intercepted;
      if (selectedSession === "worker-old-session") await page.evaluate("loadAgentChatThread('worker')");
      else await page.evaluate("switchSession('newer-session')");
      await held.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: [{ role: "user", text: "Obsolete transcript" }] }) });
      await pending;
      expect(await page.evaluate("currentSessionId")).toBe(selectedSession);
      const text = await page.$eval("#chat-messages", el => el.textContent);
      expect(text).toContain("New selected transcript");
      expect(text).not.toContain("Obsolete transcript");
      expect(await page.evaluate("window.sentSubscriptions.at(-1)")).toEqual([selectedSession]);
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser)("input during agent header loading addresses that agent and preserves its heading", async () => {
    seedChat("worker");
    seedChat("selected");
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/sessions/selected-old-session`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
      await page.evaluate(`(() => {
        const init = initAgentChat;
        initAgentChat = name => window.pendingAgentInit = init(name);
      })()`);
      let capture: (request: HTTPRequest) => void;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (new URL(request.url()).pathname === "/api/agents") capture(request);
        else void request.continue();
      });
      await page.evaluate("routeTo('/agents/worker')");
      const held = await intercepted;
      await page.evaluate("document.getElementById('chat-input').value = 'Message the selected agent'; sendChat()");
      expect(published).toMatchObject([{ type: "session.steer.requested", target: { sessionId: "worker-old-session" } }]);
      await held.continue();
      await page.evaluate("window.pendingAgentInit");
      expect(await page.$eval("#agents-content h2", el => el.textContent)).toBe("worker");
      expect(await page.evaluate("currentSessionId")).toBe("worker-old-session");
    } finally { await browser.close(); }
  }, 30000);

  test.skipIf(skipBrowser).each([false, true])(
    "late direct-chat admission with existing session=%s cannot rebind a routed session",
    async (existing) => {
      if (existing) seedChat("worker");
      seedChat("selected");
      const browser = await puppeteer.launch({
        executablePath: chrome!,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await page.goto(`${base}/sessions/selected-old-session`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
        // Hold both initial default resolution and the admitted request lookup.
        await page.evaluate(`(() => {
        const load = loadAgentChatThread;
        loadAgentChatThread = name => window.pendingAgentChat = load(name);
      })()`);
        let capture: (request: HTTPRequest) => void;
        let captureDefault: (request: HTTPRequest) => void;
        let captureDiscovery: (request: HTTPRequest) => void;
        const intercepted = new Promise<HTTPRequest>((resolveRequest) => {
          capture = resolveRequest;
        });
        const defaultRead = new Promise<HTTPRequest>((resolveRequest) => {
          captureDefault = resolveRequest;
        });
        const discoveryRead = new Promise<HTTPRequest>((resolveRequest) => {
          captureDiscovery = resolveRequest;
        });
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (new URL(request.url()).pathname === "/api/agents/worker/message") capture(request);
          else if (new URL(request.url()).pathname === "/api/agents/worker/default-session") {
            if (new URL(request.url()).searchParams.has("requestId")) captureDiscovery(request);
            else captureDefault(request);
          } else void request.continue();
        });
        await page.evaluate("routeTo('/agents/worker')");
        const defaultHeld = await defaultRead;
        const pending = page.evaluate("document.getElementById('chat-input').value = 'Message worker'; sendChat()");
        const held = await intercepted;
        if (existing) await page.evaluate("routeTo('/sessions/selected-old-session')");
        await held.continue();
        await pending;
        if (!existing) {
          const discoveryHeld = await discoveryRead;
          await page.evaluate("routeTo('/sessions/selected-old-session')");
          await discoveryHeld.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ sessionId: "obsolete-session", requestId: published[0].data.requestId }),
          });
        }
        await page.waitForFunction(
          () => document.querySelector("#session-detail-panel h3")?.textContent === "selected-old-session",
        );
        await defaultHeld.continue();
        await page.evaluate("window.pendingAgentChat");
        expect(await page.evaluate("currentSessionId")).toBe("selected-old-session");
        expect(await page.evaluate("currentAgentChat")).toBeNull();
        expect(published).toMatchObject([
          existing
            ? { type: "session.steer.requested", target: { sessionId: "worker-old-session" } }
            : { type: "chat.start.requested", data: { agent: "worker" } },
        ]);
        const submitted = new Promise<void>((done) => {
          onPublish = done;
        });
        await page.type("#chat-input", "Follow up on selected session");
        await page.click("#chat-send");
        await submitted;
        expect(published).toHaveLength(2);
        expect(published[1]).toMatchObject({
          type: "session.steer.requested",
          target: { sessionId: "selected-old-session" },
        });
      } finally {
        await browser.close();
      }
    },
    30000,
  );

  test.skipIf(skipBrowser)("unbound interface chat rejects HTTP and browser input without steering an old session", async () => {
    seedChat();
    child.kill("SIGKILL");
    await stopped;
    await startWeb("", "");
    for (const suffix of ["", "?new=true"]) {
      const response = await fetch(base + "/api/agents/helper/message" + suffix, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Keep this request" }),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "No Conversation App is configured" });
    }
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/agents/helper`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("currentAgentChat === 'helper' && ws?.readyState === WebSocket.OPEN");
      await page.type("#chat-input", "Keep this request");
      await page.click("#chat-send");
      await page.waitForFunction(() => document.body.textContent!.includes("No Conversation App is configured"));
      expect(await page.$eval("#chat-input", el => (el as HTMLInputElement).value)).toBe("Keep this request");
      expect(published).toEqual([]);
    } finally { await browser.close(); }
  });

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
    control.close();
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

  test("HTTP forwards bounded human reads to the real control socket, without changing SDK reads", async () => {
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
    expect(await read(`/api/task?${new URLSearchParams({ appId: "alpha", taskId: "work/a ?&", acceptedEvidence: "true", evidenceLimit: "1" })}`)).toEqual(
      service.getTask({ appId: "alpha", taskId: "work/a ?&", acceptedEvidence: { limit: 1 } }),
    );
    await read("/api/task?appId=alpha&taskId=work%2Fa&evidenceLimit=1", 400);
    expect((await read("/api/tasks?appId=alpha&status=waiting")).items).toEqual([]);
    expect(await read("/api/tasks?allApps=true&status=running&status=waiting&limit=8"))
      .toEqual(service.listTasks({ status: ["running", "waiting"], limit: 8 }));
    expect(await read("/api/apps/alpha/tasks")).toEqual({ items: [{ id: "sdk-task", status: "done" }] });
    expect(await read("/api/apps/alpha/tasks/sdk-task")).toEqual({ id: "sdk-task", status: "done" });
    expect(await read("/api/apps/alpha/tasks/sdk-task?inputKey=request%3Aearlier&inputKey=request%3Asecond")).toEqual({
      id: "sdk-task", status: "done", inputEvents: [{ key: "request:earlier" }, { key: "request:second" }],
    });
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
    expect(await read("/api/conversation?appId=support&conversationId=retained-room")).toEqual(conversation);
    await read("/api/conversation?appId=support", 400);
    await read("/api/conversation?conversationId=retained-room", 400);
    rejectConversationRead = true;
    expect(await read("/api/conversation?appId=support&conversationId=retained-room", 503)).toMatchObject({ error: "fixture Conversation storage unavailable" });
    rejectConversationRead = false;
    expect(await read("/api/conversation?appId=support&conversationId=retained-room")).toEqual(conversation);
    expect(published).toHaveLength(0);
    control.close();
    await read("/api/conversation?appId=support&conversationId=retained-room", 503);
  });

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
          if (frame.type !== "status" || !frame.diagnostics) return;
          clearTimeout(timer);
          socket.removeEventListener("message", onMessage);
          resolve();
        };
        socket.addEventListener("message", onMessage);
        socket.send(JSON.stringify({ type: "status", diagnostics: true }));
      }));
      await page.evaluate("window.fixtureDiagnostics = []; busSubscribe('handler.failed', event => window.fixtureDiagnostics.push(event))");
      for (const listener of listeners) {
        listener({ type: "status", activeAgents: [{ agent: "worker", sessionId: "other-session", status: "running" }] });
        listener({ type: "text", data: { sessionId: "other-session" }, text: "Other session text" });
        listener({ type: "handler.failed", data: { appId: "other-app", taskId: "work", stage: "execute", error: "Diagnostic survives May chat", disposition: "not-retrying" } });
      }
      await page.waitForFunction("window.fixtureDiagnostics.some(event => event.data.error === 'Diagnostic survives May chat')");
      expect(await page.evaluate("activeSessions.some(s => s.sessionId === 'other-session')")).toBe(true);
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
});
