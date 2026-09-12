/**
 * E8 — Project comment and shipped chat rendering (browser)
 *
 * Validates the full project-comment flow end-to-end:
 *   1. The served platform UI loads at /#/projects.
 *   2. The toggle reveals inactive projects (sandbox platform is "waiting").
 *   3. The platform row's route target uses the canonical id form
 *      (`routeTo('/projects/' + 'platform')`) — not a full path.
 *   4. Clicking the row navigates to `/projects/platform` and resolves
 *      `_projectDetailPath` to `projects/platform`.
 *   5. Historical Markdown stays readable; comments without a loaded App are
 *      rejected visibly and the user's text is preserved.
 *   6. An ordinary App's declared subscription accepts a comment through HTTP
 *      and runs a Task. Repeating the same submission reuses its receipt.
 *   7. The shipped chat renderer handles Markdown/raw streaming, knowledge
 *      links and escaped fallback without another browser/daemon startup.
 *
 * Gated to skip when:
 *   - `E2E_NO_UI=1` is set (opt-out for fast local runs), OR
 *   - Chrome/Chromium executable is not available, OR
 *   - puppeteer-core is not importable.
 * Otherwise runs by default, consistent with the rest of the e2e suite.
 *
 * What this doesn't cover (intentionally):
 *   - Daemon-internal comment plumbing (covered by E2 without a browser).
 *   - Non-platform project UI flows (out of scope of this single page).
 *   - Long-running workflow-iteration completion (E2/E3 cover the worker side).
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { openSandboxDb, pollUntil, queryEvents } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

const E2E_NO_UI = process.env.E2E_NO_UI === "1";

// Probe for puppeteer-core and chrome at file scope (cheap; no launch yet).
async function probePuppeteer(): Promise<{ ok: true; mod: typeof import("puppeteer-core"); chromePath: string } | { ok: false; reason: string }> {
  // Chrome (or chromium) executable
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  const chromePath = candidates.find((p) => existsSync(p));
  if (!chromePath) {
    return {
      ok: false,
      reason: "no chrome/chromium executable found (set CHROME_PATH or install /usr/bin/google-chrome)",
    };
  }
  // The browser driver is a declared repository dependency, not a host fallback.
  try {
    const mod = await import("puppeteer-core");
    return { ok: true, mod, chromePath };
  } catch {
    return { ok: false, reason: "puppeteer-core not importable; run bun install --frozen-lockfile" };
  }
}

function statusOf(content: string): string | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const s = m[1].match(/^status:\s*(.+)$/m);
  return s ? s[1].trim() : null;
}

const probe = await probePuppeteer();
if (process.env.CI && (E2E_NO_UI || !probe.ok)) {
  throw new Error(`Browser coverage is required in CI: ${E2E_NO_UI ? "E2E_NO_UI=1" : !probe.ok ? probe.reason : ""}`);
}
if (!probe.ok) console.warn(`[E8] skipped: ${probe.reason}`);

describe.skipIf(E2E_NO_UI || !probe.ok)("E8: project comment via served UI", () => {
  let sb: Sandbox;

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureProjects: ["comment.app"],
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      cronJson: { may: [] },
      includePlatformUi: true,
      daemonArgs: ["--cron", "--socket", "--web"],
    });
    await sb.daemonReady;
    if (!sb.waitForWeb) throw new Error("sandbox web port not allocated");
    await sb.waitForWeb(15000);
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test("served UI submits a comment and renders chat Markdown/raw streaming safely", async () => {
    if (!probe.ok) throw new Error(probe.reason);
    const { mod: puppeteer, chromePath } = probe;
    const base = `http://127.0.0.1:${sb.webPort}`;
    const PROJECT_FILE = join(sb.projectsRoot, "platform", "project.md");
    const DISC_FILE = join(sb.projectsRoot, "platform", "discussion.md");

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      page.on("pageerror", (e) => console.log(`[E8 pageerror] ${e.message}`));

      // 1. Load /#/projects
      page.on("console", (msg) => {
        if (msg.type() === "error") console.log(`[E8 console.error] ${msg.text()}`);
      });
      page.on("requestfailed", (req) => {
        console.log(`[E8 reqfail] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
      });
      page.on("response", (res) => {
        if (res.status() >= 400) console.log(`[E8 http ${res.status()}] ${res.url()}`);
      });
      // Page-specific assertions below prove readiness; background requests
      // need not stop before a human can use the page.
      await page.goto(`${base}/#/projects`, { waitUntil: "domcontentloaded", timeout: 10_000 });

      // 2. Reveal inactive projects (platform default status = waiting).
      await page.waitForSelector("#show-hidden-toggle", { timeout: 5000 });
      await page.evaluate(() => {
        const cb = document.getElementById("show-hidden-toggle") as HTMLInputElement | null;
        if (cb && !cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change"));
        }
      });
      await page.waitForFunction(
        () => {
          const rows = document.querySelectorAll('tr[onclick*="routeTo"]');
          return Array.from(rows).some((r) => (r.textContent ?? "").includes("platform"));
        },
        { timeout: 5000 },
      );

      // 3. Route helpers + canonical-id form
      const helpersPresent = await page.evaluate(
        () => {
          // `let` declarations in <script> tags create top-level bindings
          // that are NOT properties of globalThis, so feature-detect via
          // identifier lookup.
          try { return typeof projectIdOf === "function" && typeof projectPathOf === "function"; }
          catch { return false; }
        },
      );
      expect(helpersPresent).toBe(true);

      const platformRouteAttr = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr[onclick*="routeTo"]'));
        const row = rows.find((r) => (r.textContent ?? "").includes("platform"));
        return row ? row.getAttribute("onclick") : null;
      });
      expect(platformRouteAttr).not.toBeNull();
      expect(
        /routeTo\(\s*['"]\/projects\/['"]\s*\+\s*['"]platform['"]\s*\)/.test(platformRouteAttr ?? ""),
      ).toBe(true);

      // 4. Click row -> canonical route + resolved path
      await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr[onclick*="routeTo"]'));
        const row = rows.find((r) => (r.textContent ?? "").includes("platform")) as HTMLElement | undefined;
        row?.click();
      });
      await page.waitForFunction(
        () => location.pathname === "/projects/platform" && location.hash === "",
        { timeout: 5000 },
      );
      await page.waitForFunction(
        () => {
          const el = document.getElementById("projects-content");
          return el && /platform/i.test(el.textContent ?? "") && !/Loading project/.test(el.textContent ?? "");
        },
        { timeout: 8000 },
      );
      const resolvedPath = await page.evaluate(() => {
        try { return _projectDetailPath; } catch { return undefined; }
      });
      expect(resolvedPath).toBe("projects/platform");

      // 5. A legacy project is history, not an alternative work dispatcher.
      const projectBefore = readFileSync(PROJECT_FILE, "utf-8");
      const discussionBefore = readFileSync(DISC_FILE, "utf-8");
      expect(statusOf(projectBefore)).toBe("waiting");

      const stamp = "e8-" + new Date().toISOString();
      const commentText = "ui e2e: " + stamp;
      await page.waitForSelector("#project-comment", { timeout: 5000 });
      expect(await page.$eval("#project-comment", (el) => el.getAttribute("placeholder")))
        .not.toContain("auto-resumes");
      await page.type("#project-comment", commentText);
      const rejectedResponse = page.waitForResponse((res) => res.url().endsWith("/api/projects/comment"));
      await page.click('button[onclick="addProjectComment()"]');
      const rejected = await rejectedResponse;
      expect(rejected.status()).toBe(503);
      expect(await rejected.json()).toMatchObject({ ok: false, triggered: false });
      await page.waitForFunction(() => /Failed:.*is not loaded/.test(
        document.getElementById("project-comment-status")?.textContent ?? ""), { timeout: 5000 });
      expect(await page.$eval("#project-comment", (el) => (el as HTMLInputElement).value)).toBe(commentText);
      expect(readFileSync(PROJECT_FILE, "utf-8")).toBe(projectBefore);
      expect(readFileSync(DISC_FILE, "utf-8")).toBe(discussionBefore);

      // 6. This App uses a declared comment subscription (like the maintenance
      // App), not generic message input. Keep that supported App policy path.
      await page.goto(`${base}/projects/comment.app`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => {
        try { return _projectDetailPath === "projects/comment.app" && !!document.getElementById("project-comment"); }
        catch { return false; }
      }, { timeout: 8000 });
      await page.type("#project-comment", commentText);
      const acceptedResponse = page.waitForResponse((res) => res.url().endsWith("/api/projects/comment"));
      await page.click('button[onclick="addProjectComment()"]');
      const accepted = await acceptedResponse;
      expect(accepted.status()).toBe(202);
      const receipt = await accepted.json();
      expect(receipt).toMatchObject({ ok: true, projectId: "comment", eventType: "project.comment.created" });

      // Success banner shows
      await page.waitForFunction(
        () => {
          const el = document.getElementById("project-comment-status");
          return (
            el &&
            (el as HTMLElement).style.display !== "none" &&
            /Comment recorded/.test(el.textContent ?? "") && /event \d+/.test(el.textContent ?? "")
          );
        },
        { timeout: 10_000 },
      );

      const replay = await fetch(`${base}/api/projects/comment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: accepted.request().postData(),
      });
      expect(replay.status).toBe(202);
      expect((await replay.json()).eventId).toBe(receipt.eventId);
      const db = openSandboxDb(sb.dbPath);
      try {
        const store = AppTaskResourceStore.activeFromDb(db, "comment")!;
        await pollUntil(() => store.readTask("work/comment")?.status.phase === "converged", {
          timeoutMs: 15_000, intervalMs: 100, description: "browser comment Task result",
        });
        expect(store.readTask("work/comment")).toMatchObject({
          metadata: { generation: 1 }, spec: { outcome: commentText },
        });
        const comments = queryEvents(db, { types: ["project.comment.created"] });
        expect(comments).toHaveLength(1);
        expect(comments[0].id).toBe(receipt.eventId);
        expect(JSON.parse(comments[0].data!)).toMatchObject({ comment: commentText, project: "comment" });
        expect(queryEvents(db, { types: ["project.nudge"] })).toEqual([]);
        expect(queryEvents(db, { types: ["e2e.workflow_ran"] })).toHaveLength(1);
      } finally { db.close(); }

      // Shipped chat.js, in the same real browser: no copied renderer or DOM.
      // The page is interactive before its async Markdown dependency arrives.
      // Wait for that exact prerequisite, not all background network traffic.
      await page.waitForFunction(
        () => typeof (window as typeof window & { marked?: { parse?: unknown } }).marked?.parse === "function",
        { timeout: 10_000 },
      );
      const rendered = await page.evaluate(() => {
        const ui = window as typeof window & {
          renderAssistantMsg: (el: HTMLElement, text: string) => void;
          toggleMarkdown: () => void;
          marked?: { parse: (text: string) => string };
        };
        if (!ui.marked?.parse) throw new Error("Shipped markdown renderer did not load");
        const el = document.createElement("div");
        el.className = "msg assistant";
        document.body.append(el);
        try {
          ui.renderAssistantMsg(el, "**Hello** KE-123");
          const initial = {
            bold: el.querySelector("strong")?.textContent, raw: el.dataset.raw,
            link: el.querySelector("a")?.getAttribute("href"),
          };
          ui.toggleMarkdown();
          ui.renderAssistantMsg(el, "**Hello** KE-123 continued");
          const raw = {
            text: el.textContent, bold: !!el.querySelector("strong"),
            label: document.getElementById("md-toggle")?.textContent,
          };
          ui.toggleMarkdown();
          const restored = {
            bold: el.querySelector("strong")?.textContent, text: el.textContent?.trim(),
            label: document.getElementById("md-toggle")?.textContent,
          };
          const marked = ui.marked;
          try {
            ui.marked = undefined;
            ui.renderAssistantMsg(el, "<b>unparsed</b>");
            return { initial, raw, restored, fallback: { text: el.textContent, html: el.innerHTML } };
          } finally {
            ui.marked = marked;
          }
        } finally {
          el.remove();
        }
      });
      expect(rendered).toEqual({
        initial: { bold: "Hello", raw: "**Hello** KE-123", link: "#/knowledge/entries/KE-123.md" },
        raw: { text: "**Hello** KE-123 continued", bold: false, label: "Markdown" },
        restored: { bold: "Hello", text: "Hello KE-123 continued", label: "Raw" },
        fallback: { text: "<b>unparsed</b>", html: "&lt;b&gt;unparsed&lt;/b&gt;" },
      });
    } finally {
      await browser.close();
    }
  }, 60_000);
});
