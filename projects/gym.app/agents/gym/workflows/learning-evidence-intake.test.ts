import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./learning-evidence-intake";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function task(event: Record<string, unknown>): string {
  return `app: test\n\n## Trigger Event\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

test("records positive learning evidence exactly once", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-learning-evidence-"));
  roots.push(root);
  const ctx = {
    projectsRoot: join(root, "projects"),
    task: task({
      type: "gym.learning.evidence.observed",
      polarity: "positive",
      evaluation: {
        agent: "may",
        sessionId: "s_good",
        reviewedVerdict: "good",
      },
    }),
    done(summary: string) {
      return { type: "done" as const, summary };
    },
    blocked(reason: string) {
      return { type: "blocked" as const, reason };
    },
  } as unknown as WorkflowContext;

  expect((await execute(ctx)).type).toBe("done");
  expect((await execute(ctx)).type).toBe("done");

  const evidenceDir = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "learning",
    "evidence",
  );
  const evidencePath = join(evidenceDir, "s_good.json");
  expect(existsSync(evidencePath)).toBe(true);
  expect(JSON.parse(readFileSync(evidencePath, "utf8"))).toMatchObject({
    polarity: "positive",
    status: "unclassified",
  });
  expect(
    readFileSync(join(evidenceDir, "observations.jsonl"), "utf8")
      .trim()
      .split("\n"),
  ).toHaveLength(1);
});
