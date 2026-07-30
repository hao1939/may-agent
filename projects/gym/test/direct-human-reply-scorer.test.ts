import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const roots: string[] = [];
const scorer = resolve(
  import.meta.dirname,
  "../scenarios/may-conversation-admit-long-running-reply/success_criteria.js",
);

function score(commitment: Record<string, unknown>) {
  const root = mkdtempSync(`${tmpdir()}/gym-direct-reply-`);
  roots.push(root);
  writeFileSync(
    `${root}/alignment-decision.json`,
    JSON.stringify({
      understood_intent: "Get the verified July reliability proposal from reports.app.",
      mode: "route pending durable acceptance",
      priority: "Establish accountable work without an unsupported promise.",
      needs_clarification: false,
      next_action:
        "Require an accepted work reference, terminal proof, completion wake, and review checkpoint.",
      delegations: [],
      constraints: ["Invent no state."],
      preference_updates: [],
      response_to_hao:
        "I am routing this to the reports owner. Durable acceptance is still pending; you do not need to act.",
      commitment,
    }),
  );
  const run = Bun.spawnSync(["node", scorer, root], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode).toBe(0);
  return JSON.parse(run.stdout.toString());
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("direct human reply scorer", () => {
  it("accepts the routing envelope while durable ownership is pending", () => {
    const result = score({
      kind: "routing",
      intendedOwner: "reports.app owner",
      acceptanceNeeded:
        "Accepted work reference on this trace with proof, completion wake, and review checkpoint",
    });
    expect(result.passed).toBe(true);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ name: "direct-reply-contract", passed: true }),
    );
  });

  it("rejects a missing routing boundary", () => {
    const result = score({ kind: "none" });
    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ name: "direct-reply-contract", passed: false }),
    );
  });
});
