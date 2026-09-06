/**
 * E8 — Project comment via served UI (browser)
 *
 * Validates the full project-comment flow end-to-end:
 *   1. The served platform UI loads at /#/projects.
 *   2. The toggle reveals inactive projects (sandbox platform is "waiting").
 *   3. The platform row's route target uses the canonical id form
 *      (`routeTo('/projects/' + 'platform')`) — not a full path.
 *   4. Clicking the row navigates to `/projects/platform` and resolves
 *      `_projectDetailPath` to `projects/platform`.
 *   5. Typing a comment + clicking the submit button POSTs to
 *      `/api/projects/comment`, the success banner appears.
 *   6. discussion.md is appended; project.md status flips from "waiting"
 *      to "active".
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
    return { ok: false, reason: "no chrome/chromium executable found (set CHROME_PATH or install /usr/bin/google-chrome)" };
  }
  // The browser driver is a declared repository dependency, not a host fallback.
  const tryPaths = [
    "puppeteer-core",
  ];
  for (const p of tryPaths) {
    try {
      const mod = (await import(p)) as typeof import("puppeteer-core");
      return { ok: true, mod, chromePath };
    } catch {
      /* keep trying */
    }
  }
  return { ok: false, reason: "puppeteer-core not importable; run bun install --frozen-lockfile" };
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

  test("UI loads, route helpers exist, comment submits, file state updates", async () => {
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
      await page.goto(`${base}/#/projects`, { waitUntil: "networkidle0", timeout: 10_000 });

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

      // 5. Submit a comment
      const statusBefore = statusOf(readFileSync(PROJECT_FILE, "utf-8"));
      expect(statusBefore).toBe("waiting");

      const stamp = "e8-" + new Date().toISOString();
      const commentText = "ui e2e: " + stamp;
      await page.waitForSelector("#project-comment", { timeout: 5000 });
      await page.type("#project-comment", commentText);
      const submitFound = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const b = btns.find((x) => /addProjectComment/.test(x.getAttribute("onclick") ?? ""));
        if (b) {
          (b as HTMLButtonElement).click();
          return true;
        }
        return false;
      });
      expect(submitFound).toBe(true);

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

      // 6. File state — discussion appended; status flipped to active.
      const discAfter = readFileSync(DISC_FILE, "utf-8");
      expect(discAfter).toContain(commentText);

      // status flip is synchronous in the comment endpoint
      const projAfter = readFileSync(PROJECT_FILE, "utf-8");
      expect(statusOf(projAfter)).toBe("active");
    } finally {
      await browser.close();
    }
  }, 60_000);
});
