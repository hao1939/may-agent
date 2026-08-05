import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const roots: string[] = [];
const scorer = resolve(
  import.meta.dirname,
  "../scenarios/may-conversation-admit-long-running-reply/success_criteria.js",
);

function score(mayTurn: Record<string, unknown>) {
  const root = mkdtempSync(`${tmpdir()}/gym-direct-reply-`);
  roots.push(root);
  writeFileSync(
    `${root}/alignment-decision.json`,
    JSON.stringify({
      understood_intent: "Get the verified July reliability proposal from reports.app.",
      mode: "route pending durable acceptance",
      priority: "Establish accountable work without an unsupported promise.",
      needs_clarification: false,
      next_action: "Route the requested outcome and proof to reports.app.",
      delegations: [],
      constraints: ["Invent no state."],
      preference_updates: [],
      response_to_hao:
        "I am routing this to the reports owner. Durable acceptance is still pending; you do not need to act.",
      may_turn: mayTurn,
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

describe("canonical May turn scorer", () => {
  it("accepts the production route shape while durable ownership is pending", () => {
    const result = score({
      disposition: "route",
      response:
        "I am routing this to the reports owner. Durable acceptance is still pending; you do not need to act.",
      project: "reports",
      outcome: "Investigate the July reliability gap and produce a verified proposal.",
      requiredProof: "The proposal cites the reliability evidence and passes reports verification.",
      constraints: ["Do not claim owner acceptance before the owner responds."],
    });
    expect(result.passed).toBe(true);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ name: "canonical-may-turn-contract", passed: true }),
    );
  });

  it("rejects a non-route turn for the pending durable request", () => {
    const result = score({ disposition: "answer", response: "The owner is handling it." });
    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ name: "canonical-may-turn-contract", passed: false }),
    );
  });
});
