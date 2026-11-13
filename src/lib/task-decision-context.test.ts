import { Type } from "typebox";
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TaskDetail } from "@may-agent/sdk";
import { createTaskDecisionContext } from "./task-decision-context.js";
import { prepareTaskWorkspaceContext } from "./task-workspace-context.js";
import { createAssistantMessageEventStream, getCurrentSystemPrompt, getCurrentTools, type TranscriptContext } from "@earendil-works/pi-ai";
import { createFinishTool } from "./tools/lifecycle.js";
import { createAgentRun, restoreAgentMessages } from "./agent-runner.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { prepareAgentExecution } from "./agent-execution.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { workloadObservation } from "../../test/fixtures/task-workload.js";

function fixture(root: string) {
  const task: TaskDetail = {
    id: "review",
    parentId: "root",
    generation: 1,
    resourceVersion: 3,
    status: "running",
    agent: "task-owner",
    creator: { appId: "caller", taskId: "requester" },
    outcome: "Review the draft",
    acceptance: ["Keep approval separate"],
    input: { background: "old notes" },
    summary: "Draft prepared",
    result: { understanding: "Wednesday", version: "v3" },
    facts: ["Venue: Cedar"],
    acceptedEvidence: { available: true, maxPageSize: 20 },
    currentObligations: {
      available: true,
      inputWaits: {
        maxItems: 100,
        truncated: false,
        items: [
          {
            key: "task:publish",
            conditionCount: 1,
            correlation: { input: { available: true, id: "publish", kind: "message", status: "handling" } },
          },
        ],
      },
    },
    conditions: [
      {
        id: "approval",
        type: "approval.observed",
        subject: "draft:v3",
        expected: true,
        owner: "human:reviewer",
        requestedAction: "Approve exact version",
        observation: { generation: 1, resourceVersion: 1, observedGeneration: 0, state: "unknown" },
      },
    ],
    pendingEvents: { items: [], truncated: false },
  };
  let current = structuredClone(task);
  let failure = false;
  const context = {
    taskBinding: { appId: "sample", taskId: task.id, generation: 1, attemptId: "attempt-1" },
    recoveryOwner: "app-task",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    reconciliation: {
      task: structuredClone(task),
      appId: "sample",
      taskId: task.id,
      generation: 1,
      resourceVersion: 3,
      agent: "owner",
      outcome: task.outcome,
      acceptance: task.acceptance,
      input: task.input,
      events: { items: [], truncated: false },
      waits: { open: [], note: "attempt-start" },
      children: { live: [], completed: [] },
    },
    details: { task, declaredOutputs: [] },
    taskRead: {
      get: async () => {
        if (failure) throw new Error("read unavailable");
        return structuredClone(current);
      },
    },
  } as unknown as TaskExecutionContext;
  prepareTaskWorkspaceContext(context, root, []);
  return {
    context,
    task,
    setCurrent: (value: TaskDetail) => {
      current = value;
    },
    fail: () => {
      failure = true;
    },
  };
}

function packet(message: AgentMessage) {
  const content = message.content;
  if (typeof content === "string" || !Array.isArray(content)) throw new Error("Expected text blocks");
  const text = content.find((item) => item.type === "text");
  if (!text || text.type !== "text") throw new Error("Expected decision brief");
  return JSON.parse(text.text.slice(text.text.indexOf("\n{")));
}

function inputEvent(id: string, message: string, eventId: number) {
  return {
    eventId,
    observedAt: "2026-09-28T14:30:17.911Z",
    event: {
      type: "app.task.requested",
      data: {
        appId: "sample",
        idempotencyKey: `task:${id}`,
        request: {
          id,
          input: {
            kind: "message",
            data: { context: { reviewer: "supervisor", evidencePath: "/evidence/review.md" }, message },
          },
        },
      },
    },
  };
}

function pendingInputEvent(id: string, message: string, eventId: number) {
  return {
    eventId,
    observedAt: "2026-09-28T20:50:36.643Z",
    event: {
      type: "app.input.requested",
      data: {
        appId: "sample",
        taskId: "review",
        idempotencyKey: id,
        input: {
          kind: "message",
          data: { context: { authority: "clarification only" }, message },
        },
      },
    },
  };
}

test("refresh keeps current evidence, independent approval and a scoped last-known fallback", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-context-"));
  try {
    const f = fixture(root);
    const read = createTaskDecisionContext(f.context);
    const initial = packet(await read());
    expect(initial.assignment.agent).toBe("task-owner");
    expect(initial.assignment.creator).toEqual({ appId: "caller", taskId: "requester" });
    expect(initial.conditions[0].observation.state).toBe("unknown");
    f.setCurrent({ ...f.task, resourceVersion: 4, result: { understanding: "Thursday", version: "v4" } });
    const updated = packet(await read());
    expect(updated.current.result).toEqual({ understanding: "Thursday", version: "v4" });
    expect(updated.conditions[0].subject).toBe("draft:v3");
    expect(updated.observed.resourceVersion).toBe(4);
    expect(updated.coverage.detail).not.toBe(initial.coverage.detail);
    f.fail();
    const fallback = packet(await read());
    expect(fallback.observed.refresh.available).toBe(false);
    expect(fallback.observed.snapshot).toBe("last-successful-read");
    expect(fallback.current).toEqual(updated.current);
    expect(fallback.conditions).toEqual(updated.conditions);
    expect(fallback.assignment).toEqual(updated.assignment);
    expect(fallback.coverage.currentRead.taskId).toBe("review");
    expect(f.context.details?.task.result).toEqual({ understanding: "Wednesday", version: "v3" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("workload retains its attempt-start time and coverage across Task refresh; absent feedback stays absent", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-workload-"));
  try {
    const f = fixture(root);
    const read = createTaskDecisionContext(f.context);
    expect(packet(await read()).workloadAtAttemptStart).toBeUndefined();
    f.context.reconciliation.workload = workloadObservation();
    const first = await read();
    expect(packet(first).workloadAtAttemptStart).toEqual(workloadObservation());
    expect(JSON.stringify(first)).toContain("Required work remains owed under pressure");
    f.setCurrent({ ...f.task, resourceVersion: 4 });
    const updated = packet(await read());
    expect(updated.observed.resourceVersion).toBe(4);
    expect(updated.workloadAtAttemptStart).toEqual(workloadObservation());
    f.context.reconciliation.workload = { available: false };
    expect(packet(await read()).workloadAtAttemptStart).toEqual({ available: false });
    // The workspace brief references the same retained observation for helpers.
    delete f.context.workspaceBrief;
    const brief = prepareTaskWorkspaceContext(f.context, root, []);
    if (!("taskFile" in brief)) throw new Error(brief.error);
    for (const text of [readFileSync(brief.taskFile, "utf8"), JSON.stringify(first.content)]) {
      expect(text).toContain("Workload at attempt start");
      expect(text).toContain("neither reserves an execution slot");
      expect(text).toContain("Fields marked unavailable establish neither an allowance nor a denial");
      expect(text).toContain("Required work remains owed under pressure");
      expect(text).toContain("the creator retains that decision");
      expect(text).not.toMatch(/Work-start credits|sponsor and current-root balances|protected coordination funds|funding hold/i);
    }
    const full = JSON.parse(readFileSync(join(brief.taskFile, "..", "context.json"), "utf8"));
    expect(full.reconciliation.workload).toEqual({ available: false });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("initial failure and a changed generation preserve known scope without claiming a fresh binding", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-scope-"));
  try {
    const f = fixture(root);
    f.setCurrent({ ...f.task, generation: 2, outcome: "Different assignment" });
    const read = createTaskDecisionContext(f.context);
    const stale = packet(await read());
    expect(stale.observed.refresh.bindingCurrent).toBe(false);
    expect(stale.assignment.outcome).toBe("Review the draft");
    f.fail();
    const missing = packet(await read());
    expect(missing.observed.snapshot).toBe("attempt-start");
    expect(missing.current.result.version).toBe("v3");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("long assigned and pending messages keep actionable identity beside independent state", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-inputs-"));
  try {
    const f = fixture(root);
    const assignedMessage = `Supervisor correction: continue the existing review. ${"assigned detail ".repeat(500)}`;
    const pendingMessage = `New clarification: compare the smallest candidate. ${"pending detail ".repeat(500)}`;
    f.context.reconciliation.events.items = [inputEvent("assigned-review", assignedMessage, 71)];
    f.setCurrent({
      ...f.task,
      pendingEvents: { items: [pendingInputEvent("pending-clarification", pendingMessage, 72)], truncated: false },
    });

    const message = await createTaskDecisionContext(f.context)();
    expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThan(16 * 1024);
    const p = packet(message);
    expect(p.coverage.note).toContain("attemptInput is assigned to this attempt");
    expect(p.coverage.note).toContain("pendingInput is not yet claimed");
    const assigned = p.events.attemptInput.preview.items.preview[0];
    expect(assigned.pointer).toBe("/events/attemptInput/items/0");
    expect(assigned.preview.event.type).toBe("app.task.requested");
    expect(assigned.preview.event.data.request.id).toBe("assigned-review");
    expect(assigned.preview.event.data.request.input.kind).toBe("message");
    expect(assigned.preview.event.data.request.input.data.pointer).toBe(
      "/events/attemptInput/items/0/event/data/request/input/data",
    );
    expect(assigned.preview.event.data.request.input.data.preview.message.preview).toStartWith("Supervisor correction");

    const pending = p.events.pendingInput.preview.items.preview[0];
    expect(pending.pointer).toBe("/events/pendingInput/items/0");
    expect(pending.preview.event.type).toBe("app.input.requested");
    expect(pending.preview.event.data.idempotencyKey).toBe("pending-clarification");
    expect(pending.preview.event.data.taskId).toBe("review");
    expect(pending.preview.event.data.input.kind).toBe("message");
    expect(pending.preview.event.data.input.data.pointer).toBe("/events/pendingInput/items/0/event/data/input/data");
    expect(pending.preview.event.data.input.data.preview.message.preview).toStartWith("New clarification");
    expect(p.current.result).toEqual({ understanding: "Wednesday", version: "v3" });
    expect(p.conditions[0]).toMatchObject({ id: "approval", observation: { state: "unknown" } });
    expect(p.obligations.inputWaits.items[0].key).toBe("task:publish");

    const detail = JSON.parse(readFileSync(p.coverage.detail, "utf8"));
    expect(detail.events.attemptInput.items[0].event.data.request.input.data.message).toBe(assignedMessage);
    expect(detail.events.pendingInput.items[0].event.data.input.data.message).toBe(pendingMessage);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("continued transfer input keeps its original request identity and content pointer", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-transfer-"));
  try {
    const f = fixture(root);
    const message = `Transferred caller request must remain attributable. ${"transfer detail ".repeat(500)}`;
    f.context.reconciliation.events.continuedInputs = [inputEvent("transferred-request", message, 44)];

    const p = packet(await createTaskDecisionContext(f.context)());
    const transferred = p.events.attemptInput.preview.continuedInputs.preview[0];
    expect(transferred.pointer).toBe("/events/attemptInput/continuedInputs/0");
    expect(transferred.preview.event.type).toBe("app.task.requested");
    expect(transferred.preview.event.data.idempotencyKey).toBe("task:transferred-request");
    expect(transferred.preview.event.data.request.id).toBe("transferred-request");
    expect(transferred.preview.event.data.request.input.data.preview.message.preview).toStartWith(
      "Transferred caller request",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("work context keeps unknown result scope and incomplete obligation counts explicit", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-work-coverage-"));
  try {
    const f = fixture(root);
    f.context.reconciliation.previousAttempt = {
      attemptId: "previous", generation: 1, state: "completed",
      acceptedResult: { state: "converged", summary: "Legacy result without scope", facts: [] },
    };
    f.setCurrent({ ...f.task, currentObligations: { available: false } });
    const read = createTaskDecisionContext(f.context);
    const unknown = packet(await read());
    expect(unknown.work.retainedInputs).toEqual({ available: false });
    expect(unknown.work.previousResult.coveredInputs).toBeNull();
    f.setCurrent({ ...f.task, currentObligations: { available: true, inputWaits: {
      maxItems: 1, truncated: true, items: [{ key: "old", pending: true, conditionCount: 0,
        correlation: { input: { available: false }, admission: { available: false } } }],
    } } });
    const bounded = packet(await read());
    expect(bounded.work.retainedInputs).toEqual({ available: true, observed: 1, pendingWork: 1, truncated: true });
    f.fail();
    const fallback = packet(await read());
    expect(fallback.observed.refresh.available).toBe(false);
    expect(fallback.work).toEqual(bounded.work);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("large Unicode data stays discoverable without displacing current conclusions and approval", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-bounds-"));
  try {
    const f = fixture(root);
    const background = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`note/${i}`, '🧪"'.repeat(1000)]));
    f.setCurrent({ ...f.task, input: { background, correction: "Thursday" } });
    const message = await createTaskDecisionContext(f.context)();
    expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThan(16 * 1024);
    const p = packet(message);
    expect(p.input.omitted).toBe(true);
    expect(p.current.result.version).toBe("v3");
    expect(p.conditions[0].id).toBe("approval");
    const detail = JSON.parse(readFileSync(p.coverage.detail, "utf8"));
    expect(detail.input).toEqual({ background, correction: "Thursday" });
    expect(detail.binding).toEqual(f.context.taskBinding);
    const path = join(root, "unwritable");
    writeFileSync(path, "file");
    f.context.workspaceBrief = { taskFile: join(path, "TASK.md") };
    const withoutFile = packet(await createTaskDecisionContext(f.context)());
    expect(withoutFile.coverage.detailError).toBeTruthy();
    expect(withoutFile.observed.refresh.available).toBe(true);
    expect(withoutFile.current).toEqual(p.current);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the production transform restores current facts after compaction without accumulating briefs", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-compaction-"));
  try {
    const f = fixture(root);
    f.context.reconciliation.events.continuedInputs = [inputEvent("original", "Review remains required", 1)];
    f.context.reconciliation.previousAttempt = {
      attemptId: "previous", generation: 1, state: "completed",
      acceptedResult: { state: "converged", summary: "Draft prepared", facts: ["draft:ready"], inputKeys: [] },
    };
    const task = "Original caller request with full data";
    let supplied: string | undefined;
    const skill = {
      name: "review",
      description: "Review the evidence",
      filePath: join(root, "SKILL.md"),
      canonicalPath: join(root, "SKILL.md"),
      content: "Check the cited version before judging.",
      scope: "agent" as const,
      contentHash: "fixture-hash",
    };
    writeFileSync(skill.canonicalPath, skill.content);
    const helperSchema = Type.Object({ verdict: Type.String({ description: "App-owned review finding" }) });
    const prepared = prepareAgentExecution({
      definition: {
        name: "helper",
        description: "Review",
        systemPrompt: "App reviewer: assess evidence quality.",
        skillCatalog: { skills: new Map([[skill.name, skill]]), diagnostics: [], omittedFromPrompt: [] },
        domain: "test",
        model: fakeModel(),
        tools: [createFinishTool({ projectRoot: root })],
        compaction: true,
        contextPreparation: ({ task }) => {
          supplied = task;
          return "Review contribution only";
        },
      },
      projectRoot: root,
      sessionId: "helper-1",
      task,
      skill: "review",
      outputSchema: helperSchema,
      contextPrompt: "Host default",
      taskContext: f.context,
    });
    expect(supplied).toBe(task);
    expect(prepared.prompt).toContain("Review contribution only");
    const messages: AgentMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: "user",
      timestamp: i,
      content: [{ type: "text", text: "Old unrelated note. ".repeat(100) }],
    }));
    const requests: TranscriptContext[] = [];
    const agent = createAgentRun({
      ...prepared.runner,
      streamFn: (_model, context) => {
        requests.push(JSON.parse(JSON.stringify(context)));
        const stream = createAssistantMessageEventStream();
        const invalidFinish = requests.length === 3;
        const message = usageReply(
          invalidFinish
            ? {
                stopReason: "toolUse",
                content: [
                  {
                    type: "toolCall",
                    id: "wrong-result",
                    name: "finish",
                    arguments: { summary: "wrong", result: { state: "converged" } },
                  },
                ],
              }
            : {},
        );
        stream.push({ type: "done", reason: invalidFinish ? "toolUse" : "stop", message });
        return stream;
      },
    });
    restoreAgentMessages(agent, messages);
    await agent.prompt(prepared.prompt);
    expect(requests[0].messages.length).toBeLessThan(30);
    expect(JSON.stringify(requests[0].messages)).toContain("COMPACTED CONTEXT");
    expect(packet(requests[0].messages.at(-1)!).current.result.version).toBe("v3");
    f.setCurrent({ ...f.task, resourceVersion: 5, result: { understanding: "Thursday" } });
    await agent.prompt("Recheck the review");
    expect(packet(requests[1].messages.at(-1)!).current.result.understanding).toBe("Thursday");
    for (const request of requests) {
      const current = packet(request.messages.at(-1)!);
      expect(current.assignment.agent).toBe("task-owner");
      expect(current.assignment.creator).toEqual({ appId: "caller", taskId: "requester" });
      expect(current.work.assignedAtStart.continuingInputs).toBe(1);
      expect(current.work.previousResult.coveredInputs).toBe(0);
      expect(getCurrentSystemPrompt(request.messages)).toContain("App reviewer: assess evidence quality.");
      expect(getCurrentSystemPrompt(request.messages)).toContain("a helper still owes only its assigned contribution");
      expect(getCurrentSystemPrompt(request.messages)).toContain(skill.canonicalPath);
      expect(getCurrentSystemPrompt(request.messages)).not.toContain("workflow step");
      const finish = getCurrentTools(request.messages).find((tool) => tool.name === "finish")!;
      expect(finish.parameters.properties.result).toEqual(helperSchema);
      expect(JSON.stringify(request.messages).split("Task decision brief")).toHaveLength(2);
    }
    expect(JSON.stringify(agent.state.messages)).not.toContain("Task decision brief");
    await agent.prompt("Return the review");
    expect(requests).toHaveLength(4);
    const rejected = requests[3].messages.find(
      (message) => message.role === "toolResult" && message.toolCallId === "wrong-result",
    );
    expect(rejected).toMatchObject({ isError: true });
    expect(JSON.stringify(rejected)).toContain("verdict");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("TASK.md and decision brief keep assigned review input and non-request event previews distinct from empty pendingEvents", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-missed-review-"));
  try {
    const f = fixture(root);
    const largeReviewFinding = `Reviewer found missing null-check in parser.ts. ${"evidence line ".repeat(200)}`;
    f.context.reconciliation.events.items = [
      {
        eventId: 91,
        observedAt: "2026-09-29T10:00:00.000Z",
        event: {
          type: "evaluation.report.published",
          target: { appId: "sample", taskId: "review" },
          data: {
            requestId: "app_8fc834e0",
            verdict: "revise",
            finding: largeReviewFinding,
          },
        },
      } as any,
    ];
    f.context.reconciliation.events.continuedInputs = [
      inputEvent("earlier-unanswered", "Keep backwards compatibility", 55),
    ];
    delete f.context.workspaceBrief;
    const brief = prepareTaskWorkspaceContext(f.context, root, []);
    if (!("taskFile" in brief)) throw new Error(brief.error);
    const taskMd = readFileSync(brief.taskFile, "utf8");
    expect(taskMd).toContain("## Assigned vs. pending input");
    expect(taskMd).toContain("`/reconciliation/events/items/0` — evaluation.report.published `app_8fc834e0`");
    expect(taskMd).toContain("`/reconciliation/events/continuedInputs/0` — app.task.requested `earlier-unanswered`");
    expect(taskMd).toContain("Unclaimed pending input at attempt start (`/reconciliation/task/pendingEvents/items`): 0");

    const message = await createTaskDecisionContext(f.context)();
    const text = (message.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("an empty pendingEvents / pendingInput window NEVER means this attempt has no assigned review");
    const p = packet(message);
    expect(p.work.assignedAtStart).toEqual({ newEvents: 1, continuingInputs: 1, moreEvents: false });
    expect(p.work.pendingUnclaimed).toEqual({ available: true, newEvents: 0, moreEvents: false });
    const reviewPreview = p.events.attemptInput.preview.items.preview[0];
    expect(reviewPreview.pointer).toBe("/events/attemptInput/items/0");
    expect(reviewPreview.preview.event.type).toBe("evaluation.report.published");
    expect(reviewPreview.preview.event.data.pointer).toBe("/events/attemptInput/items/0/event/data");
    expect(reviewPreview.preview.event.data.preview.requestId).toBe("app_8fc834e0");
    expect(reviewPreview.preview.event.data.preview.finding.preview).toStartWith("Reviewer found missing null-check");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the owner brief refreshes creator-owned work independently of empty grouping children", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-created-work-"));
  try {
    const f = fixture(root);
    let items = [
      {
        appId: "another-app",
        taskId: "finite-contribution",
        generation: 1,
        resourceVersion: 4,
        status: "idle" as const,
        outcomePreview: "Assess one report snapshot",
        summaryPreview: "Assessment returned",
        acceptedAttempt: { id: "accepted-report", generation: 1 },
      },
      {
        appId: "sample",
        taskId: "standing-service",
        generation: 2,
        resourceVersion: 7,
        status: "waiting" as const,
        outcomePreview: "Handle later notices on this declared route",
        summaryPreview: "Current cycle complete",
        acceptedAttempt: { id: "accepted-cycle", generation: 2 },
      },
    ];
    let reads = 0;
    f.context.taskRead.created = async (options) => {
      expect(options).toEqual({ limit: 5 });
      reads++;
      return {
        creator: { appId: "sample", taskId: "review" },
        observedAt: `observation-${reads}`,
        items,
        nextCursor: "more-creator-work",
      };
    };
    const brief = createTaskDecisionContext(f.context);
    const first = packet(await brief());
    expect(first.related.childrenAtAttemptStart).toEqual({ live: [], completed: [] });
    expect(first.createdAssignments).toEqual({
      available: true,
      creator: { appId: "sample", taskId: "review" },
      items,
      nextCursor: "more-creator-work",
    });
    expect(first.observed.createdAssignmentsReadAt).toBe("observation-1");
    const detail = JSON.parse(readFileSync(first.coverage.createdAssignmentsDetail, "utf8"));
    expect(detail.createdAssignments.items).toEqual(items);
    // A real close removes only the finite contribution from the read. The
    // standing assignment remains visible rather than becoming a completion gate.
    items = items.slice(1);
    const second = packet(await brief());
    expect(second.createdAssignments.items.map((item: { taskId: string }) => item.taskId)).toEqual([
      "standing-service",
    ]);
    expect(second.observed.createdAssignmentsReadAt).toBe("observation-2");
    expect(f.context.reconciliation.children).toEqual({ live: [], completed: [] });
    expect(reads).toBe(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([false, true])(
  "unchanged creator discovery reuses decision detail while observation times refresh (has work: %s)",
  async (hasWork) => {
    const root = mkdtempSync(join(tmpdir(), "decision-created-dedup-"));
    try {
      const f = fixture(root);
      const background = "Large retained source detail. ".repeat(4_000);
      f.setCurrent({ ...f.task, input: { background } });
      const item = {
        appId: "another-app",
        taskId: "finite-contribution",
        generation: 1,
        resourceVersion: 4,
        status: "idle" as const,
        outcomePreview: "Assess one report snapshot",
        summaryPreview: "Assessment returned",
        acceptedAttempt: { id: "accepted-report", generation: 1 },
      };
      let items = hasWork ? [item] : [];
      let reads = 0;
      f.context.taskRead.created = async () => ({
        creator: { appId: "sample", taskId: "review" },
        observedAt: `observation-${++reads}`,
        items,
        nextCursor: "more-creator-work",
      });
      const brief = createTaskDecisionContext(f.context);
      const first = packet(await brief());
      for (let index = 2; index <= 5; index++) {
        const current = packet(await brief());
        expect(current.coverage.detail).toBe(first.coverage.detail);
        expect(current.observed.createdAssignmentsReadAt).toBe(`observation-${index}`);
        expect(current.createdAssignments).toEqual(first.createdAssignments);
      }
      expect(first.observed.createdAssignmentsReadAt).toBe("observation-1");
      const detail = JSON.parse(readFileSync(first.coverage.createdAssignmentsDetail, "utf8"));
      expect(detail.createdAssignments.items).toEqual(items);
      expect(detail.createdAssignments.nextCursor).toBe("more-creator-work");
      expect(detail.createdAssignments.observedAt).toBeUndefined();
      expect(JSON.parse(readFileSync(first.coverage.detail, "utf8")).input.background).toBe(background);
      expect(readdirSync(dirname(first.coverage.detail))).toHaveLength(1);
      // A changed assignment remains fresh and receives its own immutable detail.
      items = [{ ...item, resourceVersion: 5, summaryPreview: "A correction remains owed" }];
      const changed = packet(await brief());
      expect(changed.coverage.detail).toBe(first.coverage.detail);
      expect(changed.coverage.createdAssignmentsDetail).not.toBe(first.coverage.createdAssignmentsDetail);
      expect(changed.createdAssignments.items).toEqual(items);
      expect(readdirSync(dirname(first.coverage.detail))).toHaveLength(1);
      expect(readdirSync(dirname(first.coverage.createdAssignmentsDetail))).toHaveLength(2);
      expect(reads).toBe(6);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("frequent creator-page updates do not duplicate large unchanged owner detail", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-created-independent-"));
  try {
    const f = fixture(root);
    const background = "Large retained owner evidence. ".repeat(4_000);
    f.setCurrent({ ...f.task, input: { background } });
    let version = 1;
    f.context.taskRead.created = async () => ({
      creator: { appId: "sample", taskId: "review" },
      observedAt: `observation-${version}`,
      items: [
        {
          appId: "another-app",
          taskId: "contribution",
          generation: 1,
          resourceVersion: version,
          status: "running",
          outcomePreview: "Complete the delegated assessment",
        },
      ],
    });
    const brief = createTaskDecisionContext(f.context);
    const first = packet(await brief());
    const ownerBytes = readFileSync(first.coverage.detail, "utf8");
    const createdFiles = new Set([first.coverage.createdAssignmentsDetail]);
    for (version = 2; version <= 12; version++) {
      const current = packet(await brief());
      expect(current.coverage.detail).toBe(first.coverage.detail);
      expect(current.createdAssignments.items[0].resourceVersion).toBe(version);
      const created = JSON.parse(readFileSync(current.coverage.createdAssignmentsDetail, "utf8"));
      expect(created.createdAssignments.items[0].resourceVersion).toBe(version);
      expect(created.binding).toEqual(f.context.taskBinding);
      expect(current.coverage.createdAssignmentsDetail).not.toBe(first.coverage.createdAssignmentsDetail);
      createdFiles.add(current.coverage.createdAssignmentsDetail);
    }
    expect(createdFiles.size).toBe(12);
    expect(readFileSync(first.coverage.detail, "utf8")).toBe(ownerBytes);
    expect(readdirSync(dirname(first.coverage.detail))).toHaveLength(1);
    expect(ownerBytes).toContain(background);
    for (const file of createdFiles) {
      expect(readFileSync(file, "utf8")).not.toContain(background);
      expect(readFileSync(file, "utf8").length).toBeLessThan(2_000);
    }
    // Independent source changes still produce new immutable owner evidence.
    f.setCurrent({ ...f.task, input: { background }, resourceVersion: 4, summary: "Owner reviewed evidence" });
    expect(packet(await brief()).coverage.detail).not.toBe(first.coverage.detail);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each(["decisions", "created-assignments"])(
  "decision sources keep independent errors and resolvable creator previews when %s cannot be saved",
  async (failedDirectory) => {
    const root = mkdtempSync(join(tmpdir(), "decision-created-sources-"));
    try {
      const f = fixture(root);
      const background = "Owner source payload. ".repeat(4_000);
      f.setCurrent({ ...f.task, input: { background } });
      const items = Array.from({ length: 5 }, (_, index) => ({
        appId: "another-app",
        taskId: `contribution-${index}`,
        generation: 1,
        resourceVersion: 4,
        status: "idle" as const,
        outcomePreview: "🔎".repeat(240),
        summaryPreview: "✅".repeat(240),
      }));
      f.context.taskRead.created = async () => ({
        creator: { appId: "sample", taskId: "review" },
        observedAt: "current-page",
        items,
        nextCursor: "more-creator-work",
      });
      const workspace = f.context.workspaceBrief;
      if (!workspace || !("taskFile" in workspace)) throw new Error("Expected fixture workspace");
      writeFileSync(join(dirname(workspace.taskFile), failedDirectory), "not a directory");
      const current = packet(await createTaskDecisionContext(f.context)());
      expect(current.createdAssignments.omitted).toBe(true);
      expect(current.createdAssignments.pointer).toBe("/createdAssignments");
      expect(Buffer.byteLength(JSON.stringify(current.createdAssignments))).toBeLessThanOrEqual(1_600);
      expect(current.observed.createdAssignmentsReadAt).toBe("current-page");
      expect(current.current.summary).toBe(f.task.summary);
      expect(current.coverage.note).toContain("createdAssignmentsDetail");
      expect(current.coverage.note).toContain("scoped reads");
      if (failedDirectory === "decisions") {
        expect(current.coverage.detail).toBeUndefined();
        expect(current.coverage.detailError).toBeTruthy();
        expect(current.coverage.createdAssignmentsDetailError).toBeUndefined();
        const source = JSON.parse(readFileSync(current.coverage.createdAssignmentsDetail, "utf8"));
        expect(source.binding).toEqual(f.context.taskBinding);
        expect(source.createdAssignments.items).toEqual(items);
        expect(source.createdAssignments.nextCursor).toBe("more-creator-work");
        const checkPointers = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          const node = value as Record<string, unknown>;
          if (node.omitted) {
            expect(typeof node.pointer).toBe("string");
            const keys = (node.pointer as string)
              .split("/")
              .slice(1)
              .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"));
            expect(keys.reduce((target, key) => target[key], source)).not.toBeUndefined();
          }
          Object.values(node).forEach(checkPointers);
        };
        checkPointers(current.createdAssignments);
      } else {
        expect(current.coverage.createdAssignmentsDetail).toBeUndefined();
        expect(current.coverage.createdAssignmentsDetailError).toBeTruthy();
        expect(current.coverage.detailError).toBeUndefined();
        const source = JSON.parse(readFileSync(current.coverage.detail, "utf8"));
        expect(source.binding).toEqual(f.context.taskBinding);
        expect(source.input.background).toBe(background);
        expect(source.createdAssignments).toBeUndefined();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("missing, failed or mismatched creator discovery remains unavailable without losing the owner's input", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-created-unavailable-"));
  try {
    const f = fixture(root);
    f.context.reconciliation.events.items = [inputEvent("owed", "Return the original result", 71)];
    const brief = createTaskDecisionContext(f.context);
    expect(packet(await brief()).createdAssignments).toMatchObject({ available: false });
    f.context.taskRead.created = async () => ({
      creator: { appId: "sample", taskId: "review" },
      observedAt: "last-successful-read",
      items: [],
    });
    expect(packet(await brief()).observed.createdAssignmentsReadAt).toBe("last-successful-read");
    f.context.taskRead.created = async () => {
      throw new Error("Created work temporarily unavailable");
    };
    const failed = packet(await brief());
    expect(failed.createdAssignments).toEqual({
      available: false,
      reason: "Error: Created work temporarily unavailable",
    });
    expect(failed.events.attemptInput.items).toHaveLength(1);
    expect(failed.observed.createdAssignmentsReadAt).toBeUndefined();
    f.context.taskRead.created = async () => ({
      creator: { appId: "other", taskId: "other-owner" },
      observedAt: "now",
      items: [],
    });
    const mismatched = packet(await brief());
    expect(mismatched.createdAssignments.available).toBe(false);
    expect(mismatched.createdAssignments.reason).toContain("does not match");
    expect(mismatched.observed.createdAssignmentsReadAt).toBeUndefined();
    expect(mismatched.assignment).toEqual(failed.assignment);
    expect(f.context.reconciliation.events.items).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
