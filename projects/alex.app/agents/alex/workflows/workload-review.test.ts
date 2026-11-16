import { Check } from "typebox/value";
import { afterEach, expect, setSystemTime, test } from "bun:test";
import { admitTaskReconcileResult, type TaskDetail, type TaskWorkload, type AppWorkflowContext } from "@may-agent/sdk/app";
import { execute } from "./workload-review.js";
import { workloadReviewPolicy, workloadReviewTask, WORKLOAD_REVIEW_INTERVAL_MS, WORKLOAD_REVIEW_TASK_ID } from "../../../workload-review-policy.js";

const now = 1_800_000_000_000;
const originalReviewEnabled = process.env.ALEX_WORKLOAD_REVIEW_ENABLED;
const originalNotifyOwners = process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS;
afterEach(() => {
  setSystemTime();
  if (originalReviewEnabled === undefined) delete process.env.ALEX_WORKLOAD_REVIEW_ENABLED;
  else process.env.ALEX_WORKLOAD_REVIEW_ENABLED = originalReviewEnabled;
  if (originalNotifyOwners === undefined) delete process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS;
  else process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS = originalNotifyOwners;
});
function fixture(heavy = false, notifyOwners = false) {
  setSystemTime(now);
  process.env.ALEX_WORKLOAD_REVIEW_ENABLED = "true";
  process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS = String(notifyOwners);
  const policy = workloadReviewPolicy({ ALEX_WORKLOAD_REVIEW_ENABLED: "true" });
  const own = { id: WORKLOAD_REVIEW_TASK_ID, generation: 1, status: "running", outcome: "Review workload", conditions: [] } as unknown as TaskDetail;
  const task = { id: "incident", generation: 1, status: "waiting", outcome: "Restore required delivery", acceptance: ["Verify the actual repair"],
    acceptedEvidence: { available: true, maxPageSize: 20 }, parentId: "root", input: {},
    agent: "alex", creator: { appId: "alex" }, conditions: [], currentObligations: { available: true, inputWaits: { items: [], truncated: false, maxItems: 8 } } } as TaskDetail;
  const tasks: TaskDetail[] = [own, task];
  const workload: TaskWorkload = {
    version: 1, observedAt: new Date(now).toISOString(), scope: { appId: "alex" },
    coverage: { limit: 20, scanned: 2, matched: 2, truncated: false },
    counts: { running: heavy ? 4 : 1, runnable: heavy ? 10 : 0, waiting: 1, attention: 0, idle: 0, paused: 0, cooldown: 0, unknown: 0, pendingInputTasks: 0 },
    assignments: { rootTasks: 0, contributions: 0, unattributed: 2, representedRoots: 0 },
    examples: { blockers: [{ taskId: "incident", kind: "waiting" }], dispositionCandidates: [], truncated: false },
    unadmittedInputs: { scope: { appId: "alex" }, coverage: { limit: 5, scanned: 0, truncated: false }, omitted: 0, items: [] },
    limits: { app: { backgroundMaxConcurrent: 3, interactiveAdditional: 1 }, host: { available: false }, sharedHost: { available: false }, agent: { available: false }, root: { available: false } },
    queueWait: { available: false }, resourceHealth: { available: false },
    funding: { ordinary: { available: false }, currentRoot: { available: false } },
  };
  const prompts: string[] = [];
  let response: unknown = { status: "done", output: { decision: "retain", reason: "The delivery remains owed; choose a smaller useful method." } };
  const reads: string[] = [];
  const ctx = {
    reconciliation: { appId: "alex", taskId: own.id, generation: 1, agent: "alex", events: { items: [], truncated: false } },
    signal: new AbortController().signal,
    read: {
      contract: async () => ({ taskPolicy: { coordination: policy.coordination } }),
      tasks: { workload: async () => { reads.push("workload"); return structuredClone(workload); },
        get: async (id: string) => { reads.push(id); return structuredClone(tasks.find(task => task.id === id) ?? null); },
        list: async () => ({ items: structuredClone(tasks) }) },
    },
    call: async (_agent: string, prompt: string, options: Record<string, unknown>) => {
      prompts.push(prompt);
      expect(options).toMatchObject({ tools: "readonly", timeoutMs: 60_000, operationAllowance: 8 });
      return response;
    },
    done: (summary: string, output: unknown) => ({ status: "done", summary, output }),
    blocked: (summary: string) => ({ status: "blocked", summary }),
  } as unknown as AppWorkflowContext;
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

test("pre-Task received demand receives accountable advice even with no business Task", async () => {
  const f = fixture(false, true);
  f.tasks.splice(1);
  const pending = { id: "required-report", kind: "work", source: { kind: "app" as const, id: "exact-caller" },
    receivedAt: now, changedAt: now };
  f.workload.unadmittedInputs = { scope: { appId: "alex" }, coverage: { limit: 5, scanned: 1, truncated: true, nextCursor: "next-input" }, omitted: 0, items: [pending] };
  f.setResponse({ status: "done", output: { decision: "reconsider", inputId: pending.id, reason: "The receiving App owes an admission decision", nextStep: "Owner inspect the exact retained input and judge the business need; preserve its caller route" } });
  const result = await execute(f.ctx);
  expect(result.status).toBe("done");
  expect(f.prompts).toHaveLength(1);
  expect(f.prompts[0]).toContain("required-report");
  expect(f.prompts[0]).toContain("receiving App");
  expect(state(result)).toMatchObject({ inputCursor: "next-input", decision: { inputId: pending.id } });
  expect(result.output).not.toHaveProperty("requests");
  f.setResponse({ status: "done", output: { decision: "reconsider", inputId: "unread-input", reason: "Unknown demand" } });
  expect((await execute(f.ctx)).status).toBe("blocked");
});

test("an empty Task batch cannot hide unavailable or omitted pre-Task demand", async () => {
  const f = fixture();
  f.tasks.splice(1);
  delete f.workload.unadmittedInputs;
  expect((await execute(f.ctx)).status).toBe("blocked");
  f.workload.unadmittedInputs = { scope: { appId: "alex" }, coverage: { limit: 5, scanned: 1, truncated: false }, omitted: 1, items: [] };
  expect((await execute(f.ctx)).status).toBe("blocked");
  expect(f.prompts).toHaveLength(0);
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
  expect(f.prompts[0]).toContain("Unavailable fields establish neither an allowance nor a denial");
  expect(f.prompts[0]).toContain("App limits and the controller-Host observation have separate scopes");
  expect(f.prompts[0]).not.toMatch(/protected credits|sponsor credits|seek.*funding|funding or method decision/i);
  expect(f.prompts[0]).toContain('"resourceHealth":{"available":false}');
  expect(result.output).toMatchObject({ state: "converged", actions: [], result: { workloadReview: { decision: { decision: "retain" } } } });
  expect(admitTaskReconcileResult(result.output).ok).toBe(true);
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

test("owner notification is a separately opted-in addressed request, with a retained identity across unchanged reviews", async () => {
  expect(workloadReviewPolicy({ ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS: "true" }).notifyOwners).toBe(false);
  const f = fixture(true, true);
  f.setResponse({ status: "done", output: { decision: "reconsider", taskId: f.task.id,
    reason: "The delivery remains owed.", nextStep: "Defer the optional parallel cross-check." } });
  const first = await execute(f.ctx);
  expect(admitTaskReconcileResult(first.output).ok).toBe(true);
  expect(first.output).toMatchObject({ state: "waiting", requests: [{ appId: "alex", taskId: f.task.id,
    input: { kind: "message", data: { context: { workloadAdvice: { subject: { taskId: f.task.id, generation: 1 } } } } } }] });
  const output = first.output as { requests: Array<{ id: string }>; conditions: unknown[]; result: TaskDetail["result"] };
  expect(output.conditions).toEqual([{ requestId: output.requests[0]!.id }]);
  f.own.result = output.result;
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  const repeated = await execute(f.ctx);
  expect(repeated.output).not.toHaveProperty("requests");
  expect(f.prompts).toHaveLength(1);
  f.own.result = (repeated.output as { result: TaskDetail["result"] }).result;
  f.workload.counts.runnable++;
  setSystemTime(now + 2 * WORKLOAD_REVIEW_INTERVAL_MS);
  expect((await execute(f.ctx)).output).not.toHaveProperty("requests");
  expect(f.prompts).toHaveLength(2);
});

test.each(["disabled", "retain", "input-only", "pending-owner", "changed-target", "closed-target"] as const)(
  "%s does not produce an owner notification", async kind => {
    const f = fixture(true, kind !== "disabled");
    f.setResponse({ status: "done", output: { decision: kind === "retain" ? "retain" : "reconsider",
      ...(kind === "input-only" ? {} : { taskId: f.task.id }),
      reason: "Keep the obligation.", nextStep: "Reconsider the current method." } });
    if (kind === "pending-owner") f.own.conditions.push({ id: "pending", type: "app.dependency.updated", subject: "id:pending" } as never);
    if (kind === "changed-target" || kind === "closed-target") {
      const call = f.ctx.call;
      f.ctx.call = (async (...args: Parameters<typeof call>) => {
        const result = await (call as any)(...args);
        if (kind === "changed-target") f.task.generation++;
        else f.task.status = "closed";
        return result;
      }) as typeof f.ctx.call;
    }
    const result = await execute(f.ctx);
    expect(result.status).toBe("done");
    expect(result.output).not.toHaveProperty("requests");
  },
);

test.each(["done", "blocked", "progress", "condition-retired"] as const)("delivered %s feedback is retained during cooldown without another model call, including after notification withdrawal", async kind => {
  const status = kind === "condition-retired" ? "done" : kind;
  const f = fixture(true, true);
  f.setResponse({ status: "done", output: { decision: "reconsider", taskId: f.task.id,
    reason: "The delivery remains owed.", nextStep: "Defer optional fanout." } });
  const first = await execute(f.ctx);
  f.own.result = (first.output as { result: TaskDetail["result"] }).result;
  if (kind !== "condition-retired") f.own.conditions.push({ id: "app-request:notice", type: "app.dependency.updated", subject: "id:notice",
    observation: { state: status === "done" ? "true" : "false" } } as never);
  f.ctx.reconciliation!.events.items.push({ observedAt: new Date(now).toISOString(), event: {
    type: "app.dependency.updated", source: "app-inbox:alex", data: { id: "notice", status, summary: "Owner response evidence." },
  } } as never);
  process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS = "false";
  const returned = await execute(f.ctx);
  expect(returned.output).toMatchObject({ state: "converged", result: { workloadOwnerFeedback: {
    requestId: "notice", status, summary: "Owner response evidence.",
  } } });
  expect(returned.output).not.toHaveProperty("requests");
  expect(f.prompts).toHaveLength(1);
});

test("cancellation during the final target read prevents notification submission", async () => {
  const f = fixture(true, true);
  const controller = new AbortController();
  f.ctx.signal = controller.signal;
  f.setResponse({ status: "done", output: { decision: "reconsider", taskId: f.task.id,
    reason: "The delivery remains owed.", nextStep: "Defer optional fanout." } });
  const get = f.ctx.read.tasks.get;
  let targetReads = 0;
  f.ctx.read.tasks.get = async (...args) => {
    const result = await get(...args);
    if (args[0] === f.task.id && ++targetReads === 2) controller.abort(new Error("Source review cancelled"));
    return result;
  };
  await expect(execute(f.ctx)).rejects.toThrow("Source review cancelled");
});

test.each(["old-host", "wrong-scope", "damaged-state", "damaged-feedback", "damaged-notification", "missing-task", "over-bound", "unknown-target", "invalid-output", "failed-helper"] as const)("%s stays visible without applying advice or creating work", async kind => {
  const f = fixture();
  if (kind === "old-host") f.ctx.read.contract = async () => ({} as never);
  if (kind === "wrong-scope") f.workload.scope.appId = "other";
  if (kind === "damaged-state") f.own.result = { workloadReview: { version: 0 } };
  if (kind === "damaged-feedback") f.own.result = { workloadOwnerFeedback: { status: "applied" } };
  if (kind === "damaged-notification") f.own.result = { workloadOwnerNotificationId: "unknown" };
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

test("legacy funding observations stay scoped without implying admission authority", async () => {
  const f = fixture();
  f.workload.funding = {
    ordinary: {
      available: true,
      sponsor: { appId: "alex", agent: "alex" },
      period: "2027-01-15",
      credits: 5,
      charged: 0,
      remaining: 5,
    },
    currentRoot: {
      available: true,
      task: { appId: "alex", taskId: WORKLOAD_REVIEW_TASK_ID },
      root: { appId: "alex", taskId: WORKLOAD_REVIEW_TASK_ID },
      sponsor: { appId: "alex", agent: "alex" },
      purpose: "coordination",
      renewal: "utc-day",
      period: "2027-01-15",
      credits: 5,
      charged: 2,
      remaining: 3,
      sponsorRemaining: 3,
    },
  };
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  if (!f.workload.funding.currentRoot.available || !f.workload.funding.ordinary.available)
    throw new Error("Expected fixture funding");
  f.workload.funding.currentRoot.charged++;
  f.workload.funding.currentRoot.remaining--;
  f.workload.funding.currentRoot.sponsorRemaining = f.workload.funding.currentRoot.sponsorRemaining! - 1;
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(1);
  f.workload.funding.ordinary.charged = 5;
  f.workload.funding.ordinary.remaining = 0;
  const stressed = await execute(f.ctx);
  expect(stressed.summary).toContain("advice retained");
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain('Previous recommendation for this batch: {"decision":"retain"');
  expect(f.prompts[1]).toContain('"remaining":0');
  expect(f.prompts[1]).toContain("Unavailable fields establish neither an allowance nor a denial");
  expect(f.task.status).toBe("waiting");
  expect(stressed.output).not.toHaveProperty("requests");
  f.own.result = { workloadReview: state(stressed) };
  setSystemTime(now + 2 * WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.funding.ordinary.credits = 10;
  f.workload.funding.ordinary.remaining = 5;
  expect((await execute(f.ctx)).summary).toContain("advice retained");
  expect(f.prompts).toHaveLength(3);
  expect(f.prompts[2]).toContain("A read reserves no execution slot");
  expect(f.task.status).toBe("waiting");
});

test("legacy capacity rechecks stay quiet while changed method demand warrants advice", async () => {
  const f = fixture();
  f.workload.examples.blockers = [{ taskId: "incident", kind: "capacity", scope: "root",
    reason: "execution-capacity", requiredSlots: 2, retryAt: now + 60_000 }];
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.examples.blockers[0].retryAt = Date.now() + 60_000;
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(1);
  f.workload.examples.blockers[0].requiredSlots = 3;
  await execute(f.ctx);
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain("minimum simultaneous places");
  expect(f.prompts[1]).toContain('"requiredSlots":3');
});

test("unchanged workspace shortages stay quiet and recovery warrants reconsideration", async () => {
  const f = fixture();
  f.workload.counts = { ...f.workload.counts, runnable: 0, waiting: 1 };
  f.workload.examples.blockers = [{ taskId: "incident", kind: "workspace", reason: "workspace-capacity", retryAt: now + 60_000,
    workspace: { operation: "checkout", requiredBytes: 4096, availableBytes: 0, observedAt: now } }];
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.examples.blockers[0].retryAt = Date.now() + 60_000;
  f.workload.examples.blockers[0].workspace!.observedAt = Date.now();
  f.workload.examples.blockers[0].workspace!.availableBytes = 512;
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(1);
  expect(f.prompts[0]).toContain("A workspace blocker is a dated checkout prerequisite");
  f.workload.counts = { ...f.workload.counts, runnable: 1, waiting: 0 };
  f.workload.examples.blockers = [];
  expect((await execute(f.ctx)).summary).toContain("advice retained");
  expect(f.prompts).toHaveLength(2);
  expect(f.task.status).toBe("waiting");
});

test("changed assignment attribution warrants advice without treating contribution counts as independent commitments", async () => {
  const f = fixture();
  f.workload.assignments = { rootTasks: 1, contributions: 0, unattributed: 1, representedRoots: 1 };
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.assignments = { rootTasks: 1, contributions: 1, unattributed: 0, representedRoots: 1 };
  const result = await execute(f.ctx);
  expect(result.status).toBe("done");
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain('"contributions":1,"unattributed":0');
  expect(f.prompts[1]).toContain("do not sum represented roots across pages");
  expect(f.task.status).toBe("waiting");
});

test("legacy execution observations retain source scopes while unchanged observations stay quiet", async () => {
  const f = fixture(true);
  f.workload.limits.sharedHost = { available: true, scope: "installation", maxConcurrent: 4,
    occupied: 3, remaining: 1, backgroundMaxConcurrent: 3, backgroundOccupied: 3, backgroundRemaining: 0 };
  f.workload.limits.agent = { available: true, scope: "installation-recipient",
    recipient: { kind: "programmatic", id: "fixture/owner" }, maxConcurrent: 2, occupied: 2, remaining: 0 };
  f.workload.limits.root = { available: true, scope: "current-task-root",
    task: { appId: "alex", taskId: WORKLOAD_REVIEW_TASK_ID },
    root: { appId: "alex", taskId: WORKLOAD_REVIEW_TASK_ID }, maxConcurrent: 2, occupied: 1, remaining: 1 };
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.prompts[0]).toContain("App limits and the controller-Host observation have separate scopes");
  expect(f.prompts[0]).toContain("Older scoped observations describe only their named authority");
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.observedAt = new Date(Date.now()).toISOString();
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(1);
  f.workload.limits.sharedHost.occupied--;
  f.workload.limits.sharedHost.remaining++;
  f.workload.limits.sharedHost.backgroundOccupied--;
  f.workload.limits.sharedHost.backgroundRemaining++;
  expect((await execute(f.ctx)).summary).toContain("advice retained");
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain('"backgroundRemaining":1');
  expect(f.prompts[1]).toContain('"occupied":2,"remaining":0');
  expect(f.task.status).toBe("waiting");
});

test("bounded exact reads rotate through a stable page and unchanged revisits make no model call", async () => {
  const f = fixture();
  f.tasks.splice(1, 1, ...Array.from({ length: 6 }, (_, index) => ({
    ...structuredClone(f.task), id: `commitment-${index + 1}`, outcome: `Required delivery ${index + 1}`,
  })));
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.reads.slice(-3)).toEqual(["commitment-1", "commitment-2", "commitment-3"]);
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.reads.slice(-3)).toEqual(["commitment-4", "commitment-5", "commitment-6"]);
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain("Required delivery 6");
  setSystemTime(now + 2 * WORKLOAD_REVIEW_INTERVAL_MS);
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.reads.slice(-3)).toEqual(["commitment-1", "commitment-2", "commitment-3"]);
  expect(f.prompts).toHaveLength(2);
  const obligations = f.tasks[1]!.currentObligations;
  if (!obligations?.available) throw new Error("Missing fixture obligations");
  obligations.inputWaits.items.push({ key: "new-obligation", pending: true } as never);
  setSystemTime(now + 3 * WORKLOAD_REVIEW_INTERVAL_MS);
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  setSystemTime(now + 4 * WORKLOAD_REVIEW_INTERVAL_MS);
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.prompts).toHaveLength(3);
  expect(f.prompts[2]).toContain("new-obligation");
});

test("review progresses beyond the first Task page with matching bounded workload reads", async () => {
  const f = fixture();
  const commitments = Array.from({ length: 21 }, (_, index) => ({
    ...structuredClone(f.task), id: `commitment-${String(index + 1).padStart(2, "0")}`,
    outcome: `Required delivery ${index + 1}`,
  }));
  f.tasks.splice(1, 1, ...commitments);
  const cursors: Array<string | undefined> = [];
  const workloadCursors: Array<string | undefined> = [];
  f.ctx.read.tasks.list = async options => {
    expect(options?.limit).toBe(20);
    cursors.push(options?.cursor);
    return options?.cursor === "next-page"
      ? { items: structuredClone(commitments.slice(20)) }
      : { items: structuredClone(commitments.slice(0, 20)), nextCursor: "next-page" };
  };
  f.ctx.read.tasks.workload = async options => {
    expect(options?.limit).toBe(20);
    workloadCursors.push(options?.cursor);
    return structuredClone(f.workload);
  };
  for (let pass = 0; pass < 9; pass++) {
    setSystemTime(now + pass * WORKLOAD_REVIEW_INTERVAL_MS);
    const before = f.reads.length;
    f.own.result = { workloadReview: state(await execute(f.ctx)) };
    expect(f.reads.length - before).toBeLessThanOrEqual(4); // Own Task plus at most three exact commitments.
  }
  expect(cursors).toEqual([...Array(7).fill(undefined), "next-page", undefined]);
  expect(workloadCursors).toEqual(cursors);
  expect(f.prompts).toHaveLength(8);
  expect(f.prompts[7]).toContain("Required delivery 21");
  expect(f.reads).toContain("commitment-21");
});

test("an unchanged legacy result migrates progress without purchasing the same review again", async () => {
  const f = fixture();
  const first = state(await execute(f.ctx));
  if (typeof first.fingerprint !== "string") throw new Error("Missing initial fingerprint");
  f.own.result = { workloadReview: { version: 1, fingerprint: first.fingerprint,
    reviewedAt: first.reviewedAt, decision: first.decision } };
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  const migrated = await execute(f.ctx);
  expect(migrated.summary).toContain("No changed");
  expect(f.prompts).toHaveLength(1);
  const progress = state(migrated);
  expect(progress.version).toBe(2);
  expect(progress.offset).toBe(0);
  expect((progress.recent as Array<{ fingerprint: string }>)[0]?.fingerprint).toBe(first.fingerprint);
  f.own.result = { workloadReview: state(migrated) };
  expect((await execute(f.ctx)).summary).toContain("cooldown");
  expect(f.prompts).toHaveLength(1);
});

test("a changed exact commitment preserves the next batch for retry without a helper call", async () => {
  const f = fixture();
  f.tasks.splice(1, 1, ...Array.from({ length: 6 }, (_, index) => ({
    ...structuredClone(f.task), id: `commitment-${index + 1}`,
  })));
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  const retained = structuredClone(f.own.result);
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  const get = f.ctx.read.tasks.get;
  f.ctx.read.tasks.get = async id => {
    const task = await get(id);
    return id === "commitment-4" && task ? { ...task, generation: task.generation + 1 } : task;
  };
  const failed = await execute(f.ctx);
  expect(failed.status).toBe("blocked");
  expect(failed.output).toBeUndefined();
  expect(f.own.result).toEqual(retained);
  expect(f.prompts).toHaveLength(1);
  f.ctx.read.tasks.get = get;
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.reads.slice(-3)).toEqual(["commitment-4", "commitment-5", "commitment-6"]);
  expect(f.prompts).toHaveLength(2);
});

test.each(["identity", "generation", "legacy-identity"] as const)("changed %s at the same review position never receives unrelated previous advice", async kind => {
  const f = fixture();
  f.setResponse({ status: "done", output: { decision: "reconsider", taskId: "incident", reason: "Inspect the original delivery method." } });
  const saved = state(await execute(f.ctx));
  f.own.result = { workloadReview: kind === "legacy-identity"
    ? { version: 1, fingerprint: saved.fingerprint, reviewedAt: saved.reviewedAt, decision: saved.decision }
    : saved };
  if (kind === "generation") f.task.generation++;
  else f.task.id = "replacement";
  f.task.outcome = "Deliver a different required outcome";
  f.workload.examples.blockers = [{ taskId: f.task.id, kind: "waiting" }];
  f.setResponse({ status: "done", output: { decision: "retain", taskId: f.task.id, reason: "The new outcome remains owed." } });
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  const result = await execute(f.ctx);
  expect(result.status).toBe("done");
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain("Previous recommendation for this batch: null");
  expect(f.prompts[1]).not.toContain("Inspect the original delivery method.");
});

test("a failed helper retains the same next commitments for retry", async () => {
  const f = fixture();
  f.tasks.splice(1, 1, ...Array.from({ length: 6 }, (_, index) => ({
    ...structuredClone(f.task), id: `commitment-${index + 1}`,
  })));
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  const retained = structuredClone(f.own.result);
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.setResponse({ status: "error" });
  const failed = await execute(f.ctx);
  expect(failed.status).toBe("blocked");
  expect(failed.output).toBeUndefined();
  expect(f.own.result).toEqual(retained);
  f.setResponse({ status: "done", output: { decision: "retain", reason: "Required work remains owed." } });
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.reads.slice(-3)).toEqual(["commitment-4", "commitment-5", "commitment-6"]);
  expect(f.prompts).toHaveLength(3);
  expect(f.prompts[2]).toContain("Previous recommendation for this batch: null");
});

test("position-only version-two state is reconsidered once without unverified advice", async () => {
  const f = fixture();
  const saved = state(await execute(f.ctx));
  // Saved batch key used by revision 25772d6430 for the first page at offset zero.
  const historicalKey = "221733ba36840953d9f42366315dc22ae547051f4d9ba5099e8384b02c1b0023";
  saved.decisionKey = historicalKey;
  saved.recent = [{ key: historicalKey, fingerprint: saved.fingerprint }];
  f.own.result = { workloadReview: saved };
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  const reconsidered = await execute(f.ctx);
  expect(reconsidered.status).toBe("done");
  expect(f.prompts).toHaveLength(2);
  expect(f.prompts[1]).toContain("Previous recommendation for this batch: null");
  f.own.result = { workloadReview: state(reconsidered) };
  setSystemTime(now + 2 * WORKLOAD_REVIEW_INTERVAL_MS);
  expect((await execute(f.ctx)).summary).toContain("No changed");
  expect(f.prompts).toHaveLength(2);
});

test.each(["offset", "cache-bound", "duplicate-key", "decision-key"] as const)(
  "damaged %s progress remains visible without silently restarting the scan", async kind => {
    const f = fixture();
    const saved = state(await execute(f.ctx));
    const recent = saved.recent as Array<{ key: string; fingerprint: string }>;
    if (kind === "offset") saved.offset = 21;
    if (kind === "cache-bound") saved.recent = Array(65).fill(recent[0]);
    if (kind === "duplicate-key") saved.recent = [recent[0], recent[0]];
    if (kind === "decision-key") delete saved.decisionKey;
    f.own.result = { workloadReview: saved };
    setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
    expect((await execute(f.ctx)).status).toBe("blocked");
    expect(f.prompts).toHaveLength(1);
    expect(f.own.result.workloadReview).toEqual(saved);
  },
);

test("an empty discovery page advances its continuation without buying a planning call", async () => {
  const f = fixture();
  f.ctx.read.tasks.list = async options => options?.cursor === "next-page"
    ? { items: [structuredClone(f.task)] }
    : { items: [structuredClone(f.own)], nextCursor: "next-page" };
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.prompts).toHaveLength(0);
  setSystemTime(now + WORKLOAD_REVIEW_INTERVAL_MS);
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.prompts).toHaveLength(1);
  expect(f.prompts[0]).toContain("Restore required delivery");
});

test("the retained observation window stays bounded during a larger population scan", async () => {
  const f = fixture();
  const commitments = Array.from({ length: 70 }, (_, index) => ({
    ...structuredClone(f.task), id: `commitment-${index}`,
  }));
  f.tasks.splice(1, 1, ...commitments);
  f.ctx.read.tasks.list = async options => {
    const index = options?.cursor ? Number(options.cursor.slice(5)) : 0;
    return { items: [structuredClone(commitments[index]!)],
      ...(index < 69 ? { nextCursor: `page-${index + 1}` } : {}) };
  };
  for (let pass = 0; pass <= 70; pass++) {
    setSystemTime(now + pass * WORKLOAD_REVIEW_INTERVAL_MS);
    const result = await execute(f.ctx);
    expect(result.status).toBe("done");
    const progress = state(result);
    expect((progress.recent as unknown[]).length).toBeLessThanOrEqual(64);
    expect(JSON.stringify(progress).length).toBeLessThan(16_384);
    f.own.result = { workloadReview: progress };
  }
  expect(f.prompts).toHaveLength(71); // The first batch was evicted before the complete scan returned to it.
});


test("the helper contract admits only one subject actually supplied in this review", async () => {
  const f = fixture(false, true);
  f.workload.unadmittedInputs!.items.push({ id: "retained-demand", kind: "work", source: { kind: "app", id: "caller" },
    receivedAt: now, changedAt: now });
  f.workload.unadmittedInputs!.coverage.scanned = 1;
  f.ctx.call = (async (_agent: string, _prompt: unknown, options: { schema: Parameters<typeof Check>[0] }) => {
    const advice = { decision: "reconsider", reason: "Keep the required delivery and choose a smaller method." };
    expect(Check(options.schema, advice)).toBe(true);
    expect(Check(options.schema, { ...advice, taskId: f.task.id })).toBe(true);
    expect(Check(options.schema, { ...advice, inputId: "retained-demand" })).toBe(true);
    expect(Check(options.schema, { ...advice, taskId: f.task.id, inputId: "retained-demand" })).toBe(false);
    expect(Check(options.schema, { ...advice, taskId: "unread-task" })).toBe(false);
    expect(Check(options.schema, { ...advice, inputId: "review-request-itself" })).toBe(false);
    return { status: "done", output: { ...advice, taskId: f.task.id, nextStep: "Use the smaller local method." } };
  }) as typeof f.ctx.call;
  const result = await execute(f.ctx);
  expect(result.status).toBe("done");
  expect(result.output).toHaveProperty("requests");
});
