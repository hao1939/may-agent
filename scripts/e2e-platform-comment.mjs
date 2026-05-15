// Headless E2E for the platform project comment flow.
// Run inside the may-agent container: `node /tmp/e2e-platform-comment.mjs`
import puppeteer from "/app/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8080";
const PROJECT_FILE = "/app/projects/platform/project.md";
const DISC_FILE = "/app/projects/platform/discussion.md";

function statusOf(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const s = m[1].match(/^status:\s*(.+)$/m);
  return s ? s[1].trim() : null;
}

function tailDiscussion(content, n = 6) {
  return content.trimEnd().split("\n").slice(-n).join("\n");
}

function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? green("PASS") : red("FAIL")}  ${label}${detail ? "  \u2014 " + detail : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(red(`  [pageerror] ${e.message}`)));
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(BASE)) console.log(red(`  [reqfail] ${r.method()} ${r.url()} \u2014 ${r.failure()?.errorText}`));
  });

  // ── Step 1: Load /, click platform row ────────────────────────────────
  console.log(bold("\n[1] Load /, navigate to projects tab, click platform row"));
  await page.goto(BASE + "/#/projects", { waitUntil: "networkidle0", timeout: 10000 });

  // platform is `waiting` by default, hidden behind the "Show inactive" toggle.
  // Wait for the toggle, click it, then wait for platform row to appear.
  await page.waitForSelector("#show-hidden-toggle", { timeout: 5000 });
  await page.evaluate(() => {
    const cb = document.getElementById("show-hidden-toggle");
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change")); }
  });
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('tr[onclick*="routeTo"]');
    return [...rows].some((r) => r.textContent.includes("platform"));
  }, { timeout: 5000 });

  // Verify helpers exist (proves the new UI is loaded)
  const helpersPresent = await page.evaluate(() =>
    typeof projectIdOf === "function" && typeof projectPathOf === "function"
  );
  check("projectIdOf / projectPathOf helpers present in served UI", helpersPresent);

  // What URL would the platform row navigate to?
  const platformRouteHref = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr[onclick*="routeTo"]')];
    const row = rows.find((r) => r.textContent.includes("platform"));
    return row ? row.getAttribute("onclick") : null;
  });
  check(
    "platform row click target uses canonical id (not full path)",
    /routeTo\(\s*['"]\/projects\/['"]\s*\+\s*['"]platform['"]\s*\)/.test(platformRouteHref || ""),
    platformRouteHref || "(no row found)",
  );

  // Click it
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr[onclick*="routeTo"]')];
    const row = rows.find((r) => r.textContent.includes("platform"));
    row?.click();
  });

  await page.waitForFunction(() => location.hash.startsWith("#/projects/") && location.hash !== "#/projects", { timeout: 3000 });
  const hashAfterClick = await page.evaluate(() => location.hash);
  check("URL after platform click is canonical id form", hashAfterClick === "#/projects/platform", `hash = ${hashAfterClick}`);

  // ── Step 2: Confirm detail page loaded for the right project ─────────
  console.log(bold("\n[2] Detail page loads via projectPathOf('platform') -> 'projects/platform'"));
  await page.waitForFunction(
    () => {
      const el = document.getElementById("projects-content");
      return el && /platform/i.test(el.textContent) && !/Loading project/.test(el.textContent);
    },
    { timeout: 8000 },
  );
  const resolvedPath = await page.evaluate(() => _projectDetailPath);
  check("_projectDetailPath resolved to canonical server path", resolvedPath === "projects/platform", `got '${resolvedPath}'`);

  // ── Step 3: Submit a comment via the form ────────────────────────────
  console.log(bold("\n[3] Submit comment via the form input"));
  const statusBefore = statusOf(readFileSync(PROJECT_FILE, "utf-8"));
  const stamp = "e2e-headless-" + new Date().toISOString();
  const commentText = "browser test: " + stamp;

  // Wait for the comment input
  await page.waitForSelector("#project-comment", { timeout: 5000 });
  await page.type("#project-comment", commentText);
  // Find the submit button (calls addProjectComment)
  const submitFound = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /addProjectComment/.test(x.getAttribute("onclick") || ""));
    if (b) { b.click(); return true; }
    return false;
  });
  check("comment submit button found and clicked", submitFound);

  // Wait for the success message
  await page.waitForFunction(() => {
    const el = document.getElementById("project-comment-status");
    return el && el.style.display !== "none" && /Comment added/.test(el.textContent || "");
  }, { timeout: 5000 });
  const uiStatus = await page.evaluate(() => document.getElementById("project-comment-status")?.textContent);
  check("UI shows success status", /workflow started/i.test(uiStatus || "") || /trigger sent/i.test(uiStatus || ""), uiStatus);

  // ── Step 4: Confirm file state ───────────────────────────────────────
  console.log(bold("\n[4] Confirm filesystem state"));
  const discAfter = readFileSync(DISC_FILE, "utf-8");
  check("discussion.md contains the new comment", discAfter.includes(commentText), tailDiscussion(discAfter));

  const projAfter = readFileSync(PROJECT_FILE, "utf-8");
  const statusAfter = statusOf(projAfter);
  check("project.md status flipped synchronously to active", statusAfter === "active", `before=${statusBefore} after=${statusAfter}`);

  // ── Summary ─────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(bold(`\n${failed.length === 0 ? green("All " + results.length + " checks passed") : red(failed.length + " of " + results.length + " checks FAILED")}`));
  process.exit(failed.length === 0 ? 0 : 1);
} finally {
  await browser.close();
}
