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

test("changed ordinary funding warrants new advice; paying for this protected review does not", async () => {
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
  expect(f.prompts[1]).toContain("funding hold retains the obligation");
  expect(f.task.status).toBe("waiting");
  expect(stressed.output).not.toHaveProperty("requests");
  f.own.result = { workloadReview: state(stressed) };
  setSystemTime(now + 2 * WORKLOAD_REVIEW_INTERVAL_MS);
  f.workload.funding.ordinary.credits = 10;
  f.workload.funding.ordinary.remaining = 5;
  expect((await execute(f.ctx)).summary).toContain("advice retained");
  expect(f.prompts).toHaveLength(3);
  expect(f.prompts[2]).toContain("available credits do not establish spare execution capacity");
  expect(f.task.status).toBe("waiting");
});

test("mechanical capacity rechecks stay quiet while changed method demand warrants advice", async () => {
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

test("shared execution changes warrant method advice while unchanged observations stay quiet", async () => {
  const f = fixture(true);
  f.workload.limits.sharedHost = { available: true, scope: "installation", maxConcurrent: 4,
    occupied: 3, remaining: 1, backgroundMaxConcurrent: 3, backgroundOccupied: 3, backgroundRemaining: 0 };
  f.workload.limits.agent = { available: true, scope: "installation-recipient",
    recipient: { kind: "programmatic", id: "fixture/owner" }, maxConcurrent: 2, occupied: 2, remaining: 0 };
  f.workload.limits.root = { available: true, scope: "current-task-root",
    task: { appId: "alex", taskId: WORKLOAD_REVIEW_TASK_ID },
    root: { appId: "alex", taskId: WORKLOAD_REVIEW_TASK_ID }, maxConcurrent: 2, occupied: 1, remaining: 1 };
  f.own.result = { workloadReview: state(await execute(f.ctx)) };
  expect(f.prompts[0]).toContain("Shared Host and recipient limits describe actual installation execution");
  expect(f.prompts[0]).toContain("current-root capacity belongs only to this review's bound assignment");
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
  expect((await execute(f.ctx)).status).toBe("blocked");
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
