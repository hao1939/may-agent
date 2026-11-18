import { expect, test } from "bun:test";
import { createTestAppWorkflowContext, runWorkflowTest } from "@may-agent/sdk/testing";
import type { TaskDetail } from "@may-agent/sdk";
import * as procedure from "./revise-assignment.js";

const data = {
  appId: "development", taskId: "delivery/one", expectedGeneration: 3,
  input: { kind: "goal", data: {
    outcome: "Finish the existing PR", acceptance: ["Preserve current work"],
    constraints: ["No merge"], context: {
      incident: "existing-incident", developmentCheckout: {root: "/assigned/checkout", baseRef: "origin/main"},
    },
  } },
};

test("forwards the full exact correction to the fenced SDK capability without creating replacement work", async () => {
  const calls: unknown[] = [];
  const input = { prompt: "Revise the existing assignment", data };
  const saved = { id: data.taskId, generation: 4 } as TaskDetail;
  const run = await procedure.execute(createTestAppWorkflowContext({ input, reviseTask: async change => {
    calls.push(change); return saved;
  } }));
  expect(calls).toEqual([data]);
  expect(run.status).toBe("done");
  expect(run.output).toEqual(saved);
});

test("does not claim revision when the Host denies stale or unauthorized changes", async () => {
  const input = { prompt: "Revise the existing assignment", data };
  const ctx = createTestAppWorkflowContext({ input, reviseTask: async () => {
    throw new Error("Task requirements changed; read the current Task before revising it");
  } });
  await expect(procedure.execute(ctx)).rejects.toThrow("Task requirements changed");
});

test("rejects malformed generation before invoking revision", async () => {
  const run = await runWorkflowTest(procedure, {
    input: {prompt: "Revise the existing assignment", data: {...data, expectedGeneration: 0}},
  });
  expect(run.status).toBe("error");
  expect(run.started).toBe(false);
});
