import { describe, expect, test } from "bun:test";
import {
  createTestAppRead,
  createTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviewTaskOutcome } from "./task-outcome-review.ts";
import type { PublicCommand } from "./lib/public-task-evidence.ts";

const appId = "sample";
const taskId = "goal/one";
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
  diagnostics: { owner: appId, attemptCount: 1 },
};

function reader(currentDetail = () => detail): PublicCommand {
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
        task: appTask,
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

    const result = await reviewTaskOutcome(ctx, reader());
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
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "evaluation.task_report_published",
      localKey: `task-report-${evidenceHash.slice(0, 16)}`,
      data: { appId, taskId, evidenceHash },
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

    const first = await reviewTaskOutcome(ctx, reader());
    accepted = { id: "review/sample-goal-one", result: first.output };
    const second = await reviewTaskOutcome(ctx, reader());

    expect(modelCalls).toBe(1);
    expect(second.summary).toBe(
      "Reused accepted evaluation for unchanged sample/goal/one.",
    );
    expect(factsOf(second)).toEqual(factsOf(first));
  });

  test("does not publish a report when evidence changes during model judgment", async () => {
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
    );
    expect(result.summary).toContain("changed while it was being evaluated");
    expect(factsOf(result)).toContain(
      "review-disposition:insufficient-evidence",
    );
    expect(events).toHaveLength(0);
    expect(existsSync(join(root, "reports", "task-outcomes"))).toBeFalse();
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
