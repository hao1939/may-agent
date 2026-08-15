import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./owner-review";
import { canonicalGymTestContext } from "./lib/test-context";

function task(): string {
  return [
    "app: /tmp/gym.app",
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify({
      taskId: "runtime/regression-run/event-42",
      generation: 2,
      outcome: "Preserve a regression result",
      fallbackReason: "runner unavailable",
    }),
    "```",
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify({
      type: "gym.regression.requested",
      data: { benchmark: "may-alignment" },
    }),
    "```",
  ].join("\n");
}

test("owner fallback persists one idempotent human-review proposal", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-owner-review-"));
  const projectsRoot = join(root, "projects");
  const emitted: Array<Record<string, unknown>> = [];
  let agentRuns = 0;
  const ctx = canonicalGymTestContext({
    task: task(),
    projectsRoot,
    async runAgent() {
      agentRuns++;
      return {
        status: "done",
        sessionId: "s_owner_review",
        structuredResult: {
          proposal:
            "## Classification\nHarness/runtime failure. The runner was unavailable after a bounded request.\n\n## Evidence\nThe fallback reason names the unavailable runner and the trigger identifies may-alignment.\n\n## Next action\nHave a human verify runner health before retrying. No benchmark truth or labels should change.",
        },
      };
    },
    emit(event: Record<string, unknown>) {
      emitted.push(event);
    },
  });

  try {
    const first = await execute(ctx);
    const reviewPath = join(
      projectsRoot,
      "gym.app",
      ".state",
      "reviews",
      "workflow-exception-runtime-regression-run-event-42-2.md",
    );
    expect(first).toMatchObject({
      status: "done",
      output: { state: "converged", evidence: [reviewPath] },
    });
    expect(existsSync(reviewPath)).toBe(true);
    expect(readFileSync(reviewPath, "utf8")).toContain(
      "Harness/runtime failure",
    );
    expect(emitted[0]).toMatchObject({
      type: "gym.review.ready",
      data: { kind: "workflow-exception", reviewPath },
    });

    await execute(ctx);
    expect(agentRuns).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
