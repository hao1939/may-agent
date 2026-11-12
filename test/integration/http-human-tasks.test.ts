import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer, { type HTTPRequest } from "puppeteer-core";
import { attachControlSocket, type ControlSocket, type ControlEvent } from "../../packages/control/src/server.js";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { HumanTaskService, type HumanTaskStatus } from "../../src/app/human-task-service.js";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";

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
  let onPublish: (() => void) | undefined;
  let rejectPublish: boolean;
  let rejectConversationRead: boolean;
  let rejectAppRead: boolean;
  let listeners: Set<(event: ControlEvent) => void>;

  beforeEach(async () => {
    conversation = { messages: [], activeTurn: { id: "turn-one", revision: 7 } };
    published = [];
    onPublish = undefined;
    rejectPublish = false;
    rejectConversationRead = false;
    rejectAppRead = false;
    listeners = new Set();
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
      getSessionId: () => "fixture",
      getStatus: () => [],
      emitEvent: () => {},
      subscribeEvents: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      getAppConversation: (appId, conversationId, options) => {
        if (appId !== "support" || conversationId !== "retained-room" || options?.limit !== 30) throw new Error("Invalid conversation read");
        if (rejectConversationRead) throw new Error("fixture Conversation storage unavailable");
        return conversation;
      },
      publishEvent: (event) => {
        published.push(event);
        onPublish?.();
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

  test.skipIf(skipBrowser).each([false, true])("late direct-chat admission with existing session=%s cannot rebind a routed session", async (existing) => {
    if (existing) seedChat("worker");
    seedChat("selected");
    const browser = await puppeteer.launch({ executablePath: chrome!, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`${base}/sessions/selected-old-session`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction("ws?.readyState === WebSocket.OPEN");
      // Capture the actual retry callback; release it after the user has navigated.
      await page.evaluate(`(() => {
        const schedule = window.setTimeout;
        const load = loadAgentChatThread;
        loadAgentChatThread = name => window.pendingAgentChat = load(name);
        window.chatRetry = null;
        window.setTimeout = (callback, delay, ...args) => {
          if (delay === 800) { window.chatRetry = callback; return 0; }
          return schedule(callback, delay, ...args);
        };
      })()`);
      let capture: (request: HTTPRequest) => void;
      let captureDefault: (request: HTTPRequest) => void;
      const intercepted = new Promise<HTTPRequest>(resolveRequest => { capture = resolveRequest; });
      const defaultRead = new Promise<HTTPRequest>(resolveRequest => { captureDefault = resolveRequest; });
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (new URL(request.url()).pathname === "/api/agents/worker/message") capture(request);
        else if (new URL(request.url()).pathname === "/api/agents/worker/default-session") captureDefault(request);
        else void request.continue();
      });
      await page.evaluate("routeTo('/agents/worker')");
      const defaultHeld = await defaultRead;
      const pending = page.evaluate("document.getElementById('chat-input').value = 'Message worker'; sendChat()");
      const held = await intercepted;
      if (existing) await page.evaluate("routeTo('/sessions/selected-old-session')");
      await held.continue();
      await pending;
      if (!existing) {
        expect(await page.evaluate("typeof window.chatRetry")).toBe("function");
        await page.evaluate("routeTo('/sessions/selected-old-session')");
      }
      await page.waitForFunction(() => document.querySelector("#session-detail-panel h3")?.textContent === "selected-old-session");
      await defaultHeld.continue();
      await page.evaluate("window.pendingAgentChat");
      await page.evaluate("window.chatRetry?.()");
      expect(await page.evaluate("currentSessionId")).toBe("selected-old-session");
      expect(await page.evaluate("currentAgentChat")).toBeNull();
      expect(published).toMatchObject([existing
        ? { type: "session.steer.requested", target: { sessionId: "worker-old-session" } }
        : { type: "chat.start.requested", data: { agent: "worker" } }]);
      const submitted = new Promise<void>(done => { onPublish = done; });
      await page.type("#chat-input", "Follow up on selected session");
      await page.click("#chat-send");
      await submitted;
      expect(published).toHaveLength(2);
      expect(published[1]).toMatchObject({ type: "session.steer.requested", target: { sessionId: "selected-old-session" } });
    } finally { await browser.close(); }
  }, 30000);

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
