import { describe, expect, test } from "bun:test";
import type { ExecutionResult } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  METRIC_ID,
  buildCoverageTask,
  coverageCountsSchema,
  execute,
  parseCoverageCounts,
} from "./evaluator-aftermath-coverage-snapshot.ts";

function reconciliation() {
  return {
    appId: "evaluation",
    taskId: "runtime/aftermath-coverage-snapshot",
    generation: 2,
    resourceVersion: 3,
    agent: "evaluator",
    mode: "achieve" as const,
    outcome: "Publish coverage.",
    acceptance: ["Persist one sample."],
    input: { reason: "test" },
    children: { live: [], completed: [] },
    taskSnapshot: { live: [], truncated: false },
  };
}

function agent(output: unknown, summary = "counted"): ExecutionResult {
  return {
    id: "s_counter",
    kind: "agent",
    status: "done",
    summary,
    ...(output !== undefined ? { output } : {}),
  };
}

describe("aftermath coverage snapshot", () => {
  test("counts only sessions admitted by the App aftermath policy", () => {
    const task = buildCoverageTask();
    expect(task).toContain("workflowRunId IS NOT NULL");
    expect(task).toContain("routineWorkflowSession admission policy");
  });

  test("parses only structured direct and result count envelopes", () => {
    const counts = {
      eligible: 10,
      evaluated: 3,
      windowStart: 100,
      windowEnd: 200,
    };
    expect(parseCoverageCounts(counts)).toEqual(counts);
    expect(parseCoverageCounts({ result: counts })).toEqual(counts);
    expect(parseCoverageCounts({ summary: JSON.stringify(counts) })).toBeNull();
    expect(parseCoverageCounts({ ...counts, evaluated: 11 })).toBeNull();
  });

  test("requests structured counts, records the sample, and converges", async () => {
    const records: unknown[][] = [];
    let suppliedSchema: unknown;
    const counts = {
      eligible: 10,
      evaluated: 3,
      windowStart: 100,
      windowEnd: 200,
    };
    const result = await execute(
      createTestAppWorkflowContext({
        input: { reason: "repair" },
        reconciliation: reconciliation(),
        callAgent: async (_agent, _task, options) => {
          suppliedSchema = options?.schema;
          return agent(counts);
        },
        recordMetric: async (...args) => {
          records.push(args);
        },
      }),
    );
    expect(result.status).toBe("done");
    expect(suppliedSchema).toBe(coverageCountsSchema);
    expect(records).toHaveLength(1);
    expect(records[0]?.[0]).toBe(METRIC_ID);
    expect(records[0]?.[1]).toBe(0.3);
    expect(records[0]?.[2]).toMatchObject({
      sampleSize: 10,
      measuredAt: counts.windowEnd,
      measuredBy: "workflow:evaluator-aftermath-coverage-snapshot",
    });
    expect(String((records[0]?.[2] as { note: string }).note)).toContain(
      '"evaluated":3',
    );
  });
});
