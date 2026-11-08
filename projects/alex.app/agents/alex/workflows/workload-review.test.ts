import { afterEach, expect, setSystemTime, test } from "bun:test";
import type { TaskDetail, TaskWorkload, WorkflowContext } from "@may-agent/sdk";
import { execute } from "./workload-review.js";
import { workloadReviewPolicy, workloadReviewTask, WORKLOAD_REVIEW_INTERVAL_MS, WORKLOAD_REVIEW_TASK_ID } from "../../../workload-review-policy.js";

const now = 1_800_000_000_000;
afterEach(() => setSystemTime());
function fixture(heavy = false) {
  setSystemTime(now);
  const policy = workloadReviewPolicy({ ALEX_WORKLOAD_REVIEW_ENABLED: "true" });
  const own = { id: WORKLOAD_REVIEW_TASK_ID, generation: 1, status: "running", outcome: "Review workload" } as TaskDetail;
  const task = { id: "incident", generation: 1, status: "waiting", outcome: "Restore required delivery", acceptance: ["Verify the actual repair"],
    acceptedEvidence: { available: true, maxPageSize: 20 }, parentId: "root", input: {},
    agent: "alex", creator: { appId: "alex" }, conditions: [], currentObligations: { available: true, inputWaits: { items: [], truncated: false, maxItems: 8 } } } as TaskDetail;
  const tasks: TaskDetail[] = [own, task];
  const workload: TaskWorkload = {
    version: 1, observedAt: new Date(now).toISOString(), scope: { appId: "alex" },
    coverage: { limit: 20, scanned: 2, matched: 2, truncated: false },
    counts: { running: heavy ? 4 : 1, runnable: heavy ? 10 : 0, waiting: 1, attention: 0, idle: 0, paused: 0, cooldown: 0, unknown: 0, pendingInputTasks: 0 },
    examples: { blockers: [{ taskId: "incident", kind: "waiting" }], dispositionCandidates: [], truncated: false },
    limits: { app: { backgroundMaxConcurrent: 3, interactiveAdditional: 1 }, host: { available: false }, agent: { available: false }, root: { available: false } },
    queueWait: { available: false }, resourceHealth: { available: false },
  };
  const prompts: string[] = [];
  let response: unknown = { status: "done", output: { decision: "retain", reason: "The delivery remains owed; choose a smaller useful method." } };
  const reads: string[] = [];
  const ctx = {
    reconciliation: { appId: "alex", taskId: own.id, generation: 1, agent: "alex" },
    signal: new AbortController().signal,
    read: {
      contract: async () => ({ taskPolicy: { coordination: policy.coordination } }),
      tasks: { workload: async () => { reads.push("workload"); return structuredClone(workload); },
        get: async (id: string) => { reads.push(id); return structuredClone(tasks.find(task => task.id === id) ?? null); },
        list: async () => ({ items: structuredClone(tasks) }) },
    },
    agents: { call: async (_agent: string, prompt: string, options: Record<string, unknown>) => {
      prompts.push(prompt);
      expect(options).toMatchObject({ tools: "readonly", timeoutMs: 60_000, operationAllowance: 8 });
      return response;
    } },
    done: (summary: string, output: unknown) => ({ status: "done", summary, output }),
    blocked: (summary: string) => ({ status: "blocked", summary }),
  } as unknown as WorkflowContext;
  return { ctx, own, task, tasks, workload, prompts, reads, setResponse: (value: unknown) => { response = value; } };
}
const state = (result: Awaited<ReturnType<typeof execute>>) => (result.output as { result: { workloadReview: Record<string, unknown> } }).result.workloadReview;

test("pilot opt-in selects one stable standing Task and never grants role from its input", () => {
  expect(workloadReviewPolicy({}).enabled).toBe(false);
  const input = { id: "first", input: { kind: "workload-review", data: {} } };
  expect(() => workloadReviewTask(input as never, false)).toThrow("opt-in");
  const first = workloadReviewTask(input as never, true);
  expect(workloadReviewTask({ ...input, id: "later" } as never, true).intent.id).toBe(first.intent.id);
  expect(first.intent).toMatchObject({ id: WORKLOAD_REVIEW_TASK_ID, agent: "alex", workflow: "workload-review" });
  expect(workloadReviewPolicy({ ALEX_WORKLOAD_REVIEW_ENABLED: "true" }).schedule.catchUp).toBe("latest");
});

test.each([false, true])("required work stays owed in the same bounded advice contract under heavy=%s", async heavy => {
  const f = fixture(heavy);
  const result = await execute(f.ctx);
  expect(result.status).toBe("done");
  expect(f.prompts).toHaveLength(1);
  expect(f.prompts[0]).toContain("Restore required delivery");
  expect(f.prompts[0]).toContain("Business need determines owed work under every load");
  expect(f.prompts[0]).toContain("smaller useful methods and less optional fanout");
  expect(f.prompts[0]).toContain("Do not create filler Tasks or prefer closure to reduce counts");
  expect(f.prompts[0]).toContain('"resourceHealth":{"available":false}');
  expect(result.output).toMatchObject({ state: "converged", actions: [], result: { workloadReview: { decision: { decision: "retain" } } } });
  expect(result.output).not.toHaveProperty("requests");
  expect(f.reads).toEqual([WORKLOAD_REVIEW_TASK_ID, "workload", "incident"]);
  expect(f.task.status).toBe("waiting");
});

test("accepted review state coalesces cooldown, timestamps, its own result and unchanged empty passes", async () => {
  const f = fixture();
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  await execute(f.ctx);
  expect(f.prompts).toHaveLength(1);
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.observedAt = new Date(Date.now()).toISOString();
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(1);
  if (!f.task.currentObligations?.available) throw new Error("Missing fixture obligations");
  f.task.currentObligations.inputWaits.items.push({ key: "new-obligation", pending: true } as never);
  expect((await execute(f.ctx)).summary).toContain("advice retained");
  expect(f.prompts).toHaveLength(2);
  f.tasks.splice(1);
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  setSystemTime(now + 2 * WORKLOAD_REVIEW_INTERVAL_MS);
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(2);
});

test.each(["old-host", "wrong-scope", "damaged-state", "missing-task", "over-bound", "unknown-target", "invalid-output", "failed-helper"] as const)("%s stays visible without applying advice or creating work", async kind => {
  const f = fixture();
  if (kind === "old-host") f.ctx.read.contract = async () => ({} as never);
  if (kind === "wrong-scope") f.workload.scope.appId = "other";
  if (kind === "damaged-state") f.own.result = { workloadReview: { version: 0 } };
  if (kind === "missing-task") f.ctx.read.tasks.get = async () => null;
  if (kind === "over-bound") f.tasks.push(...Array(21).fill(f.task));
  if (kind === "unknown-target") f.setResponse({ status: "done", output: { decision: "reconsider", reason: "Review", taskId: "unread" } });
  if (kind === "invalid-output") f.setResponse({ status: "done", output: { decision: "close", reason: "Too many Tasks" } });
  if (kind === "failed-helper") f.setResponse({ status: "error" });
  const result = await execute(f.ctx);
  expect(result.status).toBe("blocked");
  expect(result.output).toBeUndefined();
  expect(f.task.status).toBe("waiting");
  if (["old-host", "wrong-scope", "damaged-state", "missing-task", "over-bound"].includes(kind)) expect(f.prompts).toHaveLength(0);
});
