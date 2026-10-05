import { describe, expect, setSystemTime, test } from "bun:test";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import {
  createTestAppRead,
  createTestAppWorkflowContext as createSdkTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { EvidenceStore } from "../../../../../shared/tools/task-evidence.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { taskForInput, taskInputForEvent } from "../../../app.ts";
import {
  assessmentContext,
  claimSemanticAllowance,
  reviewTaskOutcome,
} from "./task-outcome-review.ts";
import {
  readSubjectTask,
  type PublicCommand,
} from "./lib/public-task-evidence.ts";
import {
  hashReport,
  listTaskReports,
  markTaskReportPublished,
  renderTaskReportMarkdown,
  resolveTaskReportPath,
  taskReportPaths,
  TASK_OUTCOME_RUBRIC_VERSION,
  writeImmutable,
} from "./lib/task-report-store.ts";
import { reviewerProfile } from "./lib/reviewer-profile.ts";

const TEST_APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
function createTestAppWorkflowContext(
  options: Parameters<typeof createSdkTestAppWorkflowContext>[0],
) {
  const supplied = options.workspace;
  const appRoot =
    supplied?.appRoot &&
    existsSync(join(supplied.appRoot, "criteria", "criteria.md"))
      ? supplied.appRoot
      : TEST_APP_ROOT;
  return createSdkTestAppWorkflowContext({
    ...options,
    workspace: supplied
      ? { ...supplied, appRoot }
      : {
          root: TEST_APP_ROOT,
          appRoot,
          projectRoot: TEST_APP_ROOT,
          output: TEST_APP_ROOT,
        },
  });
}

const appId = "sample";
const taskId = "goal/one";
const VALIDITY_NOW = Date.UTC(2026, 8, 17);
const appTask = {
  id: taskId,
  status: "up-to-date",
  generation: 1,
  creator: { appId },
  outcome: "Ship it",
  acceptance: ["verified"],
  input: {
    kind: "goal",
    data: {
      outcome: "Ship it",
      acceptance: ["verified"],
      constraints: ["Keep creator provenance and original input"],
    },
  },
};
const detail = {
  appId,
  taskId,
  ref: "abc12345",
  generation: 1,
  resourceVersion: 2,
  outcome: "Ship it",
  acceptance: ["verified"],
  facts: ["commit:abc"],
  status: "up-to-date",
  history: [],
  historyTruncated: false,
  diagnostics: { owner: appId, attemptCount: 1, conditions: [] },
};

function assessmentSubject(
  currentDetail: Record<string, unknown>,
  currentObligations?: Record<string, unknown>,
) {
  return {
    disposition: "eligible" as const,
    reason: "verified",
    appId,
    taskId,
    evidenceHash: "a".repeat(64),
    task: {
      appTask: {
        ...appTask,
        ...(currentObligations ? { currentObligations } : {}),
      },
      detail: currentDetail,
    },
  };
}

function condition(
  id: string,
  observedAt: string,
  reviewAfterMs: number,
  state: "unknown" | "false" | "true" = "unknown",
) {
  return {
    id,
    condition: {
      metadata: { id, generation: 1, resourceVersion: 1 },
      spec: {
        type: "time.reached",
        subject: `condition:${id}`,
        expected: true,
        owner: "app:sample",
        reviewAfterMs,
      },
      status: {
        observedGeneration: 1,
        state,
        observed: state === "true",
        observedAt,
      },
    },
  };
}

function reader(
  currentDetail: () => Record<string, unknown> = () => detail,
  currentAppTask: () => Record<string, unknown> = () => appTask,
): PublicCommand {
  return async (command) => {
    if (command.type === "apps.list")
      return {
        type: "ok",
        command: "apps.list",
        apps: [{ id: appId, owner: "worker" }],
      };
    if (command.type === "app.tasks.list")
      return {
        type: "ok",
        command: "app.tasks.list",
        appId,
        tasks: [{ id: taskId }],
      };
    if (command.type === "app.task.get")
      return {
        type: "ok",
        command: "app.task.get",
        appId,
        taskId: command.taskId,
        task: currentAppTask(),
      };
    return { type: "ok", command: "task.get", task: currentDetail() };
  };
}

function reconciliation() {
  return {
    appId: "evaluation",
    taskId: "review/sample-goal-one",
    generation: 1,
    resourceVersion: 7,
    attemptId: "attempt-one",
    agent: "evaluator",
    mode: "achieve" as const,
    outcome: "Review one external Task",
    acceptance: ["Publish an immutable report"],
    input: { appId, taskId },
    children: { live: [], completed: [] },
    events: { items: [] },
  };
}

const judgment = {
  disposition: "assessed" as const,
  responsibility: "sample owns the requested delivery.",
  summary: "Delivered with verification.",
  findings: [],
  verification: ["commit abc read back"],
  delivery: "verified",
};

function factsOf(
  result: Awaited<ReturnType<typeof reviewTaskOutcome>>,
): string[] {
  const output = result.output as { facts?: unknown } | undefined;
  return Array.isArray(output?.facts)
    ? output.facts.filter((fact): fact is string => typeof fact === "string")
    : [];
}

describe("Task outcome review", () => {
  test("retains detector evidence in the report without making quiet polling stale Task evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-observer-"));
    let prompt = "";
    let checkedAt = 100;
    let observerReads = 0;
    const base = reader(
      () => ({ ...detail, status: "waiting" }),
      () => ({
        ...appTask,
        conditions: [
          {
            id: "build",
            type: "build.state",
            subject: "resource:42",
            expected: {
              source: "app:builds:observer:status",
              field: "state",
              equals: "passed",
            },
            reviewAfterMs: 3_600_000,
            observation: { state: "unknown" },
          },
        ],
      }),
    );
    const command: PublicCommand = async (cmd) => {
      if (cmd.type !== "apps.list" || cmd.appId !== "builds") return base(cmd);
      observerReads++;
      return {
        command: "apps.list",
        apps: [
          {
            id: "builds",
            observations: [{ id: "status", type: "build.state" }],
            observerHealth: [
              {
                id: "status",
                available: true,
                running: false,
                lastCompletedAt: checkedAt,
                resources: [
                  { resource: "42", checkedAt, lastSuccessAt: checkedAt },
                ],
              },
            ],
          },
        ],
      };
    };
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId, assessmentPurpose: "ongoing" },
      callAgent: async (_agent, value) => {
        prompt = String(value);
        checkedAt = 200; // A healthy check while the reviewer works is not a Task change.
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "fixture",
          output: judgment,
        };
      },
    });
    try {
      const result = await reviewTaskOutcome(ctx, command, root);
      const path = factsOf(result)
        .find((fact) => fact.startsWith("report-facts:"))!
        .slice(13);
      const payload = JSON.parse(readFileSync(join(root, path), "utf8"));
      expect(prompt).toContain("Supplementary observer evidence");
      expect(prompt).toContain('"lastSuccessAt":100');
      expect(payload.observerEvidence.items[0]).toMatchObject({
        conditionId: "build",
        available: true,
        resource: { resource: "42", lastSuccessAt: 100 },
      });
      expect(payload.evidence).not.toHaveProperty("observerEvidence");
      expect(payload.freshness.status).toBe("current");
      const repeated = await reviewTaskOutcome(ctx, command, root);
      expect(
        factsOf(repeated).find((fact) => fact.startsWith("report-facts:")),
      ).toBe(`report-facts:${path}`);
      expect(observerReads).toBe(1); // Reuse the staged report; no new polling or assessment.
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("publishes process separately from a valid wait and freshness binds inspected tool bytes", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-process-"));
    let toolOutput =
      "Repeated the same discovery after the answer was available";
    let prompt = "";
    const source = ".state/sessions/s_subject/session.jsonl";
    const base = reader(() => ({
      ...detail,
      status: "waiting",
      history: [
        {
          eventId: 123,
          eventType: "project.task.reconciled",
          generation: 1,
          attemptId: "a1",
        },
      ],
    }));
    const command: PublicCommand = async (cmd) =>
      cmd.type === "task.attempts.read"
        ? {
            version: 1,
            available: true,
            appId,
            taskId,
            attemptId: "a1",
            generation: 1,
            sessionId: "s_subject",
          }
        : cmd.type === "event.get"
          ? {
              command: "event.get",
              event: {
                id: 123,
                type: "project.task.reconciled",
                data: {
                  project: appId,
                  taskId,
                  generation: 1,
                  attemptId: "a1",
                  workflowRunId: "s_subject",
                },
              },
            }
          : base(cmd);
    const sessionRead = async (_id: string, transcript: boolean) =>
      transcript
        ? {
            sessionId: "s_subject",
            source,
            messageCount: 1,
            messages: [
              {
                role: "tool_result",
                rawLine: 4,
                rawSource: source,
                toolCallId: "call",
                content: toolOutput,
              },
            ],
          }
        : {
            session: {
              sessionId: "s_subject",
              app_id: appId,
              task_id: taskId,
              task_generation: 1,
              attempt_id: "a1",
              agent: "worker",
              status: "done",
            },
          };
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId, assessmentPurpose: "ongoing" },
      callAgent: async (_agent, value) => {
        prompt = String(value);
        toolOutput = "changed after inspection";
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "fixture",
          output: {
            ...judgment,
            summary:
              "Wait is valid; completed work had avoidable repetition; process scope is bounded.",
            findings: ["Process: a1/s_subject/4 repeated discovery"],
          },
        };
      },
    });
    const result = await reviewTaskOutcome(ctx, command, root, sessionRead);
    expect(prompt).toContain("Repeated the same discovery");
    expect(prompt).toContain("(1) current state/wait coherence");
    expect(prompt).toContain(
      "it does not invalidate an otherwise supported wait",
    );
    const path = factsOf(result)
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    const payload = JSON.parse(readFileSync(join(root, path), "utf8"));
    expect(payload.evidence.detail.status).toBe("waiting");
    expect(
      payload.evidence.readBack.process.attempts[0].messages[0].text,
    ).toContain("Repeated");
    expect(payload.judgment.findings).toEqual([
      "Process: a1/s_subject/4 repeated discovery",
    ]);
    expect(payload.freshness.status).toBe("stale");
  });
  test("uses current Host checkpoints instead of stale creation or diagnostic timestamps", () => {
    const observedAt = "2026-09-27T01:55:22.616Z";
    const reviewAt = Date.parse("2026-09-28T01:55:22.616Z");
    const subject = assessmentSubject({
      ...detail,
      diagnostics: {
        conditions: [
          condition("approval", "2026-09-25T01:55:22.616Z", 86400000),
        ],
      },
    });
    Object.assign(subject.task.appTask, {
      conditions: [
        {
          id: "approval",
          reviewAfterMs: 86400000,
          observation: {
            state: "unknown",
            createdAt: "2026-09-25T01:55:22.616Z",
            observedAt,
            reviewAt,
          },
        },
      ],
    });
    expect(
      assessmentContext(subject, "ongoing", Date.parse("2026-09-27T14:00:00Z"))
        .validity,
    ).toEqual({
      phase: "before-due",
      dueAt: reviewAt,
      boundaries: [
        { conditionId: "approval", dueAt: reviewAt, phase: "before-due" },
      ],
    });
    expect(assessmentContext(subject, "ongoing", reviewAt).validity.phase).toBe(
      "due",
    );
    Object.assign(subject.task.appTask, { conditions: [] });
    expect(assessmentContext(subject, "ongoing", reviewAt).validity.phase).toBe(
      "unknown",
    );
  });

  test("derives every unresolved review boundary from the production task.get envelope", () => {
    const observedAt = "2026-09-18T12:00:00.000Z";
    const subject = assessmentSubject({
      ...detail,
      // Guessed lookalikes outside diagnostics must never become deadlines.
      conditions: [{ dueAt: 1 }],
      diagnostics: {
        ...detail.diagnostics,
        conditions: [
          condition("later", observedAt, 120_000),
          condition("first", observedAt, 60_000, "false"),
          condition("resolved", observedAt, 60_000, "true"),
        ],
      },
    });
    const before = assessmentContext(
      subject,
      "ongoing",
      Date.parse(observedAt) + 30_000,
    );
    const afterFirst = assessmentContext(
      subject,
      "ongoing",
      Date.parse(observedAt) + 90_000,
    );
    const afterBoth = assessmentContext(
      subject,
      "ongoing",
      Date.parse(observedAt) + 150_000,
    );

    expect(before.validity).toEqual({
      phase: "before-due",
      dueAt: Date.parse(observedAt) + 60_000,
      boundaries: [
        {
          conditionId: "first",
          dueAt: Date.parse(observedAt) + 60_000,
          phase: "before-due",
        },
        {
          conditionId: "later",
          dueAt: Date.parse(observedAt) + 120_000,
          phase: "before-due",
        },
      ],
    });
    expect(afterFirst.validity.boundaries.map(({ phase }) => phase)).toEqual([
      "due",
      "before-due",
    ]);
    expect(afterBoth.validity.boundaries.map(({ phase }) => phase)).toEqual([
      "due",
      "due",
    ]);
    expect(
      new Set([
        before.validityIdentity,
        afterFirst.validityIdentity,
        afterBoth.validityIdentity,
      ]).size,
    ).toBe(3);
  });

  test("combines Task, input-wait, and independent later Condition deadlines from real public endpoint shapes", async () => {
    const first = VALIDITY_NOW + 60_000;
    const later = VALIDITY_NOW + 180_000;
    const subject = await readSubjectTask(
      { appId, taskId },
      reader(
        () => ({
          ...detail,
          // Human task.get lookalikes are not authoritative scheduling fields.
          currentObligations: { available: true, reviewAt: 1 },
          diagnostics: {
            ...detail.diagnostics,
            conditions: [
              condition(
                "middle-condition",
                new Date(VALIDITY_NOW).toISOString(),
                120_000,
              ),
            ],
          },
        }),
        () => ({
          ...appTask,
          currentObligations: {
            available: true,
            reviewAt: first,
            inputWaits: {
              items: [
                { key: "input-without-deadline", conditionCount: 0 },
                { key: "later-input", reviewAt: later, conditionCount: 1 },
              ],
              maxItems: 20,
              truncated: false,
            },
          },
        }),
      ),
    );

    const before = assessmentContext(subject, "ongoing", VALIDITY_NOW);
    const afterFirst = assessmentContext(subject, "ongoing", first);
    expect(before.validity).toEqual({
      phase: "before-due",
      dueAt: first,
      boundaries: [
        { taskReviewAt: true, dueAt: first, phase: "before-due" },
        {
          conditionId: "middle-condition",
          dueAt: VALIDITY_NOW + 120_000,
          phase: "before-due",
        },
        { inputWaitKey: "later-input", dueAt: later, phase: "before-due" },
      ],
    });
    expect(afterFirst.validity.phase).toBe("due");
    expect(afterFirst.validity.boundaries).toEqual([
      { taskReviewAt: true, dueAt: first, phase: "due" },
      {
        conditionId: "middle-condition",
        dueAt: VALIDITY_NOW + 120_000,
        phase: "before-due",
      },
      { inputWaitKey: "later-input", dueAt: later, phase: "before-due" },
    ]);
    expect(afterFirst.validityIdentity).not.toBe(before.validityIdentity);
  });

  test("keeps no-deadline obligations unknown and identities renewed waits", () => {
    const withoutDeadline = assessmentSubject(detail, {
      available: true,
      inputWaits: {
        items: [{ key: "open-input", conditionCount: 0 }],
        maxItems: 20,
        truncated: false,
      },
    });
    expect(
      assessmentContext(withoutDeadline, "ongoing", VALIDITY_NOW).validity,
    ).toEqual({ phase: "unknown", dueAt: null, boundaries: [] });

    const renewed = (reviewAt: number) =>
      assessmentSubject(detail, {
        available: true,
        inputWaits: {
          items: [{ key: "open-input", reviewAt, conditionCount: 0 }],
          maxItems: 20,
          truncated: false,
        },
      });
    const original = assessmentContext(
      renewed(VALIDITY_NOW + 60_000),
      "ongoing",
      VALIDITY_NOW,
    );
    const replacement = assessmentContext(
      renewed(VALIDITY_NOW + 120_000),
      "ongoing",
      VALIDITY_NOW,
    );
    expect(original.validity.boundaries).toEqual([
      {
        inputWaitKey: "open-input",
        dueAt: VALIDITY_NOW + 60_000,
        phase: "before-due",
      },
    ]);
    expect(replacement.validityIdentity).not.toBe(original.validityIdentity);
  });

  test("publishes an ongoing assessment with its rubric and due-phase identity", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-ongoing-"));
    const observedAt = new Date(Date.now() - 120_000).toISOString();
    const ongoingDetail = {
      ...detail,
      status: "attention",
      diagnostics: {
        ...detail.diagnostics,
        conditions: [condition("review", observedAt, 60_000, "false")],
      },
    };
    const events: Array<Record<string, any>> = [];
    let prompt = "";
    const result = await reviewTaskOutcome(
      createTestAppWorkflowContext({
        input: { appId, taskId, assessmentPurpose: "ongoing" },
        reconciliation: reconciliation(),
        callAgent: async (_agent, value) => {
          prompt = String(value);
          return {
            id: "s_ongoing",
            kind: "agent",
            status: "done",
            summary: "done",
            output: judgment,
          };
        },
        emit: async (event) => events.push(event as Record<string, any>),
      }),
      reader(() => ongoingDetail),
      root,
    );
    const facts = factsOf(result);
    const reportPath = facts
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    const report = JSON.parse(readFileSync(join(root, reportPath), "utf8"));
    expect(report).toMatchObject({
      rubricVersion: "task-obligation-v1",
      assessment: {
        purpose: "ongoing",
        validity: {
          phase: "due",
          boundaries: [{ conditionId: "review", phase: "due" }],
        },
      },
    });
    expect(events[0]?.data).toMatchObject({
      assessmentPurpose: "ongoing",
      rubricVersion: "task-obligation-v1",
      validityIdentity: report.assessment.validityIdentity,
    });
    expect(events[0]?.localKey).toMatch(
      /^task-report-[a-f0-9]{16}-[a-f0-9]{12}$/,
    );
    expect(prompt).toContain(
      "App status done plus Task detail up-to-date with terminal=false and ready=false is coherent",
    );
    expect(prompt).toContain("no review deadline is required");
    expect(prompt).toContain(
      "assessed and insufficient-evidence are both successful evaluator judgments",
    );
    expect(prompt).toContain(
      "do not write Markdown, JSON, or any other task-outcome report file",
    );
    expect(prompt).toContain(
      "Separate delivery verification from substantive claim support",
    );
    expect(prompt).toContain(
      "read available conflicting controls, evaluations, corrections, or falsifiers",
    );
    expect(prompt).toContain(
      "Author-created probes may substantiate a claim when they test the relevant path",
    );
    expect(prompt).toContain(
      "accepted Task facts that merely repeat the author's claim add no independent support",
    );
  });

  test("passes the combined real public Task views to the model and publishes immutable artifacts", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-"));
    const events: Array<Record<string, unknown>> = [];
    let prompt = "";
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      reconciliation: reconciliation(),
      workspace: { root, appRoot: root, projectRoot: root, output: root },
      callAgent: async (_agent, value) => {
        prompt = String(value);
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
    });

    const result = await reviewTaskOutcome(ctx, reader(), root);
    const facts = factsOf(result);
    expect(result.status).toBe("done");
    expect(facts).toContain("review-disposition:assessed");
    expect(facts).toContain("subject:sample/goal/one");
    expect(facts).toContain("execution:s_judge");
    expect(prompt).toContain('"creator":{"appId":"sample"}');
    expect(prompt).toContain("Keep creator provenance and original input");
    expect(prompt).toContain('"resourceVersion":2');

    const evidenceHash = facts
      .find((fact) => fact.startsWith("evidence-hash:"))!
      .slice(14);
    const report = facts.find((fact) => fact.startsWith("report:"))!.slice(7);
    const reportFacts = facts
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    expect(report).toContain(
      `${taskId.replace("/", "-")}-${evidenceHash.slice(0, 16)}`,
    );
    expect(reportFacts).toContain(evidenceHash.slice(0, 16));
    expect(existsSync(join(root, report))).toBeTrue();
    expect(existsSync(join(root, reportFacts))).toBeTrue();
    expect(readFileSync(join(root, report), "utf8")).toContain(
      "Delivered with verification.",
    );
    expect(
      JSON.parse(readFileSync(join(root, reportFacts), "utf8")),
    ).toMatchObject({
      rubricVersion: "task-outcome-v2",
      sourceRevision: "unavailable:not-exposed-to-workflow",
      disposition: "assessed",
      evidence: {
        appTask: { creator: { appId: "sample" } },
        detail: { resourceVersion: 2 },
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "evaluation.task_report_published",
      localKey: `task-report-${evidenceHash.slice(0, 16)}`,
      data: { appId, taskId, evidenceHash },
    });
  });

  test("calls the dedicated DeepSeek agent and attributes its separate report", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-deepseek-"));
    const appRoot = mkdtempSync(join(tmpdir(), "evaluation-app-root-"));
    mkdirSync(join(appRoot, "criteria"));
    writeFileSync(
      join(appRoot, "criteria", "criteria.md"),
      "UNIQUE APP ROOT RUBRIC",
    );
    let calledAgent = "";
    let suppliedPrompt = "";
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId, reviewer: "evaluator-deepseek" },
      reconciliation: reconciliation(),
      workspace: { root, appRoot, projectRoot: appRoot, output: root },
      callAgent: async (agent, prompt) => {
        calledAgent = agent;
        suppliedPrompt = prompt;
        return {
          id: "s_deepseek",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
    });

    const result = await reviewTaskOutcome(ctx, reader(), root);
    const facts = factsOf(result);
    expect(calledAgent).toBe("evaluator-deepseek");
    expect(suppliedPrompt).toContain("UNIQUE APP ROOT RUBRIC");
    expect(suppliedPrompt).toContain(
      "assessed and insufficient-evidence are both successful evaluator judgments",
    );
    expect(suppliedPrompt).toContain(
      "do not write Markdown, JSON, or any other task-outcome report file",
    );
    expect(facts).toContain("reviewer:evaluator-deepseek");
    expect(facts).toContain("configured-model:deepseek-v4-flash");
    const reportFacts = facts
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    expect(reportFacts).toStartWith("task-outcomes/evaluator-deepseek/");
    expect(
      JSON.parse(readFileSync(join(root, reportFacts), "utf8")),
    ).toMatchObject({
      evaluator: {
        reviewer: "evaluator-deepseek",
        configuredModel: "deepseek-v4-flash",
        observedModel: "unknown:not-exposed-to-workflow",
        executionId: "s_deepseek",
      },
    });
  });

  test("reuses an unchanged accepted report before calling the model", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-reuse-"));
    let accepted: Record<string, unknown> | null = null;
    let modelCalls = 0;
    const read = createTestAppRead({
      tasks: {
        get: async () => accepted,
      },
    });
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      reconciliation: reconciliation(),
      read,
      workspace: { root, appRoot: root, projectRoot: root, output: root },
      callAgent: async () => {
        modelCalls += 1;
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
    });

    const first = await reviewTaskOutcome(ctx, reader(), root);
    accepted = { id: "review/sample-goal-one", result: first.output };
    const second = await reviewTaskOutcome(ctx, reader(), root);

    expect(modelCalls).toBe(1);
    expect(second.summary).toBe(
      "Reused accepted evaluation for unchanged sample/goal/one.",
    );
    expect(factsOf(second)).toEqual(factsOf(first));
  });

  test("presentation churn reuses immutable staged report instead of colliding or paying for another judgment", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-presentation-"));
    let calls = 0;
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      callAgent: async () => {
        calls++;
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
    });
    const first = await reviewTaskOutcome(ctx, reader(), root);
    const report = factsOf(first)
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    const original = readFileSync(join(root, report), "utf8");
    await reviewTaskOutcome(
      ctx,
      reader(() => ({ ...detail, ref: "new-ref", resourceVersion: 9,
        history: [
          { eventId: 40, timestamp: 400, eventType: "project.task.reconcile.skipped" },
          { eventId: 41, timestamp: 400, eventType: "project.task.reconcile.profiled" },
        ],
      })),
      root,
    );
    expect(calls).toBe(1);
    expect(readFileSync(join(root, report), "utf8")).toBe(original);
  });

  test("replays an authentic legacy report without changing its marker or publication event", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-legacy-replay-"));
    const command = reader();
    const subject = await readSubjectTask({ appId, taskId }, command);
    expect(subject.disposition).toBe("eligible");
    const paths = taskReportPaths(appId, taskId, subject.evidenceHash!);
    const payload = {
      version: 1,
      rubricVersion: TASK_OUTCOME_RUBRIC_VERSION,
      sourceRevision: "legacy-source",
      createdAt: Date.UTC(2026, 8, 20),
      disposition: judgment.disposition,
      subject: { appId, taskId, evidenceHash: subject.evidenceHash },
      evidence: subject.task,
      evaluator: { executionId: "s_legacy", cost: "unknown" },
      judgment,
    };
    writeImmutable(
      resolveTaskReportPath(root, paths.jsonPath),
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    writeImmutable(
      resolveTaskReportPath(root, paths.markdownPath),
      renderTaskReportMarkdown(payload)!,
    );
    markTaskReportPublished(root, {
      appId,
      taskId,
      evidenceHash: subject.evidenceHash!,
      executionId: "s_legacy",
      jsonPath: paths.jsonPath,
      markdownPath: paths.markdownPath,
      jsonSha256: hashReport(resolveTaskReportPath(root, paths.jsonPath)),
      markdownSha256: hashReport(
        resolveTaskReportPath(root, paths.markdownPath),
      ),
    });
    const markerPath = resolveTaskReportPath(root, paths.publicationPath);
    const markerBefore = readFileSync(markerPath, "utf8");
    let modelCalls = 0;
    let event: Record<string, unknown> | undefined;
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      reconciliation: reconciliation(),
      callAgent: async () => {
        modelCalls += 1;
        throw new Error("legacy replay must not call the model");
      },
      emit: async (value) => {
        event = value as unknown as Record<string, unknown>;
      },
    });

    const result = await reviewTaskOutcome(ctx, command, root);

    expect(modelCalls).toBe(0);
    expect(readFileSync(markerPath, "utf8")).toBe(markerBefore);
    expect(event?.data).toEqual({
      appId,
      taskId,
      evidenceHash: subject.evidenceHash,
      executionId: "s_legacy",
      report: paths.markdownPath,
      facts: paths.jsonPath,
      jsonHash: hashReport(resolveTaskReportPath(root, paths.jsonPath)),
      markdownHash: hashReport(resolveTaskReportPath(root, paths.markdownPath)),
    });
    expect(factsOf(result)).toContain("configured-model:unknown:not-recorded");
    expect(factsOf(result)).toContain("observed-model:unknown:not-recorded");
  });

  test("keeps a failed reviewer execution unfinished and defers retry to the existing allowance boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-execution-failure-"));
    let calls = 0;
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      callAgent: async () => {
        calls += 1;
        return {
          id: "s_empty_turn",
          kind: "agent",
          status: "error",
          summary: "provider returned no assistant output",
        };
      },
    });

    const failed = await reviewTaskOutcome(ctx, reader(), root);
    expect(failed.status).toBe("done");
    expect(failed.output).toMatchObject({ state: "incomplete", report: true });
    expect(failed.summary).toContain("remains unfinished");
    expect(factsOf(failed)).toContain("review-disposition:evaluator-failed");
    expect(factsOf(failed)).toContain("execution:s_empty_turn");
    expect(admitTaskReconcileResult(failed.output)).toMatchObject({
      ok: true,
      result: { state: "incomplete", report: true },
    });

    const deferred = await reviewTaskOutcome(ctx, reader(), root);
    expect(deferred.status).toBe("done");
    expect(deferred.output).toMatchObject({
      state: "waiting",
      result: { disposition: "budget-deferred" },
    });
    expect(calls).toBe(1);
    expect(listTaskReports(root)).toEqual([]);
  });

  test("passes consumed artifact bytes and gaps to the evaluator and preserves them in the immutable report", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-artifact-"));
    const store = new EvidenceStore(join(root, "evidence"));
    const ref = await store.put(
      "Tests: seven passed; activation not checked",
      "md",
    );
    const missing = { path: join(root, "missing.md"), sha256: "a".repeat(64) };
    let prompt = "";
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      callAgent: async (_agent, value) => {
        prompt = String(value);
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "done",
          output: { ...judgment, disposition: "insufficient-evidence" },
        };
      },
    });
    const command = reader(
      () =>
        ({
          ...detail,
          result: { verification: ref, required: missing },
        }) as typeof detail,
    );
    const result = await reviewTaskOutcome(ctx, command, root);
    expect(prompt).toContain("Tests: seven passed; activation not checked");
    expect(prompt).toContain('"status":"missing"');
    expect(prompt).toContain("Artifact existence is not read-back");
    const path = factsOf(result)
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    const payload = JSON.parse(readFileSync(join(root, path), "utf8"));
    expect(
      payload.evidence.readBack.artifacts.map((item: any) => item.status),
    ).toEqual(["read", "missing"]);
    expect(payload.disposition).toBe("insufficient-evidence");
  });

  test("artifact change during judgment retains a stale snapshot report without certifying current evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-artifact-stale-"));
    const ref = await new EvidenceStore(root).put("original", "md");
    let emits = 0;
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      callAgent: async () => {
        writeFileSync(ref.path, "replaced");
        return {
          id: "s_judge",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
      emit: async () => {
        emits++;
      },
    });
    const result = await reviewTaskOutcome(
      ctx,
      reader(() => ({ ...detail, result: { evidence: ref } }) as typeof detail),
      root,
    );
    expect(result.summary).toContain("judgment of the inspected snapshot");
    expect(factsOf(result)).toContain("snapshot-freshness:stale");
    expect(emits).toBe(1);
    expect(listTaskReports(root)).toMatchObject([
      { evidenceHash: expect.any(String), freshness: { status: "stale" } },
    ]);
  });

  test("keeps a failed publication undiscoverable and publishes the staged retry without another model call", async () => {
    const reportRoot = mkdtempSync(join(tmpdir(), "task-review-publish-"));
    const workspaceRoot = mkdtempSync(join(tmpdir(), "task-review-workspace-"));
    let emitAttempts = 0;
    let modelCalls = 0;
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      reconciliation: reconciliation(),
      workspace: {
        root: workspaceRoot,
        appRoot: workspaceRoot,
        projectRoot: workspaceRoot,
        output: workspaceRoot,
      },
      callAgent: async () => {
        modelCalls += 1;
        return {
          id: "s_retry",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
      emit: async () => {
        emitAttempts += 1;
        if (emitAttempts === 1) throw new Error("publication unavailable");
      },
    });

    await expect(reviewTaskOutcome(ctx, reader(), reportRoot)).rejects.toThrow(
      "publication unavailable",
    );
    expect(listTaskReports(reportRoot)).toEqual([]);
    expect(listTaskReports(workspaceRoot)).toEqual([]);

    const retry = await reviewTaskOutcome(ctx, reader(), reportRoot);
    expect(retry.status).toBe("done");
    expect(modelCalls).toBe(1);
    expect(emitAttempts).toBe(2);
    expect(listTaskReports(reportRoot)).toHaveLength(1);
    expect(listTaskReports(workspaceRoot)).toEqual([]);
  });

  test("publishes the inspected judgment with snapshot identity separate from current freshness", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-stale-"));
    const events: unknown[] = [];
    let current = detail;
    const ctx = createTestAppWorkflowContext({
      input: { appId, taskId },
      reconciliation: reconciliation(),
      workspace: { root, appRoot: root, projectRoot: root, output: root },
      callAgent: async () => {
        current = {
          ...detail,
          resourceVersion: 3,
          facts: [...detail.facts, "commit:def"],
        };
        return {
          id: "s_stale",
          kind: "agent",
          status: "done",
          summary: "done",
          output: judgment,
        };
      },
      emit: async (event) => {
        events.push(event);
      },
    });

    const result = await reviewTaskOutcome(
      ctx,
      reader(() => current),
      root,
    );
    expect(result.summary).toContain("judgment of the inspected snapshot");
    expect(factsOf(result)).toContain("review-disposition:assessed");
    expect(factsOf(result)).toContain("snapshot-freshness:stale");
    expect(events).toHaveLength(1);
    const reportPath = factsOf(result)
      .find((fact) => fact.startsWith("report-facts:"))!
      .slice(13);
    const report = JSON.parse(readFileSync(join(root, reportPath), "utf8"));
    expect(report).toMatchObject({
      snapshot: {
        generation: 1,
        evidenceHash: report.subject.evidenceHash,
      },
      freshness: {
        status: "stale",
        currentEvidenceHash: expect.not.stringMatching(
          new RegExp(`^${report.subject.evidenceHash}$`),
        ),
      },
      evidence: { detail: { resourceVersion: 2, facts: ["commit:abc"] } },
    });
  });

  test("rejects a drifted pinned subject before model judgment or publication", async () => {
    let calls = 0;
    const ctx = createTestAppWorkflowContext({
      input: {
        appId,
        taskId,
        subjectGeneration: 2,
        evidenceHash: "f".repeat(64),
      },
      callAgent: async () => {
        calls += 1;
        throw new Error("must not call");
      },
    });
    const result = await reviewTaskOutcome(ctx, reader());
    expect(result.summary).toContain("pinned post-adoption identity");
    expect(factsOf(result)).toContain("expected-generation:2");
    expect(factsOf(result)).toContain("actual-generation:1");
    expect(calls).toBe(0);
  });

  test("keeps semantic allowance independent from selector cadence", () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-independent-budget-"));
    const now = 1_789_824_000_000;
    const allowance = claimSemanticAllowance(
      root,
      "subject",
      {
        EVALUATION_AUTO_REVIEW_INTERVAL_MS: "3600000",
        EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS: "86400000",
        EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL: "2",
      },
      now,
    );
    expect(allowance).toMatchObject({ allowed: true, limit: 2 });
    expect(allowance.nextEligibleAt - allowance.slot * 86_400_000).toBe(
      86_400_000,
    );
  });

  test("keeps Sol and DeepSeek allowance counters independent", () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-reviewer-budgets-"));
    const now = 1_789_824_000_000;
    const sol = reviewerProfile("evaluator");
    const deepseek = reviewerProfile("evaluator-deepseek");

    expect(
      claimSemanticAllowance(root, "sol", {}, now, sol).allowed,
    ).toBeTrue();
    expect(
      claimSemanticAllowance(root, "sol-2", {}, now, sol).allowed,
    ).toBeFalse();
    expect(
      claimSemanticAllowance(root, "deepseek", {}, now, deepseek),
    ).toMatchObject({ allowed: true, limit: 1 });
    expect(deepseek.configuredModel).toBe("deepseek-v4-flash");
    expect(sol.configuredModel).toBe("gpt-5.6-sol");
  });

  test("returns the same exact deadline for repeated same-subject reviews and becomes eligible after it", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-budget-wait-"));
    const now = 1_789_824_000_000;
    setSystemTime(new Date(now));
    try {
      const occupied = claimSemanticAllowance(
        root,
        "another-subject",
        process.env,
        now,
      );
      expect(occupied.allowed).toBeTrue();
      let modelCalls = 0;
      const context = () =>
        createTestAppWorkflowContext({
          input: { appId, taskId },
          reconciliation: reconciliation(),
          callAgent: async () => {
            modelCalls += 1;
            return {
              id: "s_after_budget",
              kind: "agent",
              status: "done",
              summary: "done",
              output: judgment,
            };
          },
        });

      const first = await reviewTaskOutcome(context(), reader(), root);
      const early = await reviewTaskOutcome(context(), reader(), root);
      for (const deferred of [first, early]) {
        expect(deferred.status).toBe("done");
        expect(deferred.output).toMatchObject({
          state: "waiting",
          result: {
            disposition: "budget-deferred",
            subject: { appId, taskId, generation: 1 },
            allowance: {
              slot: occupied.slot,
              limit: occupied.limit,
              nextEligibleAt: occupied.nextEligibleAt,
            },
          },
          reviewAt: occupied.nextEligibleAt,
        });
      }
      expect(modelCalls).toBe(0);

      setSystemTime(new Date(occupied.nextEligibleAt + 1));
      const eligible = await reviewTaskOutcome(context(), reader(), root);
      expect(eligible.output).toMatchObject({ state: "converged" });
      expect(modelCalls).toBe(1);
    } finally {
      setSystemTime();
    }
  });

  test("routes an admitted self-review through deterministic exclusion with zero evaluator calls", async () => {
    const attachment = taskForInput({
      id: "self-review",
      source: { kind: "system", id: "test" },
      input: {
        kind: "review-task-outcome",
        data: { appId: "evaluation", taskId: "runtime/owner-review" },
      },
    });
    expect(attachment).toMatchObject({
      kind: "desired",
      intent: { workflow: "task-outcome-review" },
    });
    let calls = 0;
    const result = await reviewTaskOutcome(
      createTestAppWorkflowContext({
        input: { appId: "evaluation", taskId: "runtime/owner-review" },
        callAgent: async () => {
          calls += 1;
          throw new Error("must not call");
        },
      }),
      reader(),
    );
    expect(result.summary).toContain("excluded");
    expect(calls).toBe(0);
  });

  test("excludes an externally owned Task assigned to an Evaluation worker before a model call", async () => {
    let calls = 0;
    const base = reader();
    const command: PublicCommand = async (request) => {
      const response = await base(request);
      if (request.type !== "app.task.get") return response;
      return {
        ...response,
        task: {
          ...appTask,
          creator: { appId: "external-owner" },
          agent: "evaluator-deepseek",
        },
      };
    };
    const result = await reviewTaskOutcome(
      createTestAppWorkflowContext({
        input: { appId, taskId },
        callAgent: async () => {
          calls += 1;
          throw new Error("must not call");
        },
      }),
      command,
    );
    expect(result.summary).toContain("Evaluation worker execution");
    expect(factsOf(result)).toContain(
      "review-disposition:insufficient-evidence",
    );
    expect(calls).toBe(0);
  });

  test("returns an automatic acquisition failure through the existing owner-review route", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-review-acquisition-"));
    const emitted: Record<string, unknown>[] = [];
    let modelCalls = 0;
    const result = await reviewTaskOutcome(
      createTestAppWorkflowContext({
        input: { appId, taskId, automatic: true },
        reconciliation: reconciliation(),
        emit: async (value) => {
          emitted.push(value as Record<string, unknown>);
        },
        callAgent: async () => {
          modelCalls += 1;
          throw new Error("must not call");
        },
      }),
      async (command) => {
        if (command.type === "apps.list")
          throw new Error("catalog temporarily unavailable");
        return reader()(command);
      },
      root,
    );

    expect(admitTaskReconcileResult(result.output).ok).toBeTrue();
    expect(modelCalls).toBe(0);
    expect(listTaskReports(root)).toEqual([]);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "evaluation.review_failed",
      data: {
        reason: "automatic-evidence-acquisition-failed",
        stage: "subject-evidence-acquisition",
        appId,
        taskId,
        error: "catalog temporarily unavailable",
      },
      target: { appId: "alex", project: "alex" },
    });

    const ownerInput = taskInputForEvent(
      emitted[0] as Parameters<typeof taskInputForEvent>[0],
    );
    expect(ownerInput).toMatchObject({
      kind: "message",
      data: {
        context: {
          reviewFailure: {
            reason: "automatic-evidence-acquisition-failed",
            error: "catalog temporarily unavailable",
          },
        },
      },
    });
    expect(taskForInput({ id: "review-failure", input: ownerInput! } as never).intent).toMatchObject({
      parentId: "root",
      agent: "alex",
      input: ownerInput,
    });
  });

  test("keeps explicit and legitimate neutral evidence failures off the automatic owner route", async () => {
    for (const input of [
      { appId, taskId },
      { appId: "evaluation", taskId, automatic: true as const },
    ]) {
      const emitted: Record<string, unknown>[] = [];
      let calls = 0;
      const result = await reviewTaskOutcome(
        createTestAppWorkflowContext({
          input,
          emit: async (value) => emitted.push(value as Record<string, unknown>),
          callAgent: async () => {
            calls += 1;
            throw new Error("must not call");
          },
        }),
        input.appId === "evaluation"
          ? reader()
          : async () => {
              throw new Error("catalog temporarily unavailable");
            },
      );
      expect(factsOf(result)).toContain(
        input.appId === "evaluation"
          ? "review-disposition:excluded"
          : "review-disposition:insufficient-evidence",
      );
      expect(calls).toBe(0);
      expect(emitted).toEqual([]);
    }
  });

  test("exclusion and evidence failures do not call the evaluator", async () => {
    for (const targetAppId of ["evaluation", "missing"]) {
      let calls = 0;
      const ctx = createTestAppWorkflowContext({
        input: { appId: targetAppId, taskId },
        callAgent: async () => {
          calls += 1;
          throw new Error("must not call");
        },
      });
      const command =
        targetAppId === "missing" ? fixtureMissingCatalog() : reader();
      const result = await reviewTaskOutcome(ctx, command);
      expect(factsOf(result)).toEqual([
        expect.stringMatching(
          /^review-disposition:(excluded|insufficient-evidence)$/,
        ),
        `subject:${targetAppId}/${taskId}`,
      ]);
      expect(calls).toBe(0);
    }
  });
});

function fixtureMissingCatalog(): PublicCommand {
  return async (command) =>
    command.type === "apps.list"
      ? { type: "ok", command: "apps.list", apps: [] }
      : reader()(command);
}
