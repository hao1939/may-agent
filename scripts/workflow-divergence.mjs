#!/usr/bin/env bun
/**
 * Workflow-fork divergence report.
 *
 * Prints, for each `projects/<id>/workflows/<id>-iteration.ts` fork, a summary
 * of how it differs from the canonical `projects/platform/workflows/platform-iteration.ts`.
 *
 * Per the "copy not share" principle, forks ARE expected to diverge over time.
 * This tool exists so that:
 *
 *   (a) when a fix lands in platform-iteration that other forks should pick
 *       up (e.g. Bug F: 2026-05-18), maintainers can see at a glance which
 *       forks still carry the old behavior.
 *
 *   (b) when an unrelated agent edits a fork directly, divergence is visible
 *       rather than silent.
 *
 * Output is informational only — non-zero exit only on file-read errors.
 *
 * Usage:
 *   bun scripts/workflow-divergence.mjs           # human summary
 *   bun scripts/workflow-divergence.mjs --json    # machine-readable
 *   bun scripts/workflow-divergence.mjs --diff    # full unified diffs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const BASELINE = join(ROOT, "projects/platform/workflows/platform-iteration.ts");
const BASELINE_ID = "platform-iteration";

const args = new Set(process.argv.slice(2));
const wantJson = args.has("--json");
const wantDiff = args.has("--diff");

function listForks() {
  const projectsDir = join(ROOT, "projects");
  const out = [];
  for (const id of readdirSync(projectsDir).sort()) {
    const wfPath = join(projectsDir, id, "workflows", `${id}-iteration.ts`);
    try {
      statSync(wfPath);
      out.push({ id, path: wfPath });
    } catch {
      /* not a forked project */
    }
  }
  return out;
}

function lineStats(baseline, fork) {
  // Use diffstat-like output from `git diff --no-index --numstat`
  try {
    const raw = execSync(
      `git --no-pager diff --no-index --numstat -- ${baseline} ${fork} 2>/dev/null || true`,
      { encoding: "utf8" }
    ).trim();
    if (!raw) return { added: 0, removed: 0 };
    // "<added>\t<removed>\t<path>" — there may be a header line; we take last non-empty
    const last = raw.split("\n").filter((l) => /^\d/.test(l)).pop();
    if (!last) return { added: 0, removed: 0 };
    const [a, r] = last.split("\t");
    return { added: parseInt(a, 10) || 0, removed: parseInt(r, 10) || 0 };
  } catch {
    return { added: 0, removed: 0 };
  }
}

/**
 * Heuristic markers of known platform-iteration fixes/features. Each marker:
 * - `name`: human label
 * - `landed`: ISO date the marker landed in platform-iteration
 * - `probe`: substring that, when PRESENT in a fork, means it has the fix
 */
const MARKERS = [
  {
    name: "Bug F: setStatusFooter preserves Current State narrative",
    landed: "2026-05-18",
    probe: "function setStatusFooter(",
  },
];

function scanMarkers(forkContent) {
  return MARKERS.map((m) => ({
    name: m.name,
    landed: m.landed,
    present: forkContent.includes(m.probe),
  }));
}

function fullDiff(baseline, fork) {
  try {
    return execSync(
      `git --no-pager diff --no-index --no-color -- ${baseline} ${fork} 2>/dev/null || true`,
      { encoding: "utf8" }
    );
  } catch {
    return "";
  }
}

function main() {
  const baselineContent = readFileSync(BASELINE, "utf8");
  const baselineLines = baselineContent.split("\n").length;
  const baselineMarkers = scanMarkers(baselineContent);

  const forks = listForks().filter((f) => f.id !== "platform");
  const report = forks.map((f) => {
    const content = readFileSync(f.path, "utf8");
    return {
      id: f.id,
      lines: content.split("\n").length,
      ...lineStats(BASELINE, f.path),
      markers: scanMarkers(content),
    };
  });

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          baseline: { id: BASELINE_ID, lines: baselineLines, markers: baselineMarkers },
          forks: report,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Baseline: ${BASELINE_ID} (${baselineLines} lines)`);
  console.log(`Forks:    ${report.length}`);
  console.log();

  const w = Math.max(...report.map((r) => r.id.length), 4);
  console.log(
    `${"fork".padEnd(w)}  ${"lines".padStart(5)}  ${"+adds".padStart(6)}  ${"-dels".padStart(6)}  missing-fixes`
  );
  console.log("-".repeat(w + 38 + 25));

  for (const r of report) {
    const missing = r.markers.filter((m) => !m.present).map((m) => m.name);
    console.log(
      `${r.id.padEnd(w)}  ${String(r.lines).padStart(5)}  ${String(r.added).padStart(6)}  ${String(r.removed).padStart(6)}  ${missing.length ? missing.join("; ") : "—"}`
    );
  }

  console.log();
  console.log("Notes:");
  console.log("- adds/dels are against platform-iteration.ts.");
  console.log("- 'missing-fixes' lists tracked platform changes a fork hasn't picked up.");
  console.log("- Divergence is expected per 'copy not share'. This report is informational.");

  if (wantDiff) {
    console.log();
    console.log("=".repeat(72));
    console.log("Full diffs");
    console.log("=".repeat(72));
    for (const r of report) {
      console.log();
      console.log(`--- ${r.id} ---`);
      console.log(fullDiff(BASELINE, join(ROOT, "projects", r.id, "workflows", `${r.id}-iteration.ts`)));
    }
  }
}

main();
