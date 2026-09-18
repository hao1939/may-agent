import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { Check } from "typebox/value";
import app, { taskForGymInput } from "./app";
import { parseComparison } from "./agents/gym/workflows/compare-candidate";

const comparison = {
  agent: "may",
  baselineRunId: "run-baseline",
  candidate: "candidate-1",
  candidateFingerprint: "sha256:candidate",
  benchmark: "may-alignment",
  scorerRevision: "scorer-v1",
  frameworkRevision: "framework-v1",
  model: "gpt-5",
  trials: 2,
  timeoutMs: 60_000,
  totalAllowanceMs: 300_000,
  scenarios: [
    "incident",
    "paraphrase",
    "opposite-control",
    "unrelated-transfer",
  ],
};

describe("bounded Gym App", () => {
  test("exposes only ordinary goal/message input with no autonomous schedules or legacy apply workflow", () => {
    expect(
      Check(app.inputSchema, {
        kind: "goal",
        data: {
          outcome: "Compare",
          acceptance: ["Retain proof"],
          context: { comparison },
        },
      }),
    ).toBeTrue();
    expect(
      Check(app.inputSchema, { kind: "run-regression", data: comparison }),
    ).toBeFalse();
    expect(app.schedules).toEqual([]);
    expect(app.tasks).toEqual({ maxConcurrent: 2 });
    expect(app).not.toHaveProperty("actions");
    expect(
      existsSync(
        new URL("./agents/gym/workflows/improve-agent.ts", import.meta.url),
      ),
    ).toBeFalse();
    expect(
      existsSync(
        new URL("./archive/workflows/improve-agent.ts", import.meta.url),
      ),
    ).toBeTrue();
  });

  test("keeps May and Scout comparison goals ordinary and lets the owner select procedure", () => {
    for (const agent of ["may", "scout"] as const) {
      const input = {
        kind: "goal",
        data: {
          outcome: `Compare ${agent}`,
          acceptance: ["Exact identities"],
          context: { comparison: { ...comparison, agent } },
        },
      } as const;
      const attached = taskForGymInput({
        id: `request-${agent}`,
        source: { kind: "app", id: agent },
        input,
      });
      expect(attached).toMatchObject({
        kind: "desired",
        intent: { parentId: "gym", agent: "gym", input },
      });
      if (attached.kind === "desired")
        expect(attached.intent.workflow).toBeUndefined();
    }
  });

  test("requires exact bounded comparison scope", () => {
    expect(parseComparison({ requestId: "r1", ...comparison })).toMatchObject({
      agent: "may",
      model: "gpt-5",
      scorerRevision: "scorer-v1",
    });
    expect(() =>
      parseComparison({ requestId: "r1", ...comparison, agent: "other" }),
    ).toThrow("may or scout");
    expect(() =>
      parseComparison({
        requestId: "r1",
        ...comparison,
        scenarios: ["incident"],
      }),
    ).toThrow("requires incident");
    expect(() =>
      parseComparison({ requestId: "r1", ...comparison, trials: 99 }),
    ).toThrow("1 through 5");
  });
});
