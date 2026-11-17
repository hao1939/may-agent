import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { Type } from "@may-agent/sdk";
import type { AppTaskAttachment, AppTaskInput, TaskIntent } from "@may-agent/sdk/app";
import { Check } from "typebox/value";

export const piuBenchmarkTaskId =
  "domain/platform-initiated-upgrade/verification-benchmark";

export const platformUpgradeBenchmarkInputSchema = Type.Object(
  {
    kind: Type.Literal("platform-initiated-upgrade-benchmark"),
    data: Type.Object({}, { additionalProperties: false }),
  },
  { additionalProperties: false },
);

export const platformUpgradeBenchmarkFeedbackSchema = Type.Object(
  {
    kind: Type.Literal("owner-review"),
    data: Type.Object(
      {
        message: Type.String({ minLength: 1, maxLength: 16_000 }),
        context: Type.Object(
          {
            intent: Type.Literal("task-feedback"),
            taskId: Type.Literal(piuBenchmarkTaskId),
            expectedGeneration: Type.Integer({ minimum: 1 }),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// App-owned finite assignment. Human feedback attaches to this Task; it cannot
// replace its source/effect boundaries or authorize another native executor.
const assignment = JSON.parse(
  readFileSync(new URL("./piu-benchmark-assignment.json", import.meta.url), "utf8"),
) as {
  outcome: string;
  acceptance: string[];
  handoffPath: string;
  evidenceRoot: string;
  progressPath: string;
  [key: string]: unknown;
};

function benchmarkIntent(): TaskIntent {
  return {
    id: piuBenchmarkTaskId,
    parentId: "group/domain-work",
    outcome: assignment.outcome,
    acceptance: [...assignment.acceptance],
    agent: "aks-explorer",
    executor: "codex-goal",
    priority: "P1",
    category: "domain",
    input: {
      executionContract: "platform-initiated-upgrade-benchmark/v1",
      assignment: structuredClone(assignment),
    },
    outputs: [assignment.progressPath, assignment.evidenceRoot],
  };
}

export function platformUpgradeBenchmarkAttachment(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment | null {
  const start = Check(platformUpgradeBenchmarkInputSchema, admitted.input);
  const feedback = Check(platformUpgradeBenchmarkFeedbackSchema, admitted.input);
  if (!start && !feedback) return null;
  if (admitted.source.kind !== "human" || !admitted.source.id.trim())
    throw new Error("PIU benchmark admission requires an explicit human source");
  if (start) return { kind: "desired", intent: benchmarkIntent() };
  const data = admitted.input.data as { message: string };
  if (!data.message.trim()) throw new Error("PIU benchmark feedback is empty");
  return { kind: "existing", taskId: piuBenchmarkTaskId };
}

/** This exemption recognizes the complete fixed assignment, not a name/prefix. */
export function isPlatformUpgradeBenchmarkIntent(intent: TaskIntent): boolean {
  return isDeepStrictEqual(intent, benchmarkIntent());
}
