import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Check } from "typebox/value";
import { appTaskTestContext } from "../may-agent/src/app/core/tasks/app-task-test-support";
import { admitTaskInput } from "../may-agent/src/app/core/state/inbox";
import app, { taskForGymInput } from "./app";
import { parseComparison } from "./agents/gym/workflows/compare-candidate";

const comparison = {
  agent: "may",
  baselineRunId: "run-baseline",
  baselinePath: "/frozen/gym/run-baseline",
  baselineFingerprint: "sha256:baseline",
  candidate: "candidate-1",
  candidatePath: "/frozen/may/agents/.lab/candidate-1",
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
        intent: { parentId: "gym-system", agent: "gym", input },
      });
      if (attached.kind === "desired")
        expect(attached.intent.workflow).toBeUndefined();
    }
  });

  test("both ordinary inputs admit against the App's actual seeded Task graph", () => {
    const root = mkdtempSync(join(tmpdir(), "gym-app-admission-"));
    const config = appTaskTestContext({
      appDir: import.meta.dirname,
      appId: "gym",
      databasePath: join(root, "tasks.db"),
      agent: "gym",
      maxConcurrent: 2,
    });
    try {
      for (const input of [
        {
          kind: "goal",
          data: {
            outcome: "Compare frozen artifacts",
            acceptance: ["Return exact evidence"],
          },
        },
        {
          kind: "message",
          data: { message: "Explain retained comparison evidence" },
        },
      ]) {
        const inputContext = {
          id: `seed-${input.kind}`,
          source: { kind: "human" as const, id: "fixture" },
          input,
        };
        const attachment = taskForGymInput(inputContext);
        const result = admitTaskInput(config, {
          appId: "gym",
          attachment,
          inputContext,
          idempotencyKey: inputContext.id,
        });
        expect(
          config.resourceStore.readTask(result.taskId)?.spec.parentId,
        ).toBe("gym-system");
      }
    } finally {
      config.resourceStore.close();
      rmSync(root, { recursive: true, force: true });
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
