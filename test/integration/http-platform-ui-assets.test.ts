/**
 * Regression test for F8: top-level platform UI assets must be served.
 *
 * Background: index.html lives at PROJECTS_ROOT/platform/ui/index.html and is
 * served at "/" by `serveIndex`. The HTML uses relative <script src="..."> and
 * <link href="..."> tags, so the browser fetches them at "/styles.css",
 * "/app.js", "/pages/projects.js" etc. Before the F8 fix, the server only
 * registered a /projects/platform/ui/* route — root-level GETs 404'd, and the
 * page was non-interactive.
 *
 * This test calls the real platform UI fetch helper with a synthetic
 * PROJECTS_ROOT containing a minimal platform/ui/ tree. No socket or browser is
 * required — keeps the regression check fast, stable, and chromeless.
 *
 * See projects/platform/proposals/2026-05-19-e2e-harness-findings.md § F8.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { servePlatformUiRequest } from "../../src/app/http/server.js";

describe("F8 regression: top-level platform UI assets (chromeless)", () => {
  let tmpRoot: string;

  beforeAll(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "may-f8-"));
    const platformUi = join(tmpRoot, "projects", "platform", "ui");
    mkdirSync(join(platformUi, "pages"), { recursive: true });

    // Minimal asset set covering all extensions the F8 patch allows.
    writeFileSync(
      join(platformUi, "index.html"),
      `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head>
<body><script src="app.js"></script><script src="pages/projects.js"></script></body></html>`,
    );
    writeFileSync(join(platformUi, "styles.css"), "body { color: rebeccapurple; }");
    writeFileSync(join(platformUi, "app.js"), "console.log('app');");
    writeFileSync(join(platformUi, "pages", "projects.js"), "function addProjectComment(){}");
    // Also a "would-be path traversal" target to verify containment.
    writeFileSync(join(tmpRoot, "outside.js"), "// must not be served");

  });

  afterAll(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  function get(path: string): Response {
    return servePlatformUiRequest(new Request(`http://localhost${path}`), join(tmpRoot, "projects"))
      ?? new Response("Not found", { status: 404 });
  }

  test("serves the platform index at /", async () => {
    const res = get("/");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(`<link rel="stylesheet" href="styles.css">`);
  });

  test("serves the platform index for real app routes", async () => {
    for (const path of ["/events", "/events/123", "/agents/may", "/projects", "/projects/alpha-project.app", "/projects/alpha-project.app/tasks", "/projects/alpha-project.app/functions"]) {
      const res = get(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(`<script src="app.js"></script>`);
    }
  });

  test("does NOT hijack project-owned domain UI routes", async () => {
    expect(get("/projects/alpha-project.app/ui/").status).toBe(404);
    expect(get("/projects/alpha-project.app/kanban/").status).toBe(404);
    expect(get("/projects/alpha-project.app/ui/index.html").status).toBe(404);
  });

  test("serves top-level /styles.css from platform/ui (F8)", async () => {
    const res = get("/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
    expect(await res.text()).toContain("rebeccapurple");
  });

  test("serves top-level /app.js from platform/ui (F8)", async () => {
    const res = get("/app.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("console.log");
  });

  test("serves nested /pages/projects.js from platform/ui (F8)", async () => {
    const res = get("/pages/projects.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("addProjectComment");
  });

  test("does NOT serve assets outside the platform/ui dir (containment)", async () => {
    // ../../outside.js encoded — must not escape platform/ui.
    const res = get("/..%2F..%2Foutside.js");
    // 404 (asset not found at platform/ui/...) is the expected outcome;
    // 400/403 would also be acceptable. Anything 2xx is the bug.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("does NOT route /api/* through the asset fallback", async () => {
    // Asset fallback only matches static extensions, so an unknown /api path
    // must still 404 (its real handler) not be hijacked.
    const res = get("/api/does-not-exist");
    // Real API router returns 404 too; the assertion is that we don't get a
    // 200 with file contents from platform/ui (which would prove fallthrough
    // bug). The body should not be a JS/CSS file.
    expect(res.status).toBe(404);
  });

  test("404s on a static-extension request when the file isn't present", async () => {
    const res = get("/missing.css");
    expect(res.status).toBe(404);
  });
});
