import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./evaluation-intake.ts";
import { canonicalGymTestContext } from "./lib/test-context";

function task(data: Record<string, unknown>): string {
  return [
    "## Reconciliation Task",
    "```json",
    JSON.stringify({
      taskId: "runtime/evaluation-intake",
      generation: 1,
      input: { contractRevision: 1 },
    }),
    "```",
    "## Trigger Event",
    "```json",
    JSON.stringify({ type: "evaluation.reviewed", data }),
    "```",
  ].join("\n");
}

describe("evaluation-intake", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("processes each canonical reviewed-evaluation trigger idempotently", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-evaluation-intake-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const appDir = join(projectsRoot, "gym.app");
    const emitted: Record<string, unknown>[] = [];
    const positive = canonicalGymTestContext({
      projectsRoot,
      task: task({
        agent: "may",
        reviewedVerdict: "pass",
        sessionId: "session-good",
      }),
      emit: (event) => emitted.push(event),
    });
    const negative = canonicalGymTestContext({
      projectsRoot,
      task: task({
        agent: "may",
        reviewedVerdict: "needs_improvement",
        sessionId: "session-bad",
      }),
      emit: (event) => emitted.push(event),
    });

    expect((await execute(positive)).status).toBe("done");
    expect((await execute(positive)).status).toBe("done");
    expect((await execute(negative)).status).toBe("done");

    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "session-good.json"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "session-bad.json"),
      ),
    ).toBe(true);
    expect(existsSync(join(appDir, ".state", "incidents", "session-bad.json"))).toBe(true);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.review.requested",
        data: expect.objectContaining({
          requestKey: "incident-session-bad",
        }),
      }),
    ]);
  });

  it("uses only the exact trigger that owns the current attempt", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-evaluation-trigger-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const appDir = join(projectsRoot, "gym.app");
    await execute(
      canonicalGymTestContext({
        projectsRoot,
        task: task({ agent: "may", sessionId: "current-event", reviewedVerdict: "pass" }),
      }),
    );

    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "current-event.json"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(appDir, ".state", "learning", "evidence", "already-handled.json"),
      ),
    ).toBe(false);
  });

  it("trusts the reviewed verdict over the original triage lane", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-evaluation-verdict-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const appDir = join(projectsRoot, "gym.app");
    const emitted: Record<string, unknown>[] = [];
    for (const [sessionId, reviewedVerdict] of [
      ["reviewed-good", "good"],
      ["reviewed-acceptable", "acceptable"],
    ] as const) {
      await execute(
        canonicalGymTestContext({
          projectsRoot,
          task: task({
            agent: "may",
            lane: "needs_triage",
            verdict: "needs_improvement",
            reviewedVerdict,
            sessionId,
          }),
          emit: (event) => emitted.push(event),
        }),
      );
      expect(
        JSON.parse(
          readFileSync(
            join(appDir, ".state", "learning", "evidence", `${sessionId}.json`),
            "utf8",
          ),
        ),
      ).toMatchObject({ polarity: "positive" });
      expect(existsSync(join(appDir, ".state", "incidents", `${sessionId}.json`))).toBe(false);
    }
    expect(emitted).toEqual([]);
  });
});
