import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute, incidentReviewEmissionLocalKey } from "./incident-intake.ts";
import { canonicalGymTestContext } from "./lib/test-context";

function task(details: Record<string, unknown>): string {
  return [
    "## Reconciliation Task",
    "```json",
    JSON.stringify({
      taskId: "runtime/incident-intake",
      generation: 1,
      input: details,
    }),
    "```",
  ].join("\n");
}

describe("incident-intake", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps review emission keys stable on replay and distinct across incidents", async () => {
    const root = mkdtempSync(join(tmpdir(), "gym-incident-intake-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const emitted: Record<string, unknown>[] = [];
    const replayedDetails = { sessionId: "same-incident", summary: "failure" };
    const distinctDetails = {
      sessionId: "distinct-incident",
      summary: "failure",
    };
    const replayed = canonicalGymTestContext({
      projectsRoot,
      task: task(replayedDetails),
      emit: (event) => emitted.push(event),
    });
    const distinct = canonicalGymTestContext({
      projectsRoot,
      task: task(distinctDetails),
      emit: (event) => emitted.push(event),
    });

    expect((await execute(replayed)).status).toBe("done");
    expect((await execute(replayed)).status).toBe("done");
    expect((await execute(distinct)).status).toBe("done");

    expect(emitted).toHaveLength(3);
    expect(emitted.map((event) => event.localKey)).toEqual([
      incidentReviewEmissionLocalKey(replayedDetails),
      incidentReviewEmissionLocalKey(replayedDetails),
      incidentReviewEmissionLocalKey(distinctDetails),
    ]);
    expect(emitted[0]?.localKey).toBe(emitted[1]?.localKey);
    expect(emitted[0]?.localKey).not.toBe(emitted[2]?.localKey);
    expect(emitted.every((event) => event.type === "gym.review.requested")).toBe(
      true,
    );
  });
});
