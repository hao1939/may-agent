/**
 * E3a — Project iteration loop (lite, no LLM)
 *
 * Drives a fixture iteration workflow against a fixture project. Validates:
 *   - handler scans projects, identifies active ones, dispatches iteration
 *   - iteration workflow runs, mutates project.md, completes
 *   - SDK project-schema round-trips multi-line `stop_reason` value across
 *     read → write cycles (Bug E regression at live-stack layer)
 *   - iteration counter advances each tick (no double-dispatch within a tick)
 *
 * NOT covered (defer to E3a-full LLM variant):
 *   - real platform-iteration workflow with reviewer/worker session calls
 *   - Bug F (setStatusFooter narrative preservation) — covered by
 *     projects/platform/workflows/project-iteration.test.ts unit tests
 *
 * Validates documented behavior of:
 *   - workflow-authoring.md § Workflow Location, Project Workflow
 *   - projects.md § Iteration Loop
 *   - SDK project-schema (multi-line scalar quoting)
 *
 * Gated behind E2E_LIVE=1; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  E2E_LIVE,
  openSandboxDb,
  pollUntil,
  queryEvents,
  queryWorkflowRuns,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe.skipIf(!E2E_LIVE)("E3a: project iteration loop (lite)", () => {
  let sb: Sandbox;
  const projectId = "e2e-iteration-sandbox";
  const t0 = Date.now();
  const originalStopReason = "line one\nline two with: colon\nline three with ```code block```";

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureHandlers: { may: ["e2e-project-iteration"] },
      fixtureWorkflows: { may: ["e2e-iteration-stub"] },
      fixtureProjects: [projectId],
      cronJson: {
        may: [
          {
            name: "e2e-project-iter",
            handler: "e2e-project-iteration",
            intervalMs: 10000,
            agent: "may",
            enabled: true,
          },
        ],
      },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "iteration workflow runs, advances counter, preserves multi-line frontmatter",
    async () => {
      const projectFile = join(sb.projectsRoot, projectId, "project.md");
      const db = openSandboxDb(sb.dbPath);
      try {
        // Wait for ≥2 iteration completions (so we observe iteration counter
        // advancing across writes, not just one write).
        const result = await pollUntil(
          () => {
            const completes = queryEvents(db, {
              types: ["e2e.iteration.complete"],
              since: t0,
              limit: 10,
            }).filter((e) => (e.data ?? "").includes(projectId));
            return completes.length >= 2 ? completes : null;
          },
          { timeoutMs: 35_000, intervalMs: 500, description: "≥2 iteration completions" },
        );

        // No iteration errors.
        const errors = queryEvents(db, { types: ["e2e.iteration.error"], since: t0, limit: 5 });
        expect(errors.length).toBe(0);

        // Each completion should report a higher iteration number than the
        // previous (sorted desc, so descending order from latest).
        const iters = result.map((e) => {
          const d = JSON.parse(e.data ?? "{}");
          return (d.data?.iteration ?? d.iteration) as number;
        });
        // Sorted DESC by timestamp; first element is latest = highest.
        expect(iters[0]).toBeGreaterThan(iters[1]);
        expect(iters[0]).toBeGreaterThanOrEqual(2);

        // ── Bug E regression: stop_reason multi-line value preserved ────
        const finalContent = readFileSync(projectFile, "utf-8");
        const fm = finalContent.match(/^---\n([\s\S]*?)\n---/);
        expect(fm).not.toBeNull();
        // The frontmatter must still contain all 3 lines from original.
        expect(finalContent).toContain("line one");
        expect(finalContent).toContain("line two with: colon");
        expect(finalContent).toContain("line three with ```code block```");

        // Workflow runs persisted.
        const runs = queryWorkflowRuns(db, {
          workflow: "e2e-iteration-stub",
          since: t0,
        });
        expect(runs.length).toBeGreaterThanOrEqual(2);
        for (const r of runs) {
          expect(r.status).toBe("done");
        }

        // ── Round-trip exactness: extract current stop_reason and compare ─
        // The SDK's parseProjectMeta should decode the value to exactly the
        // original 3-line string. We import the parser from the SDK directly
        // since the test process has access to the package.
        const { parseProjectMeta } = await import("../../packages/sdk/src/project-schema.js");
        const meta = parseProjectMeta(finalContent);
        expect(meta.stop_reason).toBe(originalStopReason);
      } finally {
        db.close();
      }
    },
    60_000,
  );
});
