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
 * This test starts the real Bun web server with a synthetic PROJECTS_ROOT
 * containing a minimal platform/ui/ tree, then issues HTTP GETs to assert
 * that the F8 fix routes top-level static asset paths correctly. No browser
 * required — keeps the regression check fast and chromeless.
 *
 * See projects/platform/proposals/2026-05-19-e2e-harness-findings.md § F8.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startWebUI } from "../../src/app/http/server.js";

describe("F8 regression: top-level platform UI assets (chromeless)", () => {
  let tmpRoot: string;
  let server: { port: number; stop?: () => void } | null = null;
  // Save env vars we mutate so other tests aren't affected.
  let savedProjectsRoot: string | undefined;
  let savedProjectRoot: string | undefined;
  let savedStateDir: string | undefined;

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

    // State dir needs to exist for openStateDb; an empty dir is fine.
    const stateDir = join(tmpRoot, ".state");
    mkdirSync(stateDir, { recursive: true });

    // Snapshot + override env vars consumed at startWebUI() call time.
    savedProjectsRoot = process.env.PROJECTS_ROOT;
    savedProjectRoot = process.env.PROJECT_ROOT;
    savedStateDir = process.env.STATE_DIR;
    process.env.PROJECTS_ROOT = join(tmpRoot, "projects");
    process.env.PROJECT_ROOT = tmpRoot;
    process.env.STATE_DIR = stateDir;

    // port 0 — let Bun pick.
    const result = startWebUI({ stateDir, port: 0 });
    server = result as { port: number; stop?: () => void };
  });

  afterAll(() => {
    try {
      // Bun.serve returns a server with .stop(); cast loosely since the
      // type declaration in server.ts only includes { port }.
      const stoppable = server as unknown as { stop?: () => void } | null;
      stoppable?.stop?.();
    } catch {}
    // Restore env.
    if (savedProjectsRoot === undefined) delete process.env.PROJECTS_ROOT;
    else process.env.PROJECTS_ROOT = savedProjectsRoot;
    if (savedProjectRoot === undefined) delete process.env.PROJECT_ROOT;
    else process.env.PROJECT_ROOT = savedProjectRoot;
    if (savedStateDir === undefined) delete process.env.STATE_DIR;
    else process.env.STATE_DIR = savedStateDir;
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  function baseUrl(): string {
    if (!server) throw new Error("server not started");
    return `http://127.0.0.1:${server.port}`;
  }

  test("serves the platform index at /", async () => {
    const res = await fetch(`${baseUrl()}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(`<link rel="stylesheet" href="styles.css">`);
  });

  test("serves top-level /styles.css from platform/ui (F8)", async () => {
    const res = await fetch(`${baseUrl()}/styles.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
    expect(await res.text()).toContain("rebeccapurple");
  });

  test("serves top-level /app.js from platform/ui (F8)", async () => {
    const res = await fetch(`${baseUrl()}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("console.log");
  });

  test("serves nested /pages/projects.js from platform/ui (F8)", async () => {
    const res = await fetch(`${baseUrl()}/pages/projects.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("addProjectComment");
  });

  test("does NOT serve assets outside the platform/ui dir (containment)", async () => {
    // ../../outside.js encoded — must not escape platform/ui.
    const res = await fetch(`${baseUrl()}/..%2F..%2Foutside.js`);
    // 404 (asset not found at platform/ui/...) is the expected outcome;
    // 400/403 would also be acceptable. Anything 2xx is the bug.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("does NOT route /api/* through the asset fallback", async () => {
    // Asset fallback only matches static extensions, so an unknown /api path
    // must still 404 (its real handler) not be hijacked.
    const res = await fetch(`${baseUrl()}/api/does-not-exist`);
    // Real API router returns 404 too; the assertion is that we don't get a
    // 200 with file contents from platform/ui (which would prove fallthrough
    // bug). The body should not be a JS/CSS file.
    expect(res.status).toBe(404);
  });

  test("404s on a static-extension request when the file isn't present", async () => {
    const res = await fetch(`${baseUrl()}/missing.css`);
    expect(res.status).toBe(404);
  });
});
