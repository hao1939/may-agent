import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { taskForEvaluationInput, taskInputForEvent } from "../../../app.js";
import { selectFairCandidate } from "./task-outcome-selector.js";
import { reviewTaskOutcome } from "./task-outcome-review.js";
import {
  readSubjectTask,
  type PublicCommand,
} from "./lib/public-task-evidence.js";
import { intakeEvaluationReport } from "../../../../may.app/agents/may/workflows/evaluation-report-intake.js";

test("recovered work reaches population review, preserves its cut through admission/reuse, and passes May intake", async () => {
  const end = Date.UTC(2026, 8, 26, 12);
  const root = mkdtempSync(join(tmpdir(), "systemic-review-"));
  const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const workspace = { root, appRoot, projectRoot: appRoot, output: root };
  const example = {
    appId: "sample",
    taskId: "chat",
    attemptId: "failed",
    generation: 1,
  };
  const current = {
    start: end - 86_400_000,
    end,
    totals: {
      terminal: 10,
      failed: 3,
      interrupted: 0,
      failurePercent: 30,
      failedWallMs: 1000,
    },
    examples: [example],
    byHandler: [],
  };
  const previous = {
    ...current,
    start: end - 2 * 86_400_000,
    end: end - 86_400_000,
    totals: {
      terminal: 10,
      failed: 1,
      interrupted: 0,
      failurePercent: 10,
      failedWallMs: 500,
    },
  };
  const seenCuts: number[] = [];
  const command: PublicCommand = async (cmd) => {
    if (cmd.type === "apps.list")
      return {
        command: cmd.type,
        apps: [{ id: "sample" }, { id: "evaluation" }],
      };
    if (cmd.type === "task.attempts.read") {
      seenCuts.push(Number(cmd.end));
      return {
        version: 1,
        available: true,
        appId: "sample",
        taskId: cmd.taskId ?? null,
        end: cmd.end,
        windowMs: 86_400_000,
        previous,
        current,
      };
    }
    if (cmd.type === "tasks.list")
      return {
        command: cmd.type,
        tasks: {
          items: cmd.status
            ? []
            : [{ ...example, status: "up-to-date", updatedAt: end }],
        },
      };
    if (cmd.type === "app.task.get")
      return {
        command: cmd.type,
        appId: "sample",
        taskId: "chat",
        task: {
          id: "chat",
          generation: 1,
          status: "done",
          outcome: "Answer input",
          creator: { appId: "sample" },
          facts: ["Latest input recovered"],
        },
      };
    if (cmd.type === "task.get")
      return {
        command: cmd.type,
        task: {
          appId: "sample",
          taskId: "chat",
          generation: 1,
          status: "up-to-date",
          history: [],
          acceptedEvidence: { page: { items: [] } },
        },
      };
    throw new Error(`Unexpected ${cmd.type}`);
  };
  const config = {
    enabled: true,
    reviewer: "evaluator-deepseek" as const,
    intervalMs: 300000,
    maxApps: 10,
    maxTasksPerApp: 2,
    maxPagesPerApp: 2,
    recentWindowMs: 604800000,
  };
  try {
    const selection = await selectFairCandidate(
      command,
      config,
      root,
      undefined,
      end + 1000,
    );
    expect(selection.candidate).toEqual({
      appId: "sample",
      taskId: "chat",
      assessmentPurpose: "ongoing",
      populationEnd: end,
    });
    const ordinary = await selectFairCandidate(
      command,
      config,
      root,
      selection.state,
      end + 3_601_000,
    );
    expect(ordinary.candidate).toEqual({ appId: "sample", taskId: "chat" });
    const input = taskInputForEvent({
      type: "evaluation.task.review.requested",
      data: { ...selection.candidate, reviewer: "evaluator-deepseek" },
    } as any)!;
    const task = taskForEvaluationInput({
      id: "request",
      source: { kind: "system", id: "test" },
      input,
    } as any)!;
    expect(JSON.stringify(task)).toContain(`"populationEnd":${end}`);
    // Exercise the actual admitted input, not a separately constructed shortcut.
    const admitted = (task as any).intent.input;
    expect(admitted.populationEnd).toBe(end);
    let calls = 0;
    const publications: any[] = [];
    const ctx = createTestAppWorkflowContext({
      input: admitted,
      workspace,
      callAgent: async (_agent, prompt) => {
        calls++;
        expect(String(prompt)).toContain("Assess this exact Task AND");
        expect(String(prompt)).toContain(
          "| current | App | 10 | 3 | 0 | 30 | 1000 |",
        );
        return {
          id: "s_reviewer",
          kind: "agent",
          status: "done",
          summary: "reviewed",
          output: {
            disposition: "assessed",
            summary:
              "Current input recovered; repeated App failures merit investigation.",
            responsibility: "May judges value and cause",
            findings: ["Population has three failures; cause unassessed"],
            verification: ["Current Task and fixed population read"],
            delivery: "Report returned",
          },
        };
      },
    });
    ctx.events.emit = async (event) => {
      publications.push(event);
      return { id: publications.length } as any;
    };
    await reviewTaskOutcome(ctx, command, root);
    await reviewTaskOutcome(ctx, command, root);
    expect(calls).toBe(1);
    const publication = publications.find(
      (e) => e.type === "evaluation.task_report_published",
    )!.data;
    expect(publication.rubricVersion).toBe("task-obligation-v2");
    const report = JSON.parse(
      readFileSync(join(root, publication.facts), "utf8"),
    );
    expect(report.evidence.population.end).toBe(end);
    expect(report.freshness.status).toBe("current");
    const intake = await intakeEvaluationReport(
      createTestAppWorkflowContext({ input: publication, workspace }),
      root,
      (subject) => readSubjectTask(subject, command),
    );
    expect(JSON.stringify(intake)).toContain('"disposition":"investigate"');
    expect(JSON.stringify(intake)).not.toContain('"disposition":"stale"');
    expect(seenCuts.every((cut) => cut === end)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
